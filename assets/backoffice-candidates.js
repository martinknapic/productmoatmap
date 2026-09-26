// ProductMoat Backoffice — the candidate pipeline
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

// Questionnaire link (Link column): their private interview page while it's with them.
function boCandLink(c) {
  if (["invited", "drafting", "ready"].includes(c.status)) {
    if (c.linkRevoked) return { kind: "Revoked", text: "link revoked", url: null };
    return { kind: "Questionnaire", text: `interview?t=${c.id.slice(0, 8)}…`, url: `${location.origin}/interview.html?t=${c.id}` };
  }
  return null;
}

// The article itself (Article column): "Preview" -> the article as it stands, from the moment the
// questionnaire exists (the private preview page, which admins may open; the admin preview page once
// it's locked or scheduled), "Published" -> the public URL once it's live.
function boArticleLink(c) {
  if (["invited", "drafting", "ready"].includes(c.status) && c.invitation && c.questionnaire) {
    // a revoked questionnaire link also closes the private preview page, so use the admin preview then
    return { kind: "Preview", url: c.linkRevoked ? `${location.origin}/backoffice/preview.html?id=${c.id}` : `${location.origin}/interview-preview.html?t=${c.id}` };
  }
  if (c.status === "locked" || c.status === "scheduled") {
    return { kind: c.status === "scheduled" ? "Scheduled" : "Preview", url: `${location.origin}/backoffice/preview.html?id=${c.id}` };
  }
  if (c.status === "published" && c.publish && c.publish.slug) {
    const category = c.publish.category || (c.profile.focusTag === "design" ? "productux" : "productmanagement");
    return { kind: "Published", url: `${location.origin}/interview/${category}/${c.publish.slug}` };
  }
  return null;
}

const boPill = status => `<span class="bo-pill bo-pill-${boEscapeHTML(status)}">${boEscapeHTML(BO_STATUS_LABELS[status] || status)}</span>`;
const boQuestionnaireLink = c => `${location.origin}/interview.html?t=${c.id}`;
const boWhen = iso => (iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
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
        <span class="bo-rec-value">${value ? boEscapeHTML(value) : "—"}</span>
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

async function initBackofficeCandidates() {
  if (!(await boCurrentGuard())) return;

  const state = { all: [], status: "all", source: "all", q: "" };
  const listEl = document.getElementById("bo-cand-body");
  const chipsEl = document.getElementById("bo-cand-chips");

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
    );
    document.getElementById("bo-cand-count").textContent = `(${rows.length})`;
    document.getElementById("bo-cand-empty").hidden = rows.length > 0;
    listEl.innerHTML = rows.map(c => `
      <tr class="bo-row-link" data-open="${boEscapeHTML(c.id)}">
        <td class="bo-cell-photo">${boCandAvatar(c.profile)}</td>
        <td class="bo-cell-strong">${boEscapeHTML(boCandName(c))}<br><span class="bo-cell-dim">${boEscapeHTML(c.profile.email || "")}</span></td>
        <td>${boEscapeHTML(c.profile.role) || "—"}<br><span class="bo-cell-dim">${boEscapeHTML(c.profile.company)}</span></td>
        <td>${boEscapeHTML(c.profile.location) || "—"}</td>
        <td class="bo-cell-rec">${c.profile.linkedin ? `<a class="bo-rec bo-li" data-tip-cand="${boEscapeHTML(c.id)}" href="${boEscapeHTML(c.profile.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${boEscapeHTML(boCandName(c))}'s LinkedIn profile — hover for name and email">${BO_LINKEDIN_SVG}</a>` : `<span class="bo-cell-dim">—</span>`}</td>
        <td><span class="bo-badge bo-badge-src">${boEscapeHTML(BO_SOURCE_LABELS[c.source] || c.source)}</span></td>
        <td class="bo-cell-rec">${c.recommendation ? `<a class="bo-rec" data-tip-rec="${boEscapeHTML(c.id)}" href="${boEscapeHTML(boRecommenderLinkedIn(c.recommendation).url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${boEscapeHTML(c.recommendation.recommenderName || "the recommender")}'s LinkedIn — hover for name and email">${BO_LINKEDIN_SVG}</a>` : `<span class="bo-cell-dim">—</span>`}</td>
        <td>${boPill(c.status)}</td>
        <td class="bo-cell-url">${(() => {
          const a = boArticleLink(c);
          if (!a) return `<span class="bo-cell-dim">—</span>`;
          return `<a class="bo-url" href="${boEscapeHTML(a.url)}" target="_blank" rel="noopener noreferrer" title="${boEscapeHTML(a.url)}"><span class="bo-url-kind bo-url-${boEscapeHTML(a.kind.toLowerCase() === "published" ? "live" : a.kind.toLowerCase())}">${boEscapeHTML(a.kind)}</span><span aria-hidden="true">↗</span></a>`;
        })()}</td>
        <td class="bo-cell-url">${(() => {
          const l = boCandLink(c);
          if (!l) return `<span class="bo-cell-dim">—</span>`;
          if (!l.url) return `<span class="bo-cell-dim">${boEscapeHTML(l.text)}</span>`;
          return `<a class="bo-url" href="${boEscapeHTML(l.url)}" target="_blank" rel="noopener noreferrer" title="${boEscapeHTML(l.url)}"><span class="bo-url-kind bo-url-${boEscapeHTML(l.kind.toLowerCase())}">${boEscapeHTML(l.kind)}</span><span class="bo-url-text">${boEscapeHTML(l.text)}</span><span aria-hidden="true">↗</span></a>`;
        })()}</td>
        <td>${c.invitation ? `${boEscapeHTML(c.invitation.channel === "linkedin" ? "LinkedIn" : "Email")} · ${boEscapeHTML(new Date(c.invitation.sentAt).toLocaleDateString())}` : "—"}</td>
        <td>${boEscapeHTML(boWhen(c.updatedAt))}</td>
        <td><a class="bracket-link" href="candidate.html?id=${encodeURIComponent(c.id)}">[ Open ]</a></td>
      </tr>`).join("");
  }

  chipsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-status]"); if (b) { state.status = b.dataset.status; render(); } });
  document.getElementById("bo-cand-source").addEventListener("change", (e) => { state.source = e.target.value; render(); });
  document.getElementById("bo-cand-search").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  const tip = boContactTooltip();
  // what the hover card shows for a given icon: data-tip-cand = the candidate, data-tip-rec = their recommender
  const infoOf = (btn) => {
    const c = state.all.find(x => x.id === (btn.dataset.tipCand || btn.dataset.tipRec));
    if (!c) return null;
    if (btn.dataset.tipCand) {
      return { title: "Candidate", name: c.profile.name, email: c.profile.email, notes: c.profile.email ? [] : ["No email saved yet — add one on their page."] };
    }
    const rec = c.recommendation;
    if (!rec) return null;
    return {
      title: "Recommended by", name: rec.recommenderName, email: rec.recommenderEmail,
      notes: [
        boRecommenderLinkedIn(rec).exact ? "Click the icon to open their LinkedIn profile." : "No profile link was saved — the icon opens a LinkedIn search for their name.",
        ...(rec.stayAnonymous ? ["Asked to stay anonymous — the invitation doesn't name them."] : [])
      ]
    };
  };
  const tipTarget = (e) => e.target.closest("[data-tip-cand], [data-tip-rec]");
  listEl.addEventListener("mouseover", (e) => { const b = tipTarget(e); const i = b && infoOf(b); if (i) tip.show(b, i); });
  listEl.addEventListener("mouseout", (e) => { if (tipTarget(e)) tip.hideSoon(); });
  listEl.addEventListener("focusin", (e) => { const b = tipTarget(e); const i = b && infoOf(b); if (i) tip.show(b, i); });
  listEl.addEventListener("focusout", (e) => { if (tipTarget(e)) tip.hideSoon(); });
  window.addEventListener("scroll", () => tip.hideSoon(), true);
  listEl.addEventListener("click", (e) => {
    if (e.target.closest("a")) return; // LinkedIn icons open their own tab; never open the row
    const row = e.target.closest("[data-open]");
    if (row) location.href = `candidate.html?id=${encodeURIComponent(row.dataset.open)}`;
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
      location.href = `candidate.html?id=${encodeURIComponent(data.id)}`;
    } catch (err) {
      boToast(err.message === "missing_name" ? "A name is required."
        : err.message === "storage_failed" ? "Couldn't save: storage isn't reachable (is Vercel Blob connected to this project?)."
        : "Couldn't add that person — please try again.");
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
  const how = `It's a set of questions about your path into product, how you think, and how AI is changing the craft. Only a handful are required and the rest are optional; you can also add up to three questions of your own. Each answer has its own Save button, and what you've saved is waiting for you whenever you come back. When you're happy with them, press the button at the bottom of the page — we'll then prepare a preview together, and nothing goes public until you've had the final say.`;
  // The page is private: opening it means signing in with LinkedIn (which also creates their private profile).
  const signupLine = c.source === "recommended" || !c.profile.email
    ? `\n\nThe page is private, so you'll be asked to sign in with LinkedIn first — one click, and you land right back on it.`
    : `\n\nThe page is private, so you'll be asked to sign in with LinkedIn first — please use the account that goes with ${c.profile.email}.`;
  const estLine = est ? `\n\nWe're aiming to publish around ${est}.` : "";

  let opening;
  if (c.source === "applied") {
    opening = `Thank you for applying to be featured on ProductMoat — we read every application ourselves, and we'd love to interview you.`;
  } else if (c.source === "recommended") {
    const who = rec.stayAnonymous || !rec.recommenderName ? "Someone in the ProductMoat community" : rec.recommenderName;
    opening = `${who} recommended you for ProductMoat, an interview series about how product people think and work in the age of AI — and we'd love to feature you.`;
  } else {
    opening = `I'm Martin, and I run ProductMoat, an interview series about how product people think and work in the age of AI. I'd love to feature you.`;
  }

  if (channel === "linkedin") {
    return {
      subject: "",
      body: `Hi ${first},\n\n${opening}\n\nHere's your personal, private interview page: ${link}\n\n${how}${signupLine}${estLine}\n\nIf it's not for you, no problem at all — just let me know.\n\nMartin`
    };
  }
  return {
    subject: "Your ProductMoat interview",
    body: `Hi ${first},\n\n${opening}\n\nHere's your personal, private interview page — only you (and I) can open it:\n${link}\n\n${how}${signupLine}${estLine}\n\nIf it's not for you, no problem at all — just reply and let me know.\n\nWarm regards,\nMartin`
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
    } catch (err) { root.innerHTML = `<p class="bo-empty">Candidate not found. <a class="bracket-link" href="candidates.html">[ Back to the list ]</a></p>`; }
  }

  async function act(payload, okMsg) {
    try {
      const data = await boCandApi({ id, ...payload });
      if (data.deleted) { location.href = "candidates.html"; return null; }
      if (data.candidate) c = data.candidate;
      render();
      if (okMsg) boToast(okMsg);
      return data;
    } catch (err) {
      boToast(({ slug_taken: "That URL is already taken.", lock_first: "Lock it first.", unpublish_first: "Unpublish first." })[err.message] || "That didn't work — try again.");
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
    const tabs = [["profile", "Profile"], ["invitation", "Invitation"],
      ...(invited ? [["questions", "Questions"], ["answers", `Answers <span class="bo-tab-count">${answered}</span>`], ["signoff", "Sign-off &amp; preview"]] : [])];
    if (!tabs.some(([k]) => k === activeTab)) activeTab = "profile";
    const tab = k => `data-tab="${k}"${k === activeTab ? "" : " hidden"}`;

    root.innerHTML = `
      <div class="bo-cand-head">
        <div class="bo-cand-title">
          ${boCandAvatar(p, "bo-cand-avatar-lg")}
          <div>
          <a class="bracket-link" href="candidates.html">[ ← All candidates ]</a>
          <h2>${boEscapeHTML(boCandName(c))} ${boPill(c.status)}</h2>
          <p class="bo-section-note">${boEscapeHTML(BO_SOURCE_LABELS[c.source] || c.source)} · added ${boEscapeHTML(boWhen(c.createdAt))}${c.approval && c.approval.approved ? ` · marked final by ${c.approval.by === "admin" ? "you (on their behalf)" : "the person"} ${boEscapeHTML(boWhen(c.approval.at))}` : ""}</p>
          </div>
        </div>
        <div class="bo-cand-actions">
          ${c.status === "published" ? `<a class="btn btn-ghost" href="${boEscapeHTML(c.preview.url)}" target="_blank" rel="noopener">View live</a>` : ""}
          ${c.status === "published" || c.status === "scheduled" ? `<button class="btn btn-ghost" id="bo-unpublish">${c.status === "scheduled" ? "Cancel schedule → back to preview" : "Unpublish → back to preview"}</button>` : ""}
          ${c.locked || c.status === "scheduled" || c.status === "published" ? `<a class="btn btn-primary" href="preview.html?id=${encodeURIComponent(c.id)}">Open preview &amp; publish</a>` : ""}
        </div>
      </div>

      <nav class="bo-tabs" aria-label="Candidate sections">${tabs.map(([k, label]) =>
        `<a href="#${k}" data-tabbtn="${k}"${k === activeTab ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`).join("")}</nav>

      ${c.source === "recommended" && c.recommendation ? `
      <section class="bo-card" ${tab("profile")}>
        <h3>Recommendation</h3>
        <p><strong>Why:</strong> ${boEscapeHTML(c.recommendation.reason) || "—"}</p>
        <p class="bo-cell-dim">Recommended by ${boEscapeHTML(c.recommendation.recommenderName || "unknown")}${c.recommendation.recommenderEmail ? ` (${boEscapeHTML(c.recommendation.recommenderEmail)})` : ""} <a class="bracket-link" href="${boEscapeHTML(boRecommenderLinkedIn(c.recommendation).url)}" target="_blank" rel="noopener noreferrer">[ LinkedIn${boRecommenderLinkedIn(c.recommendation).exact ? "" : " search"} ]</a>${c.recommendation.stayAnonymous ? " — asked to stay anonymous, so the invitation doesn't name them" : ""}.</p>
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
          <p class="bo-section-note">Creating the invitation makes their private questionnaire page (a copy of the standard questions, which you can still edit). You then send them the link yourself — by email or LinkedIn.</p>
          <div class="bo-inline">
            <label class="bo-lbl">Send via
              <select class="bo-input" id="bo-inv-channel"><option value="email"${msgChannel === "email" ? " selected" : ""}>Email</option><option value="linkedin"${msgChannel === "linkedin" ? " selected" : ""}>LinkedIn message</option></select>
            </label>
            <label class="bo-lbl">Estimated publish date<input class="bo-input" type="date" id="bo-inv-est"></label>
            <button class="btn btn-primary" id="bo-inv-create" ${c.declined ? "disabled" : ""}>Create questionnaire &amp; mark as invited</button>
          </div>` : `
          <p class="bo-section-note">Invited by ${boEscapeHTML(c.invitation.channel === "linkedin" ? "LinkedIn" : "email")} on ${boEscapeHTML(boWhen(c.invitation.sentAt))}. The message below is a starting point for the manual send — edit it freely.</p>
          <div class="bo-linkrow">
            <input class="bo-input" id="bo-q-link" readonly value="${boEscapeHTML(link)}">
            <button class="btn btn-ghost" id="bo-copy-link">Copy link</button>
            <button class="btn btn-ghost" id="bo-revoke">${c.linkRevoked ? "Restore link" : "Revoke link"}</button>
          </div>
          ${c.linkRevoked ? `<p class="bo-warn">This link is revoked — the person can't open it.</p>` : ""}
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

      ${invited ? `
      <section class="bo-card" ${tab("questions")}>
        <h3>Their questions</h3>
        <p class="bo-section-note">This person's own copy of the questionnaire. Edit, add or remove questions any time — before or while they're answering. Answers stay attached to a question as long as it isn't removed.</p>
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
          ${c.approval && c.approval.approved ? `Marked final by ${c.approval.by === "admin" ? "you" : "the person"} on ${boEscapeHTML(boWhen(c.approval.at))}.` : "Not marked as final yet — they do that on their page, or you can do it for them."}
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

    on("#bo-inv-create", () => act({ action: "invite", channel: root.querySelector("#bo-inv-channel").value, estimatedPublishDate: root.querySelector("#bo-inv-est").value || null }, "Questionnaire created — now send them the link"));
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
      if (data) location.href = `preview.html?id=${encodeURIComponent(id)}`;
    });
    on("#bo-unpublish", async () => {
      const live = c.status === "published";
      if (!window.confirm(live ? `Take ${boCandName(c)}'s interview offline and return it to preview? It stays locked, so you can review or reschedule it.` : "Cancel the schedule and return this to preview?")) return;
      const data = await act({ action: "unpublish" });
      if (data) location.href = `preview.html?id=${encodeURIComponent(id)}`;
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

  async function load() {
    const resp = await fetch(`/api/candidates?id=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!resp.ok) { bar.innerHTML = `<div class="wrap"><p>Candidate not found. <a href="candidates.html">Back to the list</a></p></div>`; return; }
    c = await resp.json();
    render();
  }

  async function act(payload, msg) {
    try {
      const data = await boCandApi({ id, ...payload });
      if (data.deleted) { location.href = "candidates.html"; return null; }
      c = data.candidate; render(); if (msg) boToast(msg); return data;
    } catch (err) {
      boToast(({ slug_taken: "That URL is already taken.", lock_first: "Lock the interview first.", missing_schedule: "Pick a schedule date/time first." })[err.message] || "That didn't work — try again.");
      return null;
    }
  }

  function render() {
    const pub = c.publish, p = c.preview, live = c.status === "published", scheduled = c.status === "scheduled";
    const est = (c.invitation && c.invitation.estimatedPublishDate) || "";
    document.title = `Preview — ${c.profile.name} — ProductMoat`;
    bar.innerHTML = `
      <div class="wrap pv-inner">
        <div class="pv-top">
          <div>
            <span class="pv-tag">${live ? "LIVE" : scheduled ? "SCHEDULED" : "PREVIEW — NOT PUBLIC"}</span>
            ${boPill(c.status)}
            <span class="pv-url">${boEscapeHTML(location.origin)}<strong>/interview/${boEscapeHTML(p.category)}/${boEscapeHTML(p.slug)}</strong></span>
            ${live ? `<a class="bracket-link" href="${boEscapeHTML(p.url)}" target="_blank" rel="noopener">[ View live ]</a>` : ""}
          </div>
          <div class="pv-links">
            <a class="bracket-link" href="candidate.html?id=${encodeURIComponent(id)}">[ ← Candidate ]</a>
          </div>
        </div>

        <div class="pv-grid">
          <div class="pv-field">
            <label class="bo-lbl">Estimated publish date<span class="pv-help">What we told them; informational</span>
              <input class="bo-input" type="date" id="pv-est" value="${boEscapeHTML(est)}" ${c.invitation ? "" : "disabled"}></label>
          </div>
          <div class="pv-field">
            <label class="bo-lbl">Publish schedule<span class="pv-help">When it actually goes live</span>
              <input class="bo-input" type="datetime-local" id="pv-schedule" value="${toLocalInput(pub.scheduledPublishAt)}" ${live ? "disabled" : ""}></label>
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
            <label class="bo-lbl">Foreword <span class="pv-help">Your editorial intro (optional — the section is hidden if empty)</span>
              <textarea class="bo-input" id="pv-foreword" rows="3">${boEscapeHTML(pub.foreword)}</textarea></label>
          </div>
        </div>

        <div class="pv-actions">
          <button class="btn btn-ghost" id="pv-save">Save changes</button>
          ${live ? `<button class="btn btn-ghost" id="pv-unpublish">Unpublish → back to preview</button>` : `
            <button class="btn btn-ghost" id="pv-schedule-btn">${scheduled ? "Update schedule" : "Schedule publish"}</button>
            <button class="btn btn-primary" id="pv-now">Publish now</button>
            ${scheduled ? `<button class="btn btn-ghost" id="pv-unschedule">Cancel schedule</button>` : ""}`}
          <span class="pv-spacer"></span>
          <button class="btn btn-ghost bo-delete" id="pv-delete">Delete</button>
        </div>
      </div>`;

    renderPersonPage(articleRoot, p, { preview: true });
    wire();
  }

  function fields() {
    const sched = document.getElementById("pv-schedule").value;
    return {
      action: "setPublishing",
      estimatedPublishDate: document.getElementById("pv-est").value || null,
      scheduledPublishAt: sched ? new Date(sched).toISOString() : null,
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

    on("#pv-save", async () => { if (await saveFields()) boToast("Saved"); });
    on("#pv-schedule-btn", async () => {
      if (!document.getElementById("pv-schedule").value) return boToast("Pick a schedule date/time first.");
      if (!(await saveFields())) return;
      await act({ action: "publish", mode: "schedule" }, "Scheduled");
    });
    on("#pv-now", async () => {
      if (!window.confirm(`Publish ${c.profile.name}'s interview now? It goes live immediately at /interview/${document.getElementById("pv-category").value}/${document.getElementById("pv-slug").value}.`)) return;
      if (!(await saveFields())) return;
      await act({ action: "publish", mode: "now" }, "Published");
    });
    on("#pv-unschedule", () => act({ action: "unpublish" }, "Schedule cancelled — back in preview mode"));
    on("#pv-unpublish", () => { if (window.confirm("Take this interview offline and return it to preview? It stays locked, so you can review, edit the details, or reschedule it.")) act({ action: "unpublish" }, "Unpublished — back in preview mode"); });
    on("#pv-delete", () => { if (window.confirm(`Delete ${c.profile.name}'s interview and candidate record permanently? This can't be undone.`)) act({ action: "delete" }); });
  }

  load();
}
