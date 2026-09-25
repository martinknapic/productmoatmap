// ProductMoat — a person's personal interview page (interview.html?t=<token>)
//
// The admin invites someone from the backoffice; that creates this questionnaire (a copy of
// the standard questions the admin can still edit). The page loads it from /api/interview,
// autosaves every change, and lets the person say "I'm happy with this version". Once the
// admin locks it, it becomes read-only while the article is prepared.

const IV_MAX_ANSWER = 2000;
const IV_SAVE_DELAY_MS = 1200;

const IV_FOCUS_OPTIONS = [
  ["ai", "AI & ML"], ["b2b", "B2B SaaS"], ["design", "Product design / UX"], ["growth", "Consumer & Growth"],
  ["fintech", "Fintech"], ["platform", "Platform & Infra"], ["marketplace", "Marketplace"], ["health", "Healthtech"],
  ["leadership", "Product Leadership"], ["other", "Other"]
];

// Profile-backed questions (Q1–Q5) are edited in the "Your details" block.
const IV_PROFILE_FIELDS = [
  { key: "name", label: "Full name", max: 200, required: true },
  { key: "role", label: "Current role", max: 200, required: true },
  { key: "company", label: "Company", max: 200, required: true },
  { key: "location", label: "Location (city, country)", max: 200, required: true },
  { key: "yearsExperience", label: "Years in product / design", max: 2, required: true, type: "number" },
  { key: "focusTag", label: "Focus area", select: true },
  { key: "linkedin", label: "LinkedIn URL", max: 300, type: "url" },
  { key: "website", label: "Website (optional)", max: 300, type: "url" },
  { key: "twitter", label: "X / Twitter (optional)", max: 300, type: "url" },
  { key: "snippet", label: "Short bio — one line used to introduce you", max: 200, area: true },
  { key: "pullQuote", label: "Pull quote — one punchy line that sums up how you think (optional)", max: 160, area: true }
];

function initInterview() {
  const root = document.getElementById("iv-root");
  if (!root) return;

  const token = new URLSearchParams(location.search).get("t") || "";
  if (!token) return renderInvalid(root);

  const state = {
    profile: {}, questionnaire: null, answers: {}, custom: [], customLimit: 3,
    locked: false, approval: { approved: false }, status: "invited", estimatedPublishDate: null, published: null,
    dirty: false, saving: false, saveTimer: null
  };

  fetch(`/api/interview?t=${encodeURIComponent(token)}`, { credentials: "omit" })
    .then(resp => (resp.ok ? resp.json() : Promise.reject(resp.status)))
    .then(data => { apply(data); render(); })
    .catch(() => renderInvalid(root));

  function apply(data) {
    state.profile = data.profile || state.profile;
    state.questionnaire = data.questionnaire || state.questionnaire;
    state.answers = data.answers || {};
    state.custom = data.custom || [];
    state.customLimit = data.customLimit || 3;
    state.locked = !!data.locked;
    state.approval = data.approval || { approved: false };
    state.status = data.status;
    state.estimatedPublishDate = data.estimatedPublishDate;
    state.published = data.published;
  }

  const readOnly = () => state.locked || !!state.published;
  const sections = () => state.questionnaire.sections.map(s => ({ ...s, questions: s.questions.filter(q => !q.fromProfile) }));
  const allQuestions = () => sections().flatMap(s => s.questions);
  const filled = id => typeof state.answers[id] === "string" && state.answers[id].trim() !== "";
  const profileFilled = key => { const v = state.profile[key]; return v != null && String(v).trim() !== ""; };

  // required = the questionnaire's own required flags; profile-backed ones map to profile fields
  const PROFILE_Q = { q1: "name", q2: "role", q3: "company", q4: "location", q5: "yearsExperience" };
  function missingRequired() {
    return state.questionnaire.sections.flatMap(s => s.questions).filter(q => q.required).filter(q =>
      q.fromProfile ? !profileFilled(PROFILE_Q[q.id] || "name") : !filled(q.id)
    );
  }
  const requiredTotal = () => state.questionnaire.sections.flatMap(s => s.questions).filter(q => q.required).length;

  // ---------- rendering ----------

  function render() {
    const first = (state.profile.name || "").split(/\s+/)[0] || "there";
    document.title = `${first}'s interview — ProductMoat`;
    root.innerHTML = `
      <section class="why-hero iv-hero">
        <div class="wrap iv-hero-grid">
          <div class="iv-hero-text">
            <div class="eyebrow">Your interview</div>
            <h1>Hi ${escapeHTML(first)} — let's hear your story.</h1>
            <p class="about-lede">
              This page is yours alone. Open a question to answer it — your answers save automatically,
              so you can leave and come back to the same link any time. Only the
              <span class="q-badge q-badge-req">Required</span> questions are needed; skip any
              <span class="q-badge q-badge-opt">Optional</span> ones. The wording may be adjusted as we
              go, and when you're happy, tell us with the button at the bottom.
            </p>
            ${state.estimatedPublishDate ? `<p class="iv-est">Estimated publish date: <strong>${escapeHTML(formatDay(state.estimatedPublishDate))}</strong></p>` : ""}
            <div class="iv-progress" id="iv-progress"></div>
          </div>
          <div class="iv-hero-photo">${heroPhoto()}</div>
        </div>
      </section>

      <section class="iv-body wrap">
        <div id="iv-banner"></div>
        ${renderDetails()}
        ${sections().map(renderSection).join("")}
        ${renderCustomSection()}
        <div class="iv-submit" id="iv-submit"></div>
      </section>
    `;
    wire();
    refreshAll();
  }

  // Large portrait of the person (photo set by the admin / from LinkedIn); initials if there's none or it fails to load.
  function heroPhoto() {
    const photo = (state.profile.photo || "").trim();
    const src = !photo ? "" : /^https?:\/\//i.test(photo) ? photo : `/${photo.replace(/^\/+/, "")}`;
    const initials = (state.profile.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    return `<div class="iv-portrait"><span>${escapeHTML(initials)}</span>${src ? `<img src="${escapeAttr(src)}" alt="${escapeAttr(state.profile.name || "")}" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</div>`;
  }

  function renderDetails() {
    return `
      <div class="iv-section" data-section="details">
        <div class="iv-section-head">
          <div class="qsection-index">00</div>
          <div>
            <h2>Your details</h2>
            <p>How you'll be introduced. Check they're right — you can edit anything.</p>
          </div>
        </div>
        <div class="iv-details">
          ${IV_PROFILE_FIELDS.map(f => {
            const v = state.profile[f.key] == null ? "" : state.profile[f.key];
            const id = `iv-p-${f.key}`;
            let input;
            if (f.select) {
              input = `<select class="ivq-input" id="${id}" data-profile="${f.key}">${IV_FOCUS_OPTIONS.map(([val, lab]) => `<option value="${val}"${val === v ? " selected" : ""}>${lab}</option>`).join("")}</select>`;
            } else if (f.area) {
              input = `<textarea class="ivq-input" id="${id}" data-profile="${f.key}" rows="2" maxlength="${f.max}">${escapeHTML(v)}</textarea>`;
            } else {
              input = `<input class="ivq-input" id="${id}" data-profile="${f.key}" type="${f.type || "text"}" ${f.type === "number" ? 'min="0" max="60"' : `maxlength="${f.max}"`} value="${escapeAttr(v)}">`;
            }
            return `<div class="iv-field${f.area ? " is-wide" : ""}"><label class="iv-label" for="${id}">${escapeHTML(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>${input}</div>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderSection(section, i) {
    if (!section.questions.length) return "";
    return `
      <div class="iv-section" data-section="${escapeAttr(section.id)}">
        <div class="iv-section-head">
          <div class="qsection-index">${String(i + 1).padStart(2, "0")}</div>
          <div>
            <h2>${escapeHTML(section.title)}</h2>
            ${section.blurb ? `<p>${escapeHTML(section.blurb)}</p>` : ""}
            <div class="qsection-meta" data-section-meta="${escapeAttr(section.id)}"></div>
          </div>
        </div>
        <div class="iv-list">${section.questions.map(renderQuestion).join("")}</div>
      </div>
    `;
  }

  let qCounter = 0;
  function renderQuestion(q) {
    qCounter += 1;
    const value = state.answers[q.id] || "";
    return `
      <div class="ivq${filled(q.id) ? " is-done" : ""}" data-q="${escapeAttr(q.id)}">
        <button type="button" class="ivq-head" aria-expanded="false" aria-controls="ivq-body-${escapeAttr(q.id)}" id="ivq-head-${escapeAttr(q.id)}">
          <span class="ivq-num">Q${String(qCounter).padStart(2, "0")}</span>
          <span class="ivq-text">${escapeHTML(q.text)}</span>
          <span class="q-badge ${q.required ? "q-badge-req" : "q-badge-opt"}">${q.required ? "Required" : "Optional"}</span>
          <span class="ivq-check" aria-label="Answered">&check;</span>
          <span class="ivq-chevron" aria-hidden="true"></span>
        </button>
        <div class="ivq-body" id="ivq-body-${escapeAttr(q.id)}" role="region" aria-labelledby="ivq-head-${escapeAttr(q.id)}" inert>
          <div class="ivq-body-inner">
            ${q.hint ? `<p class="ivq-hint">${escapeHTML(q.hint)}</p>` : ""}
            <textarea class="ivq-input" data-answer="${escapeAttr(q.id)}" rows="6" maxlength="${IV_MAX_ANSWER}" placeholder="Write your answer here…">${escapeHTML(value)}</textarea>
            <div class="ivq-foot">
              <span class="ivq-count" data-count="${escapeAttr(q.id)}">${value.length} / ${IV_MAX_ANSWER}</span>
              <button type="button" class="ivq-next" data-next="${escapeAttr(q.id)}">Next question &rarr;</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCustomSection() {
    return `
      <div class="iv-section" data-section="custom">
        <div class="iv-section-head">
          <div class="qsection-index">+</div>
          <div>
            <h2>Add your own questions</h2>
            <p>Optional. Write up to ${state.customLimit} questions you'd rather be asked, and answer them. They're shown at the end of your interview.</p>
            <div class="qsection-meta" id="iv-custom-meta"></div>
          </div>
        </div>
        <div class="iv-custom" id="iv-custom"></div>
        <div class="iv-custom-actions">
          <button type="button" class="btn btn-ghost" id="iv-add-custom">+ Add a question</button>
          <div class="iv-ideas">
            <span class="label-mono">Ideas</span>
            ${CUSTOM_QUESTION_IDEAS.map(i => `<button type="button" class="iv-idea" data-idea="${escapeAttr(i)}">${escapeHTML(i)}</button>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderCustomRows() {
    document.getElementById("iv-custom").innerHTML = state.custom.map((c, i) => `
      <div class="iv-custom-row" data-custom="${i}">
        <div class="iv-custom-top">
          <span class="ivq-num">Your own ${i + 1}</span>
          <button type="button" class="bo-row-remove" data-remove-custom="${i}">[ Remove ]</button>
        </div>
        <label class="iv-label" for="iv-cq-${i}">Question</label>
        <input type="text" class="ivq-input" id="iv-cq-${i}" data-custom-q="${i}" maxlength="200" value="${escapeAttr(c.q)}" placeholder="What would you like to be asked?">
        <label class="iv-label" for="iv-ca-${i}">Your answer</label>
        <textarea class="ivq-input" id="iv-ca-${i}" data-custom-a="${i}" rows="5" maxlength="${IV_MAX_ANSWER}" placeholder="Write your answer here…">${escapeHTML(c.a)}</textarea>
      </div>
    `).join("");
    document.getElementById("iv-add-custom").hidden = state.custom.length >= state.customLimit;
    document.getElementById("iv-custom-meta").textContent = `${state.custom.length} of ${state.customLimit} added`;
    applyReadOnly();
  }

  // ---------- accordion + inputs ----------

  function setOpen(qEl, open) {
    qEl.classList.toggle("is-open", open);
    qEl.querySelector(".ivq-head").setAttribute("aria-expanded", open ? "true" : "false");
    const body = qEl.querySelector(".ivq-body");
    if (open) body.removeAttribute("inert"); else body.setAttribute("inert", "");
  }

  function openQuestion(id, { focus = true, scroll = true } = {}) {
    document.querySelectorAll(".ivq.is-open").forEach(el => { if (el.dataset.q !== id) setOpen(el, false); });
    const qEl = document.querySelector(`.ivq[data-q="${CSS.escape(id)}"]`);
    if (!qEl) return;
    setOpen(qEl, true);
    if (focus && !readOnly()) setTimeout(() => qEl.querySelector(".ivq-input").focus({ preventScroll: true }), 180);
    if (scroll) setTimeout(() => qEl.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function applyReadOnly() {
    const ro = readOnly();
    root.querySelectorAll(".ivq-input").forEach(el => { el.disabled = ro; });
    root.querySelectorAll("#iv-add-custom, .iv-idea, [data-remove-custom]").forEach(el => { el.disabled = ro; });
  }

  function wire() {
    renderCustomRows();

    root.addEventListener("click", (e) => {
      const head = e.target.closest(".ivq-head");
      if (head) {
        const qEl = head.closest(".ivq");
        if (qEl.classList.contains("is-open")) setOpen(qEl, false); else openQuestion(qEl.dataset.q);
        return;
      }
      const next = e.target.closest("[data-next]");
      if (next) {
        const qs = allQuestions();
        const idx = qs.findIndex(q => q.id === next.dataset.next);
        setOpen(next.closest(".ivq"), false);
        if (qs[idx + 1]) openQuestion(qs[idx + 1].id);
        else document.getElementById("iv-submit").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (readOnly()) return;
      if (e.target.id === "iv-add-custom") {
        if (state.custom.length < state.customLimit) {
          state.custom.push({ q: "", a: "" });
          renderCustomRows();
          document.getElementById(`iv-cq-${state.custom.length - 1}`).focus();
        }
        return;
      }
      const idea = e.target.closest("[data-idea]");
      if (idea && state.custom.length < state.customLimit) {
        state.custom.push({ q: idea.dataset.idea, a: "" });
        renderCustomRows();
        document.getElementById(`iv-ca-${state.custom.length - 1}`).focus();
        queueSave();
        return;
      }
      const remove = e.target.closest("[data-remove-custom]");
      if (remove) {
        state.custom.splice(Number(remove.dataset.removeCustom), 1);
        renderCustomRows();
        queueSave();
      }
    });

    root.addEventListener("input", (e) => {
      const t = e.target;
      if (readOnly()) return;
      if (t.dataset.answer) {
        state.answers[t.dataset.answer] = t.value;
        const counter = document.querySelector(`[data-count="${CSS.escape(t.dataset.answer)}"]`);
        if (counter) counter.textContent = `${t.value.length} / ${IV_MAX_ANSWER}`;
        t.closest(".ivq").classList.toggle("is-done", t.value.trim() !== "");
      } else if (t.dataset.profile) {
        state.profile[t.dataset.profile] = t.type === "number" ? (t.value === "" ? "" : Number(t.value)) : t.value;
      } else if (t.dataset.customQ !== undefined) {
        state.custom[Number(t.dataset.customQ)].q = t.value;
      } else if (t.dataset.customA !== undefined) {
        state.custom[Number(t.dataset.customA)].a = t.value;
      } else {
        return;
      }
      if (state.approval.approved) { state.approval = { approved: false }; }
      refreshAll();
      queueSave();
    });

    root.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") e.target.dispatchEvent(new Event("input", { bubbles: true })); });
    root.addEventListener("focusout", () => { if (state.dirty) saveNow(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && state.dirty) saveNow(); });
    window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

    const firstOpen = missingRequired().find(q => !q.fromProfile);
    if (firstOpen) openQuestion(firstOpen.id, { focus: false, scroll: false });
    applyReadOnly();
  }

  // ---------- status, progress, submit ----------

  function refreshAll() { refreshBanner(); refreshProgress(); refreshSubmit(); applyReadOnly(); }

  function refreshBanner() {
    const el = document.getElementById("iv-banner");
    if (!el) return;
    if (state.published) {
      el.innerHTML = `<div class="iv-note is-published">Your interview is live. <a class="bracket-link" href="${escapeAttr(state.published.url)}">[ Read it ]</a></div>`;
    } else if (state.locked) {
      el.innerHTML = `<div class="iv-note is-locked"><strong>Locked.</strong> This version is being prepared for publishing, so it can't be edited any more. Need a change? Just reply to us and we'll reopen it.</div>`;
    } else if (state.approval.approved) {
      const who = state.approval.by === "admin" ? "ProductMoat marked this version as final on your behalf" : "You marked this version as final";
      el.innerHTML = `<div class="iv-note is-approved"><strong>&check; ${who}</strong> on ${escapeHTML(formatWhen(state.approval.at))}. If you change anything, it goes back to draft and you can mark it final again.</div>`;
    } else {
      el.innerHTML = `<div class="iv-note is-draft"><strong>Draft.</strong> You're still working on this version — nothing is final until you say so at the bottom.</div>`;
    }
  }

  function refreshProgress() {
    const req = state.questionnaire.sections.flatMap(s => s.questions).filter(q => q.required);
    const done = req.length - missingRequired().length;
    const optional = allQuestions().filter(q => !q.required);
    const bar = document.getElementById("iv-progress");
    if (bar) {
      bar.innerHTML = `
        <div class="iv-progress-line"><div class="iv-progress-fill" style="width:${req.length ? Math.round((done / req.length) * 100) : 100}%"></div></div>
        <div class="iv-progress-text">
          <span><strong>${done} of ${req.length}</strong> required</span>
          <span><strong>${optional.filter(q => filled(q.id)).length} of ${optional.length}</strong> optional</span>
          <span><strong>${state.custom.filter(c => c.q.trim() && c.a.trim()).length}</strong> of your own</span>
        </div>`;
    }
    sections().forEach(s => {
      const el = document.querySelector(`[data-section-meta="${CSS.escape(s.id)}"]`);
      if (el) el.textContent = `${s.questions.filter(q => filled(q.id)).length} of ${s.questions.length} answered`;
    });
  }

  function refreshSubmit() {
    const box = document.getElementById("iv-submit");
    if (!box) return;
    const missing = missingRequired();
    const approved = state.approval.approved;
    const ro = readOnly();

    let body;
    if (state.published) {
      body = `<h2>Published.</h2><p>Thank you — your interview is live.</p>`;
    } else if (state.locked) {
      body = `<h2>Locked for publishing.</h2><p>Nothing more to do — we'll be in touch about the publish date.</p>`;
    } else if (approved) {
      body = `<h2>You're happy with this version.</h2>
        <p>We'll take it from here. Want to change something? Reopen it — it goes back to draft.</p>
        <button type="button" class="btn btn-ghost" id="iv-reopen">Reopen for editing</button>`;
    } else {
      body = `<h2>Happy with this version?</h2>
        <p>${missing.length
          ? `Still needed before you can finish: ${missing.map(q => escapeHTML(q.fromProfile ? q.text : q.text)).join("; ")}.`
          : "All required questions are answered. Optional ones can stay blank. When you press the button we'll treat this as the version you're happy with."}</p>
        <button type="button" class="btn btn-primary" id="iv-approve" ${missing.length ? 'aria-disabled="true"' : ""}>I'm happy with this version</button>`;
    }
    box.innerHTML = body;
    const approveBtn = document.getElementById("iv-approve");
    if (approveBtn) approveBtn.addEventListener("click", () => setApproval(true));
    const reopen = document.getElementById("iv-reopen");
    if (reopen) reopen.addEventListener("click", () => setApproval(false));
    if (ro) box.classList.add("is-readonly"); else box.classList.remove("is-readonly");
  }

  // ---------- saving ----------

  function payload() {
    return JSON.stringify({ t: token, profile: state.profile, answers: state.answers, custom: state.custom });
  }

  function queueSave() {
    state.dirty = true;
    setToast("Saving…");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveNow, IV_SAVE_DELAY_MS);
  }

  async function post(body) {
    const resp = await fetch("/api/interview", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", body
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw Object.assign(new Error("request failed"), { status: resp.status, data });
    return data;
  }

  async function saveNow() {
    clearTimeout(state.saveTimer);
    if (state.saving) { state.saveTimer = setTimeout(saveNow, 400); return; }
    state.saving = true;
    state.dirty = false;
    try {
      const data = await post(payload());
      state.status = data.status;
      state.approval = data.approval;
      refreshBanner(); refreshSubmit();
      setToast(`Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, true);
    } catch (err) {
      if (err.status === 423) { apply(err.data); render(); setToast("This interview has been locked.", true, true); }
      else { state.dirty = true; setToast("Couldn't save — check your connection. We'll retry.", false, true); state.saveTimer = setTimeout(saveNow, 5000); }
    } finally {
      state.saving = false;
    }
  }

  async function setApproval(approve) {
    if (approve && missingRequired().length) return;
    if (state.dirty) await saveNow();
    try {
      const data = await post(JSON.stringify({ t: token, approve }));
      state.approval = data.approval;
      state.status = data.status;
      refreshAll();
      if (approve) window.scrollTo({ top: 0, behavior: "smooth" });
      setToast(approve ? "Marked as your final version — thank you!" : "Reopened — back to draft.", true);
    } catch (err) {
      setToast("Couldn't update — please try again.", false, true);
    }
  }

  let toastTimer = null;
  function setToast(text, autoHide, isError) {
    const el = document.getElementById("iv-toast");
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
    clearTimeout(toastTimer);
    if (autoHide) toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
  }
}

function formatWhen(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function formatDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString([], { dateStyle: "long" });
}
function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderInvalid(root) {
  root.innerHTML = `
    <section class="why-hero">
      <div class="wrap">
        <div class="eyebrow">Your interview</div>
        <h1>This link isn't working.</h1>
        <p class="about-lede">
          It may have expired, been replaced by a newer one, or been copied incompletely. Reply
          to the message we sent you and we'll get you a fresh link.
        </p>
        <a class="btn btn-ghost" href="questions.html">See what the interview covers &rarr;</a>
      </div>
    </section>
  `;
}
