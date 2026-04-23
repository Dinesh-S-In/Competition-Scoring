/**
 * Clears one judge’s JSON file in the repo (sets it to []).
 * POST body: { "judge": "Example SMITH" }
 * Same env as submit: GITHUB_*, JUDGE_DATA_DIR, INGEST_SECRET.
 */

const {
  getSubmitFilePath,
  getCsvFilePath,
  putArrayWithRetry,
  writeEmptyJudgeCsv,
} = require("./lib/github-judge");
const { deleteByJudgeName } = require("./lib/dbInsert");

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(payload));
}

function parseBody(req) {
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
  return body;
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

  const body = parseBody(req);
  const judge = body && String(body.judge || "").trim();
  if (!judge) {
    return sendJson(res, 400, { ok: false, error: "Missing judge" });
  }

  const haveGit = Boolean(token && owner && repo);
  const haveDb = Boolean(process.env.DATABASE_URL);

  if (!haveGit && !haveDb) {
    return sendJson(res, 200, {
      ok: true,
      git: false,
      db: { ok: false, skip: true },
      message: "No server storage. Configure GitHub and/or DATABASE_URL in Vercel to clear the repo/database.",
    });
  }

  const filePath = getSubmitFilePath(judge);
  const csvPath = getCsvFilePath(judge);
  const ctx = { owner, repo, branch, token };

  let gitCsvOk = true;
  let gitCsvError;

  if (haveGit) {
    try {
      await putArrayWithRetry(
        { ...ctx, filePath },
        [],
        `chore: reset judge file ${judge} [skip deploy]`,
      );
      try {
        await writeEmptyJudgeCsv(ctx, judge);
      } catch (e2) {
        gitCsvOk = false;
        gitCsvError = e2 && e2.message ? e2.message : String(e2);
        // eslint-disable-next-line no-console
        console.error("CSV reset in Git failed:", e2);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      return sendJson(res, 500, {
        ok: false,
        git: false,
        error: e && e.message ? e.message : String(e),
      });
    }
  }

  let db = { ok: true, skip: !process.env.DATABASE_URL };
  if (process.env.DATABASE_URL) {
    try {
      const r = await deleteByJudgeName(judge);
      if (r.skip) db = { ok: true, skip: true };
      else if (r.ok) db = { ok: true, skip: false };
      else db = { ok: false, error: r.error };
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("DB delete failed:", e);
      db = {
        ok: false,
        error: e && e.message ? e.message : String(e),
        skip: false,
      };
    }
  }

  if (haveGit) {
    return sendJson(res, 200, {
      ok: true,
      git: true,
      db: process.env.DATABASE_URL ? db : undefined,
      message: "Cleared in repository and/or database.",
      path: filePath,
      csvPath,
      csvOk: gitCsvOk,
      csvError: gitCsvError || undefined,
    });
  }

  return sendJson(res, 200, {
    ok: true,
    git: false,
    db: process.env.DATABASE_URL ? db : { ok: false, skip: true },
    message: "Database cleared (Git not configured).",
  });
};

