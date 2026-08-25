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
