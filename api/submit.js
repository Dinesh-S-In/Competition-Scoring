/**
 * Appends/updates: Git (data/judges/*.json + *.csv) and/or PostgreSQL (Neon).
 * Env: GITHUB_*, JUDGE_DATA_DIR, INGEST_SECRET, DATABASE_URL (Neon)
 */

const {
  getSubmitFilePath,
  getCsvFilePath,
  appendWithRetry,
  writeJudgeCsvMirror,
} = require("./lib/github-judge");

const { upsertSubmission: upsertSubmissionDb } = require("./lib/dbInsert");

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

  const body = parseBody(req);
  if (!body || !body.judge || !body.team) {
    return sendJson(res, 400, { ok: false, error: "Missing judge or team" });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const haveGit = Boolean(token && owner && repo);
  const haveDb = Boolean(process.env.DATABASE_URL);

  if (!haveGit && !haveDb) {
    return sendJson(res, 200, {
      ok: true,
      git: false,
      db: { ok: false, skip: true },
      message:
        "No server storage configured. Add GITHUB_TOKEN + GITHUB_OWNER + GITHUB_REPO and/or DATABASE_URL (see README). Data stays in the browser only.",
    });
  }

  const filePath = getSubmitFilePath(body.judge);
  const csvPath = getCsvFilePath(body.judge);
  const ctx = { owner, repo, branch, token };

  let git = { ok: false, paths: { json: filePath, csv: csvPath } };
  if (haveGit) {
    try {
      const result = await appendWithRetry({ ...ctx, filePath }, body);
      git = {
        ...git,
        ok: true,
        inRepo: result,
        path: filePath,
        csvPath,
      };
      let csvOk = true;
      let csvError;
      try {
        await writeJudgeCsvMirror(ctx, body.judge, result.merged);
      } catch (e2) {
        csvOk = false;
        csvError = e2 && e2.message ? e2.message : String(e2);
        // eslint-disable-next-line no-console
        console.error("CSV mirror to Git failed:", e2);
      }
      Object.assign(git, { csvOk, csvError: csvError || undefined });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Git update failed:", e);
      Object.assign(git, {
        error: e && e.message ? e.message : String(e),
      });
    }
  } else {
    Object.assign(git, { skipped: "GitHub not configured" });
  }

  let db = { ok: true, skip: !process.env.DATABASE_URL };
  if (process.env.DATABASE_URL) {
    try {
      const r = await upsertSubmissionDb(body);
      if (r.skip) {
        db = { ok: true, skip: true };
      } else if (r.ok) {
        db = { ok: true, skip: false };
      } else {
        db = { ok: false, error: r.error, skip: false };
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("DB upsert failed:", e);
      db = {
        ok: false,
        skip: false,
        error: e && e.message ? e.message : String(e),
      };
    }
  } else {
    Object.assign(db, { skipped: "DATABASE_URL not set" });
  }

  return sendJson(res, 200, {
    ok: true,
    git: Boolean(git.ok),
    gitError: git.error,
    inRepo: git.inRepo,
    path: filePath,
    csvPath: haveGit ? csvPath : undefined,
    csvOk: git.csvOk,
    csvError: git.csvError,
    db: process.env.DATABASE_URL
      ? {
          ok: Boolean(db.ok),
          error: db.error,
          skip: Boolean(db.skip),
        }
      : { ok: false, skip: true },
    message: "Processed.",
  });
};
