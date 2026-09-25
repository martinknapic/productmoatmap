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
        <td class="bo-cell-strong">${boEscapeHTML(boCandName(c))}<br><span class="bo-cell-dim">${boEscapeHTML(c.profile.email || "")}</span></td>
        <td>${boEscapeHTML(c.profile.role) || "—"}<br><span class="bo-cell-dim">${boEscapeHTML(c.profile.company)}</span></td>
        <td>${boEscapeHTML(c.profile.location) || "—"}</td>
        <td><span class="bo-badge bo-badge-src">${boEscapeHTML(BO_SOURCE_LABELS[c.source] || c.source)}</span></td>
        <td>${boPill(c.status)}</td>
        <td>${c.invitation ? `${boEscapeHTML(c.invitation.channel === "linkedin" ? "LinkedIn" : "Email")} · ${boEscapeHTML(new Date(c.invitation.sentAt).toLocaleDateString())}` : "—"}</td>
        <td>${boEscapeHTML(boWhen(c.updatedAt))}</td>
        <td><a class="bracket-link" href="candidate.html?id=${encodeURIComponent(c.id)}">[ Open ]</a></td>
      </tr>`).join("");
  }

  chipsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-status]"); if (b) { state.status = b.dataset.status; render(); } });
  document.getElementById("bo-cand-source").addEventListener("change", (e) => { state.source = e.target.value; render(); });
  document.getElementById("bo-cand-search").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  listEl.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
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
  const how = `It's a set of questions about your path into product, how you think, and how AI is changing the craft. Only a handful are required and the rest are optional; you can also add up to three questions of your own. Your answers save automatically, so come back any time. When you're happy with them, press the button at the bottom of the page — we'll then prepare a preview together, and nothing goes public until you've had the final say.`;
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
      body: `Hi ${first},\n\n${opening}\n\nHere's your personal, private interview page: ${link}\n\n${how}${estLine}\n\nIf it's not for you, no problem at all — just let me know.\n\nMartin`
    };
  }
  return {
    subject: "Your ProductMoat interview",
    body: `Hi ${first},\n\n${opening}\n\nHere's your personal, private interview page — only you (and I) can open it:\n${link}\n\n${how}${estLine}\n\nIf it's not for you, no problem at all — just reply and let me know.\n\nWarm regards,\nMartin`
  };
}

async function initBackofficeCandidate() {
  if (!(await boCurrentGuard())) return;
  const id = new URLSearchParams(location.search).get("id");
  const root = document.getElementById("bo-cand-root");
  let c;
  let qEditor = null;
  let msgChannel = null;

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

    root.innerHTML = `
      <div class="bo-cand-head">
        <div>
          <a class="bracket-link" href="candidates.html">[ ← All candidates ]</a>
          <h2>${boEscapeHTML(boCandName(c))} ${boPill(c.status)}</h2>
          <p class="bo-section-note">${boEscapeHTML(BO_SOURCE_LABELS[c.source] || c.source)} · added ${boEscapeHTML(boWhen(c.createdAt))}${c.approval && c.approval.approved ? ` · marked final by ${c.approval.by === "admin" ? "you (on their behalf)" : "the person"} ${boEscapeHTML(boWhen(c.approval.at))}` : ""}</p>
        </div>
        <div class="bo-cand-actions">
          ${c.status === "published" ? `<a class="btn btn-ghost" href="${boEscapeHTML(c.preview.url)}" target="_blank" rel="noopener">View live</a>` : ""}
          ${c.locked || c.status === "scheduled" || c.status === "published" ? `<a class="btn btn-primary" href="preview.html?id=${encodeURIComponent(c.id)}">Open preview &amp; publish</a>` : ""}
        </div>
      </div>

      ${c.source === "recommended" && c.recommendation ? `
      <section class="bo-card">
        <h3>Recommendation</h3>
        <p><strong>Why:</strong> ${boEscapeHTML(c.recommendation.reason) || "—"}</p>
        <p class="bo-cell-dim">Recommended by ${boEscapeHTML(c.recommendation.recommenderName || "unknown")}${c.recommendation.recommenderEmail ? ` (${boEscapeHTML(c.recommendation.recommenderEmail)})` : ""}${c.recommendation.stayAnonymous ? " — asked to stay anonymous, so the invitation doesn't name them" : ""}.</p>
      </section>` : ""}

      <section class="bo-card">
        <h3>1 · Profile</h3>
        <p class="bo-section-note">Used for the article's header and directory card. For applicants this is what they submitted; complete or correct anything here.</p>
        <form id="bo-prof-form" class="bo-form-grid">
          ${[["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["role", "Role / title"], ["company", "Company"], ["location", "Location (city, country)"],
             ["yearsExperience", "Years of experience"], ["linkedin", "LinkedIn URL"], ["website", "Website"], ["twitter", "X / Twitter"], ["photo", "Photo URL (https://…)"], ["lat", "Latitude (map)"], ["lng", "Longitude (map)"]]
            .map(([k, label]) => `<label class="bo-lbl">${label}<input class="bo-input" name="${k}" value="${boEscapeHTML(p[k] == null ? "" : p[k])}"></label>`).join("")}
          <label class="bo-lbl">Focus area<select class="bo-input" name="focusTag">${BO_FOCUS.map(([v, l]) => `<option value="${v}"${v === p.focusTag ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="bo-lbl bo-wide">Short bio (max 200)<textarea class="bo-input" name="snippet" rows="2" maxlength="200">${boEscapeHTML(p.snippet)}</textarea></label>
          <label class="bo-lbl bo-wide">Pull quote (max 160)<textarea class="bo-input" name="pullQuote" rows="2" maxlength="160">${boEscapeHTML(p.pullQuote)}</textarea></label>
          <label class="bo-lbl bo-wide">Internal notes (never shown publicly)<textarea class="bo-input" name="notes" rows="3">${boEscapeHTML(c.notes)}</textarea></label>
          <div class="bo-wide"><button class="btn btn-primary bo-small" type="submit">Save profile</button></div>
        </form>
      </section>

      <section class="bo-card">
        <h3>2 · Invitation</h3>
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
      <section class="bo-card">
        <h3>3 · Their questions</h3>
        <p class="bo-section-note">This person's own copy of the questionnaire. Edit, add or remove questions any time — before or while they're answering. Answers stay attached to a question as long as it isn't removed.</p>
        <div id="bo-qed-mount"></div>
        <div class="bo-savebar">
          <button class="btn btn-primary" id="bo-qed-save">Save their questions</button>
          <button class="btn btn-ghost" id="bo-qed-reset">Replace with the current standard questions</button>
          <span class="bo-save-status" id="bo-qed-status"></span>
        </div>
      </section>

      <section class="bo-card">
        <h3>4 · Answers <span class="bo-cell-dim">(${answered} answered${(c.custom || []).length ? ` · ${(c.custom || []).length} own` : ""} · last edited ${boEscapeHTML(boWhen(c.answersUpdatedAt))})</span></h3>
        <p class="bo-section-note">Read what they've written, or edit on their behalf. Saving edits clears their "final" sign-off.</p>
        <div id="bo-answers">${renderAnswers()}</div>
        <div class="bo-savebar"><button class="btn btn-primary" id="bo-answers-save" ${ro ? "disabled" : ""}>Save answers on their behalf</button></div>
      </section>

      <section class="bo-card">
        <h3>5 · Sign-off, lock &amp; preview</h3>
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

      <section class="bo-card bo-danger">
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
          ${live ? `<button class="btn btn-ghost" id="pv-unpublish">Unpublish</button>` : `
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
    on("#pv-unschedule", () => act({ action: "setPublishing", scheduledPublishAt: null }, "Schedule cancelled"));
    on("#pv-unpublish", () => { if (window.confirm("Take this interview offline? It goes back to locked.")) act({ action: "unpublish" }, "Unpublished"); });
    on("#pv-delete", () => { if (window.confirm(`Delete ${c.profile.name}'s interview and candidate record permanently? This can't be undone.`)) act({ action: "delete" }); });
  }

  load();
}
