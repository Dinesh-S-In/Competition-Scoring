/**
 * Appends or updates one submission in data/submissions.json in the connected GitHub repo.
 * Vercel env: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, optional GITHUB_BRANCH (default main).
 * Optional: SUBMISSIONS_FILE_PATH (default data/submissions.json), INGEST_SECRET.
 * Commit message includes [skip deploy] for Ignored Build Step in Vercel (see README).
 */

const FILE_PATH = process.env.SUBMISSIONS_FILE_PATH || "data/submissions.json";

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

async function appendWithRetry(
  { owner, repo, branch, token, filePath },
  incoming,
) {
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
        message: `chore: record judge submission [skip deploy]`,
        content,
        branch,
      };
      if (existingSha) putBody.sha = existingSha;
      await githubPut(base, token, putBody);
      return { count: merged.length };
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

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-ingest-key");
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  const secret = process.env.INGEST_SECRET;
  if (secret) {
    const k = req.headers["x-ingest-key"] || req.headers["X-Ingest-Key"];
    if (k !== secret) {
      return sendJson(res, 401, { ok: false, error: "Unauthorized" });
    }
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return sendJson(res, 200, {
      ok: true,
      git: false,
      message: "Server not configured for GitHub. Submission is stored in the browser only.",
    });
  }

  let body = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString() || "{}");
    } catch {
      body = {};
    }
  } else if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  } else if (!body || typeof body !== "object") {
    body = {};
  }

  if (!body || !body.judge || !body.team) {
    return sendJson(res, 400, { ok: false, error: "Missing judge or team" });
  }

  try {
    const result = await appendWithRetry(
      { owner, repo, branch, token, filePath: FILE_PATH },
      body,
    );
    return sendJson(res, 200, {
      ok: true,
      git: true,
      message: "Saved to repository.",
      inRepo: result,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return sendJson(res, 500, {
      ok: false,
      git: false,
      error: e && e.message ? e.message : String(e),
    });
  }
};
