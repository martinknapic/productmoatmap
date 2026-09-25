// ProductMoat Backoffice — question editor
//
// Used twice: backoffice/questions.html edits the standard question bank (what new invitations
// start from), and backoffice/candidate.html edits one person's own copy of it. Same UI both
// times: sections with a title/blurb, and questions with text, guidance, and a required flag.
// Question ids stay stable (answers are keyed by them); new questions get an id from the API.

function boQuestionEditor(mount, initialSections, onChange) {
  let sections = JSON.parse(JSON.stringify(initialSections || []));
  const esc = boEscapeHTML;

  function changed() { if (onChange) onChange(sections); }

  function render() {
    mount.innerHTML = `
      <div class="bo-qed">
        ${sections.map((s, si) => `
          <div class="bo-qed-section" data-si="${si}">
            <div class="bo-qed-section-head">
              <div class="bo-qed-fields">
                <label class="bo-lbl">Section title
                  <input type="text" class="bo-input" data-f="title" value="${esc(s.title)}" maxlength="120">
                </label>
                <label class="bo-lbl">Short description
                  <input type="text" class="bo-input" data-f="blurb" value="${esc(s.blurb || "")}" maxlength="300">
                </label>
              </div>
              <div class="bo-qed-tools">
                <button type="button" class="bo-row-remove" data-act="sec-up" ${si === 0 ? "disabled" : ""}>[ ↑ ]</button>
                <button type="button" class="bo-row-remove" data-act="sec-down" ${si === sections.length - 1 ? "disabled" : ""}>[ ↓ ]</button>
                <button type="button" class="bo-row-remove" data-act="sec-del">[ Delete section ]</button>
              </div>
            </div>
            <ol class="bo-qed-list">
              ${s.questions.map((q, qi) => `
                <li class="bo-qed-q" data-qi="${qi}">
                  <div class="bo-qed-fields">
                    <label class="bo-lbl">Question
                      <input type="text" class="bo-input" data-f="text" value="${esc(q.text)}" maxlength="300">
                    </label>
                    <label class="bo-lbl">Guidance shown under it
                      <input type="text" class="bo-input" data-f="hint" value="${esc(q.hint || "")}" maxlength="300">
                    </label>
                  </div>
                  <div class="bo-qed-tools">
                    <label class="bo-check"><input type="checkbox" data-f="required" ${q.required ? "checked" : ""}> Required</label>
                    ${q.fromProfile ? `<span class="bo-badge">FROM PROFILE</span>` : ""}
                    <button type="button" class="bo-row-remove" data-act="q-up" ${qi === 0 ? "disabled" : ""}>[ ↑ ]</button>
                    <button type="button" class="bo-row-remove" data-act="q-down" ${qi === s.questions.length - 1 ? "disabled" : ""}>[ ↓ ]</button>
                    <button type="button" class="bo-row-remove" data-act="q-del">[ Remove ]</button>
                  </div>
                </li>`).join("")}
            </ol>
            <button type="button" class="btn btn-ghost bo-small" data-act="q-add">+ Add a question</button>
          </div>`).join("")}
        <button type="button" class="btn btn-ghost bo-small" data-act="sec-add">+ Add a section</button>
      </div>`;
  }

  mount.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const secEl = e.target.closest("[data-si]");
    const s = sections[Number(secEl.dataset.si)];
    const qEl = e.target.closest("[data-qi]");
    if (qEl) {
      const q = s.questions[Number(qEl.dataset.qi)];
      q[f] = f === "required" ? e.target.checked : e.target.value;
    } else {
      s[f] = e.target.value;
    }
    changed();
  });

  mount.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || btn.disabled) return;
    const si = Number(btn.closest("[data-si]") && btn.closest("[data-si]").dataset.si);
    const qEl = btn.closest("[data-qi]");
    const qi = qEl ? Number(qEl.dataset.qi) : -1;
    const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };
    switch (btn.dataset.act) {
      case "sec-up": swap(sections, si, si - 1); break;
      case "sec-down": swap(sections, si, si + 1); break;
      case "sec-del":
        if (!window.confirm(`Delete the section "${sections[si].title}" and its ${sections[si].questions.length} question(s)?`)) return;
        sections.splice(si, 1); break;
      case "sec-add": sections.push({ title: "New section", blurb: "", questions: [] }); break;
      case "q-up": swap(sections[si].questions, qi, qi - 1); break;
      case "q-down": swap(sections[si].questions, qi, qi + 1); break;
      case "q-del": sections[si].questions.splice(qi, 1); break;
      case "q-add": sections[si].questions.push({ text: "", hint: "", required: false }); break;
    }
    render();
    changed();
  });

  render();
  return {
    getSections: () => sections,
    setSections: (next) => { sections = JSON.parse(JSON.stringify(next)); render(); }
  };
}
