/**
 * Optional PostgreSQL (Neon) — same data shape as the Git JSON export.
 * Set DATABASE_URL in Vercel; if unset, all functions no-op.
 */

async function getNeon() {
  if (!process.env.DATABASE_URL) return null;
  const { neon } = await import("@neondatabase/serverless");
  return neon(process.env.DATABASE_URL);
}

/**
 * @param {object} body - submission object from the client
 */
async function upsertSubmission(body) {
  const sql = await getNeon();
  if (!sql) return { ok: true, skip: true };

  const s = (body && body.scores) || {};
  const id = String(body.id || "");
  if (!id) return { ok: false, error: "missing id" };

  const submittedAt = body.submittedAt
    ? new Date(body.submittedAt).toISOString()
    : new Date().toISOString();
  const judge = String(body.judge || "");
  const team = String(body.team || "");
  const jtk = String(
    body.judgeTeamKey || `${judge}__${team}`.toLowerCase(),
  );
  const total = body.total != null ? Number(body.total) : null;
  const grade = body.grade != null ? String(body.grade) : null;
  const award = body.award != null ? String(body.award) : "";
  const standout = String(
    body.standoutMoment ?? body.overallFeedback ?? "",
  ).trim();
  const sc = (k) => (s[k] != null && s[k] !== "" ? Number(s[k]) : null);

  await sql`
    INSERT INTO submissions (
      id, submitted_at, judge, team, judge_team_key, total, grade, award, standout_moment,
      score_bi, score_fs, score_ai, score_in, score_cs, updated_at
    ) VALUES (
      ${id},
      ${submittedAt}::timestamptz,
      ${judge},
      ${team},
      ${jtk},
      ${total},
      ${grade},
      ${award},
      ${standout},
      ${sc("bi")},
      ${sc("fs")},
      ${sc("ai")},
      ${sc("in")},
      ${sc("cs")},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      submitted_at = EXCLUDED.submitted_at,
      total = EXCLUDED.total,
      grade = EXCLUDED.grade,
      award = EXCLUDED.award,
      standout_moment = EXCLUDED.standout_moment,
      score_bi = EXCLUDED.score_bi,
      score_fs = EXCLUDED.score_fs,
      score_ai = EXCLUDED.score_ai,
      score_in = EXCLUDED.score_in,
      score_cs = EXCLUDED.score_cs,
      updated_at = now();
  `;

  return { ok: true, skip: false };
}

async function deleteByJudgeName(judgeName) {
  const sql = await getNeon();
  if (!sql) return { ok: true, skip: true };
  const j = String(judgeName || "").trim();
  if (!j) return { ok: false, error: "missing judge" };
  await sql`DELETE FROM submissions WHERE judge = ${j};`;
  return { ok: true, skip: false };
}

module.exports = { upsertSubmission, deleteByJudgeName, getNeon };
