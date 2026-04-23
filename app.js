/* 
  Competition Judging App (vanilla JS)
  - Local-first prototype using localStorage
  - Simple “views” so you can later swap HTML blocks easily
  - Data layer is isolated so it can later be replaced with Supabase calls
*/

const APP_CONFIG = {
  eventTitle: "Competition Scoring",
  eventSubtitle: "Fast, consistent judging with weighted criteria.",
  eventDescription:
    "Choose the judge, then the first team to score. The app then moves you through the remaining teams in order until all eight are done.",

  storageKey: "judgeApp.submissions.v2",

  judges: [
    "Vaibhav Shah",
    "Eric Shea",
    "Sachin Khairnar",
    "Matthew Rupas",
    "Jonathan Kletzel",
    "Peter Frank",
    "Sri Balakrishnan",
  ],

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
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Data layer (localStorage now; easy to swap later) ----------

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSubmissions(submissions) {
  localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(submissions));
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

function clearAllSubmissions() {
  saveSubmissions([]);
}

/** @type {string} one key per browser */
const JUDGE_FLOW_KEY = "judgeApp.judgeFlow.v1";

function loadFlowMap() {
  try {
    return JSON.parse(localStorage.getItem(JUDGE_FLOW_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFlowMap(map) {
  localStorage.setItem(JUDGE_FLOW_KEY, JSON.stringify(map));
}

function getStartTeamNum(judge) {
  const n = loadFlowMap()[judge]?.startTeamNum;
  return n != null && n >= 1 && n <= 8 ? n : null;
}

function setStartTeamNum(judge, n) {
  const map = loadFlowMap();
  map[judge] = { startTeamNum: clamp(parseInt(n, 10), 1, 8) };
  saveFlowMap(map);
}

function clearJudgeFlow() {
  localStorage.removeItem(JUDGE_FLOW_KEY);
}

/**
 * e.g. start 3 -> [3,4,5,6,7,8,1,2]
 * @param {number} startNum
 * @returns {number[]}
 */
function buildTeamOrder(startNum) {
  const a = [];
  for (let i = 0; i < 8; i += 1) a.push(((startNum - 1 + i) % 8) + 1);
  return a;
}

function getSubmissionCountForJudge(judge) {
  return loadSubmissions().filter((s) => s.judge === judge).length;
}

function teamNameToNum(teamName) {
  const m = String(teamName).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** First team in queue (for this judge) that has no submission yet, or null if all 8 done. */
function getNextTeamForJudge(judge) {
  let start = getStartTeamNum(judge);
  if (start == null) {
    if (getSubmissionCountForJudge(judge) > 0) start = 1; // legacy data: assume start at 1
    else return null;
  }
  for (const n of buildTeamOrder(start)) {
    const t = `Team ${n}`;
    if (!hasSubmissionFor(judge, t)) return t;
  }
  return null;
}

function indexInQueue(judge, teamName) {
  const start = getStartTeamNum(judge) ?? 1;
  const order = buildTeamOrder(start);
  const num = teamNameToNum(teamName);
  if (!num) return -1;
  return order.indexOf(num);
}

function syncSubmitButtonLabel() {
  if (!els.submitBtn) return;
  const { judge, team } = state.selection;
  const idx = indexInQueue(judge, team);
  if (idx < 0) {
    els.submitBtn.textContent = "Submit score";
    return;
  }
  if (idx < 7) els.submitBtn.textContent = "Submit & Go to Next Team";
  else els.submitBtn.textContent = "Submit & Finish (all 8 teams)";
}

// ---------- App state ----------

const state = {
  view: "welcome",
  selection: {
    judge: "",
    team: "",
  },
  // live draft scores
  draft: {
    scores: Object.fromEntries(APP_CONFIG.criteria.map((c) => [c.id, 0])),
    overallFeedback: "",
    award: "none",
  },
};

// ---------- DOM elements ----------

const els = {
  // top
  tabs: Array.from(document.querySelectorAll("[data-nav]")),

  // welcome
  eventTitle: $("#eventTitle"),
  eventSubtitle: $("#eventSubtitle"),
  eventDescription: $("#eventDescription"),
  judgeSelect: $("#judgeSelect"),
  teamSelect: $("#teamSelect"),
  startTeamField: $("#startTeamField"),
  startTeamHint: $("#startTeamHint"),
  resumeBanner: $("#resumeBanner"),
  startBtn: $("#startBtn"),
  welcomeHint: $("#welcomeHint"),

  // top bar
  topbarContext: $("#topbarContext"),
  topbarJudge: $("#topbarJudge"),

  // score
  scoreKicker: $("#scoreKicker"),
  teamPill: $("#teamPill"),
  scoreContext: $("#scoreContext"),
  scoreContextMeta: $("#scoreContextMeta"),
  criteriaContainer: $("#criteriaContainer"),
  totalValue: $("#totalValue"),
  totalGrade: $("#totalGrade"),
  totalHint: $("#totalHint"),
  breakdownContainer: $("#breakdownContainer"),
  overallFeedback: $("#overallFeedback"),
  awardOptions: $("#awardOptions"),
  awardHint: $("#awardHint"),
  scoreForm: $("#scoreForm"),
  submitBtn: $("#submitBtn"),
  resetBtn: $("#resetBtn"),
  scoreHint: $("#scoreHint"),
  successState: $("#successState"),
  successToRecordsBtn: $("#successToRecordsBtn"),
  scoreAnotherBtn: $("#scoreAnotherBtn"),
  backToWelcomeBtn: $("#backToWelcomeBtn"),
  goRecordsBtn: $("#goRecordsBtn"),

  // records
  exportCsvBtn: $("#exportCsvBtn"),
  clearAllBtn: $("#clearAllBtn"),
  recordsMeta: $("#recordsMeta"),
  recordsTbody: $("#recordsTbody"),
  recordsHint: $("#recordsHint"),

  completeTitle: $("#completeTitle"),
  completeText: $("#completeText"),
  completeToRecordsBtn: $("#completeToRecordsBtn"),
  completeToWelcomeBtn: $("#completeToWelcomeBtn"),
};

// ---------- Rendering ----------

function setHint(el, message, tone = "muted") {
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
  els.eventDescription.textContent = APP_CONFIG.eventDescription;
}

function fillSelect(selectEl, options, placeholder = "Select...") {
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

function refreshWelcomeForJudge() {
  const judge = els.judgeSelect?.value;
  if (!judge) {
    if (els.startTeamField) els.startTeamField.hidden = false;
    if (els.resumeBanner) els.resumeBanner.hidden = true;
    if (els.startTeamHint) els.startTeamHint.textContent = "";
    return;
  }

  const count = getSubmissionCountForJudge(judge);
  const next = getNextTeamForJudge(judge);
  const start = getStartTeamNum(judge);

  if (count === 0) {
    if (els.startTeamField) els.startTeamField.hidden = false;
    if (els.resumeBanner) els.resumeBanner.hidden = true;
    if (els.teamSelect) els.teamSelect.disabled = false;
    if (els.startTeamHint) {
      els.startTeamHint.textContent =
        "After this team, the app will continue in order (e.g. first Team 3 → then 4, 5, 6, 7, 8, 1, 2).";
    }
  } else {
    if (els.startTeamField) els.startTeamField.hidden = true;
    if (els.resumeBanner) {
      els.resumeBanner.hidden = false;
      if (next) {
        const from = start != null ? `Queue from Team ${start} · ` : "";
        els.resumeBanner.textContent = `${from}${count} of 8 submitted. Next: ${next}.`;
      } else {
        els.resumeBanner.textContent = `All 8 teams are scored for ${judge}.`;
      }
    }
  }
}

function renderWelcome() {
  fillSelect(els.judgeSelect, APP_CONFIG.judges, "Choose a judge");
  fillSelect(els.teamSelect, APP_CONFIG.teams, "First team to score…");
  setHint(els.welcomeHint, "");
  refreshWelcomeForJudge();
}

function renderAwardOptions() {
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

    const range = $(`#range-${c.id}`);
    const numEl = $(`#num-${c.id}`);

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
  // Weighted average where each criterion is 0..10, weights sum to 1.0
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

  const q = indexInQueue(judge, team);
  const pos = q >= 0 ? q + 1 : "—";
  if (els.teamPill) els.teamPill.textContent = team || "—";
  if (els.scoreKicker) els.scoreKicker.textContent = `Scoring · ${pos} of 8 in your order`;
  if (els.scoreContext) els.scoreContext.textContent = team || "—";

  const locked = hasSubmissionFor(judge, team);
  if (locked) {
    els.scoreContextMeta.textContent =
      "A submission already exists for this judge–team pair. Use Back to welcome to continue your queue.";
    els.submitBtn.disabled = true;
    setHint(
      els.scoreHint,
      "This team is already submitted. Return to the welcome screen to resume the next team.",
      "warn",
    );
  } else {
    els.scoreContextMeta.textContent = "Use the 0–10 scale on each card (rubric text below).";
    els.submitBtn.disabled = false;
    setHint(els.scoreHint, "");
  }
  syncSubmitButtonLabel();
}

function renderSuccessState(show) {
  els.successState.hidden = !show;
  if (show) {
    els.scoreForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderRecords() {
  const submissions = loadSubmissions();
  els.recordsTbody.innerHTML = "";
  els.recordsMeta.textContent = `${submissions.length} submission${submissions.length === 1 ? "" : "s"} stored locally.`;
  setHint(els.recordsHint, "");

  if (submissions.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="12" class="muted" style="padding: 16px 12px;">
        No submissions yet. Start on the Welcome page to create your first score.
      </td>
    `;
    els.recordsTbody.appendChild(tr);
    return;
  }

  for (const s of submissions) {
    const g = s.grade ?? gradeFromTotal(s.total ?? 0);
    const sc = s.scores || {};
    const cell = (id) => {
      const v = sc[id];
      if (v == null || v === "") return "—";
      return String(v);
    };
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDateTime(s.submittedAt)}</td>
      <td>${s.judge}</td>
      <td>${s.team}</td>
      <td class="table__num"><strong>${Number(s.total ?? 0).toFixed(1)}</strong></td>
      <td class="table__grade" title="${String(g).replace(/"/g, "&quot;")}">${g}</td>
      <td class="table__num">${cell("bi")}</td>
      <td class="table__num">${cell("fs")}</td>
      <td class="table__num">${cell("ai")}</td>
      <td class="table__num">${cell("in")}</td>
      <td class="table__num">${cell("cs")}</td>
      <td>${humanizeAward(s.award)}</td>
      <td class="muted">${(s.overallFeedback || "").slice(0, 180)}${(s.overallFeedback || "").length > 180 ? "…" : ""}</td>
    `;
    els.recordsTbody.appendChild(tr);
  }
}

function humanizeAward(id) {
  const opt = APP_CONFIG.awardOptions.find((o) => o.id === id);
  return opt ? opt.title : "—";
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

  els.overallFeedback.value = "";
  renderTotal();
  renderSuccessState(false);
  syncSubmitButtonLabel();
}

function goWelcome() {
  state.selection.judge = "";
  state.selection.team = "";
  setTopbarJudge(false);
  setTabEnabled("score", false);
  setView("welcome");
  renderWelcome();
}

function showJudgeCompletion(judge) {
  if (els.completeTitle) {
    els.completeTitle.textContent = "All team scores are in";
  }
  if (els.completeText) {
    els.completeText.textContent = `${judge}, you have submitted scores for all eight teams in your assigned order. Thank you.`;
  }
  setTopbarJudge(true, judge);
  setTabEnabled("score", false);
  renderSuccessState(false);
  setView("complete");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetDraft() {
  state.draft.scores = Object.fromEntries(APP_CONFIG.criteria.map((c) => [c.id, 0]));
  state.draft.overallFeedback = "";
  state.draft.award = "none";
}

function exportCsv() {
  const submissions = loadSubmissions();
  if (submissions.length === 0) {
    setHint(els.recordsHint, "No submissions to export yet.", "warn");
    return;
  }

  const criteriaCols = APP_CONFIG.criteria.map(
    (c) => `${c.shortName || c.name} (0–10 score)`,
  );

  const header = [
    "submittedAt",
    "judge",
    "team",
    "total",
    "grade",
    "award",
    "overallFeedback",
    ...criteriaCols,
  ];

  const lines = [header.map(escapeCsv).join(",")];
  for (const s of submissions) {
    const row = [
      s.submittedAt,
      s.judge,
      s.team,
      Number(s.total ?? 0).toFixed(1),
      s.grade ?? gradeFromTotal(s.total ?? 0),
      humanizeAward(s.award),
      s.overallFeedback ?? "",
    ];

    for (const c of APP_CONFIG.criteria) {
      row.push(String(s.scores?.[c.id] ?? ""));
    }

    lines.push(row.map(escapeCsv).join(","));
  }

  const filename = `submissions_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadTextFile(filename, lines.join("\n"));
  setHint(els.recordsHint, `Exported ${submissions.length} submission(s) to CSV.`, "good");
}

// ---------- Wire up events ----------

function initNav() {
  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-nav");
      if (btn.disabled) return;

      if (view === "welcome") {
        if (state.view !== "welcome" && (state.view === "score" || state.view === "complete")) {
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
        return;
      }

      if (view === "records") {
        setTopbarJudge(false);
        renderRecords();
        setView("records");
        return;
      }
    });
  });
}

function initWelcome() {
  els.startBtn.addEventListener("click", () => {
    const judge = els.judgeSelect.value;
    if (!judge) {
      setHint(els.welcomeHint, "Please choose a judge.", "warn");
      return;
    }

    const count = getSubmissionCountForJudge(judge);
    if (count === 0) {
      const startNum = teamNameToNum(els.teamSelect.value);
      if (!startNum) {
        setHint(els.welcomeHint, "Choose the first team to score (Team 1 through Team 8).", "warn");
        return;
      }
      setStartTeamNum(judge, startNum);
      const first = `Team ${startNum}`;
      if (hasSubmissionFor(judge, first)) {
        setHint(els.welcomeHint, "That team already has a submission for this judge.", "warn");
        return;
      }
      resetDraft();
      startScoring(judge, first);
      return;
    }

    const next = getNextTeamForJudge(judge);
    if (!next) {
      setHint(
        els.welcomeHint,
        "All 8 teams are already scored for this judge. Check Records, or pick another judge.",
        "good",
      );
      return;
    }
    resetDraft();
    startScoring(judge, next);
  });

  els.judgeSelect.addEventListener("change", () => {
    refreshWelcomeForJudge();
    setHint(els.welcomeHint, "");
  });
  els.teamSelect.addEventListener("change", () => {
    if (getSubmissionCountForJudge(els.judgeSelect.value) === 0) setHint(els.welcomeHint, "");
  });
}

function initScoring() {
  els.overallFeedback.addEventListener("input", () => {
    state.draft.overallFeedback = els.overallFeedback.value;
  });

  els.resetBtn.addEventListener("click", () => {
    resetDraft();
    renderCriteria();
    renderAwardOptions();
    els.overallFeedback.value = "";
    renderTotal();
    renderSuccessState(false);
    setHint(els.scoreHint, "Form reset.", "good");
  });

  els.backToWelcomeBtn.addEventListener("click", () => {
    if (
      confirm(
        "Return to the welcome screen? Unsaved work on this team will be lost. Submitted teams stay saved.",
      )
    ) {
      goWelcome();
    }
  });

  els.goRecordsBtn.addEventListener("click", () => {
    setTopbarJudge(false);
    renderRecords();
    setView("records");
  });

  els.scoreForm.addEventListener("submit", (e) => {
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
      overallFeedback: state.draft.overallFeedback || "",
      award: state.draft.award || "none",
    };

    addSubmission(submission);
    setHint(els.scoreHint, "Saved locally.", "good");

    const next = getNextTeamForJudge(judge);
    if (next) {
      resetDraft();
      state.selection.team = next;
      state.selection.judge = judge;
      renderSuccessState(false);
      renderScoreContext();
      renderCriteria();
      renderAwardOptions();
      if (els.overallFeedback) els.overallFeedback.value = "";
      renderTotal();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    showJudgeCompletion(judge);
  });

  els.successToRecordsBtn.addEventListener("click", () => {
    setTopbarJudge(false);
    renderRecords();
    setView("records");
  });

  els.scoreAnotherBtn.addEventListener("click", () => {
    renderSuccessState(false);
    goWelcome();
  });

  if (els.completeToRecordsBtn) {
    els.completeToRecordsBtn.addEventListener("click", () => {
      setTopbarJudge(false);
      renderRecords();
      setView("records");
    });
  }
  if (els.completeToWelcomeBtn) {
    els.completeToWelcomeBtn.addEventListener("click", () => {
      goWelcome();
    });
  }
}

function initRecords() {
  els.exportCsvBtn.addEventListener("click", exportCsv);

  els.clearAllBtn.addEventListener("click", () => {
    const ok = confirm("Clear ALL local submissions and team-order settings? This cannot be undone.");
    if (!ok) return;
    clearAllSubmissions();
    clearJudgeFlow();
    renderRecords();
    goWelcome();
    setHint(els.recordsHint, "Cleared all local submissions and queue settings.", "good");
  });
}

// ---------- Init ----------

function init() {
  renderEventText();
  renderWelcome();
  initNav();
  initWelcome();
  initScoring();
  initRecords();

  // default view
  setTabEnabled("score", false);
  setView("welcome");
}

document.addEventListener("DOMContentLoaded", init);

