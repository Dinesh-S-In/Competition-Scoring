/**
 * Clears one judge’s JSON file in the repo (sets it to []).
 * POST body: { "judge": "Example SMITH" }
 * Same env as submit: GITHUB_*, JUDGE_DATA_DIR, INGEST_SECRET.
 */

const { getSubmitFilePath, putArrayWithRetry } = require("./lib/github-judge");

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

  if (!token || !owner || !repo) {
    return sendJson(res, 200, {
      ok: true,
      git: false,
      message: "Server not configured for GitHub. Cleared data in this browser only.",
    });
  }

  const body = parseBody(req);
  const judge = body && String(body.judge || "").trim();
  if (!judge) {
    return sendJson(res, 400, { ok: false, error: "Missing judge" });
  }

  const filePath = getSubmitFilePath(judge);

  try {
    await putArrayWithRetry(
      { owner, repo, branch, token, filePath },
      [],
      `chore: reset judge file ${judge} [skip deploy]`,
    );
    return sendJson(res, 200, {
      ok: true,
      git: true,
      message: "Cleared in repository.",
      path: filePath,
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
