-- Run this in the Neon (or any Postgres) SQL console after creating a project.
-- Vercel env: set DATABASE_URL to the pooled connection string from Neon.

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  submitted_at TIMESTAMPTZ NOT NULL,
  judge TEXT NOT NULL,
  team TEXT NOT NULL,
  judge_team_key TEXT NOT NULL,
  total NUMERIC(5, 2),
  grade TEXT,
  award TEXT,
  standout_moment TEXT,
  score_bi SMALLINT,
  score_fs SMALLINT,
  score_ai SMALLINT,
  score_in SMALLINT,
  score_cs SMALLINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_judge ON submissions (judge);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions (submitted_at DESC);
