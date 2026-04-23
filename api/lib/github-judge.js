/**
 * Shared GitHub Content API helpers for per-judge JSON + CSV under data/judges/<slug>.*
 * CSV matches the app’s “Download CSV for Excel” columns (opens in Microsoft Excel from Git).
 */

function authHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "competition-judging-api",
  };
}

function contentsUrl(owner, repo, filePath) {
  const enc = filePath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("%2F");
  return `https://api.github.com/repos/${owner}/${repo}/contents/${enc}`;
}

function getJudgeDataDir() {
  return (process.env.JUDGE_DATA_DIR || "data/judges").replace(/\\/g, "/").replace(/\/$/, "");
}

/** Same rules as the browser meta text — kebab slug from display name. */
function judgeSlug(name) {
  const s = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "judge";
}

function getSubmitFilePath(judgeName) {
  return `${getJudgeDataDir()}/${judgeSlug(judgeName)}.json`;
}

function getCsvFilePath(judgeName) {
  return `${getJudgeDataDir()}/${judgeSlug(judgeName)}.csv`;
}

/** Must match app.js export column order and criterion ids. */
const CRITERIA_CSV = [
  { id: "bi", header: "Business Impact (0-10)" },
  { id: "fs", header: "Feasibility & Scalability (0-10)" },
  { id: "ai", header: "AI Depth (0-10)" },
  { id: "in", header: "Innovation (0-10)" },
  { id: "cs", header: "Cross-System (0-10)" },
];

const AWARD_TITLES = {
  none: "No award nomination",
  best_overall: "Best Overall",
  best_genai: "Best Use of GenAI",
  ai_for_good: "AI for Good",
  human_ai: "Human + AI",
  disruptor: "Disruptor",
  user_delight: "User Delight",
  best_prototype: "Best Prototype",
  judges_choice: "Judges' Choice",
};

function humanizeAward(id) {
  if (id == null) return "—";
  return AWARD_TITLES[id] || String(id);
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {object[]} merged
 * @returns {string} UTF-8 with BOM for Excel
 */
function submissionsToCsv(merged) {
  const list = Array.isArray(merged) ? [...merged] : [];
  list.sort((a, b) => {
    const ta = new Date(a && a.submittedAt).getTime();
    const tb = new Date(b && b.submittedAt).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
  const critHeaders = CRITERIA_CSV.map((c) => c.header);
  const header = [
    "submitted",
    "judge",
    "team",
    "total",
    "grade",
    "award",
    "overallFeedback",
    ...critHeaders,
  ];
  const lines = [header.map(escapeCsv).join(",")];
  for (const s of list) {
    if (!s) continue;
    const feedback = String(
      s.standoutMoment ?? s.overallFeedback ?? "",
    ).trim();
    const row = [
      s.submittedAt || "",
      s.judge || "",
      s.team || "",
      s.total != null ? Number(s.total).toFixed(1) : "",
      s.grade != null ? String(s.grade) : "",
      humanizeAward(s.award),
      feedback,
    ];
    for (const c of CRITERIA_CSV) {
      const v = s.scores && s.scores[c.id];
      row.push(v == null || v === "" ? "" : String(v));
    }
    lines.push(row.map(escapeCsv).join(","));
  }
  return "\uFEFF" + lines.join("\r\n");
}

async function githubGetJson(url, token) {
  const r = await fetch(url, { headers: authHeaders(token) });
  if (r.status === 404) return { status: 404, data: null, text: "" };
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub GET ${r.status}: ${text.slice(0, 400)}`);
  return { status: 200, data: JSON.parse(text) };
}

async function githubPut(url, token, body) {
  const r = await fetch(url, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`GitHub PUT ${r.status}: ${text.slice(0, 400)}`);
    err.status = r.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function decodeFileContent(f) {
  if (!f || f.encoding !== "base64" || !f.content) return null;
  return Buffer.from(f.content.replace(/\n/g, ""), "base64").toString("utf8");
}

function parseSubmissionsFile(raw) {
  if (!raw || !raw.trim()) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("submissions file must be a JSON array");
  return parsed;
}

function mergeSubmission(list, incoming) {
  if (!incoming || !incoming.judge || !incoming.team) return list;
  const key =
    typeof incoming.judgeTeamKey === "string"
      ? String(incoming.judgeTeamKey).toLowerCase()
      : `${String(incoming.judge).trim()}__${String(incoming.team).trim()}`.toLowerCase();
  const next = { ...incoming, judgeTeamKey: key };
  const i = list.findIndex(
    (s) => s && String(s.judgeTeamKey || "").toLowerCase() === key,
  );
  if (i >= 0) {
    const o = [...list];
    o[i] = next;
    return o;
  }
  return [next, ...list];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Add/update one row in a judge’s JSON file.
 */
async function appendWithRetry({ owner, repo, branch, token, filePath }, incoming) {
  const base = contentsUrl(owner, repo, filePath);
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const refUrl = `${base}?ref=${encodeURIComponent(branch)}`;
      const g = await githubGetJson(refUrl, token);
      let list;
      let existingSha;
      if (g.status === 404) {
        list = [];
        existingSha = null;
      } else {
        const raw = decodeFileContent(g.data);
        if (raw) list = parseSubmissionsFile(raw);
        else list = [];
        existingSha = g.data && g.data.sha;
      }
      const merged = mergeSubmission(list, incoming);
      const content = Buffer.from(JSON.stringify(merged, null, 2), "utf8").toString("base64");
      const putBody = {
        message: `chore: update judge data ${judgeSlug(incoming.judge)} [skip deploy]`,
        content,
        branch,
      };
      if (existingSha) putBody.sha = existingSha;
      await githubPut(base, token, putBody);
      return { count: merged.length, path: filePath, merged };
    } catch (e) {
      lastErr = e;
      if (e && (e.status === 409 || e.message?.includes("409")) && attempt < 4) {
        await sleep(250 + attempt * 200);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * Replace whole file with a JSON array (e.g. [] to reset a judge in Git).
 */
async function putArrayWithRetry(
  { owner, repo, branch, token, filePath },
  array,
  message,
) {
  if (!Array.isArray(array)) throw new Error("putArrayWithRetry: expected array");
  const base = contentsUrl(owner, repo, filePath);
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const refUrl = `${base}?ref=${encodeURIComponent(branch)}`;
      const g = await githubGetJson(refUrl, token);
      let existingSha;
      if (g.status === 404) {
        existingSha = null;
      } else {
        existingSha = g.data && g.data.sha;
      }
      const content = Buffer.from(JSON.stringify(array, null, 2), "utf8").toString("base64");
      const putBody = {
        message: message || `chore: reset judge file [skip deploy]`,
        content,
        branch,
      };
      if (existingSha) putBody.sha = existingSha;
      await githubPut(base, token, putBody);
      return { path: filePath };
    } catch (e) {
      lastErr = e;
      if (e && (e.status === 409 || e.message?.includes("409")) && attempt < 4) {
        await sleep(250 + attempt * 200);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * Write raw text (e.g. CSV) to a path, with 409 retry.
 */
async function putTextFileWithRetry(
  { owner, repo, branch, token, filePath },
  text,
  message,
) {
  const base = contentsUrl(owner, repo, filePath);
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const refUrl = `${base}?ref=${encodeURIComponent(branch)}`;
      const g = await githubGetJson(refUrl, token);
      let existingSha;
      if (g.status === 404) {
        existingSha = null;
      } else {
        existingSha = g.data && g.data.sha;
      }
      const content = Buffer.from(text, "utf8").toString("base64");
      const putBody = {
        message: message || `chore: update file [skip deploy]`,
        content,
        branch,
      };
      if (existingSha) putBody.sha = existingSha;
      await githubPut(base, token, putBody);
      return { path: filePath };
    } catch (e) {
      lastErr = e;
      if (e && (e.status === 409 || e.message?.includes("409")) && attempt < 4) {
        await sleep(250 + attempt * 200);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/**
 * After JSON is saved, write the same data as Excel-friendly CSV.
 */
async function writeJudgeCsvMirror(ctx, judgeName, mergedArray) {
  const csvPath = getCsvFilePath(judgeName);
  const csv = submissionsToCsv(mergedArray);
  const slug = judgeSlug(judgeName);
  return putTextFileWithRetry(
    { ...ctx, filePath: csvPath },
    csv,
    `chore: update judge CSV ${slug} [skip deploy]`,
  );
}

/**
 * On reset: empty JSON is already written; mirror empty table as header-only CSV.
 */
async function writeEmptyJudgeCsv(ctx, judgeName) {
  return writeJudgeCsvMirror(ctx, judgeName, []);
}

module.exports = {
  getSubmitFilePath,
  getCsvFilePath,
  judgeSlug,
  appendWithRetry,
  putArrayWithRetry,
  putTextFileWithRetry,
  submissionsToCsv,
  writeJudgeCsvMirror,
  writeEmptyJudgeCsv,
};
