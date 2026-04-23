/**
 * GET (or POST) full export of submissions as CSV for Excel.
 * Secured with header: Authorization: Bearer <EXPORT_CSV_SECRET>
 * (set EXPORT_CSV_SECRET in Vercel; keep it private).
 *
 * Open in browser: not practical for Bearer — use curl or a small admin page.
 * Example: curl -H "Authorization: Bearer $SECRET" "https://yoursite.vercel.app/api/export-db-csv" -o all.csv
 */

const { getNeon } = require("./lib/dbInsert");

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function sendCsv(res, text) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="all-submissions.csv"');
  return res.end("\uFEFF" + text);
}

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.end("Unauthorized");
}

function getSecretQuery(req) {
  try {
    if (!req.url) return null;
    const u = new URL(req.url, "https://localhost");
    return u.searchParams.get("secret");
  } catch {
    return null;
  }
}

function checkAuth(req) {
  const want = process.env.EXPORT_CSV_SECRET;
  if (!want) return { ok: false, reason: "not_configured" };
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m && m[1] === want) return { ok: true };
  const q = getSecretQuery(req) || "";
  if (q && q === want) return { ok: true };
  return { ok: false, reason: "bad" };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  if (!process.env.DATABASE_URL) {
    res.statusCode = 503;
    return res.end("Database not configured (set DATABASE_URL).");
  }

  const auth = checkAuth(req);
  if (auth.reason === "not_configured") {
    res.statusCode = 503;
    return res.end("Set EXPORT_CSV_SECRET in Vercel to enable this endpoint.");
  }
  if (!auth.ok) {
    return unauthorized(res);
  }

  try {
    const sql = await getNeon();
    if (!sql) {
      res.statusCode = 503;
      return res.end("Database not available.");
    }
    const rows = await sql`
      SELECT
        id, submitted_at, judge, team, total, grade, award, standout_moment,
        score_bi, score_fs, score_ai, score_in, score_cs, updated_at
      FROM submissions
      ORDER BY submitted_at DESC
    `;
    const header = [
      "id",
      "submitted",
      "judge",
      "team",
      "total",
      "grade",
      "award",
      "standout_moment",
      "score_bi",
      "score_fs",
      "score_ai",
      "score_in",
      "score_cs",
      "updated_at",
    ];
    const lines = [header.map(escapeCsv).join(",")];
    for (const r of rows) {
      const line = [
        r.id,
        r.submitted_at,
        r.judge,
        r.team,
        r.total,
        r.grade,
        r.award,
        r.standout_moment,
        r.score_bi,
        r.score_fs,
        r.score_ai,
        r.score_in,
        r.score_cs,
        r.updated_at,
      ];
      lines.push(line.map(escapeCsv).join(","));
    }
    return sendCsv(res, lines.join("\r\n"));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    res.statusCode = 500;
    return res.end(e && e.message ? e.message : String(e));
  }
};
