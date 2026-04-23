/* 
  Competition Judging App (vanilla JS)
  - localStorage (per-judge when using a named judge page)
  - optional POST to /api/submit → per-judge file data/judges/<slug>.json on GitHub; POST /api/reset-judge clears that file
*/

const APP_CONFIG = {
  eventTitle: "Competition Scoring",
  eventSubtitle: "Fast, consistent judging with weighted criteria.",

  storageKey: "judgeApp.submissions.v2",

  teams: Array.from({ length: 8 }, (_, i) => `Team ${i + 1}`),

  criteria: [
    {
      id: "bi",
      stripe: 1,
      icon: "💰",
      name: "Business Impact",
      nameNote: "(Revenue + Cost)",
      description:
        "Quantified, measurable impact on a real problem — revenue generated, cost savings, operational efficiency, risk reduction. Reward specific numbers and believable logic. Penalise vague claims.",
      tags: ["Revenue", "Cost Savings", "ROI", "Risk Reduction", "Productivity"],
      weight: 0.3,
      shortName: "Business Impact",
      barLabel: "Business Impact (30%)",
      scale: {
        left: "0 — No evidence",
        mid: "5 — Adequate",
        right: "10 — Exceptional",
      },
    },
    {
      id: "fs",
      stripe: 2,
      icon: "⚙️",
      name: "Feasibility & Scalability",
      nameNote: "",
      description:
        "Working demo, real tech stack, deployment path described. Assess production-readiness, integration realism, adoption path, and ability to scale beyond the initial use case.",
      tags: ["Working Demo", "Real Stack", "Deployment", "Adoption Path", "Scale"],
      weight: 0.2,
      shortName: "Feasibility & Scalability",
      barLabel: "Feasibility & Scalability (20%)",
      scale: {
        left: "0 — Concept only",
        mid: "5 — Prototype",
        right: "10 — Production-ready",
      },
    },
    {
      id: "ai",
      stripe: 3,
      icon: "🧠",
      name: "AI Depth",
      nameNote: "",
      description:
        "Non-trivial AI usage — model selection, pipeline design, prompt engineering, agent orchestration, retrieval, guardrails. Penalise shallow ChatGPT wrappers and generic 'uses AI' claims with no design depth.",
      tags: ["Model Design", "Pipeline", "Orchestration", "Retrieval", "Guardrails"],
      weight: 0.2,
      shortName: "AI Depth",
      barLabel: "AI Depth (20%)",
      scale: {
        left: "0 — No AI depth",
        mid: "5 — Standard usage",
        right: "10 — Truly novel",
      },
    },
    {
      id: "in",
      stripe: 4,
      icon: "💡",
      name: "Innovation",
      nameNote: "",
      description:
        "Novel approach genuinely differentiated from existing solutions. Creative application of AI to a problem that hasn't been solved this way before. Not just rebranded automation.",
      tags: ["Novelty", "Differentiation", "Creative AI", "Original Thinking"],
      weight: 0.2,
      shortName: "Innovation",
      barLabel: "Innovation (20%)",
      scale: {
        left: "0 — Existing solution",
        mid: "5 — Incremental",
        right: "10 — Truly novel",
      },
    },
    {
      id: "cs",
      stripe: 5,
      icon: "🔗",
      name: "Cross-System Collaboration",
      nameNote: "",
      description:
        "Multi-system integration with clear data flow. Evidence of connecting tools like Slack, WhatsApp, Microsoft Dynamics, Teams, Salesforce, or other enterprise systems into a coherent workflow.",
      tags: ["Slack", "WhatsApp", "MS Dynamics", "Multi-System", "Data Flow"],
      weight: 0.1,
      shortName: "Cross-System",
      barLabel: "Cross-System Collab (10%)",
      scale: {
        left: "0 — Single system",
        mid: "5 — 2 systems",
        right: "10 — Full integration",
      },
    },
  ],

  /** One nomination only (radio). */
  awardOptions: [
    { id: "none", title: "No award nomination", emoji: "" },
    { id: "best_overall", title: "Best Overall", emoji: "🏆" },
    { id: "best_genai", title: "Best Use of GenAI", emoji: "🤖" },
    { id: "ai_for_good", title: "AI for Good", emoji: "🌍" },
    { id: "human_ai", title: "Human + AI", emoji: "🤝" },
    { id: "disruptor", title: "Disruptor", emoji: "⚡" },
    { id: "user_delight", title: "User Delight", emoji: "✨" },
    { id: "best_prototype", title: "Best Prototype", emoji: "🔧" },
    { id: "judges_choice", title: "Judges' Choice", emoji: "⭐" },
  ],
};

function isJudgePage() {
  return (
    typeof window !== "undefined" && window.__JUDGE_PAGE && String(window.__JUDGE_PAGE.name || "").trim()
  );
}

function getJudgeNameFromConfig() {
  if (!isJudgePage()) return "";
  return String(window.__JUDGE_PAGE.name).trim();
}

const GRADE_MAP = [
  [9.5, "A+ · Exceptional"],
  [8.5, "A · Outstanding"],
  [7.5, "A- · Very strong"],
  [6.5, "B+ · Strong"],
  [5.5, "B · Good"],
  [4.5, "B- · Adequate"],
  [3.5, "C+ · Weak"],
  [2.5, "C · Poor"],
  [0, "D · Insufficient"],
];

function gradeFromTotal(total) {
  const t = Number(total) || 0;
  for (const [min, label] of GRADE_MAP) {
    if (t >= min) return label;
  }
  return "D · Insufficient";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- Small utilities ----------

function $(sel) {
  return document.querySelector(sel);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Data layer (localStorage; server merge via /api/submit) ----------

function getStorageKey() {
  if (isJudgePage()) {
    return `${APP_CONFIG.storageKey}::${encodeURIComponent(getJudgeNameFromConfig())}`;
  }
  return APP_CONFIG.storageKey;
}

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSubmissions(submissions) {
  localStorage.setItem(getStorageKey(), JSON.stringify(submissions));
}

function makeJudgeTeamKey(judge, team) {
  return `${judge}__${team}`.toLowerCase();
}

function hasSubmissionFor(judge, team) {
  const key = makeJudgeTeamKey(judge, team);
  return loadSubmissions().some((s) => s.judgeTeamKey === key);
}

function addSubmission(submission) {
  const submissions = loadSubmissions();
  submissions.unshift(submission);
  saveSubmissions(submissions);
}

async function postSubmissionToServer(submission) {
  const headers = { "Content-Type": "application/json" };
  if (window.__JUDGE_PAGE && window.__JUDGE_PAGE.ingestKey) {
    headers["x-ingest-key"] = String(window.__JUDGE_PAGE.ingestKey);
  }
  try {
    const r = await fetch("/api/submit", {
      method: "POST",
      headers,
      body: JSON.stringify(submission),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, git: Boolean(j.git), error: j.error || `HTTP ${r.status}` };
    }
    return { ok: true, ...j };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

async function postResetJudgeToServer(judge) {
  const headers = { "Content-Type": "application/json" };
  if (window.__JUDGE_PAGE && window.__JUDGE_PAGE.ingestKey) {
    headers["x-ingest-key"] = String(window.__JUDGE_PAGE.ingestKey);
  }
  try {
    const r = await fetch("/api/reset-judge", {
      method: "POST",
      headers,
      body: JSON.stringify({ judge }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { ok: false, git: Boolean(j.git), error: j.error || `HTTP ${r.status}` };
    }
    return { ok: true, ...j };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

// ---------- App state ----------

const state = {
  view: "welcome",
  selection: {
    judge: "",
    team: "",
  },
  draft: {
    scores: Object.fromEntries(APP_CONFIG.criteria.map((c) => [c.id, 0])),
    standoutMoment: "",
    award: "none",
  },
};

// ---------- DOM elements ----------

const els = {
  tabs: Array.from(document.querySelectorAll("[data-nav]")),
  eventTitle: $("#eventTitle"),
  eventSubtitle: $("#eventSubtitle"),
  eventDescription: $("#eventDescription"),
  welcomeTitle: $("#welcomeTitle"),
  teamSelect: $("#teamSelect"),
  startBtn: $("#startBtn"),
  welcomeHint: $("#welcomeHint"),
  topbarContext: $("#topbarContext"),
  topbarJudge: $("#topbarJudge"),
  scoreKicker: $("#scoreKicker"),
  teamPill: $("#teamPill"),
  scoreContext: $("#scoreContext"),
  scoreContextMeta: $("#scoreContextMeta"),
  criteriaContainer: $("#criteriaContainer"),
  totalValue: $("#totalValue"),
  totalGrade: $("#totalGrade"),
  totalHint: $("#totalHint"),
  breakdownContainer: $("#breakdownContainer"),
  standoutField: $("#standoutField"),
  awardOptions: $("#awardOptions"),
  awardHint: $("#awardHint"),
  scoreForm: $("#scoreForm"),
  submitBtn: $("#submitBtn"),
  resetBtn: $("#resetBtn"),
  scoreHint: $("#scoreHint"),
  backToWelcomeBtn: $("#backToWelcomeBtn"),
  welcomeRecordsCard: $("#welcomeRecordsCard"),
  welcomeRecordsMeta: $("#welcomeRecordsMeta"),
  welcomeRecordsTbody: $("#welcomeRecordsTbody"),
  exportMyCsvBtn: $("#exportMyCsvBtn"),
  welcomeExportHint: $("#welcomeExportHint"),
  resetMyMarksBtn: $("#resetMyMarksBtn"),
};

// ---------- Judge name resolution ----------

function getJudgeName() {
  if (isJudgePage()) return getJudgeNameFromConfig();
  return "";
}

/** Matches server-side slug: data/judges/<slug>.json in the repo. */
function judgeDataFilePathForDisplay(judgeName) {
  const slug = String(judgeName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "judge";
  return `data/judges/${slug}.json`;
}

function clearAllSubmissions() {
  saveSubmissions([]);
}

// ---------- Rendering ----------

function setHint(el, message, tone = "muted") {
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("hint--good", "hint--bad", "hint--warn");
  if (tone === "good") el.classList.add("hint--good");
  if (tone === "bad") el.classList.add("hint--bad");
  if (tone === "warn") el.classList.add("hint--warn");
}

function setView(view) {
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((node) => {
    node.classList.toggle("is-active", node.getAttribute("data-view") === view);
  });
  els.tabs.forEach((btn) => {
    const isActive = btn.getAttribute("data-nav") === view;
    btn.classList.toggle("is-active", isActive);
  });
}

function setTabEnabled(view, enabled) {
  const btn = els.tabs.find((b) => b.getAttribute("data-nav") === view);
  if (!btn) return;
  btn.disabled = !enabled;
}

function renderEventText() {
  els.eventTitle.textContent = APP_CONFIG.eventTitle;
  els.eventSubtitle.textContent = APP_CONFIG.eventSubtitle;
  if (els.eventDescription) {
    els.eventDescription.textContent = isJudgePage() && getJudgeNameFromConfig()
      ? "Choose a team, score on the next page, and submit. Scores are copied to the organiser repository when the server is configured, and also kept on this device for your session."
      : APP_CONFIG.eventDescription;
  }
  if (els.welcomeTitle) {
    const name = getJudgeName();
    els.welcomeTitle.textContent = name ? `Welcome, ${name}` : "Welcome, judge";
  }
}

function fillSelect(selectEl, options, placeholder = "Select...") {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  ph.disabled = true;
  ph.selected = true;
  selectEl.appendChild(ph);
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    selectEl.appendChild(o);
  }
}

function setTopbarJudge(visible, judgeName) {
  if (!els.topbarContext || !els.topbarJudge) return;
  if (!visible || !judgeName) {
    els.topbarContext.hidden = true;
    return;
  }
  els.topbarContext.hidden = false;
  els.topbarJudge.innerHTML = `<span class="tj-label">Judge</span>${escapeHtml(judgeName)}`;
}

function getStandoutOrLegacy(s) {
  if (!s) return "";
  return String(s.standoutMoment ?? s.overallFeedback ?? "").trim();
}

function cellCriterionScore(s, id) {
  const sc = s && s.scores;
  if (!sc || sc[id] == null || sc[id] === "") return "—";
  return String(sc[id]);
}

/**
 * This judge’s submissions only (storage is per judge page). Visible on the Welcome table + CSV.
 */
function renderWelcomeRecordsTable() {
  if (!els.welcomeRecordsTbody) return;
  const mine = getJudgeName();
  if (!mine) {
    if (els.welcomeRecordsCard) els.welcomeRecordsCard.hidden = true;
    return;
  }
  if (els.welcomeRecordsCard) els.welcomeRecordsCard.hidden = false;

  const rows = loadSubmissions().filter((s) => s && s.judge === mine);
  rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  if (els.welcomeRecordsMeta) {
    const path = judgeDataFilePathForDisplay(mine);
    els.welcomeRecordsMeta.textContent = `${rows.length} submission${
      rows.length === 1 ? "" : "s"
    } on this page (this browser). Submits sync to the repo as ${path} when Vercel and GitHub are set up. “Reset all my marks” clears this browser and that file. Use “Download CSV for Excel” for a spreadsheet.`;
  }

  els.welcomeRecordsTbody.innerHTML = "";
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="12" class="muted" style="padding: 16px 12px">No marks submitted yet. Choose a team and score above to add a row here.</td>`;
    els.welcomeRecordsTbody.appendChild(tr);
    return;
  }

  for (const s of rows) {
    const g = s.grade ?? gradeFromTotal(s.total ?? 0);
    const feedback = getStandoutOrLegacy(s);
    const feedbackCell =
      feedback.length > 100 ? `${escapeHtml(feedback.slice(0, 100))}…` : escapeHtml(feedback);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateTime(s.submittedAt)}</td>
      <td>${escapeHtml(s.judge || "")}</td>
      <td><strong>${escapeHtml(s.team || "")}</strong></td>
      <td class="table__num"><strong>${Number(s.total ?? 0).toFixed(1)}</strong></td>
      <td class="table__grade" title="${escapeHtml(String(g))}">${escapeHtml(String(g))}</td>
      <td>${escapeHtml(humanizeAward(s.award))}</td>
      <td class="table__text" title="${escapeHtml(feedback)}">${feedbackCell || "—"}</td>
      <td class="table__num">${cellCriterionScore(s, "bi")}</td>
      <td class="table__num">${cellCriterionScore(s, "fs")}</td>
      <td class="table__num">${cellCriterionScore(s, "ai")}</td>
      <td class="table__num">${cellCriterionScore(s, "in")}</td>
      <td class="table__num">${cellCriterionScore(s, "cs")}</td>
    `;
    els.welcomeRecordsTbody.appendChild(tr);
  }
}

function exportMySubmissionsToCsv() {
  if (!isJudgePage() || !getJudgeName()) return;
  const mine = getJudgeName();
  const rows = loadSubmissions().filter((s) => s && s.judge === mine);
  rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  const critHeaders = APP_CONFIG.criteria.map(
    (c) => `${c.shortName || c.name} (0-10)`,
  );
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
  for (const s of rows) {
    const g = s.grade ?? gradeFromTotal(s.total ?? 0);
    const row = [
      s.submittedAt,
      s.judge,
      s.team,
      Number(s.total ?? 0).toFixed(1),
      g,
      humanizeAward(s.award),
      getStandoutOrLegacy(s),
    ];
    for (const c of APP_CONFIG.criteria) {
      row.push(String(s.scores?.[c.id] ?? ""));
    }
    lines.push(row.map(escapeCsv).join(","));
  }

  const safeName = String(mine).replace(/[\\/:"*?<>|]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `submissions_${safeName}_${date}.csv`;
  const bom = "\uFEFF";
  const content = bom + lines.join("\r\n");
  downloadTextFile(filename, content);
  setHint(
    els.welcomeExportHint,
    `Downloaded ${rows.length} row(s) as ${filename} — open in Microsoft Excel. Data matches the table and ${judgeDataFilePathForDisplay(
      mine,
    )} in the repo after a successful server sync.`,
    "good",
  );
}

function renderWelcome() {
  if (els.teamSelect) {
    fillSelect(els.teamSelect, APP_CONFIG.teams, "— Choose team —");
  }
  setHint(els.welcomeHint, "");
  setHint(els.welcomeExportHint, "");
  renderEventText();
  renderWelcomeRecordsTable();
}

function renderAwardOptions() {
  if (!els.awardOptions) return;
  els.awardOptions.innerHTML = "";
  for (const opt of APP_CONFIG.awardOptions) {
    const label = document.createElement("label");
    label.className = "radioCard";
    label.innerHTML = `
      <input type="radio" name="award" value="${opt.id}" />
      <div>
        <div class="radioCard__title">
          ${opt.emoji ? `<span class="radioCard__emoji" aria-hidden="true">${opt.emoji}</span>` : ""}
          <span>${opt.title}</span>
        </div>
      </div>
    `;
    const input = label.querySelector("input");
    input.checked = state.draft.award === opt.id;
    input.addEventListener("change", () => {
      state.draft.award = opt.id;
    });
    els.awardOptions.appendChild(label);
  }
}

function renderCriteria() {
  if (!els.criteriaContainer) return;
  els.criteriaContainer.innerHTML = "";

  for (const c of APP_CONFIG.criteria) {
    const row = document.createElement("div");
    row.className = "criterion crit";
    row.dataset.criterionId = c.id;
    row.dataset.stripe = String(c.stripe);

    const score = Math.round(state.draft.scores[c.id] ?? 0);
    const wPct = `${Math.round(c.weight * 100)}%`;
    const noteLine = c.nameNote
      ? `<span class="crit-name">${c.name} <em>${c.nameNote}</em></span>`
      : `<span class="crit-name">${c.name}</span>`;
    const tags = c.tags
      .map((t) => `<span class="crit-tag" title="">${t}</span>`)
      .join("");

    row.innerHTML = `
      <div class="crit-stripe" aria-hidden="true"></div>
      <div class="crit-head">
        <div class="crit-ico" aria-hidden="true">${c.icon}</div>
        <div class="crit-main">
          <div class="crit-nameBlock">${noteLine}</div>
          <p class="crit-desc">${c.description}</p>
          <div class="crit-tags">${tags}</div>
        </div>
        <div class="crit-weightCol">
          <div class="crit-pct" id="pct-${c.id}">${wPct}</div>
          <div class="crit-wt">Weight</div>
        </div>
        <div class="crit-numCol">
          <div class="crit-num" id="num-${c.id}">${score}</div>
          <div class="crit-numD">/ 10</div>
        </div>
      </div>
      <div class="crit-sliderBlock">
        <div class="slider-ticks">
          <span>${c.scale.left}</span>
          <span>${c.scale.mid}</span>
          <span>${c.scale.right}</span>
        </div>
        <input
          type="range"
          class="score-range"
          min="0"
          max="10"
          step="1"
          value="${score}"
          aria-label="${c.name} score from 0 to 10"
          id="range-${c.id}"
        />
      </div>
    `;

    els.criteriaContainer.appendChild(row);

    const range = document.getElementById(`range-${c.id}`);
    const numEl = document.getElementById(`num-${c.id}`);

    row.classList.toggle("is-active-score", score > 0);

    range.addEventListener("input", () => {
      const v = clamp(parseInt(range.value, 10), 0, 10);
      state.draft.scores[c.id] = v;
      numEl.textContent = String(v);
      row.classList.toggle("is-active-score", v > 0);
      renderTotal();
      setHint(els.scoreHint, "");
    });
  }
}

function computeWeightedTotal() {
  return APP_CONFIG.criteria.reduce((sum, c) => {
    const s = state.draft.scores[c.id] ?? 0;
    return sum + s * c.weight;
  }, 0);
}

function renderBreakdown() {
  if (!els.breakdownContainer) return;
  const total = computeWeightedTotal();
  const grade = gradeFromTotal(total);

  const rows = APP_CONFIG.criteria
    .map((c) => {
      const s = state.draft.scores[c.id] ?? 0;
      const pct = (s / 10) * 100;
      return `
        <div class="bd-row" data-crit="${c.id}">
          <div class="bd-name" title="${c.barLabel}">${c.barLabel}</div>
          <div class="bd-track"><div class="bd-fill" id="bd-fill-${c.id}" style="width:${pct}%"></div></div>
          <div class="bd-val" id="bd-val-${c.id}">${s}</div>
        </div>
      `;
    })
    .join("");

  els.breakdownContainer.innerHTML = `
    <div>
      <div class="bd-label">Score breakdown</div>
      <div class="bd-bars">${rows}</div>
    </div>
    <div class="break-total">
      <div class="bt-label">Weighted total (out of 10)</div>
      <div class="bt-num" id="btNum">${total.toFixed(1)}</div>
      <div class="bt-grade" id="btGrade">${grade}</div>
    </div>
  `;
  els.breakdownContainer.hidden = false;
}

function renderTotal() {
  const total = computeWeightedTotal();
  const grade = gradeFromTotal(total);
  if (els.totalValue) els.totalValue.textContent = total.toFixed(1);
  if (els.totalGrade) els.totalGrade.textContent = grade;
  renderBreakdown();
  const btNum = document.getElementById("btNum");
  const btG = document.getElementById("btGrade");
  if (btNum) btNum.textContent = total.toFixed(1);
  if (btG) btG.textContent = grade;
}

function renderScoreContext() {
  const { judge, team } = state.selection;
  setTopbarJudge(true, judge);

  if (els.teamPill) els.teamPill.textContent = team || "—";
  if (els.scoreKicker) els.scoreKicker.textContent = "Scoring";
  if (els.scoreContext) els.scoreContext.textContent = team || "—";

  const locked = hasSubmissionFor(judge, team);
  if (locked) {
    if (els.scoreContextMeta) {
      els.scoreContextMeta.textContent =
        "This team is already submitted for you. Use Back to welcome to pick another team.";
    }
    if (els.submitBtn) els.submitBtn.disabled = true;
    setHint(
      els.scoreHint,
      "Already submitted. Go back to the welcome page and select a different team.",
      "warn",
    );
  } else {
    if (els.scoreContextMeta) {
      els.scoreContextMeta.textContent =
        "Use the 0–10 scale on each card, then required Standout moment, award, and Submit.";
    }
    if (els.submitBtn) els.submitBtn.disabled = false;
    setHint(els.scoreHint, "");
  }
}

// ---------- Actions ----------

function startScoring(judge, team) {
  state.selection.judge = judge;
  state.selection.team = team;

  setTabEnabled("score", true);
  setView("score");

  renderScoreContext();
  renderCriteria();
  renderAwardOptions();

  if (els.standoutField) els.standoutField.value = "";
  renderTotal();
}

function goWelcome() {
  state.selection.judge = "";
  state.selection.team = "";
  setTopbarJudge(false);
  setTabEnabled("score", false);
  setView("welcome");
  renderWelcome();
}

/**
 * @param {string} judge
 * @param {Record<string, unknown> | null} [server]
 */
function returnToWelcomeAfterScoring(judge, server) {
  state.selection.team = "";
  state.selection.judge = "";
  setTopbarJudge(false);
  setTabEnabled("score", false);
  setView("welcome");
  setHint(els.scoreHint, "");
  if (server && server.ok && server.git) {
    setHint(
      els.welcomeHint,
      "Score saved and synced to the organiser’s repository. Choose a team to continue when ready.",
      "good",
    );
  } else if (server && server.ok && !server.git) {
    setHint(
      els.welcomeHint,
      "Score saved on this device. Cloud backup is not enabled on the server; ask the organiser to set GitHub in Vercel, or your score still exists only in the browser for now.",
      "warn",
    );
  } else if (server && server.error) {
    setHint(
      els.welcomeHint,
      `Score saved on this device. Server sync failed (${String(server.error).slice(0, 200)}).`,
      "warn",
    );
  } else {
    setHint(
      els.welcomeHint,
      "Score saved. You’re back on the welcome page — choose a team to continue.",
      "good",
    );
  }
  renderWelcome();
  window.scrollTo({ top: 0, behavior: "smooth" });
  void judge;
}

function resetDraft() {
  state.draft.scores = Object.fromEntries(APP_CONFIG.criteria.map((c) => [c.id, 0]));
  state.draft.standoutMoment = "";
  state.draft.award = "none";
}

function humanizeAward(id) {
  const opt = APP_CONFIG.awardOptions.find((o) => o.id === id);
  return opt ? opt.title : "—";
}

// ---------- Wire up events ----------

function initNav() {
  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-nav");
      if (btn.disabled) return;

      if (view === "welcome") {
        if (state.view !== "welcome" && state.view === "score") {
          if (
            !confirm(
              "Return to the welcome screen? Unsaved work on the current team will be lost. Submitted teams stay saved.",
            )
          ) {
            return;
          }
        }
        goWelcome();
        return;
      }

      if (view === "score") {
        if (btn.disabled) return;
        renderScoreContext();
        renderTotal();
        setView("score");
      }
    });
  });
}

function initWelcome() {
  if (els.startBtn) {
    els.startBtn.addEventListener("click", () => {
      const judge = getJudgeName();
      const team = els.teamSelect && els.teamSelect.value;
      if (!judge) {
        setHint(els.welcomeHint, "This page is not configured with a judge name. Ask the organiser for a valid link.", "bad");
        return;
      }
      if (!team) {
        setHint(els.welcomeHint, "Please choose a team.", "warn");
        return;
      }
      if (hasSubmissionFor(judge, team)) {
        setHint(
          els.welcomeHint,
          `You already submitted a score for ${judge} × ${team}. Choose another team.`,
          "warn",
        );
        return;
      }
      resetDraft();
      startScoring(judge, team);
    });
  }
  if (els.teamSelect) {
    els.teamSelect.addEventListener("change", () => setHint(els.welcomeHint, ""));
  }
  if (els.exportMyCsvBtn) {
    els.exportMyCsvBtn.addEventListener("click", () => {
      const n = loadSubmissions().filter((s) => s && s.judge === getJudgeName()).length;
      if (n === 0) {
        setHint(els.welcomeExportHint, "No submissions to export yet.", "warn");
        return;
      }
      exportMySubmissionsToCsv();
    });
  }
  if (els.resetMyMarksBtn) {
    els.resetMyMarksBtn.addEventListener("click", async () => {
      const judge = getJudgeName();
      if (!judge) return;
      const n = loadSubmissions().filter((s) => s && s.judge === judge).length;
      if (n === 0) {
        setHint(els.welcomeHint, "There are no marks to reset yet.", "warn");
        return;
      }
      const ok = confirm(
        "Reset ALL marks for you on this page? This cannot be undone. It clears this browser and, if the site is connected to GitHub, replaces your file in the repository with an empty list.",
      );
      if (!ok) return;
      clearAllSubmissions();
      setHint(els.welcomeExportHint, "");
      renderWelcomeRecordsTable();
      setHint(els.welcomeHint, "Clearing…", "muted");
      const server = await postResetJudgeToServer(judge);
      if (server && server.ok && server.git) {
        setHint(
          els.welcomeHint,
          `All marks cleared. Local data and ${judgeDataFilePathForDisplay(judge)} in the repository are now empty.`,
          "good",
        );
      } else if (server && server.ok && !server.git) {
        setHint(
          els.welcomeHint,
          "Cleared in this browser. The server is not configured to update Git; ask the organiser to set Vercel env or accept local-only clear.",
          "warn",
        );
      } else {
        setHint(
          els.welcomeHint,
          `Cleared in this browser. Server could not update Git: ${(server && server.error) || "unknown"}.`,
          "warn",
        );
      }
    });
  }
}

function initScoring() {
  if (els.standoutField) {
    els.standoutField.addEventListener("input", () => {
      state.draft.standoutMoment = els.standoutField.value;
    });
  }

  if (els.resetBtn) {
    els.resetBtn.addEventListener("click", () => {
      resetDraft();
      renderCriteria();
      renderAwardOptions();
      if (els.standoutField) els.standoutField.value = "";
      renderTotal();
      setHint(els.scoreHint, "Form reset.", "good");
    });
  }

  if (els.backToWelcomeBtn) {
    els.backToWelcomeBtn.addEventListener("click", () => {
      if (
        confirm(
          "Return to the welcome screen? Unsaved work on this team will be lost. Submitted teams stay saved.",
        )
      ) {
        goWelcome();
      }
    });
  }

  if (els.scoreForm) {
    els.scoreForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { judge, team } = state.selection;
      if (!judge || !team) {
        setHint(els.scoreHint, "Missing judge/team. Go back to the welcome page.", "warn");
        return;
      }

      if (hasSubmissionFor(judge, team)) {
        renderScoreContext();
        return;
      }

      const sm = String(els.standoutField?.value || state.draft.standoutMoment || "").trim();
      if (!sm) {
        setHint(els.scoreHint, "Standout moment is required.", "bad");
        if (els.standoutField) els.standoutField.focus();
        return;
      }
      state.draft.standoutMoment = sm;

      const total = computeWeightedTotal();
      const submission = {
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        submittedAt: nowIso(),
        judge,
        team,
        judgeTeamKey: makeJudgeTeamKey(judge, team),
        criteria: APP_CONFIG.criteria.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
        scores: { ...state.draft.scores },
        total,
        grade: gradeFromTotal(total),
        standoutMoment: sm,
        award: state.draft.award || "none",
      };

      addSubmission(submission);
      if (els.submitBtn) els.submitBtn.disabled = true;
      setHint(els.scoreHint, "Submitting…", "muted");
      const server = await postSubmissionToServer(submission);
      if (els.submitBtn) els.submitBtn.disabled = false;
      returnToWelcomeAfterScoring(judge, server);
    });
  }
}

// ---------- Init ----------

function init() {
  if (!isJudgePage()) {
    if (els.welcomeHint) {
      els.welcomeHint.textContent =
        "This judge app must be opened from a named page (e.g. example-smith.html) with a judge set in the page. Use the link you were given.";
    }
    return;
  }
  renderEventText();
  renderWelcome();
  initNav();
  initWelcome();
  initScoring();
  setTabEnabled("score", false);
  setView("welcome");
}

document.addEventListener("DOMContentLoaded", init);
