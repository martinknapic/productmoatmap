// ProductMoat — the alumni network (network.html)
//
// A members-only directory of the product people ProductMoat has interviewed. It's reciprocal and
// explicit: a member ticks the consent box (here, on Apply, or on My profile) to be visible to the
// other members — once they've been interviewed — and in return gets access to the directory.
// GET /api/member-network only returns people to members who have opted in.

function initNetwork() {
  const root = document.getElementById("net-root");
  if (!root) return;

  const focusLabel = tag => (MEMBER_FOCUS_OPTIONS.find(([v]) => v === tag) || [tag, tag])[1];
  const hero = (title, lede, extra = "") => `
    <section class="why-hero net-hero">
      <div class="wrap">
        <div class="eyebrow">Alumni network</div>
        <h1>${title}</h1>
        <p class="about-lede">${lede}</p>
        ${extra}
      </div>
    </section>`;

  const consentCard = `
    <section class="wrap net-join">
      <div class="net-consent">
        <h2>Join the network</h2>
        <p>The network is members-only and works both ways. By joining you agree that, once you've been interviewed, other network members can see your <strong>name, photo, role, company, location, focus areas, short bio, links and email</strong>. In return you can browse the directory of everyone who's done the same, starting now.</p>
        <div class="form-checkbox-row">
          <input type="checkbox" id="net-agree">
          <label for="net-agree"><strong>Yes, I agree to be visible to other network members</strong> and to have access to the network. I can leave any time from My profile.</label>
        </div>
        <span class="submit-wrap locked" id="net-join-wrap">
          <button type="button" class="btn btn-primary" id="net-join" aria-disabled="true">Join the network</button>
          <span class="submit-hint" role="tooltip">Tick the box to agree first</span>
        </span>
        <p class="hint-inline li-error" id="net-error" hidden>Couldn't join just now — please try again.</p>
      </div>
    </section>`;

  function show(html) { root.innerHTML = html; }

  function renderJoin() {
    show(hero("The people we've interviewed.", "A members-only network of the product people featured on ProductMoat — for those who've agreed to be visible to each other.") + consentCard);
    const box = document.getElementById("net-agree"), btn = document.getElementById("net-join"), wrap = document.getElementById("net-join-wrap");
    box.addEventListener("change", () => {
      btn.toggleAttribute("aria-disabled", !box.checked);
      wrap.classList.toggle("locked", !box.checked);
    });
    btn.addEventListener("click", async () => {
      if (btn.getAttribute("aria-disabled") === "true") return;
      btn.setAttribute("aria-disabled", "true"); btn.textContent = "Joining…";
      try {
        const resp = await fetch("/api/member-network", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ join: true }) });
        if (!resp.ok) throw new Error("join failed");
        load();
      } catch (err) {
        document.getElementById("net-error").hidden = false;
        btn.removeAttribute("aria-disabled"); btn.textContent = "Join the network";
      }
    });
  }

  function cardHTML(p) {
    const initials = (p.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    const avatar = p.photo
      ? `<div class="avatar net-avatar has-photo"><img src="${escapeAttr(/^https?:/i.test(p.photo) ? p.photo : "/" + p.photo.replace(/^\/+/, ""))}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><span>${escapeHTML(initials)}</span></div>`
      : `<div class="avatar net-avatar"><span>${escapeHTML(initials)}</span></div>`;
    const link = (url, label) => url ? `<a class="bracket-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">[ ${label} ]</a>` : "";
    return `
      <article class="net-card" data-name="${escapeAttr((p.name + " " + p.company + " " + p.role + " " + p.location).toLowerCase())}" data-tags="${escapeAttr(p.focusTags.join(","))}">
        <div class="net-card-top">
          ${avatar}
          <div>
            <h3>${escapeHTML(p.name)}${p.you ? ' <span class="net-you">You</span>' : ""}</h3>
            <div class="net-role">${escapeHTML(p.role)}${p.company ? ` &middot; ${escapeHTML(p.company)}` : ""}</div>
            <div class="net-loc">${escapeHTML(p.location)}</div>
          </div>
        </div>
        ${p.focusTags.length ? `<div class="net-tags">${p.focusTags.map(t => `<span class="tag">${escapeHTML(focusLabel(t))}</span>`).join("")}</div>` : ""}
        ${p.snippet ? `<p class="net-bio">${escapeHTML(p.snippet)}</p>` : ""}
        <div class="net-contact">
          <a class="net-email" href="mailto:${escapeAttr(p.email)}">${escapeHTML(p.email)}</a>
          <button type="button" class="net-copy" data-copy="${escapeAttr(p.email)}" aria-label="Copy email">Copy</button>
        </div>
        <div class="net-links">${link(p.links.linkedin, "LinkedIn")}${link(p.links.website, "Website")}${link(p.links.twitter, "X")}${p.interviewUrl ? `<a class="bracket-link" href="${escapeAttr(p.interviewUrl)}">[ Read the interview ]</a>` : ""}</div>
      </article>`;
  }

  function renderDirectory(people) {
    const tags = [...new Set(people.flatMap(p => p.focusTags))];
    show(hero("The people we've interviewed.", `Everyone here has been featured on ProductMoat and agreed to be visible to fellow members. Please use these details respectfully — they're shared for genuine peer-to-peer connection, not outreach at scale.`,
      `<div class="net-count">${people.length} member${people.length === 1 ? "" : "s"}</div>`) + `
      <section class="wrap net-body">
        <div class="net-filters">
          <input type="search" id="net-search" class="net-search" placeholder="Search name, company, role, location…">
          <select id="net-focus" class="net-focus"><option value="">All focus areas</option>${tags.map(t => `<option value="${escapeAttr(t)}">${escapeHTML(focusLabel(t))}</option>`).join("")}</select>
        </div>
        ${people.length ? `<div class="net-grid" id="net-grid">${people.map(cardHTML).join("")}</div>
          <p class="bo-empty net-empty" id="net-none" hidden>No one matches that.</p>`
          : `<p class="net-empty">No one is listed yet. Members appear here once they've been interviewed and have agreed to be visible — you'll be one of them when it's your turn.</p>`}
        <p class="net-leave">Changed your mind? <a class="bracket-link" href="account.html">[ Leave the network from My profile ]</a></p>
      </section>`);
    const grid = document.getElementById("net-grid");
    if (!grid) return;
    const apply = () => {
      const q = document.getElementById("net-search").value.trim().toLowerCase();
      const tag = document.getElementById("net-focus").value;
      let shown = 0;
      grid.querySelectorAll(".net-card").forEach(card => {
        const ok = (!q || card.dataset.name.includes(q)) && (!tag || card.dataset.tags.split(",").includes(tag));
        card.hidden = !ok; if (ok) shown += 1;
      });
      document.getElementById("net-none").hidden = shown > 0;
    };
    document.getElementById("net-search").addEventListener("input", apply);
    document.getElementById("net-focus").addEventListener("change", apply);
    grid.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-copy]");
      if (!b) return;
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied ✓"; setTimeout(() => { b.textContent = "Copy"; }, 1400); } catch (err) { window.prompt("Copy:", b.dataset.copy); }
    });
  }

  function load() {
    fetch("/api/member-network", { credentials: "same-origin" })
      .then(resp => (resp.status === 401 ? { signedOut: true } : resp.ok ? resp.json() : Promise.reject(resp.status)))
      .then(data => {
        if (data.signedOut) {
          show(hero("Sign in to see the network.", "The alumni network is members-only. Sign in with LinkedIn to join or to browse it.",
            `<div class="mi-actions"><a class="btn btn-primary" href="signup.html">Sign up with LinkedIn</a><a class="bracket-link" href="apply.html">[ Apply to be interviewed ]</a></div>`));
        } else if (!data.joined) {
          renderJoin();
        } else {
          renderDirectory(data.people || []);
        }
      })
      .catch(() => show(hero("Something went wrong.", "We couldn't load the network just now. Please refresh in a moment.")));
  }

  load();
}
