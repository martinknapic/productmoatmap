// Product Moat Backoffice - homepage featured control (backoffice/featured.html)
//
// The homepage features the newest published interview, for a full Monday to Sunday week. This page
// shows who is featured now and the next two candidates in line (ordered by the date each is planned
// for), how far along each candidacy is, and the switch that makes the next one the featured profile.
// The switch stays disabled until the candidacy is complete: every required question answered,
// approved, and locked. Switching publishes the interview now (see the "publish" action in
// api/_lib/routes/candidates.js, which also makes today its display date).
//
// Loaded after backoffice-candidates.js (API, avatar, toast, confirm helpers) and
// backoffice-calendar.js (boCalEntry: the date a candidate is placed by).

const BO_FEAT_SLOTS = ["Next up", "Then"];
// Profile-backed questions are answered from the profile fields (same map as assets/interview.js).
const BO_FEAT_PROFILE_Q = { q1: "name", q2: "role", q3: "company", q4: "location", q5: "yearsExperience" };

const boFeatFilled = v => v != null && String(v).trim() !== "";

// How complete a candidacy is, and what is still missing before it can be featured.
function boFeatProgress(c) {
  const sections = (c.questionnaire && c.questionnaire.sections) || [];
  const questions = sections.flatMap(s => s.questions);
  const answered = q => (q.fromProfile ? boFeatFilled(c.profile[BO_FEAT_PROFILE_Q[q.id] || "name"]) : boFeatFilled((c.answers || {})[q.id]));
  const req = questions.filter(q => q.required), opt = questions.filter(q => !q.required);
  const p = {
    invited: !!c.invitation && !!c.questionnaire,
    reqDone: req.filter(answered).length, reqTotal: req.length,
    optDone: opt.filter(answered).length, optTotal: opt.length,
    own: (c.custom || []).filter(x => x.q && x.a).length,
    named: boFeatFilled(c.profile.name),
    approved: !!(c.approval && c.approval.approved),
    locked: !!c.locked
  };
  p.requiredComplete = p.invited && p.reqDone === p.reqTotal;
  p.steps = [
    { key: "invited", label: "Questionnaire sent", done: p.invited },
    { key: "required", label: `Required questions answered (${p.reqDone} of ${p.reqTotal})`, done: p.requiredComplete },
    { key: "approved", label: "Answers approved", done: p.approved },
    { key: "locked", label: "Locked (final sign-off)", done: p.locked }
  ];
  p.missing = p.steps.filter(s => !s.done).length + (p.named ? 0 : 1);
  p.ready = p.missing === 0;
  return p;
}

const boFeatIsLive = c => {
  if (c.declined) return false;
  const pub = c.publish || {};
  return !!(pub.publishedAt || (pub.scheduledPublishAt && c.locked && Date.parse(pub.scheduledPublishAt) <= Date.now()));
};
// What the homepage sorts by (the same date the public pages use as publishedDate).
const boFeatShownDate = c => {
  const pub = c.publish || {};
  return pub.displayDate || String(pub.publishedAt || pub.scheduledPublishAt || "").slice(0, 10);
};

// Held back from the spotlight until the week an admin planned for it begins (same rule as the public data).
function boFeatHeldBack(c) {
  const on = (c.publish || {}).featureOn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on || "")) return false;
  const d = new Date(`${on}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10);
}

// Who the homepage features: the newest live interview, skipping ones published without the
// spotlight (same rule as featuredInterview() in assets/site.js, which falls back to everyone live).
function boFeatCurrent(all) {
  const live = all.filter(boFeatIsLive).sort((a, b) =>
    boFeatShownDate(b).localeCompare(boFeatShownDate(a)) || String((b.publish || {}).publishedAt || "").localeCompare(String((a.publish || {}).publishedAt || "")));
  return live.find(c => (c.publish || {}).featured !== false && !boFeatHeldBack(c)) || live[0] || null;
}

// The Monday to Sunday week a date falls in, as UTC midnights (same convention as the calendar).
function boFeatWeek(dateStr) {
  const d = calDateUTC(dateStr);
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}
const boFeatRange = w => `${boCalDayLabel(w.start)} - ${boCalDayLabel(w.end)}`;
const boFeatDatesHTML = w => `
  <div class="feat-dates">
    <span><em>From</em>${boEscapeHTML(boCalDayLabel(w.start))}</span>
    <span><em>To</em>${boEscapeHTML(boCalDayLabel(w.end))}</span>
  </div>`;

function boFeatPerson(c) {
  const role = [c.profile.role, c.profile.company].filter(Boolean).join(" at ");
  return `
    <a class="feat-person" href="candidate?id=${encodeURIComponent(c.id)}">
      ${boCandAvatar(c.profile, "feat-avatar")}
      <span class="feat-person-main">
        <span class="feat-name">${boEscapeHTML(boCandName(c))}</span>
        <span class="feat-sub">${boEscapeHTML(role || "-")}</span>
      </span>
    </a>`;
}

function boFeatBar(label, done, total, tone) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `
    <div class="feat-bar-row">
      <div class="feat-bar-head"><span>${label}</span><strong>${done} of ${total}</strong></div>
      <div class="feat-bar${tone ? ` feat-bar-${tone}` : ""}" role="progressbar" aria-label="${boEscapeHTML(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${pct}%"></i></div>
    </div>`;
}

function boFeatCurrentCard(c, today) {
  if (!c) {
    return `
      <article class="feat-card feat-card-now">
        <div class="feat-slot">On the homepage now</div>
        <p class="feat-empty">No interview is live yet, so the homepage has nobody to feature.</p>
      </article>`;
  }
  const week = boFeatWeek(boFeatShownDate(c));
  const pub = c.publish || {};
  const url = pub.slug ? `/interview/${pub.category || (c.profile.focusTag === "design" ? "productux" : "productmanagement")}/${pub.slug}` : "";
  return `
    <article class="feat-card feat-card-now">
      <div class="feat-slot"><span class="feat-live-dot"></span>On the homepage now</div>
      ${boFeatPerson(c)}
      ${boFeatDatesHTML(week)}
      <p class="feat-note">Featured since ${boEscapeHTML(boCalDayLabel(calDateUTC(boFeatShownDate(c))))}. Stays featured until the next interview goes live.</p>
      <div class="feat-actions">
        ${url ? `<a class="btn btn-ghost" href="${boEscapeHTML(url)}" target="_blank" rel="noopener">View live</a>` : ""}
        <a class="btn btn-ghost" href="candidate?id=${encodeURIComponent(c.id)}">Open candidate</a>
      </div>
    </article>`;
}

function boFeatNextCard(entry, slotLabel, today, isFirst) {
  const c = entry.c, p = boFeatProgress(c);
  const week = boFeatWeek(entry.date);
  const overdue = week.end < today;
  const pub = c.publish || {};
  const kindWord = { scheduled: "Scheduled for", estimated: "Estimated for" }[entry.kind];

  const stepRows = p.steps.map(s => {
    let action = "";
    if (!s.done && s.key === "approved" && p.requiredComplete) action = `<button type="button" class="feat-step-btn" data-act="approve" data-id="${boEscapeHTML(c.id)}">Approve</button>`;
    if (!s.done && s.key === "locked" && p.approved) action = `<button type="button" class="feat-step-btn" data-act="lock" data-id="${boEscapeHTML(c.id)}">Lock</button>`;
    return `<li class="${s.done ? "is-done" : ""}"><span class="feat-tick" aria-hidden="true">${s.done ? "&#10003;" : ""}</span><span class="feat-step-label">${s.label}</span>${action}</li>`;
  }).join("");

  let autoNote = "";
  if (pub.scheduledPublishAt) {
    autoNote = c.locked
      ? `Goes live automatically on ${boEscapeHTML(boWhen(pub.scheduledPublishAt))}.`
      : `Scheduled for ${boEscapeHTML(boWhen(pub.scheduledPublishAt))}, but it only goes live once it is locked.`;
  }

  const missingText = p.ready ? "" : `${p.missing} ${p.missing === 1 ? "step" : "steps"} left before this person can be featured.`;
  return `
    <article class="feat-card${p.ready ? " is-ready" : ""}">
      <div class="feat-slot">${slotLabel}${overdue ? ' <span class="feat-flag">Overdue</span>' : ""}</div>
      ${boFeatPerson(c)}
      ${boFeatDatesHTML(week)}
      <p class="feat-note">${kindWord} ${boEscapeHTML(boCalDayLabel(calDateUTC(entry.date)))}.${overdue ? " That week has already passed." : ""} ${autoNote}</p>
      <div class="feat-status">${boPill(c.status)}<span class="feat-ready ${p.ready ? "is-ready" : ""}">${p.ready ? "Ready to feature" : "Not ready"}</span></div>
      ${p.invited ? boFeatBar("Required questions", p.reqDone, p.reqTotal, p.requiredComplete ? "ok" : "") + boFeatBar("Optional questions", p.optDone, p.optTotal, "") : `<p class="feat-note">No questionnaire yet. Invite them from the candidate page.</p>`}
      ${p.own ? `<p class="feat-note">Plus ${p.own} question${p.own === 1 ? "" : "s"} of their own.</p>` : ""}
      <ul class="feat-steps">${stepRows}</ul>
      ${p.named ? "" : `<p class="feat-warn">Their name is missing from the profile.</p>`}
      <div class="feat-actions">
        <button type="button" class="btn btn-primary" data-act="feature" data-id="${boEscapeHTML(c.id)}" ${p.ready ? "" : "disabled"} ${p.ready ? "" : `title="${boEscapeHTML(missingText)}"`}>Make featured now</button>
        <a class="btn btn-ghost" href="candidate?id=${encodeURIComponent(c.id)}">Open candidate</a>
        ${p.locked ? `<a class="btn btn-ghost" href="preview?id=${encodeURIComponent(c.id)}">Preview</a>` : ""}
      </div>
      ${p.ready ? "" : `<p class="feat-hint">${boEscapeHTML(missingText)}${isFirst ? "" : " You can still switch early once it is complete."}</p>`}
    </article>`;
}

function boFeatEmptyCard(slotLabel) {
  return `
    <article class="feat-card feat-card-empty">
      <div class="feat-slot">${slotLabel}</div>
      <p class="feat-empty">Nobody is planned for this slot yet.</p>
      <div class="feat-actions"><a class="btn btn-ghost" href="candidates">Open candidates</a><a class="btn btn-ghost" href="calendar">Open calendar</a></div>
    </article>`;
}

async function initBackofficeFeatured() {
  if (!(await boCurrentGuard())) return;
  const board = document.getElementById("feat-board");
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  let all = [];

  async function load() {
    try {
      const resp = await fetch("/api/candidates", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("load failed");
      all = await resp.json();
      render();
    } catch (err) {
      board.innerHTML = `<p class="cal-error">Couldn't load the candidates. Reload the page to try again.</p>`;
    }
  }

  function render() {
    const current = boFeatCurrent(all);

    // The queue: everyone not live and not declined that has a planned date, soonest first.
    const queue = all.filter(c => !boFeatIsLive(c)).map(boCalEntry).filter(e => e && e.kind !== "published")
      .sort((a, b) => a.date.localeCompare(b.date) || boCandName(a.c).localeCompare(boCandName(b.c)));
    const undated = all.filter(c => c.status !== "declined" && !boFeatIsLive(c) && !boCalEntry(c)).length;

    const next = queue.slice(0, 2);
    const cards = [boFeatCurrentCard(current, today)]
      .concat(BO_FEAT_SLOTS.map((label, i) => (next[i] ? boFeatNextCard(next[i], label, today, i === 0) : boFeatEmptyCard(label))));

    board.innerHTML = `
      <div class="feat-grid">${cards.join("")}</div>
      <p class="cal-note">${queue.length > 2 ? `${queue.length - 2} more ${queue.length - 2 === 1 ? "candidate is" : "candidates are"} planned after these. ` : ""}${undated ? `${undated} ${undated === 1 ? "candidate has" : "candidates have"} no publish date yet, so ${undated === 1 ? "isn't" : "aren't"} in the queue. ` : ""}Planned dates come from the calendar, where you can drag candidates between weeks.</p>`;
  }

  const errorText = {
    lock_first: "Lock it first.", missing_name: "Their name is missing.", slug_taken: "That URL is already taken."
  };
  async function run(payload, msg) {
    try {
      const data = await boCandApi(payload);
      all = all.map(c => (c.id === payload.id ? { ...c, ...data.candidate } : c));
      render();
      if (msg) boToast(msg);
      return true;
    } catch (err) {
      boToast(errorText[err.message] || "That didn't work - try again.");
      return false;
    }
  }

  board.addEventListener("click", async e => {
    const btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    const c = all.find(x => x.id === btn.dataset.id);
    if (!c) return;
    const name = boEscapeHTML(boCandName(c));
    btn.disabled = true;

    if (btn.dataset.act === "approve") {
      await run({ action: "approve", id: c.id }, "Approved");
    } else if (btn.dataset.act === "lock") {
      const ok = await boConfirm({ title: "Lock this interview?", message: `<strong>${name}</strong> can no longer edit their answers. You can still unlock them from the candidate page.`, confirmLabel: "Lock" });
      if (ok) await run({ action: "lock", id: c.id }, "Locked"); else btn.disabled = false;
    } else if (btn.dataset.act === "feature") {
      const live = boFeatCurrent(all);
      const ok = await boConfirm({
        title: "Switch the featured profile?",
        message: `<strong>${name}</strong> goes live now and becomes the featured profile on the homepage${live ? `, replacing <strong>${boEscapeHTML(boCandName(live))}</strong>` : ""}. The interview is published immediately, with today as its date. Anyone watching the homepage sees the change within about a minute.`,
        confirmLabel: "Make featured now"
      });
      if (!ok) { btn.disabled = false; return; }
      await run({ action: "publish", id: c.id, mode: "now" }, `${boCandName(c)} is now featured on the homepage`);
    }
    render();
  });

  load();
}
