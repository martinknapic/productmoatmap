// ProductMoat — shared portal logic (theme, avatars, homepage grid, person page)
// Avatars are flat ink-on-paper medallions (see .avatar rules in swiss.css) by default —
// no per-person color. A person with a `photo` field gets that photo instead.

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function avatarHTML(person, cls) {
  if (person.photo) {
    return `<div class="${cls}"><img src="${person.photo}" alt="${escapeHTML(person.name)}"></div>`;
  }
  return `<div class="${cls}">${initials(person.name)}</div>`;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Lightbox (full-size profile photo) ----------

function getLightbox() {
  let overlay = document.getElementById("lightbox-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "lightbox-overlay";
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `<button class="lightbox-close" aria-label="Close">[ Close ]</button><img class="lightbox-img">`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });
  overlay.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });

  return overlay;
}

function openLightbox(src, alt) {
  const overlay = getLightbox();
  const img = overlay.querySelector(".lightbox-img");
  img.src = src;
  img.alt = alt;
  overlay.classList.add("open");
}

function closeLightbox() {
  const overlay = document.getElementById("lightbox-overlay");
  if (overlay) overlay.classList.remove("open");
}

// ---------- Theme ----------

function initTheme() {
  const saved = localStorage.getItem("pm-theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const light = saved ? saved === "light" : prefersLight;
  document.body.classList.toggle("light", light);
  updateThemeBtn();
}

function toggleTheme() {
  document.body.classList.toggle("light");
  localStorage.setItem("pm-theme", document.body.classList.contains("light") ? "light" : "dark");
  updateThemeBtn();
  if (miniMapInstance) miniMapInstance.setStyle(miniMapStyleURL());
}

function updateThemeBtn() {
  const btn = document.getElementById("theme-btn");
  if (btn) btn.textContent = document.body.classList.contains("light") ? "DARK" : "LIGHT";
}

// ---------- Homepage ----------

const FOCUS_LABELS = {
  all: "All",
  ai: "AI & ML",
  b2b: "B2B SaaS",
  design: "Design Systems",
  growth: "Consumer & Growth",
  fintech: "Fintech",
  platform: "Platform & Infra",
  marketplace: "Marketplace",
  health: "Healthtech",
  leadership: "Product Leadership"
};

let activeFilter = "all";

function renderStats() {
  const el = document.getElementById("stats-row");
  if (!el) return;
  const countries = new Set(INTERVIEWS.map(p => p.location.split(",").pop().trim())).size;
  el.innerHTML = `
    <div><div class="stat-num">${INTERVIEWS.length}</div><div class="stat-label">Conversations published</div></div>
    <div><div class="stat-num">${countries}</div><div class="stat-label">Countries represented</div></div>
    <div><div class="stat-num">Weekly</div><div class="stat-label">New interview cadence</div></div>
  `;
}

function renderFeatured() {
  const el = document.getElementById("featured-slot");
  if (!el) return;
  const ordered = [...INTERVIEWS].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  const p = ordered[0];
  const visualHTML = p.photo
    ? `<div class="featured-visual has-photo">
         <span class="featured-photo-badge">01</span>
         <div class="featured-photo-wrap"><img class="featured-photo" src="${p.photo}" alt="${escapeHTML(p.name)}"></div>
       </div>`
    : `<div class="featured-visual">
         <span class="index-mark">01</span>
         <div class="avatar-big">${initials(p.name)}</div>
       </div>`;

  el.innerHTML = `
    <a class="featured-card" href="person.html?slug=${p.slug}">
      ${visualHTML}
      <div class="featured-body">
        <span class="tag">Latest conversation</span>
        <h3>${escapeHTML(p.name)}</h3>
        <div class="featured-role">${escapeHTML(p.role)} at ${escapeHTML(p.company)} &middot; ${escapeHTML(p.location)}</div>
        <p class="featured-quote">&ldquo;${escapeHTML(p.pullQuote)}&rdquo;</p>
        <span class="featured-cta">Read the interview <span>&rarr;</span></span>
      </div>
    </a>
  `;
}

function renderChips() {
  const el = document.getElementById("chip-row");
  if (!el) return;
  const tags = ["all", ...new Set(INTERVIEWS.map(p => p.focusTag))];
  el.innerHTML = tags.map(tag =>
    `<button class="chip${tag === activeFilter ? " active" : ""}" data-tag="${tag}">${FOCUS_LABELS[tag] || tag}</button>`
  ).join("");
  el.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.tag;
      renderChips();
      renderGrid();
    });
  });
}

function renderGrid() {
  const el = document.getElementById("grid");
  if (!el) return;
  const list = [...INTERVIEWS]
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .filter(p => activeFilter === "all" || p.focusTag === activeFilter);

  el.innerHTML = list.map(p => `
    <a class="card" href="person.html?slug=${p.slug}">
      ${avatarHTML(p, "avatar")}
      <div>
        <div class="card-name">${escapeHTML(p.name)}</div>
        <div class="card-role">${escapeHTML(p.role)}</div>
      </div>
      <div class="card-meta">${escapeHTML(p.company)} &middot; ${escapeHTML(p.location)}</div>
      <p class="card-snippet">${escapeHTML(p.snippet)}</p>
      <span class="card-tag">${FOCUS_LABELS[p.focusTag] || p.focusTag}</span>
    </a>
  `).join("");
}

function initHome() {
  renderStats();
  renderFeatured();
  renderChips();
  renderGrid();
}

// ---------- Person page ----------

function initPerson() {
  const slug = new URLSearchParams(location.search).get("slug");
  const p = findInterview(slug);
  const root = document.getElementById("person-root");
  if (!p) {
    root.innerHTML = `<div class="not-found"><p>No interview found for &ldquo;${escapeHTML(slug || "")}&rdquo;.</p><br><a class="btn btn-ghost" href="index.html">&larr; Back to all conversations</a></div>`;
    return;
  }

  document.title = `${p.name} — ProductMoat`;

  const hasCoords = typeof p.lat === "number" && typeof p.lng === "number";

  root.innerHTML = `
    <section class="profile-hero">
      <div class="wrap">
        <div class="hero-content">
          <div class="hero-content-top">
            <a class="back-link" href="index.html">&larr; All conversations</a>
            <div class="profile-top">
              ${avatarHTML(p, "avatar-xl")}
              <div>
                <h1 class="profile-name">${escapeHTML(p.name)}</h1>
                <div class="profile-role">${escapeHTML(p.role)} at ${escapeHTML(p.company)}</div>
              </div>
            </div>

            <div class="profile-meta">
              <div class="meta-item"><div class="meta-label">Location</div><div class="meta-value">${escapeHTML(p.location)}</div></div>
              <div class="meta-item"><div class="meta-label">Focus area</div><div class="meta-value">${escapeHTML(FOCUS_LABELS[p.focusTag] || p.focusTag)}</div></div>
              <div class="meta-item"><div class="meta-label">Experience</div><div class="meta-value">${p.yearsExperience} years</div></div>
              <div class="meta-item"><div class="meta-label">Published</div><div class="meta-value">${formatDate(p.publishedDate)}</div></div>
            </div>

            <div class="social-row">
              ${p.links.linkedin ? `<a class="bracket-link" href="${p.links.linkedin}" target="_blank" rel="noopener">[ LinkedIn ]</a>` : ""}
              ${p.links.website ? `<a class="bracket-link" href="${p.links.website}" target="_blank" rel="noopener">[ Website ]</a>` : ""}
              ${p.links.twitter ? `<a class="bracket-link" href="${p.links.twitter}" target="_blank" rel="noopener">[ X ]</a>` : ""}
            </div>

            <blockquote class="pull-quote">&ldquo;${escapeHTML(p.pullQuote)}&rdquo;</blockquote>
          </div>

          ${hasCoords ? `
          <div class="hero-globe-col">
            <div id="mini-map" class="hero-globe"></div>
            <div class="hero-globe-scrim"></div>
            <a class="hero-globe-caption" href="map.html?slug=${p.slug}">
              <span>${escapeHTML(p.location)}</span>
              <span class="mini-map-cta">View on map &rarr;</span>
            </a>
          </div>` : ""}
        </div>
      </div>
    </section>

    <section class="foreword">
      <div class="wrap">
        <div class="foreword-inner">
          <div class="label-mono">Foreword</div>
          <p>${escapeHTML(p.foreword)}</p>
          <div class="foreword-byline">&mdash; Martin Knapic, ProductMoat</div>
        </div>
      </div>
    </section>

    <section class="qna">
      <div class="wrap">
        <div class="qna-inner">
          ${(() => {
            const total = p.sections.reduce((n, s) => n + s.questions.length, 0);
            let count = 0;
            return p.sections.map(section => `
              <div class="qna-section">
                <h2 class="qna-section-title">${escapeHTML(section.title)}</h2>
                ${section.questions.map(qa => {
                  count += 1;
                  return `
                    <div class="qa-item">
                      <div class="qa-num">${String(count).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
                      <h3>${escapeHTML(qa.q)}</h3>
                      <p>${escapeHTML(qa.a)}</p>
                    </div>
                  `;
                }).join("")}
              </div>
            `).join("");
          })()}
        </div>
      </div>
    </section>
  `;

  if (p.photo) {
    const avatarEl = root.querySelector(".avatar-xl");
    avatarEl.classList.add("has-photo");
    avatarEl.addEventListener("click", () => openLightbox(p.photo, p.name));
  }

  if (hasCoords) initMiniGlobe(p);
  renderProfileNav(p);
}

// ---------- Mini-map widgets ----------
// Two implementations share the #mini-map container + miniMapInstance variable, so
// toggleTheme()'s re-style hook works with whichever one is active. Only one is called
// from initPerson() at a time.

let miniMapInstance = null;

function miniMapStyleURL() {
  const dark = !document.body.classList.contains("light");
  return dark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
}

// Flat, non-interactive mercator preview — the original mini-map. Kept as a fallback;
// swap the initMiniGlobe(p) call above for initMiniMap(p) to bring it back.
function initMiniMap(p) {
  const el = document.getElementById("mini-map");
  if (!el || typeof maplibregl === "undefined") return;

  miniMapInstance = new maplibregl.Map({
    container: "mini-map",
    style: miniMapStyleURL(),
    center: [p.lng, p.lat],
    zoom: 9,
    interactive: false,
    attributionControl: false
  });

  miniMapInstance.on("load", () => {
    const dot = document.createElement("div");
    dot.className = "mini-map-pin";
    new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(miniMapInstance);
  });
}

// Mini globe — same globe projection, basemap, and sky treatment as the main map
// (map.html / app.js), but read-only: no drag/scroll/click, just a settle-in spin that
// mirrors the flyTo you'd see landing on this person from the main map. Click-through to
// the real map is handled by the <a> wrapper in the markup, not the map itself.
function initMiniGlobe(p) {
  const el = document.getElementById("mini-map");
  if (!el || typeof maplibregl === "undefined") return;

  miniMapInstance = new maplibregl.Map({
    container: "mini-map",
    style: miniMapStyleURL(),
    center: [p.lng, p.lat],
    zoom: 0.5,
    interactive: false,
    attributionControl: false
  });

  miniMapInstance.on("style.load", () => {
    miniMapInstance.setProjection({ type: "globe" });
    const dark = !document.body.classList.contains("light");
    miniMapInstance.setSky(dark
      ? { "sky-color": "#121212", "sky-horizon-blend": 0.5, "horizon-color": "#2a2a28", "horizon-fog-blend": 0.5, "fog-color": "#121212", "fog-ground-blend": 0.3 }
      : { "sky-color": "#f2f1ec", "sky-horizon-blend": 0.5, "horizon-color": "#e9e7de", "horizon-fog-blend": 0.5, "fog-color": "#f2f1ec", "fog-ground-blend": 0.3 });
  });

  let spinning = true;
  function idleSpin() {
    if (!spinning) return;
    const c = miniMapInstance.getCenter();
    c.lng -= 0.35;
    miniMapInstance.easeTo({ center: c, duration: 90, easing: (t) => t });
  }
  miniMapInstance.on("moveend", () => { if (spinning) idleSpin(); });

  miniMapInstance.on("load", () => {
    const dot = document.createElement("div");
    dot.className = "mini-map-pin";
    new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(miniMapInstance);

    idleSpin();
    setTimeout(() => {
      spinning = false;
      miniMapInstance.flyTo({ center: [p.lng, p.lat], zoom: 2.3, duration: 2400, essential: true });
    }, 1600);
  });
}

function renderProfileNav(current) {
  const nav = document.getElementById("profile-nav");
  if (!nav) return;
  const ordered = [...INTERVIEWS].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  const idx = ordered.findIndex(p => p.slug === current.slug);
  const prev = ordered[(idx - 1 + ordered.length) % ordered.length];
  const next = ordered[(idx + 1) % ordered.length];
  nav.innerHTML = `
    <a href="person.html?slug=${prev.slug}">&larr; ${escapeHTML(prev.name)}</a>
    <a class="next" href="person.html?slug=${next.slug}">${escapeHTML(next.name)} &rarr;</a>
  `;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------- Apply page ----------
// No backend yet: on submit this builds the same shape as an INTERVIEWS entry
// (see assets/people-data.js) plus private contact fields, logs it for whoever's
// wiring up the real submission handler, and swaps in a confirmation state.

function qaRowTemplate(list) {
  const row = document.createElement("div");
  row.className = "qa-form-item";
  row.innerHTML = `
    <div class="qa-form-item-head">
      <span class="hint-inline">Question ${list.children.length + 1}</span>
      <button type="button" class="qa-remove">[ Remove ]</button>
    </div>
    <div class="form-field full">
      <label>Question</label>
      <input type="text" class="qa-q" placeholder="A question you'd want to be asked">
    </div>
    <div class="form-field full">
      <label>Your answer</label>
      <textarea class="qa-a" rows="3" placeholder="A few sentences in your own words"></textarea>
    </div>
  `;
  row.querySelector(".qa-remove").addEventListener("click", () => {
    row.remove();
    renumberQaRows(list);
  });
  return row;
}

function renumberQaRows(list) {
  list.querySelectorAll(".qa-form-item").forEach((row, i) => {
    row.querySelector(".qa-form-item-head .hint-inline").textContent = `Question ${i + 1}`;
  });
}

function initApply() {
  const form = document.getElementById("apply-form");
  if (!form) return;

  const qaLists = new Map();
  form.querySelectorAll("[data-qa-list]").forEach(list => {
    const sectionId = list.dataset.qaList;
    qaLists.set(sectionId, list);
    list.appendChild(qaRowTemplate(list));
  });
  form.querySelectorAll("[data-qa-add]").forEach(btn => {
    const list = qaLists.get(btn.dataset.qaAdd);
    btn.addEventListener("click", () => list.appendChild(qaRowTemplate(list)));
  });

  const snippet = document.getElementById("f-snippet");
  const counter = document.getElementById("snippet-counter");
  snippet.addEventListener("input", () => {
    counter.textContent = `${snippet.value.length} / ${snippet.maxLength}`;
  });

  const photoInput = document.getElementById("f-photo");
  const photoPreview = document.getElementById("photo-preview");
  const photoFilename = document.getElementById("photo-filename");
  photoInput.addEventListener("change", () => {
    const file = photoInput.files[0];
    if (!file) {
      photoPreview.innerHTML = "＋";
      photoFilename.textContent = "No file selected — falls back to initials.";
      return;
    }
    photoFilename.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => { photoPreview.innerHTML = `<img src="${reader.result}" alt="">`; };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("f-submit-btn");
    if (submitBtn && submitBtn.getAttribute("aria-disabled") === "true") return;

    form.classList.add("was-validated");
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const application = {
      name: data.get("name").trim(),
      role: data.get("role").trim(),
      company: data.get("company").trim(),
      location: data.get("location").trim(),
      focusTag: data.get("focusTag"),
      yearsExperience: Number(data.get("yearsExperience")),
      links: {
        linkedin: data.get("linkedin").trim(),
        website: data.get("website").trim(),
        twitter: data.get("twitter").trim()
      },
      snippet: data.get("snippet").trim(),
      pullQuote: data.get("pullQuote").trim(),
      sections: [...qaLists.entries()]
        .map(([id, list]) => ({
          id,
          title: (SECTION_TITLES && SECTION_TITLES[id]) || id,
          questions: [...list.querySelectorAll(".qa-form-item")]
            .map(row => ({
              q: row.querySelector(".qa-q").value.trim(),
              a: row.querySelector(".qa-a").value.trim()
            }))
            .filter(qa => qa.q || qa.a)
        }))
        .filter(section => section.questions.length > 0),
      photoFileName: photoInput.files[0] ? photoInput.files[0].name : null,
      contactEmail: data.get("contactEmail").trim(),
      contactPhone: data.get("contactPhone").trim()
    };

    console.log("ProductMoat application (no backend wired yet):", application);

    form.hidden = true;
    document.getElementById("apply-success").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------- LinkedIn verification gate (apply.html) ----------
// The Client ID is public by design — LinkedIn OAuth apps embed it in frontend
// code, only the Client Secret is sensitive (it lives in Vercel env vars and is
// used exclusively by the /api/linkedin-callback function). Replace this with
// your app's Client ID from https://www.linkedin.com/developers/apps.
const LINKEDIN_CLIENT_ID = "778t1x9svtemxo";

// Generic gate: locks every field in `formId` (except the sign-in button and
// the submit button, which gets an aria-disabled treatment instead) until the
// visitor verifies via LinkedIn OAuth. `page` is embedded in the OAuth
// `state` param so /api/linkedin-callback knows which page to redirect back
// to — keep it in sync with ALLOWED_PAGES in that file. `onVerified(profile)`
// lets each page fill in its own page-specific fields once verified.
function initLinkedInGate({ page, formId, submitBtnId, onLocked, onVerified }) {
  const form = document.getElementById(formId);
  const gate = document.getElementById("li-gate");
  if (!form || !gate) return;

  const signInBtn = document.getElementById("li-signin-btn");
  const errorEl = document.getElementById("li-error");
  const submitWrap = document.getElementById("submit-wrap");
  const submitBtn = document.getElementById(submitBtnId);

  function setLocked(locked) {
    form.querySelectorAll("input, select, textarea, button").forEach(el => {
      if (el === submitBtn || el.closest("#li-gate")) return;
      el.disabled = locked;
    });
    submitWrap.classList.toggle("locked", locked);
    if (locked) submitBtn.setAttribute("aria-disabled", "true");
    else submitBtn.removeAttribute("aria-disabled");
    if (onLocked) onLocked(locked);
  }

  setLocked(true);

  function showError() {
    errorEl.hidden = false;
  }

  function startSignIn() {
    errorEl.hidden = true;
    const nonce = crypto.randomUUID();
    sessionStorage.setItem("li_oauth_state", nonce);
    const redirectUri = `${window.location.origin}/api/linkedin-callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state: `${nonce}:${page}`
    });
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  signInBtn.addEventListener("click", startSignIn);

  async function completeSignIn() {
    try {
      const resp = await fetch("/api/linkedin-profile", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("not verified");
      const profile = await resp.json();
      setLocked(false);
      gate.innerHTML = `<div class="li-badge"><span class="li-badge-check">&check;</span> Verified as ${escapeHTML(profile.name || "LinkedIn member")} via LinkedIn</div>`;
      if (onVerified) onVerified(profile);
    } catch (err) {
      showError();
    }
  }

  const params = new URLSearchParams(window.location.search);
  const li = params.get("li");
  if (!li) return;

  const returnedState = params.get("state");
  history.replaceState(null, "", window.location.pathname);

  if (li !== "ok") {
    showError();
    return;
  }

  const expectedState = sessionStorage.getItem("li_oauth_state");
  sessionStorage.removeItem("li_oauth_state");
  if (!returnedState || returnedState !== expectedState) {
    showError();
    return;
  }

  completeSignIn();
}

function initApplyLinkedInGate() {
  initLinkedInGate({
    page: "apply",
    formId: "apply-form",
    submitBtnId: "f-submit-btn",
    onLocked(locked) {
      const photoBtn = document.querySelector(".photo-btn");
      if (photoBtn) photoBtn.classList.toggle("is-locked", locked);
    },
    onVerified(profile) {
      document.getElementById("f-name").value = profile.name || "";
      document.getElementById("f-email").value = profile.email || "";
      if (profile.picture) {
        document.getElementById("photo-preview").innerHTML = `<img src="${profile.picture}" alt="">`;
        document.getElementById("photo-filename").textContent = "Using your LinkedIn photo — choose a file to replace it.";
      }
    }
  });
}

function initRecommendLinkedInGate() {
  initLinkedInGate({
    page: "recommend",
    formId: "recommend-form",
    submitBtnId: "r-submit-btn",
    onVerified(profile) {
      document.getElementById("r-your-name").value = profile.name || "";
      document.getElementById("r-your-email").value = profile.email || "";
    }
  });
}

// ---------- Recommend page ----------
// Same no-backend stub pattern as initApply(): validate, log, swap to a
// confirmation state. Gated behind initRecommendLinkedInGate() — yourName/
// yourEmail arrive pre-filled (and read-only) from the verified profile.

function initRecommend() {
  const form = document.getElementById("recommend-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("r-submit-btn");
    if (submitBtn && submitBtn.getAttribute("aria-disabled") === "true") return;

    form.classList.add("was-validated");
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const recommendation = {
      candidateLinkedin: data.get("candidateLinkedin").trim(),
      reason: data.get("reason").trim(),
      yourName: data.get("yourName").trim(),
      yourEmail: data.get("yourEmail").trim(),
      stayAnonymous: data.get("stayAnonymous") === "on"
    };

    console.log("ProductMoat recommendation (no backend wired yet):", recommendation);

    form.hidden = true;
    document.getElementById("recommend-success").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------- Put yourself on the map (join-map.html) ----------
// Unlike initLinkedInGate() (used by apply/recommend, which locks the *form*
// until LinkedIn verification), this page runs the gate in the opposite
// order: the visitor must drop a pin on the mini map first, which is what
// unlocks the "Sign in with LinkedIn" button. Verifying pulls their name,
// email and photo from LinkedIn, and only then does the final submit button
// unlock — see api/join-map.js for where that combined data actually lands.

const JM_MAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
};

function jmInitials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function initJoinMap() {
  const mapEl = document.getElementById("jm-picker-map");
  if (!mapEl || typeof maplibregl === "undefined") return;

  const hint = document.getElementById("jm-picker-hint");
  const signinWrap = document.getElementById("jm-signin-wrap");
  const signinBtn = document.getElementById("li-signin-btn");
  const gate = document.getElementById("li-gate");
  const errorEl = document.getElementById("li-error");
  const preview = document.getElementById("jm-preview");
  const submitWrap = document.getElementById("jm-submit-wrap");
  const submitBtn = document.getElementById("jm-submit-btn");
  const submitError = document.getElementById("jm-submit-error");

  let picked = null; // { lat, lng }
  let profile = null; // { name, email, picture }
  let marker = null;

  const theme = document.body.classList.contains("light") ? "light" : "dark";
  const picker = new maplibregl.Map({
    container: "jm-picker-map",
    style: JM_MAP_STYLES[theme],
    center: [8.2, 30],
    zoom: 1.3,
    attributionControl: { compact: true }
  });
  picker.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

  function setLockAttr(el, wrap, locked) {
    if (locked) el.setAttribute("aria-disabled", "true");
    else el.removeAttribute("aria-disabled");
    wrap.classList.toggle("locked", locked);
  }

  function refreshLocks() {
    setLockAttr(signinBtn, signinWrap, !picked);
    setLockAttr(submitBtn, submitWrap, !(picked && profile));
  }

  function setPicked(lngLat) {
    picked = { lat: lngLat.lat, lng: lngLat.lng };
    hint.textContent = `Pin set at ${picked.lat.toFixed(3)}, ${picked.lng.toFixed(3)} — drag it to adjust.`;
    if (marker) {
      marker.setLngLat(lngLat);
    } else {
      marker = new maplibregl.Marker({ draggable: true, color: "#e6432b" }).setLngLat(lngLat).addTo(picker);
      marker.on("dragend", () => setPicked(marker.getLngLat()));
    }
    refreshLocks();
  }

  picker.on("click", (e) => setPicked(e.lngLat));
  refreshLocks();

  function startSignIn() {
    if (signinBtn.getAttribute("aria-disabled") === "true" || !picked) return;
    errorEl.hidden = true;
    const nonce = crypto.randomUUID();
    sessionStorage.setItem("li_oauth_state", nonce);
    sessionStorage.setItem("jm_pin", JSON.stringify(picked));
    const redirectUri = `${window.location.origin}/api/linkedin-callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state: `${nonce}:join-map`
    });
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }
  signinBtn.addEventListener("click", startSignIn);

  async function completeSignIn() {
    try {
      const resp = await fetch("/api/linkedin-profile", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("not verified");
      profile = await resp.json();

      gate.innerHTML = `<div class="li-badge"><span class="li-badge-check">&check;</span> Verified as ${escapeHTML(profile.name || "LinkedIn member")} via LinkedIn</div>`;

      document.getElementById("jm-preview-avatar").innerHTML = profile.picture
        ? `<img src="${profile.picture}" alt="">`
        : `<div class="avatar">${escapeHTML(jmInitials(profile.name))}</div>`;
      document.getElementById("jm-preview-name").textContent = profile.name || "";
      document.getElementById("jm-preview-email").textContent = profile.email || "";
      preview.hidden = false;

      refreshLocks();
    } catch (err) {
      errorEl.hidden = false;
    }
  }

  async function submitPin() {
    if (submitBtn.getAttribute("aria-disabled") === "true" || !picked || !profile) return;
    submitError.hidden = true;
    submitBtn.setAttribute("aria-disabled", "true");
    submitBtn.textContent = "Adding you…";

    try {
      const resp = await fetch("/api/join-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
          city: document.getElementById("jm-city").value.trim(),
          country: document.getElementById("jm-country").value.trim(),
          role: document.getElementById("jm-role").value.trim(),
          company: document.getElementById("jm-company").value.trim(),
          lat: picked.lat,
          lng: picked.lng
        })
      });
      if (!resp.ok) throw new Error("submit failed");

      document.querySelectorAll(".jm-step, .jm-preview, .form-submit-row").forEach(el => { el.hidden = true; });
      document.getElementById("jm-success").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      submitError.hidden = false;
      submitBtn.removeAttribute("aria-disabled");
      submitBtn.textContent = "Add me to the map";
    }
  }
  submitBtn.addEventListener("click", submitPin);

  // Resume after the LinkedIn OAuth redirect back to this page.
  const params = new URLSearchParams(window.location.search);
  const li = params.get("li");
  if (!li) return;

  const returnedState = params.get("state");
  history.replaceState(null, "", window.location.pathname);

  const savedPin = sessionStorage.getItem("jm_pin");
  sessionStorage.removeItem("jm_pin");
  if (savedPin) {
    try {
      const parsed = JSON.parse(savedPin);
      setPicked({ lat: parsed.lat, lng: parsed.lng });
      picker.jumpTo({ center: [parsed.lng, parsed.lat], zoom: 3.5 });
    } catch (err) { /* ignore malformed sessionStorage value */ }
  }

  const expectedState = sessionStorage.getItem("li_oauth_state");
  sessionStorage.removeItem("li_oauth_state");

  if (li !== "ok" || !returnedState || returnedState !== expectedState) {
    errorEl.hidden = false;
    return;
  }

  completeSignIn();
}

// ---------- Calendar (calendar.html) ----------
// 52 weeks, grouped into 4 quarters of 13 weeks each, months labeled within
// each quarter. Weeks are Monday-start, running from the Monday on/before
// Jan 1 of the target year. Only interviews already published (publishedDate
// <= today) are ever shown — future weeks only ever render as "open".

const CAL_MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function calDateUTC(dateStr) {
  return new Date(dateStr + "T00:00:00Z");
}

function calFormatShort(date) {
  return `${CAL_MONTH_NAMES[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
}

function calBuildYearWeeks(year) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dow = jan1.getUTCDay() || 7; // Mon=1 .. Sun=7
  const firstMonday = new Date(jan1);
  firstMonday.setUTCDate(jan1.getUTCDate() - (dow - 1));

  const weeks = [];
  for (let i = 0; i < 52; i++) {
    const start = new Date(firstMonday);
    start.setUTCDate(firstMonday.getUTCDate() + i * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const rep = new Date(start); // representative day decides month/quarter
    rep.setUTCDate(start.getUTCDate() + 3);
    const month = rep.getUTCMonth();
    weeks.push({ index: i + 1, start, end, month, quarter: Math.floor(month / 3) + 1 });
  }
  return weeks;
}

function calWeekStatus(week, today, interview) {
  if (interview) return "published";
  if (week.end < today) return "gap"; // week already passed with nothing published
  return "open"; // current or future week, still available
}

function calRenderCell(week, today, interview) {
  const isCurrent = today >= week.start && today <= week.end;
  const status = calWeekStatus(week, today, interview);
  const range = `${calFormatShort(week.start)} – ${calFormatShort(week.end)}`;

  let bodyHTML;
  if (interview) {
    bodyHTML = `
      <a class="cal-card" href="person.html?slug=${encodeURIComponent(interview.slug)}" title="${escapeHTML(interview.name)} — ${escapeHTML(interview.role)}">
        ${avatarHTML(interview, "avatar cal-card-avatar")}
        <span class="cal-card-name">${escapeHTML(interview.name)}</span>
      </a>`;
  } else if (status === "gap") {
    bodyHTML = `<div class="cal-empty"><span class="cal-empty-label">&mdash;</span></div>`;
  } else {
    bodyHTML = `<div class="cal-empty"><span class="cal-empty-label">Open</span></div>`;
  }

  return `
    <td class="cal-cell" data-status="${status}"${isCurrent ? ' data-current="true"' : ""}>
      <div class="cal-cell-inner">
        <div class="cal-cell-head">
          <span class="cal-week-no">W${String(week.index).padStart(2, "0")}</span>
          <span class="cal-week-range">${range}</span>
        </div>
        ${bodyHTML}
      </div>
      <div class="cal-hover">
        <a class="cal-hover-btn" href="apply.html">Apply</a>
        <a class="cal-hover-btn" href="recommend.html">Recommend</a>
      </div>
    </td>`;
}

function calRenderQuarter(quarterWeeks, quarterNum, today, weekInterviews) {
  const monthGroups = [];
  quarterWeeks.forEach(w => {
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.month === w.month) last.count++;
    else monthGroups.push({ month: w.month, count: 1 });
  });

  const firstMonth = CAL_MONTH_NAMES[monthGroups[0].month].slice(0, 3);
  const lastMonth = CAL_MONTH_NAMES[monthGroups[monthGroups.length - 1].month].slice(0, 3);
  const year = quarterWeeks[quarterWeeks.length - 1].start.getUTCFullYear();

  const monthHeaderHTML = monthGroups.map(g =>
    `<th colspan="${g.count}">${CAL_MONTH_NAMES[g.month]}</th>`
  ).join("");

  const cellsHTML = quarterWeeks.map(w => calRenderCell(w, today, weekInterviews.get(w.index))).join("");

  return `
    <section class="cal-quarter">
      <div class="cal-quarter-label">
        <span class="cal-quarter-num">Q${quarterNum}</span>
        <span class="cal-quarter-range">${firstMonth} &ndash; ${lastMonth} ${year}</span>
      </div>
      <div class="cal-table-wrap">
        <table class="cal-table">
          <thead><tr class="cal-month-row">${monthHeaderHTML}</tr></thead>
          <tbody><tr>${cellsHTML}</tr></tbody>
        </table>
      </div>
    </section>`;
}

function initCalendar() {
  const el = document.getElementById("cal-board");
  if (!el) return;

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const year = today.getUTCFullYear();
  const weeks = calBuildYearWeeks(year);

  // Match each already-published interview to the week its publishedDate falls in.
  const weekInterviews = new Map();
  INTERVIEWS.forEach(p => {
    const published = calDateUTC(p.publishedDate);
    if (published > today) return; // never show data for the future
    const week = weeks.find(w => published >= w.start && published <= w.end);
    if (week) weekInterviews.set(week.index, p);
  });

  const quartersHTML = [1, 2, 3, 4].map(q => {
    const quarterWeeks = weeks.filter(w => w.quarter === q);
    return calRenderQuarter(quarterWeeks, q, today, weekInterviews);
  }).join("");

  el.innerHTML = quartersHTML;
}
