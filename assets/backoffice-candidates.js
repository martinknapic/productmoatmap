// Product Moat Backoffice - the candidate pipeline
//
//   candidates.html      list of everyone who applied, was recommended, or was added by hand
//   candidate.html?id=   one person: profile, invitation, their questionnaire, answers, lock
//   preview.html?id=     the article as it will be published, with schedule / publish controls
//
// All data comes from /api/candidates (admin session required).

const BO_STATUS_LABELS = {
  new: "New", invited: "Invited", drafting: "Drafting", ready: "Ready", locked: "Locked",
  scheduled: "Scheduled", published: "Published", declined: "Declined"
};
const BO_SOURCE_LABELS = { applied: "Applied", recommended: "Recommended", manual: "Added by you" };
const BO_FOCUS = [
  ["ai", "AI & ML"], ["b2b", "B2B SaaS"], ["design", "Product design / UX"], ["growth", "Consumer & Growth"],
  ["fintech", "Fintech"], ["platform", "Platform & Infra"], ["marketplace", "Marketplace"], ["health", "Healthtech"],
  ["leadership", "Product Leadership"], ["other", "Other"]
];

async function boCandApi(payload) {
  const resp = await fetch("/api/candidates", {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(data.error || "request failed"), { data });
  return data;
}

// Photo circle: initials underneath, the photo on top (removed if it fails to load, so a broken
// or expired link falls back to initials). Photos are https URLs, or site paths like assets/photos/x.jpg.
function boCandPhotoSrc(photo) {
  if (!photo) return "";
  return /^https?:\/\//i.test(photo) ? photo : `/${photo.replace(/^\/+/, "")}`;
}
function boCandAvatar(profile, extraClass = "") {
  const src = boCandPhotoSrc(profile.photo);
  return `<div class="avatar bo-cand-avatar ${extraClass}"><span>${boEscapeHTML(boInitials(profile.name))}</span>${src ? `<img src="${boEscapeHTML(src)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.remove()">` : ""}</div>`;
}

// Questionnaire link (Link column): their private interview page. It stays available in every
// status once the questionnaire exists (admins can always open it; it's just read-only for the
// person once locked or live).
function boCandLink(c) {
  if (c.invitation && c.questionnaire && c.status !== "declined") {
    if (c.linkRevoked) return { kind: "Revoked", text: "link revoked", url: null };
    return { kind: "Questionnaire", text: `interview?t=${c.id.slice(0, 8)}…`, url: `${location.origin}/interview?t=${c.id}` };
  }
  return null;
}

// The article itself (Article column): "Preview" -> the article as it stands, from the moment the
// questionnaire exists (the private preview page, which admins may open; the admin preview page once
// it's locked or scheduled), "Published" -> the public URL once it's live.
function boArticleLink(c) {
  if (["invited", "drafting", "ready"].includes(c.status) && c.invitation && c.questionnaire) {
    // a revoked questionnaire link also closes the private preview page, so use the admin preview then
    return { kind: "Preview", url: c.linkRevoked ? `${location.origin}/backoffice/preview?id=${c.id}` : `${location.origin}/interview-preview?t=${c.id}` };
  }
  if (c.status === "locked" || c.status === "scheduled") {
    return { kind: c.status === "scheduled" ? "Scheduled" : "Preview", url: `${location.origin}/backoffice/preview?id=${c.id}` };
  }
  if (c.status === "published" && c.publish && c.publish.slug) {
    const category = c.publish.category || (c.profile.focusTag === "design" ? "productux" : "productmanagement");
    return { kind: "Published", url: `${location.origin}/interview/${category}/${c.publish.slug}` };
  }
  return null;
}

const boPill = status => `<span class="bo-pill bo-pill-${boEscapeHTML(status)}">${boEscapeHTML(BO_STATUS_LABELS[status] || status)}</span>`;
const boQuestionnaireLink = c => `${location.origin}/interview?t=${c.id}`;
const boWhen = iso => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-");
const boCandName = c => c.profile.name || "(name not known yet)";
const boToast = (text) => {
  let el = document.getElementById("bo-toast");
  if (!el) { el = document.createElement("div"); el.id = "bo-toast"; el.className = "bo-toast"; document.body.appendChild(el); }
  el.textContent = text; el.hidden = false;
  clearTimeout(boToast.t); boToast.t = setTimeout(() => { el.hidden = true; }, 2600);
};

// ============================ list ============================

const BO_LINKEDIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.554V9h3.565v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
const BO_COPY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
const BO_CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// The recommender's LinkedIn: the profile URL they gave when recommending, or (older records / left
// blank) a LinkedIn people search for their name, so the icon always leads somewhere useful.
function boRecommenderLinkedIn(rec) {
  if (rec.recommenderLinkedin) return { url: rec.recommenderLinkedin, exact: true };
  return { url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(rec.recommenderName || "")}`, exact: false };
}

// Hover/focus card for the LinkedIn icons in the list (the candidate's own, and the recommender's):
// a name and an email, each with a copy button. One floating element (position: fixed) so the table's horizontal scroll can't clip it.
function boContactTooltip() {
  let pop = null, hideTimer = null, current = null;

  // info: { title, name, email, notes: [string] }
  function build(info) {
    const row = (label, value) => `
      <div class="bo-rec-line">
        <span class="bo-rec-label">${label}</span>
        <span class="bo-rec-value">${value ? boEscapeHTML(value) : "-"}</span>
        ${value ? `<button type="button" class="bo-rec-copy" data-copy-text="${boEscapeHTML(value)}" aria-label="Copy ${label.toLowerCase()}" title="Copy ${label.toLowerCase()}">${BO_COPY_SVG}</button>` : ""}
      </div>`;
    return `
      <div class="bo-rec-title">${boEscapeHTML(info.title)}</div>
      ${row("Name", info.name)}
      ${row("Email", info.email)}
      ${(info.notes || []).map(n => `<div class="bo-rec-note">${boEscapeHTML(n)}</div>`).join("")}`;
  }

  function ensure() {
    if (pop) return pop;
    pop = document.createElement("div");
    pop.className = "bo-rec-pop";
    pop.setAttribute("role", "tooltip");
    pop.hidden = true;
    pop.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    pop.addEventListener("mouseleave", hideSoon);
    pop.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy-text]");
      if (!btn) return;
      e.stopPropagation();
      try { await navigator.clipboard.writeText(btn.dataset.copyText); } catch (err) { window.prompt("Copy:", btn.dataset.copyText); return; }
      btn.innerHTML = BO_CHECK_SVG;
      btn.classList.add("is-copied");
      setTimeout(() => { btn.innerHTML = BO_COPY_SVG; btn.classList.remove("is-copied"); }, 1400);
    });
    document.body.appendChild(pop);
    return pop;
  }

  function show(anchor, info) {
    clearTimeout(hideTimer);
    const el = ensure();
    el.innerHTML = build(info);
    el.hidden = false;
    current = anchor;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8));
    const top = a.bottom + 6 + h > window.innerHeight ? Math.max(8, a.top - h - 6) : a.bottom + 6;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
  function hideSoon() { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (pop) pop.hidden = true; current = null; }, 160); }

  return { show, hideSoon, isFor: (a) => current === a };
}

// ---------- icons, tooltips and confirmation for the per-row actions ----------

const boIcon = d => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const BO_ICONS = {
  edit: boIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  link: boIcon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  send: boIcon('<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4Z"/>'),
  ban: boIcon('<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>'),
  undo: boIcon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  check: boIcon('<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/>'),
  lock: boIcon('<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  unlock: boIcon('<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
  eye: boIcon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  down: boIcon('<circle cx="12" cy="12" r="10"/><path d="M8 12l4 4 4-4"/><path d="M12 8v8"/>'),
  archive: boIcon('<path d="M3 4h18v4H3z"/><path d="M5 8v12h14V8"/><path d="M10 12h4"/>'),
  trash: boIcon('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
  live: boIcon('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  netIn: boIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M17 11l2 2 4-4"/>'),
  netOut: boIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/>')
};

// boIconTooltips (data-tip hover/focus tooltip) now lives in backoffice.js, shared
// by every backoffice page including the nav icons.

// Confirmation dialog: resolves true only if they press the confirm button. Cancel is focused first,
// and Esc, the backdrop and Cancel all say no.
function boConfirm({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise(resolve => {
    const opener = document.activeElement;
    const el = document.createElement("div");
    el.className = "bo-modal";
    el.innerHTML = `
      <div class="bo-modal-card bo-confirm" role="alertdialog" aria-modal="true" aria-labelledby="bo-confirm-title" aria-describedby="bo-confirm-msg">
        <h3 id="bo-confirm-title">${boEscapeHTML(title)}</h3>
        <p id="bo-confirm-msg" class="bo-confirm-msg">${message}</p>
        <div class="bo-confirm-actions">
          <button type="button" class="btn btn-ghost" data-r="no">Cancel</button>
          <button type="button" class="btn ${danger ? "bo-confirm-danger" : "btn-primary"}" data-r="yes">${boEscapeHTML(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const done = (v) => { document.removeEventListener("keydown", onKey, true); el.remove(); if (opener && opener.focus) opener.focus(); resolve(v); };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); done(false); return; }
      if (e.key === "Tab") {
        const b = [...el.querySelectorAll("button")]; const f = b[0], l = b[b.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); } else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    el.addEventListener("click", e => { if (e.target === el) return done(false); const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "yes"); });
    el.querySelector('[data-r="no"]').focus();
  });
}

// The date column: when it went live, when it is scheduled, or (dim) what we told them to expect.
function boPublishedCell(c) {
  const pub = c.publish || {};
  const day = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "medium" }) : "");
  if (c.status === "published") return `<span class="bo-cell-strong">${boEscapeHTML(day(pub.displayDate || pub.publishedAt) || "-")}</span>`;
  if (c.status === "scheduled") return `<span class="bo-pub-sched">Scheduled</span><br><span class="bo-cell-dim">${boEscapeHTML(day(pub.scheduledPublishAt))}</span>`;
  const est = c.invitation && c.invitation.estimatedPublishDate;
  if (est) return `<span class="bo-cell-dim">Est. ${boEscapeHTML(new Date(`${est}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" }))}</span>`;
  return `<span class="bo-cell-dim">-</span>`;
}
// The Featured column: the Monday to Sunday week the candidate holds the homepage (the week of the
// same date the calendar places them by - boCalEntry in backoffice-calendar.js), linked to that week
// on the Featured calendar.
function boFeaturedCell(c) {
  const e = typeof boCalEntry === "function" ? boCalEntry(c) : null;
  if (!e) return `<span class="bo-cell-dim">-</span>`;
  if (!e.feat) return `<span class="bo-cell-dim">Not featured</span>`;
  const d = new Date(`${e.feat}T00:00:00Z`);
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = x => x.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const state = e.kind === "published" ? "" : `<br><span class="bo-cell-dim">${e.kind === "scheduled" ? "Planned" : "Est."}</span>`;
  return `<a class="bo-feat-link" href="calendar?mode=featured&date=${e.feat}" title="Show this week on the Featured calendar">${boEscapeHTML(fmt(mon))} - ${boEscapeHTML(fmt(sun))}</a>${state}`;
}
// ---- The candidate's Dates tab: publish date (published / not published) and featured date (was / is / planned) ----
// Moving the publish date keeps a separately set featured date at least in the same week.
function boDatesPayload(c, field, value) {
  const e = boCalEntry(c), p = { action: "setDates", [field]: value };
  if (field === "publishDate" && e && e.kind !== "published" && c.publish.featureOn) p.featureDate = e.feat === e.date ? value : (e.feat > value ? e.feat : value);
  return p;
}
const boDatesPill = (label, cls) => `<span class="bo-pill bo-pill-${cls}">${boEscapeHTML(label)}</span>`;
function boDatesHTML(c) {
  const e = boCalEntry(c), live = c.status === "published", sched = c.status === "scheduled" || (!live && !!(c.publish || {}).scheduledPublishAt);
  const monday = day => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
  const todayStr = new Date().toLocaleDateString("en-CA");
  const range = day => { const m = monday(day), u = new Date(m); u.setUTCDate(m.getUTCDate() + 6); const f = x => x.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); return `${f(m)} - ${f(u)}`; };
  const unfeatured = live && c.publish && c.publish.featured === false;
  let featState = ["Planned", "scheduled"], featHelp = "Pick the week this person is featured on the homepage: the week they are published or later. This is a plan only; you feature someone yourself.";
  if (unfeatured) {
    featState = e && e.feat ? ["Planned", "scheduled"] : ["Not featured", "declined"];
    featHelp = "Live, but not featured. Pick the week you plan to feature them. It won't happen on its own: use Feature on homepage now in Sign-off &amp; preview when you are ready.";
  } else if (e && live) {
    const endOfWeek = new Date(monday(e.feat)); endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
    featState = monday(e.feat) > monday(todayStr) ? ["Planned", "scheduled"] : endOfWeek < monday(todayStr) ? ["Was featured", "published"] : ["Is featured", "published"];
    featHelp = "A featured live interview is featured from its publish date, so this is the same date as above.";
  }
  const pubLabel = live ? "Published on" : sched ? "Scheduled for" : "Est. publish date";
  const canEstimate = live || sched || !!c.invitation;
  return `
    <h3>Dates</h3>
    <p class="bo-section-note">Change a date here and the Applied list and the calendar update with it. You can also drag people between weeks on the <a class="bracket-link" href="calendar${e && e.feat ? `?mode=featured&date=${e.feat}` : ""}">[ calendar ]</a>.</p>
    <div class="bo-form-grid">
      <div class="bo-lbl">
        <span>Publish date ${boDatesPill(live ? "Published" : "Not published", live ? "published" : "new")}</span>
        <label class="bo-lbl">${pubLabel}<input class="bo-input" type="date" id="bo-date-publish" value="${boEscapeHTML(e ? e.date : "")}" ${canEstimate ? "" : "disabled"}></label>
        <span class="bo-cell-dim">${canEstimate ? (live ? "Moves the date the article shows and counts from." : "Not live yet - go to Sign-off &amp; preview to publish or schedule it.") : "Invite the person first to set an estimated date."}</span>
      </div>
      <div class="bo-lbl">
        <span>Featured ${boDatesPill(featState[0], featState[1])}</span>
        <label class="bo-lbl">${live && !unfeatured ? "Featured from" : "Est. featured date"}<input class="bo-input" type="date" id="bo-date-feature" value="${boEscapeHTML(e ? e.feat : "")}" ${(live && !unfeatured) || !e ? "disabled" : ""}></label>
        <span class="bo-cell-dim">${e && e.feat ? `Featured week: ${boEscapeHTML(range(e.feat))}. ` : ""}${featHelp}</span>
      </div>
    </div>`;
}
const boPublishedTime = c => { const p = c.publish || {}; return Date.parse(p.publishedAt || p.scheduledPublishAt || "") || 0; };

// Alumni network column: read live off their member record (attached by the API as c.network),
// not stored on the candidate itself - so it always matches what My profile / the network page shows.
const boCandNetEmail = c => c.profile.email || (c.verified && c.verified.email) || "";
function boNetPill(c) {
  if (!boCandNetEmail(c)) return `<span class="bo-cell-dim">-</span>`;
  const n = c.network;
  const on = !!(n && n.optedIn);
  const day = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "medium" }) : "");
  const tip = on
    ? `In the alumni network${n.at ? ` since ${day(n.at)}` : ""}.`
    : n && n.leftAt ? `Left the alumni network on ${day(n.leftAt)}.` : "Hasn't opted in to the alumni network.";
  return `<span class="bo-pill bo-pill-${on ? "nl-confirmed" : "nl-off"}" data-tip="${boEscapeHTML(tip)}" tabindex="0">${on ? "In" : "Not in"}</span>`;
}

// Every action that already exists on the candidate and preview pages, as one row of icon buttons.
// Which ones show depends on where the person is in the pipeline. [group, key, icon, tooltip, {href|danger}]
function boRowActions(c) {
  const id = encodeURIComponent(c.id);
  const invited = !!(c.invitation && c.questionnaire);
  const live = c.status === "published", sched = c.status === "scheduled", declined = !!c.declined;
  const approved = !!(c.approval && c.approval.approved);
  const a = [];
  a.push(["main", "edit", "edit", "Edit: profile, invitation, questions and answers", { href: `candidate?id=${id}` }]);
  if (boCandNetEmail(c)) {
    const netOn = !!(c.network && c.network.optedIn);
    a.push(["main", netOn ? "networkOut" : "networkIn", netOn ? "netOut" : "netIn", netOn ? "Kick out of the alumni network" : "Check into the alumni network"]);
  }
  if (declined) {
    a.push(["main", "restore", "undo", "Restore to the pipeline"]);
  } else {
    if (!invited) a.push(["main", "invite", "send", "Invite: create their questionnaire and mark as invited"]);
    if (invited) {
      a.push(["link", "copyLink", "link", "Copy their private questionnaire link"]);
      a.push(["link", c.linkRevoked ? "restoreLink" : "revokeLink", c.linkRevoked ? "undo" : "ban", c.linkRevoked ? "Restore the questionnaire link" : "Revoke the questionnaire link (they can no longer open it)"]);
    }
    if (invited && !live && !sched) {
      a.push(["flow", approved ? "unapprove" : "approve", approved ? "undo" : "check", approved ? "Reopen: clear the final sign-off" : "Make final on their behalf"]);
      if (!c.locked) a.push(["flow", "lock", "lock", "Lock and prepare the review (they can no longer edit)"]);
      else a.push(["flow", "unlock", "unlock", "Unlock so they can edit again"]);
    }
    if (c.locked || sched || live) a.push(["flow", "preview", "eye", "Open the preview, then schedule or publish", { href: `preview?id=${id}` }]);
    if (live || sched) a.push(["flow", "unpublish", "down", live ? "Unpublish: take it offline and return to preview" : "Cancel the schedule and return to preview"]);
    a.push(["danger", "decline", "archive", "Decline / archive: remove from the pipeline (can be restored)"]);
  }
  a.push(["danger", "delete", "trash", "Delete permanently", { danger: true }]);
  return a;
}

function boActionsHTML(c) {
  const rows = boRowActions(c);
  let last = "";
  return `<div class="bo-actions" role="group" aria-label="Actions for ${boEscapeHTML(boCandName(c))}">` + rows.map(([group, key, icon, tip, o = {}]) => {
    const sep = last && last !== group ? '<span class="bo-actions-sep" aria-hidden="true"></span>' : "";
    last = group;
    const cls = `bo-icon-btn${o.danger ? " is-danger" : ""}`;
    return sep + (o.href
      ? `<a class="${cls}" href="${boEscapeHTML(o.href)}" data-tip="${boEscapeHTML(tip)}" aria-label="${boEscapeHTML(tip)}">${BO_ICONS[icon]}</a>`
      : `<button type="button" class="${cls}" data-act="${key}" data-id="${boEscapeHTML(c.id)}" data-tip="${boEscapeHTML(tip)}" aria-label="${boEscapeHTML(tip)}">${BO_ICONS[icon]}</button>`);
  }).join("") + `</div>`;
}

async function initBackofficeCandidates() {
  if (!(await boCurrentGuard())) return;

  const state = { all: [], status: "all", source: "all", q: "", sort: "updated", dir: "desc" };
  const listEl = document.getElementById("bo-cand-body");
  const chipsEl = document.getElementById("bo-cand-chips");

  // Sortable columns: the value each row is ordered by. Rows with no value always go last.
  const STATUS_ORDER = Object.keys(BO_STATUS_LABELS);
  const SORTS = {
    name: c => boCandName(c).toLowerCase(),
    role: c => `${c.profile.role || ""} ${c.profile.company || ""}`.trim().toLowerCase(),
    location: c => (c.profile.location || "").toLowerCase(),
    source: c => BO_SOURCE_LABELS[c.source] || c.source || "",
    alumni: c => (c.network && c.network.optedIn ? 1 : 0),
    status: c => STATUS_ORDER.indexOf(c.status),
    published: c => { const e = boCalEntry(c); return e ? e.date : ""; },
    featured: c => { const e = boCalEntry(c); return e ? e.feat : ""; },
    updated: c => c.updatedAt || "",
    created: c => c.createdAt || ""
  };
  const DEFAULT_DIR = { name: "asc", role: "asc", location: "asc", source: "asc", status: "asc" }; // everything else starts newest / highest first
  const compare = (x, y) => {
    const a = SORTS[state.sort](x), b = SORTS[state.sort](y);
    const empty = v => v === "" || v == null;
    if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : empty(a) ? 1 : -1;
    const r = typeof a === "number" ? a - b : String(a).localeCompare(String(b));
    return state.dir === "asc" ? r : -r;
  };
  // A header click on the sorted column flips it; on another column it starts that column's default order.
  const setSort = (key, dir) => {
    const same = state.sort === key;
    state.sort = key;
    state.dir = dir || (same ? (state.dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key] || "desc");
  };



  function render() {
    const counts = {};
    state.all.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    chipsEl.innerHTML = [["all", "All", state.all.length], ...Object.keys(BO_STATUS_LABELS).map(s => [s, BO_STATUS_LABELS[s], counts[s] || 0])]
      .map(([k, label, n]) => `<button type="button" class="bo-chip${state.status === k ? " is-active" : ""}" data-status="${k}">${boEscapeHTML(label)} <span>${n}</span></button>`).join("");

    const q = state.q.trim().toLowerCase();
    const rows = state.all.filter(c =>
      (state.status === "all" || c.status === state.status) &&
      (state.source === "all" || c.source === state.source) &&
      (!q || [c.profile.name, c.profile.company, c.profile.role, c.profile.email, c.profile.location].join(" ").toLowerCase().includes(q))
    ).sort(compare);
    document.querySelectorAll("#bo-cand-head [data-sort]").forEach(th => {
      const on = th.dataset.sort === state.sort;
      th.setAttribute("aria-sort", on ? (state.dir === "asc" ? "ascending" : "descending") : "none");
      th.querySelector(".bo-sort-arrow").textContent = on ? (state.dir === "asc" ? "▲" : "▼") : "";
    });
    const sel = document.getElementById("bo-cand-sort");
    sel.value = [...sel.options].some(o => o.value === state.sort) ? state.sort : sel.value;
    document.getElementById("bo-cand-count").textContent = `(${rows.length})`;
    document.getElementById("bo-cand-empty").hidden = rows.length > 0;
    listEl.innerHTML = rows.map(c => `
      <tr class="bo-row-link${c.declined ? " is-declined" : ""}" data-open="${boEscapeHTML(c.id)}">
        <td class="bo-cell-photo">${boCandAvatar(c.profile)}</td>
        <td class="bo-cell-strong">${boEscapeHTML(boCandName(c))}
          ${c.profile.linkedin ? `<a class="bo-rec bo-li bo-li-inline" data-tip-cand="${boEscapeHTML(c.id)}" href="${boEscapeHTML(c.profile.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${boEscapeHTML(boCandName(c))}'s LinkedIn profile - hover for name and email">${BO_LINKEDIN_SVG}</a>` : ""}
          <br><span class="bo-cell-dim">${boEscapeHTML(c.profile.email || "")}</span></td>
        <td>${boEscapeHTML(c.profile.role) || "-"}<br><span class="bo-cell-dim">${boEscapeHTML(c.profile.company)}</span></td>
        <td>${boEscapeHTML(c.profile.location) || "-"}</td>
        <td><span class="bo-badge bo-badge-src">${boEscapeHTML(BO_SOURCE_LABELS[c.source] || c.source)}</span>${c.recommendation ? ` <a class="bo-rec bo-li-inline" data-tip-rec="${boEscapeHTML(c.id)}" href="${boEscapeHTML(boRecommenderLinkedIn(c.recommendation).url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${boEscapeHTML(c.recommendation.recommenderName || "the recommender")}'s LinkedIn - hover for who recommended them">${BO_LINKEDIN_SVG}</a>` : ""}</td>
        <td>${boNetPill(c)}</td>
        <td>${boPill(c.status)}</td>
        <td>${boPublishedCell(c)}</td>
        <td>${boFeaturedCell(c)}</td>
        <td class="bo-cell-url">${(() => {
          const a = boArticleLink(c);
          if (!a) return `<span class="bo-cell-dim">-</span>`;
          return `<a class="bo-url" href="${boEscapeHTML(a.url)}" target="_blank" rel="noopener noreferrer" title="${boEscapeHTML(a.url)}"><span class="bo-url-kind bo-url-${boEscapeHTML(a.kind.toLowerCase() === "published" ? "live" : a.kind.toLowerCase())}">${boEscapeHTML(a.kind)}</span><span aria-hidden="true">↗</span></a>`;
        })()}</td>
        <td class="bo-cell-url">${(() => {
          const l = boCandLink(c);
          if (!l) return `<span class="bo-cell-dim">-</span>`;
          if (!l.url) return `<span class="bo-cell-dim">${boEscapeHTML(l.text)}</span>`;
          return `<a class="bo-url" href="${boEscapeHTML(l.url)}" target="_blank" rel="noopener noreferrer" title="${boEscapeHTML(l.url)}"><span class="bo-url-kind bo-url-${boEscapeHTML(l.kind.toLowerCase())}">${boEscapeHTML(l.kind)}</span><span aria-hidden="true">↗</span></a>`;
        })()}</td>
        <td>${boEscapeHTML(boWhen(c.updatedAt))}${c.invitation ? `<br><span class="bo-cell-dim">Invited by ${boEscapeHTML(c.invitation.channel === "linkedin" ? "LinkedIn" : "email")}, ${boEscapeHTML(new Date(c.invitation.sentAt).toLocaleDateString())}</span>` : ""}</td>
        <td class="bo-cell-actions">${boActionsHTML(c)}</td>
      </tr>`).join("");
  }

  chipsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-status]"); if (b) { state.status = b.dataset.status; render(); } });
  document.getElementById("bo-cand-source").addEventListener("change", (e) => { state.source = e.target.value; render(); });
  document.getElementById("bo-cand-sort").addEventListener("change", (e) => { setSort(e.target.value, DEFAULT_DIR[e.target.value] || "desc"); render(); });
  const head = document.getElementById("bo-cand-head");
  const headSort = e => { const th = e.target.closest("[data-sort]"); if (th) { setSort(th.dataset.sort); render(); } };
  head.addEventListener("click", headSort);
  head.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); headSort(e); } });
  document.getElementById("bo-cand-search").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  const tip = boContactTooltip();
  boIconTooltips(listEl);
  // what the hover card shows for a given icon: data-tip-cand = the candidate, data-tip-rec = their recommender
  const infoOf = (btn) => {
    const c = state.all.find(x => x.id === (btn.dataset.tipCand || btn.dataset.tipRec));
    if (!c) return null;
    if (btn.dataset.tipCand) {
      return { title: "Candidate", name: c.profile.name, email: c.profile.email, notes: c.profile.email ? [] : ["No email saved yet - add one on their page."] };
    }
    const rec = c.recommendation;
    if (!rec) return null;
    return {
      title: "Recommended by", name: rec.recommenderName, email: rec.recommenderEmail,
      notes: [
        boRecommenderLinkedIn(rec).exact ? "Click the icon to open their LinkedIn profile." : "No profile link was saved - the icon opens a LinkedIn search for their name.",
        ...(rec.stayAnonymous ? ["Asked to stay anonymous - the invitation doesn't name them."] : [])
      ]
    };
  };
  const tipTarget = (e) => e.target.closest("[data-tip-cand], [data-tip-rec]");
  listEl.addEventListener("mouseover", (e) => { const b = tipTarget(e); const i = b && infoOf(b); if (i) tip.show(b, i); });
  listEl.addEventListener("mouseout", (e) => { if (tipTarget(e)) tip.hideSoon(); });
  listEl.addEventListener("focusin", (e) => { const b = tipTarget(e); const i = b && infoOf(b); if (i) tip.show(b, i); });
  listEl.addEventListener("focusout", (e) => { if (tipTarget(e)) tip.hideSoon(); });
  window.addEventListener("scroll", () => tip.hideSoon(), true);

  // ----- row actions -----
  const replace = (cand) => { const i = state.all.findIndex(x => x.id === cand.id); if (i !== -1) state.all[i] = cand; };
  const ERRORS = { unpublish_first: "Unpublish it first.", lock_first: "Lock it first.", storage_failed: "Couldn't save: storage isn't reachable." };

  async function run(key, c) {
    const name = boEscapeHTML(boCandName(c));
    const call = async (payload, okMsg) => {
      try {
        const data = await boCandApi({ id: c.id, ...payload });
        if (data.deleted) state.all = state.all.filter(x => x.id !== c.id); else if (data.candidate) replace(data.candidate);
        render();
        if (okMsg) boToast(okMsg);
        return data;
      } catch (err) { boToast(ERRORS[err.message] || "That didn't work - try again."); return null; }
    };
    switch (key) {
      case "copyLink":
        try { await navigator.clipboard.writeText(boQuestionnaireLink(c)); boToast("Questionnaire link copied"); } catch (err) { window.prompt("Copy this link:", boQuestionnaireLink(c)); }
        return;
      case "invite": {
        if (!(await boConfirm({ title: "Invite this person?", message: `This creates <strong>${name}</strong>'s private questionnaire and marks them as invited. You then send them the link yourself, and the next screen has the message ready to copy.`, confirmLabel: "Create & invite" }))) return;
        const data = await call({ action: "invite", channel: c.source === "recommended" ? "linkedin" : "email" });
        if (data) location.href = `candidate?id=${encodeURIComponent(c.id)}#invitation`;
        return;
      }
      case "revokeLink":
        if (!(await boConfirm({ title: "Revoke the questionnaire link?", message: `<strong>${name}</strong> will no longer be able to open their questionnaire until you restore the link.`, confirmLabel: "Revoke link", danger: true }))) return;
        return call({ action: "revokeLink", revoked: true }, "Link revoked");
      case "restoreLink": return call({ action: "revokeLink", revoked: false }, "Link restored");
      case "approve": return call({ action: "approve", approved: true }, "Marked as final on their behalf");
      case "unapprove": return call({ action: "approve", approved: false }, "Sign-off cleared");
      case "lock": {
        const approved = !!(c.approval && c.approval.approved);
        if (!(await boConfirm({ title: "Lock and prepare the review?", message: `${approved ? "" : `<strong>${name}</strong> hasn't marked this version as final. `}Locking means they can no longer edit, and you can then preview and publish. You can unlock it again later.`, confirmLabel: "Lock & prepare review" }))) return;
        const data = await call({ action: "lock", locked: true });
        if (data) location.href = `preview?id=${encodeURIComponent(c.id)}`;
        return;
      }
      case "unlock": return call({ action: "lock", locked: false }, "Unlocked, they can edit again");
      case "networkIn":
        if (!(await boConfirm({ title: "Check into the alumni network?", message: `<strong>${name}</strong> is added to the Product Moat alumni network - visible to other members once they've been interviewed, and with access to the directory right away.`, confirmLabel: "Check in" }))) return;
        return call({ action: "setNetwork", optedIn: true }, "Checked into the alumni network");
      case "networkOut":
        if (!(await boConfirm({ title: "Kick out of the alumni network?", message: `<strong>${name}</strong> loses access to the alumni network directory and disappears from it immediately.`, confirmLabel: "Kick out", danger: true }))) return;
        return call({ action: "setNetwork", optedIn: false }, "Removed from the alumni network");
      case "unpublish": {
        const live = c.status === "published";
        if (!(await boConfirm({ title: live ? "Take this interview offline?" : "Cancel the schedule?", message: live ? `<strong>${name}</strong>'s interview goes offline and returns to preview. It stays locked, so you can review or reschedule it.` : `<strong>${name}</strong>'s interview will no longer go live on schedule and returns to preview.`, confirmLabel: live ? "Unpublish" : "Cancel schedule", danger: true }))) return;
        return call({ action: "unpublish" }, live ? "Unpublished, back in preview" : "Schedule cancelled");
      }
      case "decline":
        if (!(await boConfirm({ title: "Decline and archive?", message: `<strong>${name}</strong> is removed from the pipeline and their questionnaire link stops working. Nothing is deleted, and you can restore them any time.`, confirmLabel: "Decline / archive", danger: true }))) return;
        return call({ action: "decline", declined: true }, "Archived");
      case "restore": return call({ action: "decline", declined: false }, "Restored to the pipeline");
      case "delete":
        if (!(await boConfirm({ title: "Delete permanently?", message: `<strong>${name}</strong> and everything attached to them will be removed for good: their profile and answers${c.featuredPhoto ? ", their featured photo" : ""}${c.status === "published" ? " and the published interview" : ""}. <strong>This can't be undone.</strong> If you only want them out of the pipeline, decline / archive them instead.`, confirmLabel: "Delete permanently", danger: true }))) return;
        return call({ action: "delete" }, `${boCandName(c)} was deleted`);
    }
  }

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (btn) {
      e.stopPropagation();
      const c = state.all.find(x => x.id === btn.dataset.id);
      if (!c || btn.disabled) return;
      btn.disabled = true;
      try { await run(btn.dataset.act, c); } finally { btn.disabled = false; }
      return;
    }
    if (e.target.closest("a")) return; // links (LinkedIn, article, questionnaire, actions) open on their own; never open the row
    const row = e.target.closest("[data-open]");
    if (row) location.href = `candidate?id=${encodeURIComponent(row.dataset.open)}`;
  });

  // add by hand
  const form = document.getElementById("bo-add-form");
  document.getElementById("bo-add-toggle").addEventListener("click", () => { form.hidden = !form.hidden; if (!form.hidden) form.elements.name.focus(); });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const profile = Object.fromEntries(["name", "email", "role", "company", "location", "linkedin", "focusTag"].map(k => [k, String(f.get(k) || "")]));
    try {
      const data = await boCandApi({ action: "create", profile, notes: String(f.get("notes") || "") });
      location.href = `candidate?id=${encodeURIComponent(data.id)}`;
    } catch (err) {
      boToast(err.message === "missing_name" ? "A name is required."
        : err.message === "storage_failed" ? "Couldn't save: storage isn't reachable (is Vercel Blob connected to this project?)."
        : "Couldn't add that person - please try again.");
    }
  });

  try {
    state.all = await (await fetch("/api/candidates", { credentials: "same-origin" })).json();
    render();
  } catch (err) {
    document.getElementById("bo-cand-error").hidden = false;
  }
}

// ============================ detail ============================

function boInviteMessage(c, channel, link, estimated) {
  const first = (c.profile.name || "").split(/\s+/)[0] || "there";
  const est = estimated ? new Date(`${estimated}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  const rec = c.recommendation || {};
  const how = `It's a set of questions about your path into product, how you think, and how AI is changing the craft. Only a handful are required and the rest are optional; you can also add up to three questions of your own. Each answer has its own Save button, and what you've saved is waiting for you whenever you come back. When you're happy with them, press the button at the bottom of the page - we'll then prepare a preview together, and nothing goes public until you've had the final say.`;
  // The page is private: opening it means signing in with LinkedIn (which also creates their private profile).
  const signupLine = c.source === "recommended" || !c.profile.email
    ? `\n\nThe page is private, so you'll be asked to sign in with LinkedIn first - one click, and you land right back on it.`
    : `\n\nThe page is private, so you'll be asked to sign in with LinkedIn first - please use the account that goes with ${c.profile.email}.`;
  const estLine = est ? `\n\nWe're aiming to publish around ${est}.` : "";

  let opening;
  if (c.source === "applied") {
    opening = `Thank you for applying to be featured on Product Moat - we read every application ourselves, and we'd love to interview you.`;
  } else if (c.source === "recommended") {
    const who = rec.stayAnonymous || !rec.recommenderName ? "Someone in the Product Moat community" : rec.recommenderName;
    opening = `${who} recommended you for Product Moat, an interview series about how product people think and work in the age of AI - and we'd love to feature you.`;
  } else {
    opening = `I'm Martin, and I run Product Moat, an interview series about how product people think and work in the age of AI. I'd love to feature you.`;
  }

  if (channel === "linkedin") {
    return {
      subject: "",
      body: `Hi ${first},\n\n${opening}\n\nHere's your personal, private interview page: ${link}\n\n${how}${signupLine}${estLine}\n\nIf it's not for you, no problem at all - just let me know.\n\nMartin`
    };
  }
  return {
    subject: "Your Product Moat interview",
    body: `Hi ${first},\n\n${opening}\n\nHere's your personal, private interview page - only you (and I) can open it:\n${link}\n\n${how}${signupLine}${estLine}\n\nIf it's not for you, no problem at all - just reply and let me know.\n\nWarm regards,\nMartin`
  };
}

async function initBackofficeCandidate() {
  if (!(await boCurrentGuard())) return;
  const id = new URLSearchParams(location.search).get("id");
  const root = document.getElementById("bo-cand-root");
  let c;
  let qEditor = null;
  let msgChannel = null;
  let activeTab = (location.hash || "").slice(1); // Profile | Invitation | Questions | Answers | Sign-off; kept in the URL hash

  async function load() {
    try {
      const resp = await fetch(`/api/candidates?id=${encodeURIComponent(id)}`, { credentials: "same-origin" });
      if (!resp.ok) throw new Error("nf");
      c = await resp.json();
      render();
    } catch (err) { root.innerHTML = `<p class="bo-empty">Candidate not found. <a class="bracket-link" href="candidates">[ Back to the list ]</a></p>`; }
  }

  async function act(payload, okMsg) {
    try {
      const data = await boCandApi({ id, ...payload });
      if (data.deleted) { location.href = "candidates"; return null; }
      if (data.candidate) c = data.candidate;
      render();
      if (okMsg) boToast(okMsg);
      return data;
    } catch (err) {
      boToast(({ feature_before_publish: "Featuring can't start before the week they are published.", date_in_past: "A scheduled date can't be in the past.", invite_first: "Invite the person first to set an estimated date.", slug_taken: "That URL is already taken.", lock_first: "Lock it first.", unpublish_first: "Unpublish first." })[err.message] || "That didn't work - try again.");
      return null;
    }
  }

  function render() {
    const p = c.profile;
    const invited = !!c.invitation;
    const link = boQuestionnaireLink(c);
    const est = (c.invitation && c.invitation.estimatedPublishDate) || "";
    msgChannel = msgChannel || (c.invitation && c.invitation.channel) || (c.source === "recommended" ? "linkedin" : "email");
    const msg = boInviteMessage(c, msgChannel, link, est);
    const answered = Object.keys(c.answers || {}).length;
    const ro = c.status === "published";

    // Before the invitation only Profile and Invitation exist; the rest appear once the questionnaire does.
    const tabs = [["profile", "Profile"], ["invitation", "Invitation"], ["dates", "Dates"],
      ...(invited ? [["questions", "Questions"], ["answers", `Answers <span class="bo-tab-count">${answered}</span>`], ["signoff", "Sign-off &amp; preview"]] : [])];
    if (!tabs.some(([k]) => k === activeTab)) activeTab = "profile";
    const tab = k => `data-tab="${k}"${k === activeTab ? "" : " hidden"}`;

    root.innerHTML = `
      <div class="bo-cand-head">
        <div class="bo-cand-title">
          ${boCandAvatar(p, "bo-cand-avatar-lg")}
          <div>
          <a class="bracket-link" href="candidates">[ ← All candidates ]</a>
          <h2>${boEscapeHTML(boCandName(c))} ${boPill(c.status)}</h2>
          <p class="bo-section-note">${boEscapeHTML(BO_SOURCE_LABELS[c.source] || c.source)} · added ${boEscapeHTML(boWhen(c.createdAt))}${c.approval && c.approval.approved ? ` · marked final by ${c.approval.by === "admin" ? "you (on their behalf)" : "the person"} ${boEscapeHTML(boWhen(c.approval.at))}` : ""}</p>
          </div>
        </div>
        <div class="bo-cand-actions">
          ${c.status === "published" ? `<a class="btn btn-ghost" href="${boEscapeHTML(c.preview.url)}" target="_blank" rel="noopener">View live</a>` : ""}
          ${c.status === "published" || c.status === "scheduled" ? `<button class="btn btn-ghost" id="bo-unpublish">${c.status === "scheduled" ? "Cancel schedule → back to preview" : "Unpublish → back to preview"}</button>` : ""}
          ${c.locked || c.status === "scheduled" || c.status === "published" ? `<a class="btn btn-primary" href="preview?id=${encodeURIComponent(c.id)}">Open preview &amp; publish</a>` : ""}
        </div>
      </div>

      <nav class="bo-tabs" aria-label="Candidate sections">${tabs.map(([k, label]) =>
        `<a href="#${k}" data-tabbtn="${k}"${k === activeTab ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`).join("")}</nav>

      ${c.source === "recommended" && c.recommendation ? `
      <section class="bo-card" ${tab("profile")}>
        <h3>Recommendation</h3>
        <p><strong>Why:</strong> ${boEscapeHTML(c.recommendation.reason) || "-"}</p>
        <p class="bo-cell-dim">Recommended by ${boEscapeHTML(c.recommendation.recommenderName || "unknown")}${c.recommendation.recommenderEmail ? ` (${boEscapeHTML(c.recommendation.recommenderEmail)})` : ""} <a class="bracket-link" href="${boEscapeHTML(boRecommenderLinkedIn(c.recommendation).url)}" target="_blank" rel="noopener noreferrer">[ LinkedIn${boRecommenderLinkedIn(c.recommendation).exact ? "" : " search"} ]</a>${c.recommendation.stayAnonymous ? " - asked to stay anonymous, so the invitation doesn't name them" : ""}.</p>
      </section>` : ""}

      <section class="bo-card" ${tab("profile")}>
        <h3>Profile</h3>
        <p class="bo-section-note">Used for the article's header and directory card. For applicants this is what they submitted; complete or correct anything here.</p>
        <form id="bo-prof-form" class="bo-form-grid">
          ${[["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["role", "Role / title"], ["company", "Company"], ["location", "Location (city, country)"],
             ["yearsExperience", "Years of experience"], ["linkedin", "LinkedIn URL"], ["website", "Website"], ["twitter", "X / Twitter"], ["photo", "Photo URL (https://…)"], ["lat", "Latitude (map)"], ["lng", "Longitude (map)"]]
            .map(([k, label]) => k === "photo"
              ? `<div class="bo-lbl bo-wide"><label for="bo-photo-input">${label}</label><div class="bo-photo-row"><div id="bo-photo-preview">${boCandAvatar(p, "bo-cand-avatar-lg")}</div><input class="bo-input" id="bo-photo-input" name="photo" value="${boEscapeHTML(p.photo || "")}" placeholder="https://… (LinkedIn photo for applicants, or paste a link)"></div></div>`
              : `<label class="bo-lbl">${label}<input class="bo-input" name="${k}" value="${boEscapeHTML(p[k] == null ? "" : p[k])}"></label>`).join("")}
          <label class="bo-lbl">Focus area<select class="bo-input" name="focusTag">${BO_FOCUS.map(([v, l]) => `<option value="${v}"${v === p.focusTag ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="bo-lbl bo-wide">Short bio (max 200)<textarea class="bo-input" name="snippet" rows="2" maxlength="200">${boEscapeHTML(p.snippet)}</textarea></label>
          <label class="bo-lbl bo-wide">Pull quote (max 160)<textarea class="bo-input" name="pullQuote" rows="2" maxlength="160">${boEscapeHTML(p.pullQuote)}</textarea></label>
          <label class="bo-lbl bo-wide">Internal notes (never shown publicly)<textarea class="bo-input" name="notes" rows="3">${boEscapeHTML(c.notes)}</textarea></label>
          <div class="bo-wide"><button class="btn btn-primary bo-small" type="submit">Save profile</button></div>
        </form>
      </section>

      <section class="bo-card" ${tab("invitation")}>
        <h3>Invitation</h3>
        ${!invited ? `
          <p class="bo-section-note">Creating the invitation makes their private questionnaire page (a copy of the standard questions, which you can still edit). You then send them the link yourself - by email or LinkedIn.</p>
          <div class="bo-inline">
            <label class="bo-lbl">Send via
              <select class="bo-input" id="bo-inv-channel"><option value="email"${msgChannel === "email" ? " selected" : ""}>Email</option><option value="linkedin"${msgChannel === "linkedin" ? " selected" : ""}>LinkedIn message</option></select>
            </label>
            <label class="bo-lbl">Estimated publish date<input class="bo-input" type="date" id="bo-inv-est"></label>
            <button class="btn btn-primary" id="bo-inv-create" ${c.declined ? "disabled" : ""}>Create questionnaire &amp; mark as invited</button>
          </div>` : `
          <p class="bo-section-note">Invited by ${boEscapeHTML(c.invitation.channel === "linkedin" ? "LinkedIn" : "email")} on ${boEscapeHTML(boWhen(c.invitation.sentAt))}. The message below is a starting point for the manual send - edit it freely.</p>
          <div class="bo-linkrow">
            <input class="bo-input" id="bo-q-link" readonly value="${boEscapeHTML(link)}">
            <button class="btn btn-ghost" id="bo-copy-link">Copy link</button>
            <button class="btn btn-ghost" id="bo-revoke">${c.linkRevoked ? "Restore link" : "Revoke link"}</button>
          </div>
          ${c.linkRevoked ? `<p class="bo-warn">This link is revoked - the person can't open it.</p>` : ""}
          <div class="bo-inline">
            <label class="bo-lbl">Message for
              <select class="bo-input" id="bo-msg-channel"><option value="email"${msgChannel === "email" ? " selected" : ""}>Email</option><option value="linkedin"${msgChannel === "linkedin" ? " selected" : ""}>LinkedIn message</option></select>
            </label>
            <label class="bo-lbl">Estimated publish date<input class="bo-input" type="date" id="bo-inv-est" value="${boEscapeHTML(est)}"></label>
          </div>
          ${msgChannel === "email" ? `<label class="bo-lbl">Subject<input class="bo-input" id="bo-msg-subject" value="${boEscapeHTML(msg.subject)}"></label>` : ""}
          <label class="bo-lbl">Message<textarea class="bo-input bo-msg" id="bo-msg-body" rows="14">${boEscapeHTML(msg.body)}</textarea></label>
          <div class="bo-inline">
            <button class="btn btn-primary" id="bo-msg-copy">Copy message</button>
            ${msgChannel === "email" && p.email ? `<a class="btn btn-ghost" id="bo-msg-mailto" href="#">Open in email app</a>` : ""}
            ${msgChannel === "linkedin" && p.linkedin ? `<a class="btn btn-ghost" href="${boEscapeHTML(p.linkedin)}" target="_blank" rel="noopener">Open their LinkedIn</a>` : ""}
          </div>`}
      </section>

      <section class="bo-card" ${tab("dates")}>${boDatesHTML(c)}</section>

      ${invited ? `
      <section class="bo-card" ${tab("questions")}>
        <h3>Their questions</h3>
        <p class="bo-section-note">This person's own copy of the questionnaire. Edit, add or remove questions any time - before or while they're answering. Answers stay attached to a question as long as it isn't removed.</p>
        <div id="bo-qed-mount"></div>
        <div class="bo-savebar">
          <button class="btn btn-primary" id="bo-qed-save">Save their questions</button>
          <button class="btn btn-ghost" id="bo-qed-reset">Replace with the current standard questions</button>
          <span class="bo-save-status" id="bo-qed-status"></span>
        </div>
      </section>

      <section class="bo-card" ${tab("answers")}>
        <h3>Answers <span class="bo-cell-dim">(${answered} answered${(c.custom || []).length ? ` · ${(c.custom || []).length} own` : ""} · last edited ${boEscapeHTML(boWhen(c.answersUpdatedAt))})</span></h3>
        <p class="bo-section-note">Read what they've written, or edit on their behalf. Saving edits clears their "final" sign-off.</p>
        <div id="bo-answers">${renderAnswers()}</div>
        <div class="bo-savebar"><button class="btn btn-primary" id="bo-answers-save" ${ro ? "disabled" : ""}>Save answers on their behalf</button></div>
      </section>

      <section class="bo-card" ${tab("signoff")}>
        <h3>Sign-off, lock &amp; preview</h3>
        <p class="bo-section-note">
          ${c.approval && c.approval.approved ? `Marked final by ${c.approval.by === "admin" ? "you" : "the person"} on ${boEscapeHTML(boWhen(c.approval.at))}.` : "Not marked as final yet - they do that on their page, or you can do it for them."}
          ${c.locked ? " Locked: they can no longer edit." : ""}
        </p>
        <div class="bo-inline">
          ${c.approval && c.approval.approved
            ? `<button class="btn btn-ghost" id="bo-unapprove" ${ro ? "disabled" : ""}>Reopen (clear sign-off)</button>`
            : `<button class="btn btn-ghost" id="bo-approve" ${ro ? "disabled" : ""}>Mark final on their behalf</button>`}
          ${c.locked
            ? `<button class="btn btn-ghost" id="bo-unlock">Unlock for editing</button>`
            : `<button class="btn btn-primary" id="bo-lock">Lock &amp; prepare preview →</button>`}
        </div>
      </section>` : ""}

      <section class="bo-card" ${tab("profile")}>
        <h3>Alumni network</h3>
        ${(() => {
          const email = boCandNetEmail(c);
          if (!email) return `<p class="bo-section-note">No email on file yet - add one above before checking them in.</p>`;
          const n = c.network;
          const on = !!(n && n.optedIn);
          const day = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "medium" }) : "");
          const note = on
            ? `Checked in${n.at ? ` on ${boEscapeHTML(day(n.at))}` : ""}. They're visible to other network members once interviewed, and have access to the directory.`
            : n && n.leftAt ? `Not checked in - left on ${boEscapeHTML(day(n.leftAt))}.` : `Not checked in - hasn't opted in.`;
          return `<p class="bo-section-note">${note}</p>
          <div class="bo-inline"><button class="btn ${on ? "btn-ghost" : "btn-primary"}" id="bo-net-toggle">${on ? "Kick out of the alumni network" : "Check into the alumni network"}</button></div>`;
        })()}
      </section>

      <section class="bo-card bo-danger" ${tab("profile")}>
        <h3>Remove</h3>
        <div class="bo-inline">
          <button class="btn btn-ghost" id="bo-decline">${c.declined ? "Restore to pipeline" : "Decline / archive"}</button>
          <button class="btn btn-ghost bo-delete" id="bo-delete">Delete permanently</button>
        </div>
      </section>`;

    wire();
  }

  function renderAnswers() {
    const qs = ((c.questionnaire && c.questionnaire.sections) || []);
    const disabled = c.status === "published" ? "disabled" : "";
    return qs.map(s => {
      const items = s.questions.filter(q => !q.fromProfile);
      if (!items.length) return "";
      return `<h4 class="bo-h4">${boEscapeHTML(s.title)}</h4>` + items.map(q => `
        <label class="bo-lbl bo-ans"><span>${boEscapeHTML(q.text)} ${q.required ? '<span class="bo-badge">REQUIRED</span>' : ""}</span>
          <textarea class="bo-input" data-ans="${boEscapeHTML(q.id)}" rows="3" ${disabled}>${boEscapeHTML((c.answers || {})[q.id] || "")}</textarea></label>`).join("");
    }).join("") + `<h4 class="bo-h4">Their own questions</h4>` + [...(c.custom || []), { q: "", a: "" }].map((x, i) => `
      <div class="bo-ans-custom" data-cust="${i}">
        <input class="bo-input" data-cq placeholder="Question" value="${boEscapeHTML(x.q)}" ${disabled}>
        <textarea class="bo-input" data-ca rows="2" placeholder="Answer" ${disabled}>${boEscapeHTML(x.a)}</textarea>
      </div>`).join("");
  }

  function wire() {
    const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener("click", fn); };

    // sub-menu: switch section without reloading (unsaved edits in other sections stay put)
    root.querySelectorAll("[data-tabbtn]").forEach(a => a.addEventListener("click", (e) => {
      e.preventDefault();
      activeTab = a.dataset.tabbtn;
      history.replaceState(null, "", `#${activeTab}`);
      root.querySelectorAll("[data-tabbtn]").forEach(x => { const on = x === a; x.classList.toggle("is-active", on); if (on) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
      root.querySelectorAll("[data-tab]").forEach(sec => { sec.hidden = sec.dataset.tab !== activeTab; });
    }));

    // live photo preview while typing/pasting a URL (and while the name changes, for the initials)
    const form = root.querySelector("#bo-prof-form");
    const refreshPhoto = () => {
      root.querySelector("#bo-photo-preview").innerHTML = boCandAvatar({ name: form.elements.name.value, photo: form.elements.photo.value.trim() }, "bo-cand-avatar-lg");
    };
    form.elements.photo.addEventListener("input", refreshPhoto);
    form.elements.name.addEventListener("input", refreshPhoto);

    root.querySelector("#bo-prof-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const profile = {};
      f.forEach((v, k) => { if (k !== "notes") profile[k] = v; });
      act({ action: "update", profile, notes: String(f.get("notes") || "") }, "Profile saved");
    });

    const pubIn = root.querySelector("#bo-date-publish"), featIn = root.querySelector("#bo-date-feature");
    if (pubIn) pubIn.addEventListener("change", () => { if (pubIn.value) act(boDatesPayload(c, "publishDate", pubIn.value), "Publish date saved - calendar updated"); });
    if (featIn) featIn.addEventListener("change", () => { if (featIn.value) act({ action: "setDates", featureDate: featIn.value }, "Featured date saved - calendar updated"); });

    on("#bo-inv-create", () => act({ action: "invite", channel: root.querySelector("#bo-inv-channel").value, estimatedPublishDate: root.querySelector("#bo-inv-est").value || null }, "Questionnaire created - now send them the link"));
    on("#bo-copy-link", async () => { await navigator.clipboard.writeText(boQuestionnaireLink(c)); boToast("Link copied"); });
    on("#bo-revoke", () => act({ action: "revokeLink", revoked: !c.linkRevoked }, c.linkRevoked ? "Link restored" : "Link revoked"));

    const chan = root.querySelector("#bo-msg-channel");
    if (chan) chan.addEventListener("change", () => { msgChannel = chan.value; render(); });
    const estInput = root.querySelector("#bo-inv-est");
    if (estInput && c.invitation) estInput.addEventListener("change", async () => {
      await act({ action: "setPublishing", estimatedPublishDate: estInput.value || null }, "Estimated date saved");
    });
    on("#bo-msg-copy", async () => {
      const subj = root.querySelector("#bo-msg-subject");
      await navigator.clipboard.writeText((subj ? `Subject: ${subj.value}\n\n` : "") + root.querySelector("#bo-msg-body").value);
      boToast("Message copied");
    });
    const mailto = root.querySelector("#bo-msg-mailto");
    if (mailto) mailto.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = `mailto:${encodeURIComponent(c.profile.email)}?subject=${encodeURIComponent(root.querySelector("#bo-msg-subject").value)}&body=${encodeURIComponent(root.querySelector("#bo-msg-body").value)}`;
    });

    const mount = root.querySelector("#bo-qed-mount");
    if (mount) {
      const status = root.querySelector("#bo-qed-status");
      qEditor = boQuestionEditor(mount, c.questionnaire.sections, () => { status.textContent = "Unsaved changes"; });
      on("#bo-qed-save", async () => { const d = await act({ action: "setQuestionnaire", sections: qEditor.getSections() }, "Questions saved"); });
      on("#bo-qed-reset", () => { if (window.confirm("Replace this person's questions with the current standard set? Answers to questions that no longer exist will be hidden.")) act({ action: "resetQuestionnaire" }, "Questions replaced"); });
    }

    on("#bo-answers-save", () => {
      const answers = {};
      root.querySelectorAll("[data-ans]").forEach(t => { if (t.value.trim()) answers[t.dataset.ans] = t.value; });
      const custom = [...root.querySelectorAll(".bo-ans-custom")].map(r => ({ q: r.querySelector("[data-cq]").value, a: r.querySelector("[data-ca]").value })).filter(x => x.q.trim() && x.a.trim());
      act({ action: "setAnswers", answers, custom }, "Answers saved");
    });

    on("#bo-approve", () => act({ action: "approve", approved: true }, "Marked as final"));
    on("#bo-unapprove", () => act({ action: "approve", approved: false }, "Sign-off cleared"));
    on("#bo-unlock", () => act({ action: "lock", locked: false }, "Unlocked"));
    on("#bo-lock", async () => {
      if (!(c.approval && c.approval.approved) && !window.confirm("They haven't marked this version as final. Lock it anyway? They won't be able to edit any more.")) return;
      const data = await act({ action: "lock", locked: true });
      if (data) location.href = `preview?id=${encodeURIComponent(id)}`;
    });
    on("#bo-unpublish", async () => {
      const live = c.status === "published";
      if (!window.confirm(live ? `Take ${boCandName(c)}'s interview offline and return it to preview? It stays locked, so you can review or reschedule it.` : "Cancel the schedule and return this to preview?")) return;
      const data = await act({ action: "unpublish" });
      if (data) location.href = `preview?id=${encodeURIComponent(id)}`;
    });
    on("#bo-net-toggle", async () => {
      const on = !!(c.network && c.network.optedIn);
      if (on && !window.confirm(`Kick ${boCandName(c)} out of the alumni network? They lose access to the directory and disappear from it immediately.`)) return;
      await act({ action: "setNetwork", optedIn: !on }, on ? "Removed from the alumni network" : "Checked into the alumni network");
    });
    on("#bo-decline", () => act({ action: "decline", declined: !c.declined }, c.declined ? "Restored" : "Archived"));
    on("#bo-delete", () => {
      if (window.confirm(`Delete ${boCandName(c)} permanently? Their answers${c.status === "published" ? " and the published interview" : ""} will be removed. This can't be undone.`)) act({ action: "delete" });
    });
  }

  load();
}

// ============================ preview ============================

async function initBackofficePreview() {
  if (!(await boCurrentGuard())) return;
  const id = new URLSearchParams(location.search).get("id");
  const bar = document.getElementById("pv-bar");
  const articleRoot = document.getElementById("person-root");
  let c;

  const toLocalInput = iso => {
    if (!iso) return "";
    const d = new Date(iso); const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Who the homepage features now (newest live interview), to say who a switch would replace.
  let featuredNow = null;
  const dayLabel = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  // The Monday to Sunday week a YYYY-MM-DD date falls in, as "Mon 5 Oct - Sun 11 Oct".
  function weekRange(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return "";
    const d = new Date(dateStr + "T00:00:00Z"), start = new Date(d), end = new Date(d);
    start.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1));
    end.setUTCDate(start.getUTCDate() + 6);
    return `${dayLabel(start)} - ${dayLabel(end)}`;
  }
  const localDay = iso => { const d = new Date(iso); const pad = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const shownDate = x => { const p = x.publish || {}; return p.displayDate || String(p.publishedAt || p.scheduledPublishAt || "").slice(0, 10); };

  async function load() {
    const resp = await fetch(`/api/candidates?id=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!resp.ok) { bar.innerHTML = `<div class="wrap"><p>Candidate not found. <a href="candidates">Back to the list</a></p></div>`; return; }
    c = await resp.json();
    render();
    try {
      const all = await (await fetch("/api/candidates", { credentials: "same-origin" })).json();
      featuredNow = all.filter(x => x.id !== id && !x.declined && x.status === "published")
        .sort((a, b) => shownDate(b).localeCompare(shownDate(a)))[0] || null;
      render();
    } catch (e) { /* the panel works without it */ }
  }

  async function act(payload, msg) {
    try {
      const data = await boCandApi({ id, ...payload });
      if (data.deleted) { location.href = "candidates"; return null; }
      c = data.candidate; render(); if (msg) boToast(msg); return data;
    } catch (err) {
      boToast(({ feature_before_publish: "Featuring can't start before the week they are published.", date_in_past: "A scheduled date can't be in the past.", invite_first: "Invite the person first to set an estimated date.", slug_taken: "That URL is already taken.", lock_first: "Lock the interview first.", missing_schedule: "Pick a schedule date/time first." })[err.message] || "That didn't work - try again.");
      return null;
    }
  }

  function render() {
    const pub = c.publish, p = c.preview, live = c.status === "published", scheduled = c.status === "scheduled";
    const est = (c.invitation && c.invitation.estimatedPublishDate) || "";
    document.title = `Preview - ${c.profile.name} - Product Moat`;
    // What the calendar already holds for this article decides the date offered here.
    const estDay = est, dispDay = pub.displayDate || "";
    let featIso = pub.scheduledPublishAt || "", featHelp;
    if (live) featHelp = c.publish.featured === false ? "Live, but not featured on the homepage" : "Already live and featured";
    else if (featIso) featHelp = "Already in the calendar as scheduled. Change the date or publish now";
    else if (dispDay || estDay) { featIso = `${dispDay || estDay}T09:00`; featHelp = "In the calendar as an estimate only. Pick the real date, or publish now"; }
    else featHelp = "Not in the calendar yet. Pick the date it goes live and is featured, or publish now";
    bar.innerHTML = `
      <div class="wrap pv-inner">
        <div class="pv-top">
          <div>
            <span class="pv-tag">${live ? "LIVE" : scheduled ? "SCHEDULED" : "PREVIEW - NOT PUBLIC"}</span>
            ${boPill(c.status)}
            <span class="pv-url">${boEscapeHTML(location.origin)}<strong>/interview/${boEscapeHTML(p.category)}/${boEscapeHTML(p.slug)}</strong></span>
            ${live ? `<a class="bracket-link" href="${boEscapeHTML(p.url)}" target="_blank" rel="noopener">[ View live ]</a>` : ""}
          </div>
          <div class="pv-links">
            <a class="bracket-link" href="candidate?id=${encodeURIComponent(id)}">[ ← Candidate ]</a>
          </div>
        </div>

        <div class="pv-grid">
          <div class="pv-field">
            <label class="bo-lbl">Estimated publish date<span class="pv-help">What we told them; informational</span>
              <input class="bo-input" type="date" id="pv-est" value="${boEscapeHTML(est)}" ${c.invitation ? "" : "disabled"}></label>
          </div>
          <div class="pv-field pv-wide pv-feat">
            <label class="bo-lbl">Homepage featured<span class="pv-help">${featHelp}</span>
              <input class="bo-input" type="datetime-local" id="pv-schedule" value="${toLocalInput(featIso)}" ${live ? "disabled" : ""}></label>
            <div class="pv-feat-info" id="pv-feat-info"></div>
          </div>
          <div class="pv-field">
            <label class="bo-lbl">Displayed date<span class="pv-help">The date shown on the article</span>
              <input class="bo-input" type="date" id="pv-display" value="${boEscapeHTML(pub.displayDate || "")}"></label>
          </div>
          <div class="pv-field">
            <label class="bo-lbl">Section<span class="pv-help">Sets the URL path</span>
              <select class="bo-input" id="pv-category" ${live ? "disabled" : ""}>
                <option value="productmanagement"${p.category === "productmanagement" ? " selected" : ""}>Product management</option>
                <option value="productux"${p.category === "productux" ? " selected" : ""}>Product design / UX</option>
              </select></label>
          </div>
          <div class="pv-field">
            <label class="bo-lbl">URL name<span class="pv-help">Unique; fixed once published</span>
              <input class="bo-input" id="pv-slug" value="${boEscapeHTML(p.slug)}" ${live ? "disabled" : ""}></label>
          </div>
          <div class="pv-field">
            <label class="bo-lbl">Photo URL<span class="pv-help">https://… (shown on the article)</span>
              <input class="bo-input" id="pv-photo" value="${boEscapeHTML(c.profile.photo || "")}"></label>
          </div>
          <div class="pv-field pv-wide">
            <label class="bo-lbl">Foreword <span class="pv-help">Your editorial intro (optional - the section is hidden if empty)</span>
              <textarea class="bo-input" id="pv-foreword" rows="3">${boEscapeHTML(pub.foreword)}</textarea></label>
          </div>
        </div>

        <div class="pv-actions">
          <button class="btn btn-ghost" id="pv-save">Save changes</button>
          ${live ? `${c.publish.featured === false ? `<button class="btn btn-primary" id="pv-feature">Feature on homepage now</button>` : ""}<button class="btn btn-ghost" id="pv-unpublish">Unpublish → back to preview</button>` : `
            <button class="btn btn-ghost" id="pv-schedule-btn">${scheduled ? "Update date" : "Schedule for this date"}</button>
            <button class="btn btn-ghost" id="pv-now-only">Publish only</button>
            <button class="btn btn-primary" id="pv-now">Publish &amp; feature now</button>
            ${scheduled ? `<button class="btn btn-ghost" id="pv-unschedule">Cancel schedule</button>` : ""}`}
          <span class="pv-spacer"></span>
          <button class="btn btn-ghost bo-delete" id="pv-delete">Delete</button>
        </div>
      </div>`;

    renderPersonPage(articleRoot, p, { preview: true });
    wire();
  }

  let forceSched = false;
  function fields() {
    const sched = document.getElementById("pv-schedule").value;
    return {
      action: "setPublishing",
      estimatedPublishDate: document.getElementById("pv-est").value || null,
      // An estimate-prefilled date is only a suggestion until Schedule is pressed.
      scheduledPublishAt: sched && !(c.publish.scheduledPublishAt == null && !forceSched) ? new Date(sched).toISOString() : null,
      displayDate: document.getElementById("pv-display").value || null,
      category: document.getElementById("pv-category").value,
      slug: document.getElementById("pv-slug").value,
      foreword: document.getElementById("pv-foreword").value,
      profile: { photo: document.getElementById("pv-photo").value }
    };
  }

  function wire() {
    const on = (sel, fn) => { const el = document.querySelector(sel); if (el) el.addEventListener("click", fn); };
    const live = c.status === "published";
    const saveFields = () => { const f = fields(); if (live) { delete f.slug; delete f.category; delete f.scheduledPublishAt; } return act(f); };

    const schedInput = document.getElementById("pv-schedule"), info = document.getElementById("pv-feat-info");
    const repl = featuredNow ? `, replacing <strong>${boEscapeHTML(featuredNow.profile.name)}</strong>` : "";
    const showInfo = () => {
      if (!info) return;
      if (live && c.publish.featured === false) { info.innerHTML = "Published without the homepage spotlight."; return; }
      if (live) { info.innerHTML = `Featured on the homepage${repl ? "" : ""} for the week ${boEscapeHTML(weekRange(c.publish.displayDate || ""))}.`; return; }
      const day = schedInput.value ? schedInput.value.slice(0, 10) : "";
      info.innerHTML = day
        ? `Goes live and is featured the week <strong>${boEscapeHTML(weekRange(day))}</strong>${featuredNow ? `, after <strong>${boEscapeHTML(featuredNow.profile.name)}</strong>` : ""}.`
        : "No date picked.";
    };
    if (schedInput) { schedInput.addEventListener("input", showInfo); showInfo(); }

    on("#pv-save", async () => { if (await saveFields()) boToast("Saved"); });
    on("#pv-schedule-btn", async () => {
      if (!schedInput.value) return boToast("Pick a date and time first.");
      // The featured week follows the date it goes live.
      forceSched = true;
      document.getElementById("pv-display").value = localDay(new Date(schedInput.value).toISOString());
      if (!(await saveFields())) return;
      forceSched = false;
      await act({ action: "publish", mode: "schedule" }, "Scheduled");
    });
    on("#pv-now", async () => {
      const ok = await boConfirm({
        title: "Publish and feature now?",
        message: `<strong>${boEscapeHTML(c.profile.name)}</strong>'s interview goes live immediately at /interview/${boEscapeHTML(document.getElementById("pv-category").value)}/${boEscapeHTML(document.getElementById("pv-slug").value)} and becomes the featured profile on the homepage${repl}, with today as its date.`,
        confirmLabel: "Publish & feature now"
      });
      if (!ok) return;
      if (!(await saveFields())) return;
      await act({ action: "publish", mode: "now" }, "Published and featured");
    });
    on("#pv-now-only", async () => {
      const ok = await boConfirm({
        title: "Publish without featuring?",
        message: `<strong>${boEscapeHTML(c.profile.name)}</strong>'s interview goes live immediately at /interview/${boEscapeHTML(document.getElementById("pv-category").value)}/${boEscapeHTML(document.getElementById("pv-slug").value)}. The homepage spotlight stays with ${featuredNow ? `<strong>${boEscapeHTML(featuredNow.profile.name)}</strong>` : "the current profile"}; you can feature this one later.`,
        confirmLabel: "Publish only"
      });
      if (!ok) return;
      if (!(await saveFields())) return;
      await act({ action: "publish", mode: "now", feature: false }, "Published (not featured)");
    });
    on("#pv-feature", () => act({ action: "feature" }, "Now featured on the homepage"));
    on("#pv-unschedule", () => act({ action: "unpublish" }, "Schedule cancelled - back in preview mode"));
    on("#pv-unpublish", () => { if (window.confirm("Take this interview offline and return it to preview? It stays locked, so you can review, edit the details, or reschedule it.")) act({ action: "unpublish" }, "Unpublished - back in preview mode"); });
    on("#pv-delete", () => { if (window.confirm(`Delete ${c.profile.name}'s interview and candidate record permanently? This can't be undone.`)) act({ action: "delete" }); });
  }

  load();
}
