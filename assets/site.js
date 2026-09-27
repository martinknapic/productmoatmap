// ProductMoat - shared portal logic (theme, avatars, homepage grid, person page)
// Avatars are flat ink-on-paper medallions (see .avatar rules in swiss.css) by default -
// no per-person color. A person with a `photo` field gets that photo instead.

// Alumni network is built but hidden from nav/account until there are enough interviewed
// members to make the directory worth browsing.
const ALUMNI_NETWORK_ENABLED = false;

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function avatarHTML(person, cls) {
  if (person.photo) {
    // Site-relative paths (e.g. "assets/photos/x.jpg") are stored without a leading slash;
    // root them so pages outside the site root (like backoffice/calendar.html) still resolve them.
    const src = /^https?:\/\//i.test(person.photo) ? person.photo : `/${person.photo.replace(/^\/+/, "")}`;
    return `<div class="${cls}"><img src="${src}" alt="${escapeHTML(person.name)}"></div>`;
  }
  return `<div class="${cls}">${initials(person.name)}</div>`;
}

// Pretty interview URLs: /interview/productmanagement/<slug> or /interview/productux/<slug>
// (rewritten to person.html by vercel.json / scripts/dev-server.js).
function interviewCategory(p) {
  return p.category || (p.focusTag === "design" ? "productux" : "productmanagement");
}
function interviewURL(p) {
  return `/interview/${interviewCategory(p)}/${encodeURIComponent(p.slug)}`;
}

// For values placed inside a double-quoted HTML attribute.
function escapeAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
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

// Light is the default (every page ships <body class="light"> plus a tiny inline script that
// drops it right away if the visitor previously chose dark), so there's no dark flash on load.
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("pm-theme"); } catch (err) { /* storage blocked: stay light */ }
  document.body.classList.toggle("light", saved !== "dark");
  updateThemeBtn();
  initMemberNav();
}

function toggleTheme() {
  document.body.classList.toggle("light");
  try { localStorage.setItem("pm-theme", document.body.classList.contains("light") ? "light" : "dark"); } catch (err) { /* ignore */ }
  updateThemeBtn();
  if (miniMapInstance) miniMapInstance.setStyle(miniMapStyleURL());
}

// Both icons ship inline in the button's HTML; CSS shows/hides them based on
// body.light so the correct one is there on first paint (see swiss.css). This
// only keeps the accessible label in sync with the current theme.
function updateThemeBtn() {
  const btn = document.getElementById("theme-btn");
  if (!btn) return;
  const isLight = document.body.classList.contains("light");
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
}

// ---------- Member nav (avatar+dropdown when signed in, Sign up CTA when not) ----------
// Registration happens two ways: verifying via LinkedIn on apply/recommend/
// join-map sets a persistent `pm_session` cookie as a side effect (see
// api/linkedin-callback.js), or a visitor clicks the nav's "Sign up" CTA
// straight to signup.html, which shows the profile/newsletter consent copy
// before starting the same LinkedIn flow. Either way, this just checks
// whether a session exists and swaps in the avatar or the CTA accordingly.

function memberInitials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function initMemberNav() {
  const navInner = document.querySelector(".nav-inner");
  if (!navInner || navInner.querySelector(".member-nav") || navInner.querySelector(".signup-nav-link")) return;
  if (document.body.hasAttribute("data-no-member-nav")) return; // e.g. personal interview links: keep the page focused
  ensureNavRight(navInner);

  // map.html's "Put yourself on the map" button is pointless for someone who is already on the map
  // (a pin pending / approved, or a published interview with a location), so it's hidden for them.
  // It ships hidden in the markup (no flash of the wrong state) and only appears once we've
  // confirmed they're not already on it.
  const mapCta = document.querySelector(".jm-nav-cta");
  const settleMapCta = (onMap) => { if (mapCta) { if (onMap) mapCta.style.display = "none"; mapCta.style.visibility = ""; } };

  fetch("/api/member-me", { credentials: "same-origin" })
    .then(resp => (resp.ok ? resp.json() : null))
    .then(profile => {
      if (profile) {
        renderMemberNav(navInner, profile);
        if (!mapCta) return;
        fetch("/api/member-map", { credentials: "same-origin", cache: "no-store" })
          .then(r => (r.ok ? r.json() : null))
          .then(d => settleMapCta(!!(d && d.onMap)))
          .catch(() => settleMapCta(false));
      } else {
        settleMapCta(false);
        if (!/(^|\/)signup\.html$/.test(location.pathname)) renderSignupCTA(navInner);
      }
    })
    .catch(() => settleMapCta(false));
}

// Groups the right-hand nav items so the Sign up CTA / avatar sits to the left
// of the theme toggle (the toggle stays the right-most control). Pages that
// already ship a .nav-right (map.html) are left as they are.
function ensureNavRight(navInner) {
  if (navInner.querySelector(".nav-right")) return;
  const themeBtn = navInner.querySelector("#theme-btn");
  if (!themeBtn) return;
  const right = document.createElement("div");
  right.className = "nav-right";
  navInner.insertBefore(right, themeBtn);
  right.appendChild(themeBtn);
}

function insertBeforeTheme(navInner, el) {
  const right = navInner.querySelector(".nav-right") || navInner;
  const themeBtn = right.querySelector("#theme-btn");
  right.insertBefore(el, themeBtn);
}

function renderSignupCTA(navInner) {
  const link = document.createElement("a");
  link.className = "btn btn-primary nav-cta signup-nav-link";
  link.href = "signup.html";
  link.textContent = "Sign up";
  insertBeforeTheme(navInner, link);
}

function renderMemberNav(navInner, profile) {
  const avatarInner = profile.picture
    ? `<img src="${profile.picture}" alt="">`
    : escapeHTML(memberInitials(profile.name));

  const wrap = document.createElement("div");
  wrap.className = "member-nav";
  wrap.innerHTML = `
    <button class="member-avatar-btn" id="member-avatar-btn" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">
      <span class="member-avatar">${avatarInner}</span>
    </button>
    <div class="member-dropdown" role="menu">
      <a href="account.html" role="menuitem">My profile</a>
      <a href="my-interview.html" role="menuitem">My interview</a>
      ${ALUMNI_NETWORK_ENABLED ? `<a href="network.html" role="menuitem">Alumni network</a>` : ""}
      ${profile.isAdmin ? `<a href="/backoffice/candidates.html" role="menuitem">Backoffice</a>` : ""}
      <a href="#" id="member-logout-link" role="menuitem">Log out</a>
    </div>
  `;
  insertBeforeTheme(navInner, wrap);

  const btn = wrap.querySelector("#member-avatar-btn");
  btn.addEventListener("click", () => {
    const open = wrap.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", (e) => {
    if (wrap.classList.contains("open") && !wrap.contains(e.target)) {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  wrap.querySelector("#member-logout-link").addEventListener("click", (e) => {
    e.preventDefault();
    const next = encodeURIComponent(location.pathname + location.search);
    window.location.href = `/api/member-logout?next=${next}`;
  });
}

// ---------- Sign up (signup.html) ----------
// The explicit account-creation entry point reached from the nav's "Sign up"
// CTA. Unlike apply/recommend/join-map - where the persistent session is a
// side effect of verifying for that page's own form - this page's whole
// purpose is creating the profile: it shows the consent/newsletter copy
// first, and completing sign-in here is the only path that calls
// api/member-signup.js to actually persist a profile record.

function initSignup() {
  const gate = document.getElementById("li-gate");
  if (!gate) return;

  const signInBtn = document.getElementById("li-signin-btn");
  const errorEl = document.getElementById("li-error");
  const newsletterCheckbox = document.getElementById("su-newsletter");
  const heroSection = document.getElementById("su-hero");
  const consentBlock = document.getElementById("su-consent");
  const successBlock = document.getElementById("su-success");
  const successNewsletterNote = document.getElementById("su-success-newsletter");

  function startSignIn() {
    errorEl.hidden = true;
    const nonce = crypto.randomUUID();
    sessionStorage.setItem("li_oauth_state", nonce);
    sessionStorage.setItem("su_newsletter", newsletterCheckbox.checked ? "1" : "0");
    const redirectUri = `${window.location.origin}/api/linkedin-callback`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email",
      state: `${nonce}:signup`
    });
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }
  // Already signed in (e.g. via Apply)? Then no LinkedIn round trip: confirm to create the profile.
  let sessionProfile = null;
  signInBtn.addEventListener("click", () => {
    withNewsletterPrompt(newsletterCheckbox, () => {
      if (sessionProfile) { errorEl.hidden = true; completeSignup(newsletterCheckbox.checked); } else { startSignIn(); }
    });
  });
  if (!new URLSearchParams(window.location.search).get("li")) {
    fetchMemberProfile().then(p => {
      if (!p) return;
      sessionProfile = p;
      const badge = document.createElement("div");
      badge.className = "li-badge";
      badge.innerHTML = `<span class="li-badge-check">&check;</span> You're signed in as ${escapeHTML(p.name || "a LinkedIn member")} via LinkedIn`;
      gate.insertBefore(badge, signInBtn);
      signInBtn.style.display = "none";
      withNewsletterPrompt(newsletterCheckbox, () => {
        errorEl.hidden = true;
        completeSignup(newsletterCheckbox.checked);
      });
    });
  }

  async function completeSignup(newsletter) {
    try {
      const resp = await fetch("/api/member-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ newsletter })
      });
      if (!resp.ok) throw new Error("signup failed");
      // what's actually stored (an existing subscription is kept even if the box was left unticked)
      const saved = await resp.json().catch(() => ({}));
      if (typeof saved.newsletter === "boolean") newsletter = saved.newsletter;

      if (heroSection) heroSection.hidden = true;
      consentBlock.hidden = true;
      successNewsletterNote.textContent = newsletter
        ? "You're subscribed to the newsletter - every issue includes an unsubscribe link."
        : "You're not subscribed to the newsletter - we'll only add you if you tick the box.";
      successBlock.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      // someone who is already on the map doesn't need the "put yourself on the map" suggestion
      fetch("/api/member-map", { credentials: "same-origin", cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d || !d.onMap) return;
          const cta = document.getElementById("su-map-cta");
          if (cta) cta.style.display = "none";
          const mapStep = document.getElementById("su-check-map");
          if (mapStep) mapStep.classList.add("is-done");
        })
        .catch(() => {});
    } catch (err) {
      errorEl.hidden = false;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const li = params.get("li");
  if (!li) return;

  const returnedState = params.get("state");
  history.replaceState(null, "", window.location.pathname);

  const newsletterPref = sessionStorage.getItem("su_newsletter") === "1";
  sessionStorage.removeItem("su_newsletter");

  if (li !== "ok") {
    errorEl.hidden = false;
    return;
  }

  const expectedState = sessionStorage.getItem("li_oauth_state");
  sessionStorage.removeItem("li_oauth_state");
  if (!returnedState || returnedState !== expectedState) {
    errorEl.hidden = false;
    return;
  }

  completeSignup(newsletterPref);
}

// ---------- Profile / Map / My interview (signed-in profile pages) ----------
// Every page of a member's own profile carries the same three sub-menus: Profile (their details),
// Map (their pin) and My interview (their application / interview). Each page fills #member-tabs
// once it knows the visitor is signed in.

const MEMBER_TABS = [
  ["profile", "Profile", "account.html"],
  ["map", "Map", "my-map.html"],
  ["interview", "My interview", "my-interview.html"]
];

function showMemberTabs(current) {
  const el = document.getElementById("member-tabs");
  if (!el) return;
  el.innerHTML = `<div class="wrap"><nav class="member-tabs" aria-label="My profile sections">${MEMBER_TABS.map(([id, label, href]) =>
    `<a href="${href}"${id === current ? ' class="is-active" aria-current="page"' : ""}>${label}</a>`).join("")}</nav></div>`;
  el.hidden = false;
}

// Where someone stands on the list, in one sentence (uses the /api/my-interview answer).
function applicationStatusHTML(d) {
  const fmt = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "long" }) : "");
  const myInterview = `<a class="bracket-link" href="my-interview.html">[ See it under My interview ]</a>`;
  if (d.state === "published") return `<strong>Your interview is live.</strong> ${myInterview}`;
  if (d.state === "invited") return `<strong>You've been invited.</strong> Your interview is open. ${myInterview}`;
  if (d.state === "applied") {
    return d.source === "recommended"
      ? `<strong>Someone recommended you.</strong> We'll be in touch if it looks like a fit. ${myInterview}`
      : `<strong>You applied${d.appliedAt ? ` on ${escapeHTML(fmt(d.appliedAt))}` : ""}.</strong> Your application is pending review. ${myInterview}`;
  }
  return `<p>You haven't applied to be interviewed yet.</p><a class="btn btn-primary" href="apply.html">Apply to be interviewed</a>`;
}

// ---------- The whole journey as a strip of steps ----------
// Shared by My interview and the personal questionnaire page so both show the same seven stages:
// Applied -> In review -> Invited -> Your answers -> Your sign-off -> Our review -> Published.
// ctx: { hasRecord, source, invited, requiredDone, requiredTotal, approved, locked, scheduled,
//        published, estimate }

function buildProcessSteps(ctx) {
  let stage;
  if (!ctx.hasRecord) stage = 0;
  else if (ctx.published) stage = 7;
  else if (ctx.scheduled) stage = 6;
  else if (ctx.locked || ctx.approved) stage = 5;
  else if (ctx.invited) stage = 3;
  else stage = 1;

  const total = ctx.requiredTotal || 0, done = ctx.requiredDone || 0;
  const signOffReady = stage === 3 && total > 0 && done >= total;
  const steps = [
    { title: ctx.source === "recommended" ? "Recommended" : "Applied",
      sub: !ctx.hasRecord ? "Start here" : ctx.source === "recommended" ? "You were recommended" : "Application sent" },
    { title: "In review", sub: stage > 1 ? "Reviewed" : stage === 1 ? "Pending - we read every one" : "We read every one" },
    { title: "Invited", sub: stage > 2 ? "You're in" : "By email or LinkedIn" },
    { title: "Your answers", sub: stage > 3 ? "Done" : stage === 3 ? `${done} of ${total} required` : "Answer at your pace" },
    { title: "Your sign-off", sub: stage > 4 ? (ctx.approved ? "You're happy" : "Approved") : signOffReady ? "Ready - press the button" : "After your answers" },
    { title: "Our review", sub: stage > 5 ? "Preview ready" : stage === 5 ? (ctx.locked ? "Preparing your preview" : "We'll take it from here") : "Preview & final check" },
    { title: "Published", sub: ctx.published ? "Live" : ctx.scheduled ? "Scheduled" : ctx.estimate ? `Est. ${ctx.estimate}` : "Coming up" }
  ];
  return steps.map((st, i) => ({ ...st, status: i < stage ? "done" : i === stage ? "current" : "pending", next: i === 4 && signOffReady }));
}

function processStepsHTML(steps) {
  return steps.map((st, i) => `
    <li class="iv-step is-${st.status}${st.next ? " is-next" : ""}"${st.status === "current" ? ' aria-current="step"' : ""}>
      <span class="iv-step-dot">${st.status === "done" ? "&check;" : i + 1}</span>
      <span class="iv-step-text"><span class="iv-step-title">${escapeHTML(st.title)}</span><span class="iv-step-sub">${escapeHTML(st.sub)}</span></span>
    </li>`).join("");
}

// keeps the current step visible when the strip has to scroll sideways (phones)
function revealCurrentStep(listEl) {
  const cur = listEl.querySelector(".is-current");
  if (cur && listEl.scrollWidth > listEl.clientWidth) listEl.scrollLeft = Math.max(0, cur.offsetLeft - 16);
}

// ---------- My interview (my-interview.html) ----------
// Reached from the member dropdown. The page always shows the whole journey as a strip of steps and
// where this person is on it; what's underneath depends on the stage. Before an invitation there's
// only status ("You applied", "Your application is pending review"); the interview itself (continue,
// preview, progress) appears once they've been invited.

// ---------- Invitation confetti ----------
// The first time an invited person lands on either of their two pages (My interview, or their
// personal questionnaire), whichever comes first, colourful confetti fires across the whole page
// for a few seconds. It is remembered per invitation in this browser (localStorage, shared by
// both pages), so it happens once. Skipped under prefers-reduced-motion. Add ?confetti=1 to any
// of those URLs to see it again.

const CONFETTI_COLORS = ["#f95e25", "#ec0680", "#b329d7", "#4252ed", "#109df7", "#ffd23f", "#2ec4b6"]; // logo gradient + two accents

function launchConfetti(durationMs = 3600) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (document.getElementById("pm-confetti")) return;
  const canvas = document.createElement("canvas");
  canvas.id = "pm-confetti";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:400;pointer-events:none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pieces = [];
  const add = (x, y, vx, vy, delay) => pieces.push({
    x, y, vx, vy, delay, born: false,
    w: rnd(6, 12), h: rnd(4, 9), rot: rnd(0, Math.PI * 2), vr: rnd(-9, 9),
    color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
    round: Math.random() < 0.18, wobble: rnd(0, Math.PI * 2), wobbleSpeed: rnd(4, 9), drag: rnd(0.985, 0.995)
  });
  // two cannons from the bottom corners, fired inwards and upwards...
  for (let i = 0; i < 90; i++) {
    const speed = rnd(700, 1350) * Math.min(1, H / 800 + 0.35);
    const a = rnd(-1.35, -0.75), b = rnd(-2.4, -1.8); // radians, both pointing up; left fires right, right fires left
    add(0, H, Math.cos(a) * speed, Math.sin(a) * speed, rnd(0, 0.25));
    add(W, H, Math.cos(b) * speed, Math.sin(b) * speed, rnd(0, 0.25));
  }
  // ...then a shower from the top across the full width
  for (let i = 0; i < 130; i++) add(rnd(0, W), rnd(-H * 0.25, -10), rnd(-60, 60), rnd(40, 220), rnd(0.35, 2.1));

  const start = performance.now();
  let last = start;
  function frame(now) {
    const t = (now - start) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of pieces) {
      if (t < p.delay) { alive++; continue; }
      p.vy += 900 * dt;                                  // gravity
      p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60);
      p.wobble += p.wobbleSpeed * dt;
      p.x += (p.vx + Math.sin(p.wobble) * 40) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.y > H + 30) continue;
      alive++;
      const fade = t > durationMs / 1000 - 0.9 ? Math.max(0, (durationMs / 1000 - t) / 0.9) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.wobble * 1.3));   // flutter
      ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < durationMs / 1000 && alive) requestAnimationFrame(frame);
    else cleanup();
  }
  function cleanup() { window.removeEventListener("resize", resize); canvas.remove(); }
  setTimeout(cleanup, durationMs + 1500); // never leave the overlay behind (e.g. if the tab was in the background)
  requestAnimationFrame(frame);
}

// `token` identifies the invitation (the personal questionnaire's id), so the two pages agree.
function celebrateInviteOnce(token) {
  const force = new URLSearchParams(window.location.search).get("confetti") === "1";
  const key = `pm-invite-confetti:${token}`;
  try {
    if (!force && localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch (err) {
    if (!force) return; // can't remember it (storage blocked), so don't risk repeating it on every visit
  }
  setTimeout(() => launchConfetti(), 350); // let the page settle first
}

function initMyInterview() {
  const root = document.getElementById("mi-root");
  if (!root) return;

  const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "long" }) : "");
  const fmtDay = iso => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString([], { dateStyle: "long" }) : "");

  const cta = `<a class="btn btn-primary" href="apply.html">Apply to be interviewed</a>`;
  const stepsStrip = (ctx) => `<div class="iv-steps-wrap"><div class="wrap"><ol class="iv-steps" id="mi-steps" aria-label="The interview process">${processStepsHTML(buildProcessSteps(ctx))}</ol></div></div>`;
  const hero = (title, lede, extra = "", ctx = null) => `
    ${ctx ? stepsStrip(ctx) : ""}
    <section class="why-hero${extra ? " mi-hero-actions" : ""}">
      <div class="wrap">
        <div class="eyebrow">My interview</div>
        <h1>${title}</h1>
        <p class="about-lede">${lede}</p>
        ${extra ? `<div class="mi-actions">${extra}</div>` : ""}
      </div>
    </section>`;

  const pitch = `
    <section class="benefits-section wrap">
      <div class="benefits-grid">
        <div class="benefit-item">
          <h3>Your story, told properly</h3>
          <p>A structured conversation about your path, how you think, and how AI is changing the craft - in your own words, on your own private page.</p>
        </div>
        <div class="benefit-item">
          <h3>You stay in control</h3>
          <p>Only a handful of questions are required. You save each answer when you're ready, you can add your own questions, and nothing goes public until you say you're happy with it.</p>
        </div>
        <div class="benefit-item">
          <h3>A standing place in the series</h3>
          <p>Once published, your interview lives in the directory, on the map, and across our newsletter and social channels.</p>
        </div>
        <div class="benefit-item">
          <h3>How it works</h3>
          <p>Apply &rarr; we review it ourselves &rarr; if it's a fit, you get an invitation with a personal link &rarr; you answer at your pace &rarr; we prepare a preview together. <a class="bracket-link" href="questions.html">[ See the questions ]</a> <a class="bracket-link" href="process.html">[ The process ]</a></p>
        </div>
      </div>
    </section>
    <section class="why-cta-section">
      <div class="wrap">
        <h2>Ready to be part of the series?</h2>
        <p>The application takes a few minutes. We read every one ourselves.</p>
        ${cta}
      </div>
    </section>`;

  function show(html) {
    root.innerHTML = html;
    const list = document.getElementById("mi-steps");
    if (list) revealCurrentStep(list);
  }

  // the interview itself: only exists from the invitation on
  function interviewPanel(d) {
    const pct = d.requiredTotal ? Math.round((d.requiredDone / d.requiredTotal) * 100) : 0;
    const link = `interview.html?t=${encodeURIComponent(d.token)}`;
    const preview = `interview-preview.html?t=${encodeURIComponent(d.token)}`;
    const est = d.estimatedPublishDate ? `<p class="mi-est">Estimated publish date: <strong>${escapeHTML(fmtDay(d.estimatedPublishDate))}</strong></p>` : "";
    let title, lede, primary;
    if (d.status === "scheduled") {
      title = "Your interview is scheduled.";
      lede = `It goes live on <strong>${escapeHTML(fmtDate(d.scheduledPublishAt))}</strong>. You can still preview exactly how it will look.`;
      primary = `<a class="btn btn-primary" href="${preview}">Preview my interview</a>`;
    } else if (d.locked) {
      title = "We're preparing your preview.";
      lede = "Your answers are locked in while we get your interview ready. Take a look at how it will appear when it's published.";
      primary = `<a class="btn btn-primary" href="${preview}">Preview my interview</a>`;
    } else if (d.approved) {
      title = "You're happy with this version.";
      lede = "Thank you - we'll take it from here. Want to change something? Open your interview and reopen it for editing.";
      primary = `<a class="btn btn-primary" href="${preview}">Preview my interview</a><a class="btn btn-ghost" href="${link}">Open my answers</a>`;
    } else {
      title = "Your interview is open.";
      lede = "You've been invited. Answer at your pace - press Save under each answer to keep it, and only the required questions are needed.";
      primary = `<a class="btn btn-primary" href="${link}">${d.requiredDone ? "Continue your interview" : "Start your interview"} &rarr;</a><a class="btn btn-ghost" href="${preview}">Preview</a>`;
    }
    return hero(title, lede, primary, ctxFrom(d)) + `
      <section class="wrap mi-progress-wrap">
        <div class="mi-progress">
          <div class="iv-progress-line"><div class="iv-progress-fill" style="width:${pct}%"></div></div>
          <div class="iv-progress-text"><span><strong>${d.requiredDone} of ${d.requiredTotal}</strong> required answered</span>${d.updatedAt ? `<span>Last edited ${escapeHTML(fmtDate(d.updatedAt))}</span>` : ""}</div>
          ${est}
        </div>
      </section>`;
  }

  const ctxFrom = (d) => ({
    hasRecord: true, source: d.source, invited: d.state === "invited",
    requiredDone: d.requiredDone, requiredTotal: d.requiredTotal, approved: d.approved,
    locked: d.locked, scheduled: d.status === "scheduled", published: d.state === "published",
    estimate: d.estimatedPublishDate ? fmtDay(d.estimatedPublishDate) : ""
  });

  fetch("/api/my-interview", { credentials: "same-origin" })
    .then(resp => (resp.status === 401 ? { state: "signed-out" } : resp.ok ? resp.json() : Promise.reject(resp.status)))
    .then(data => {
      if (data.state !== "signed-out") showMemberTabs("interview");
      if (data.state === "invited") {
        show(interviewPanel(data));
        celebrateInviteOnce(data.token);
      } else if (data.state === "published") {
        show(hero("Your interview is live.", "Thank you for taking part.",
          `<a class="btn btn-primary" href="${escapeAttr(data.url)}">Read your interview &rarr;</a>`, ctxFrom(data)));
      } else if (data.state === "applied") {
        const recommended = data.source === "recommended";
        show(hero(recommended ? "Someone recommended you." : "You applied - your application is pending review.",
          recommended
            ? "A member of the community suggested you for the series. We'll be in touch by email or LinkedIn if it looks like a fit - your personal interview will appear here as soon as you're invited."
            : `Thank you for applying${data.appliedAt ? ` on ${escapeHTML(fmtDate(data.appliedAt))}` : ""}. We read every application ourselves and will be in touch by email or LinkedIn if it looks like a fit - your personal interview will appear here as soon as you're invited.`,
          `<a class="bracket-link" href="questions.html">[ See what the interview covers ]</a> <a class="bracket-link" href="process.html">[ The process ]</a>`,
          { hasRecord: true, source: data.source }));
      } else if (data.state === "signed-out") {
        show(hero("Sign in to see your interview.",
          "Your personal interview page is tied to your LinkedIn account. Sign up or sign in, and it will show up here once you've been invited.",
          `<a class="btn btn-primary" href="signup.html">Sign up with LinkedIn</a>`) + pitch);
      } else {
        show(hero("You haven't been interviewed yet.",
          "ProductMoat is an interview series with product people around the world. If you'd like to be featured, apply - if it's a fit, your personal interview page will appear right here.",
          cta, { hasRecord: false }) + pitch);
      }
    })
    .catch(() => show(hero("Something went wrong.", "We couldn't check your interview just now. Please refresh in a moment.")));
}

// ---------- Account page (account.html) ----------
// "My profile" destination from the nav dropdown. Not a rich profile editor -
// there's no database behind member accounts, just whatever LinkedIn handed
// back at sign-in - so this simply confirms who you're signed in as.

// Focus areas a member can pick (any number). Same list as the Apply form's dropdown.
const MEMBER_FOCUS_OPTIONS = [
  ["ai", "AI & ML"], ["b2b", "B2B SaaS"], ["design", "Product design / UX"], ["growth", "Consumer & Growth"],
  ["fintech", "Fintech"], ["platform", "Platform & Infra"], ["marketplace", "Marketplace"], ["health", "Healthtech"],
  ["leadership", "Product Leadership"], ["other", "Other"]
];

function initAccount() {
  const root = document.getElementById("account-root");
  if (!root) return;
  const detailsRoot = document.getElementById("account-details");

  fetch("/api/member-profile", { credentials: "same-origin" })
    .then(resp => (resp.ok ? resp.json() : null))
    .then(data => {
      if (!data) { root.innerHTML = accountSignedOutHTML(); return; }
      root.innerHTML = accountSignedInHTML(data.account);
      showMemberTabs("profile");
      fetch("/api/my-interview", { credentials: "same-origin" })
        .then(resp => (resp.ok ? resp.json() : null))
        .then(d => {
          const box = document.getElementById("account-status");
          if (d && box) { box.innerHTML = applicationStatusHTML(d); box.hidden = false; }
        })
        .catch(() => {});
      document.getElementById("account-logout-btn").addEventListener("click", () => {
        window.location.href = "/api/member-logout?next=%2Faccount.html";
      });
      if (detailsRoot) initAccountDetails(detailsRoot, data.details, data.network);
    })
    .catch(() => {
      root.innerHTML = accountSignedOutHTML();
    });
}

// "Your details": everything collected on Apply, editable any time. Private to the member; it prefills
// Apply and Put yourself on the map, and doesn't need an interview page to exist.
function initAccountDetails(el, d, networkJoined) {
  const val = (v) => escapeAttr(v == null ? "" : v);
  const field = (id, label, value, extra = "") => `<div class="form-field"><label for="${id}">${label}</label><input type="text" id="${id}" name="${id.replace("mp-", "")}" value="${val(value)}" ${extra}></div>`;
  el.hidden = false;
  el.innerHTML = `
    <form class="account-form" id="account-form" novalidate>
      <div class="fieldset-head">
        <h2>Your details</h2>
        <p>Private to you. They save time on Apply and Put yourself on the map, and you can update them whenever things change - no interview page needed.</p>
      </div>
      <div class="form-grid">
        ${field("mp-name", 'Full name <span class="req">*</span>', d.name, 'maxlength="200" autocomplete="name" required')}
        ${field("mp-role", "Current role", d.role, 'maxlength="200" placeholder="e.g. Senior Product Manager"')}
        ${field("mp-company", "Current company", d.company, 'maxlength="200"')}
        ${field("mp-location", "Location", d.location, 'maxlength="200" placeholder="City, Country"')}
        <div class="form-field"><label for="mp-yearsExperience">Years in product</label><input type="number" id="mp-yearsExperience" name="yearsExperience" min="0" max="60" value="${val(d.yearsExperience)}"></div>
        <div class="form-field full">
          <label>Focus areas <span class="hint-inline">(pick any that apply)</span></label>
          <div class="focus-chips" id="mp-focus">
            ${MEMBER_FOCUS_OPTIONS.map(([v, l]) => `<label class="focus-chip"><input type="checkbox" value="${v}"${(d.focusTags || []).includes(v) ? " checked" : ""}><span>${l}</span></label>`).join("")}
          </div>
        </div>
        ${field("mp-linkedin", "LinkedIn URL", d.linkedin, 'maxlength="300" placeholder="https://www.linkedin.com/in/…"')}
        ${field("mp-website", "Website", d.website, 'maxlength="300" placeholder="https://…"')}
        ${field("mp-twitter", "X / Twitter", d.twitter, 'maxlength="300" placeholder="https://x.com/…"')}
        <div class="form-field full">
          <label for="mp-snippet">Short bio</label>
          <textarea id="mp-snippet" name="snippet" rows="2" maxlength="200" placeholder="One sentence on what you're known for or currently working on.">${escapeHTML(d.snippet || "")}</textarea>
          <span class="hint-inline" id="mp-snippet-count">${(d.snippet || "").length} / 200</span>
        </div>
        <div class="form-field full">
          <label for="mp-pullQuote">Pull quote</label>
          <textarea id="mp-pullQuote" name="pullQuote" rows="2" maxlength="160" placeholder="One punchy line that sums up how you think.">${escapeHTML(d.pullQuote || "")}</textarea>
          <span class="hint-inline" id="mp-quote-count">${(d.pullQuote || "").length} / 160</span>
        </div>
      </div>
      <div class="form-submit-row">
        <button type="submit" class="btn btn-primary" id="account-save">Save my details</button>
        <span class="hint-inline" id="account-save-status" role="status"></span>
        <a class="bracket-link" href="join-map.html">[ Put yourself on the map → ]</a>
      </div>
    </form>`;

  // Alumni network membership (explicit opt-in; leaving removes visibility and access at once)
  if (ALUMNI_NETWORK_ENABLED) {
    const netBox = document.createElement("div");
    netBox.className = "account-network";
    el.appendChild(netBox);
    renderAccountNetwork(netBox, !!networkJoined);
  }

  const form = el.querySelector("#account-form");
  const status = el.querySelector("#account-save-status");
  const count = (inputId, outId, max) => {
    const input = el.querySelector(inputId), out = el.querySelector(outId);
    input.addEventListener("input", () => { out.textContent = `${input.value.length} / ${max}`; });
  };
  count("#mp-snippet", "#mp-snippet-count", 200);
  count("#mp-pullQuote", "#mp-quote-count", 160);
  form.addEventListener("input", () => { status.textContent = ""; });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const g = (n) => form.elements[n].value;
    if (!g("name").trim()) { form.elements.name.focus(); status.textContent = "Your name is required."; status.classList.add("is-error"); return; }
    const btn = el.querySelector("#account-save");
    btn.setAttribute("aria-disabled", "true");
    status.classList.remove("is-error");
    status.textContent = "Saving…";
    try {
      const resp = await fetch("/api/member-profile", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ details: {
          name: g("name"), role: g("role"), company: g("company"), location: g("location"),
          yearsExperience: g("yearsExperience"),
          focusTags: [...el.querySelectorAll("#mp-focus input:checked")].map(i => i.value),
          linkedin: g("linkedin"), website: g("website"), twitter: g("twitter"),
          snippet: g("snippet"), pullQuote: g("pullQuote")
        } })
      });
      if (!resp.ok) throw new Error(String(resp.status));
      const saved = (await resp.json()).details;
      // show what was actually stored (e.g. links tidied to https://…)
      ["linkedin", "website", "twitter"].forEach(k => { form.elements[k].value = saved[k]; });
      status.textContent = "Saved ✓";
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = "Couldn't save just now - please try again.";
    } finally {
      btn.removeAttribute("aria-disabled");
    }
  });
}

function renderAccountNetwork(box, joined) {
  box.innerHTML = joined
    ? `<h2>Alumni network</h2>
       <p>You're in the network: you can browse the members-only directory, and once you've been interviewed other members can see your profile and email.</p>
       <div class="account-network-actions"><a class="btn btn-primary" href="network.html">Open the directory</a><button type="button" class="btn btn-ghost" id="net-leave">Leave the network</button></div>`
    : `<h2>Alumni network</h2>
       <p>A members-only network of the product people we've interviewed. Joining is your explicit choice: you agree to be visible to other members (name, photo, role, company, location, focus areas, bio, links and email) once you've been interviewed, and in return you can browse the directory.</p>
       <div class="account-network-actions"><a class="btn btn-ghost" href="network.html">Learn more &amp; join</a></div>`;
  const leave = box.querySelector("#net-leave");
  if (leave) leave.addEventListener("click", async () => {
    if (!window.confirm("Leave the alumni network? You'll disappear from the directory and lose access to it. You can rejoin any time.")) return;
    try {
      const resp = await fetch("/api/member-network", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ join: false }) });
      if (!resp.ok) throw new Error("failed");
      renderAccountNetwork(box, false);
    } catch (err) { leave.textContent = "Couldn't leave - try again"; }
  });
}

function accountSignedInHTML(profile) {
  const avatarInner = profile.picture
    ? `<img src="${profile.picture}" alt="">`
    : memberInitials(profile.name);
  return `
    <div class="eyebrow">My profile</div>
    <div class="account-top">
      <div class="account-card">
        <div class="avatar-xl${profile.picture ? " has-photo" : ""}">${avatarInner}</div>
        <div>
          <h1 class="account-name">${escapeHTML(profile.name || "ProductMoat member")}</h1>
          <p class="account-email">${escapeHTML(profile.email || "")}</p>
          <p class="account-note">Your photo and email come from LinkedIn (signing in again on Apply, Recommend, or Put yourself on the map refreshes them). Everything else below is yours to edit.</p>
          <button class="btn btn-ghost" id="account-logout-btn">Log out</button>
        </div>
      </div>
      <div class="account-status" id="account-status" hidden></div>
    </div>
  `;
}

function accountSignedOutHTML() {
  return `
    <div class="eyebrow">My profile</div>
    <h1>You're not signed in.</h1>
    <p class="about-lede">
      ProductMoat doesn't have a standalone sign-in - verifying with LinkedIn on the
      <a class="bracket-link" href="apply.html">Apply</a>,
      <a class="bracket-link" href="recommend.html">Recommend</a>, or
      <a class="bracket-link" href="join-map.html">Put yourself on the map</a>
      form also signs you in site-wide.
    </p>
  `;
}

// ---------- My map (my-map.html) - the Map tab ----------
// Their "Put yourself on the map" pins (with review status) and, once published, the pin their
// interview puts them on.

function initMyMap() {
  const root = document.getElementById("mm-root");
  if (!root) return;
  const fmtDate = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "long" }) : "");
  const hero = (title, lede, extra = "") => `
    <section class="why-hero${extra ? " mi-hero-actions" : ""}">
      <div class="wrap">
        <div class="eyebrow">My map</div>
        <h1>${title}</h1>
        <p class="about-lede">${lede}</p>
        ${extra ? `<div class="mi-actions">${extra}</div>` : ""}
      </div>
    </section>`;
  const STATUS = { pending: "Pending review", approved: "Live on the map", rejected: "Not approved", removed: "Removed" };

  fetch("/api/member-map", { credentials: "same-origin" })
    .then(resp => (resp.status === 401 ? { signedOut: true } : resp.ok ? resp.json() : Promise.reject(resp.status)))
    .then(data => {
      if (data.signedOut) {
        root.innerHTML = hero("Sign in to see your place on the map.",
          "Your pin is tied to your LinkedIn account. Sign up or sign in and it will show up here.",
          `<a class="btn btn-primary" href="signup.html">Sign up with LinkedIn</a>`);
        return;
      }
      showMemberTabs("map");
      // Each person has at most one map submission (the API already resolves theirs to a
      // single record), so there is never more than one pin card to show here.
      const pin = (data.pins || [])[0] || null;
      const iv = data.interview;
      const place = p => [p.city, p.country].filter(Boolean).join(", ") || "Pinned location";
      // Only an approved or still-pending pin (or a published interview) actually appears on the
      // public globe for map.html?me=1 to fly to - a rejected/removed pin has nothing to zoom to.
      const zoomable = !!iv || (pin && (pin.status === "approved" || pin.status === "pending"));
      const ivCard = iv ? `<li class="mm-card"><div><div class="mm-place">${escapeHTML(iv.location || "Your location")}</div><div class="mm-meta">Your interview puts you on the map</div></div><a class="bracket-link" href="${escapeAttr(iv.url)}">[ Read it ]</a></li>` : "";
      const pinCard = pin ? `<li class="mm-card"><div><div class="mm-place">${escapeHTML(place(pin))}</div><div class="mm-meta">Submitted ${escapeHTML(fmtDate(pin.submittedAt))}${pin.status === "approved" && pin.approvedAt ? ` &middot; Granted ${escapeHTML(fmtDate(pin.approvedAt))}` : ""}</div></div><span class="mm-status is-${escapeAttr(pin.status)}">${escapeHTML(STATUS[pin.status] || pin.status)}</span></li>` : "";
      const cards = [ivCard, pinCard].filter(Boolean);
      const empty = !cards.length;
      const canAdd = !data.onMap; // one pin per person; a rejected pin can be replaced
      root.innerHTML = hero(
        empty ? "You're not on the map yet." : data.onMap ? "Your place on the map." : "Your pin wasn't approved.",
        empty
          ? "Drop a pin where you work and join the map of product people. We review every pin before it goes live."
          : data.onMap
            ? "You're on the map, and here's where your pin stands. Each person gets one pin, and we review it before it goes live."
            : "We couldn't approve your pin as submitted. You can drop a new one where you work.",
        `${canAdd ? `<a class="btn btn-primary" href="join-map.html">${empty ? "Put yourself on the map" : "Drop a new pin"} &rarr;</a>` : ""}${empty ? "" : `<a class="${canAdd ? "bracket-link" : "btn btn-primary"}" href="map.html${zoomable ? "?me=1" : ""}">${canAdd ? "[ Open the map ]" : "Open the map &rarr;"}</a>`}`
      ) + (empty ? "" : `<section class="wrap mm-list-wrap"><ul class="mm-list">${cards.join("")}</ul></section>`);
    })
    .catch(() => { root.innerHTML = hero("Something went wrong.", "We couldn't load your map details just now. Please refresh in a moment."); });
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
    <a class="card" href="${interviewURL(p)}">
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
  renderChips();
  renderGrid();
}

// ---------- Person page ----------

// ---------- Interview (person.html) ----------
// The fixed 24-question PM interview (INTERVIEW_SECTIONS in people-data.js) filled in from
// p.interview.answers. Questions 1-5 (name/role/company/location/years) come from the
// profile fields; a skipped (missing/empty) answer is hidden, and a section with nothing
// answered isn't shown. p.interview.custom holds person-specific extras, shown last.

function interviewFacts(p) {
  return [
    ["Name", p.name],
    ["Current role", p.role],
    ["Current company", p.company],
    ["Location", p.location],
    ["Years in product", p.yearsExperience != null ? `${p.yearsExperience} years` : ""]
  ].filter(([, v]) => v);
}

// Fits the text width, but is never stretched beyond its own pixel size (max-width = real width).
function renderFeaturedPhoto(photo, name) {
  const w = Number(photo.width) || 0, h = Number(photo.height) || 0;
  return `<figure class="qa-photo"><img src="${escapeHTML(photo.url)}" alt="Photo of ${escapeHTML(name)}"${w && h ? ` width="${w}" height="${h}" style="max-width:${w}px"` : ""} loading="lazy" decoding="async" onerror="this.closest('figure').remove()"></figure>`;
}

function renderQA(num, question, answer) {
  return `
    <div class="qa-item">
      <div class="qa-num">${num}</div>
      <h3>${escapeHTML(question)}</h3>
      <p>${escapeHTML(answer)}</p>
    </div>
  `;
}

// Published interviews carry their own resolved sections (the questions as they were asked,
// admin edits included); the hand-written examples use the default questions + p.interview.answers.
function resolveInterviewSections(p) {
  const iv = p.interview || {};
  if (Array.isArray(iv.sections)) {
    return { fixedNumbers: false, sections: iv.sections.map(s => ({ title: s.title, items: s.questions.map(q => ({ id: q.id, text: q.text, answer: q.answer })) })) };
  }
  const answers = iv.answers || {};
  const has = id => typeof answers[id] === "string" && answers[id].trim() !== "";
  return {
    fixedNumbers: true,
    sections: INTERVIEW_SECTIONS.map(s => ({
      title: s.title,
      items: s.questions.filter(q => has(q.id)).map(q => ({ id: q.id, text: q.text, answer: answers[q.id] }))
    }))
  };
}

function renderInterview(p) {
  const { fixedNumbers, sections } = resolveInterviewSections(p);
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  let count = 0;
  const html = [];
  const facts = interviewFacts(p);

  const visible = sections.filter(s => s.items.length);
  if (!visible.length && facts.length) visible.push({ title: "Identity & Background", items: [] });

  // The person's own featured photo sits directly above the "your story" question (q6, else the
  // first answer). Only rendered when there is one: no placeholder here or in the preview.
  const photo = p.featuredPhoto && p.featuredPhoto.url ? p.featuredPhoto : null;
  const anchor = photo ? (visible.flatMap(s => s.items).find(q => q.id === "q6") || visible.flatMap(s => s.items)[0] || null) : null;

  visible.forEach((section, i) => {
    html.push(`
      <div class="qna-section">
        <h2 class="qna-section-title">${escapeHTML(section.title)}</h2>
        ${i === 0 && facts.length ? `
          <dl class="qa-facts">
            ${facts.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join("")}
          </dl>` : ""}
        ${photo && !anchor && i === 0 ? renderFeaturedPhoto(photo, p.name) : ""}
        ${section.items.map(q => {
          count += 1;
          const label = fixedNumbers
            ? `Q${q.id.slice(1).padStart(2, "0")} / ${INTERVIEW_TOTAL_QUESTIONS}`
            : `${String(count).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
          return (q === anchor ? renderFeaturedPhoto(photo, p.name) : "") + renderQA(label, q.text, q.answer);
        }).join("")}
      </div>
    `);
  });

  const custom = ((p.interview && p.interview.custom) || []).filter(c => c && c.q && c.a && c.a.trim() !== "");
  if (custom.length) {
    html.push(`
      <div class="qna-section">
        <h2 class="qna-section-title">${escapeHTML(CUSTOM_SECTION_TITLE)}</h2>
        ${custom.map((c, i) => renderQA(`Extra ${String(i + 1).padStart(2, "0")}`, c.q, c.a)).join("")}
      </div>
    `);
  }

  return html.join("");
}

// ---------- Questions overview (questions.html) ----------
// Lists every interview question from the live question bank (/api/question-bank, editable in
// the backoffice; falls back to INTERVIEW_SECTIONS in questions-default.js), marking which are
// required vs optional, plus how many custom questions can be added.

async function initQuestions() {
  const overview = document.getElementById("q-overview");
  const guide = document.getElementById("q-guide");
  const extra = document.getElementById("q-extra");
  if (!overview || !guide || !extra || typeof INTERVIEW_SECTIONS === "undefined") return;

  let bankSections = INTERVIEW_SECTIONS;
  try {
    const resp = await fetch("/api/question-bank");
    if (resp.ok) bankSections = (await resp.json()).sections || bankSections;
  } catch (err) { /* offline / no API: default questions */ }

  const all = bankSections.flatMap(s => s.questions);
  const required = all.filter(q => q.required);
  const fromProfile = required.filter(q => q.fromProfile);
  const toWrite = required.filter(q => !q.fromProfile);
  const optional = all.filter(q => !q.required);

  const lede = document.getElementById("q-lede-count");
  if (lede) lede.textContent = `${all.length} questions across ${bankSections.length} sections`;

  overview.innerHTML = `
    <div class="qstats">
      <div class="qstat">
        <div class="stat-num">${all.length}</div>
        <div class="stat-label">Questions in total</div>
      </div>
      <div class="qstat">
        <div class="stat-num">${required.length}</div>
        <div class="stat-label">Required &middot; ${fromProfile.length} come from your application, ${toWrite.length} you write</div>
      </div>
      <div class="qstat">
        <div class="stat-num">${optional.length}</div>
        <div class="stat-label">Optional &middot; answer what you like</div>
      </div>
      <div class="qstat">
        <div class="stat-num">+${CUSTOM_QUESTION_LIMIT}</div>
        <div class="stat-label">Custom questions you can add</div>
      </div>
    </div>
    <ul class="qhow">
      <li><span class="q-badge q-badge-req">Required</span> Needed to be featured. The basics (${fromProfile.length} questions) come from your application, so in practice you write ${toWrite.length} answers.</li>
      <li><span class="q-badge q-badge-opt">Optional</span> Skip any of these. Skipped questions simply don't appear on your profile, and a section with no answers is hidden.</li>
      <li><span class="q-badge q-badge-custom">Your own</span> Add up to ${CUSTOM_QUESTION_LIMIT} extra question-and-answer pairs. They're shown at the end of your interview.</li>
    </ul>
  `;

  let n = 0;
  guide.innerHTML = bankSections.map((section, i) => {
    const req = section.questions.filter(q => q.required).length;
    const count = section.questions.length;
    return `
      <div class="qsection">
        <div class="qsection-head">
          <div>
            <h2>${escapeHTML(section.title)}</h2>
            <p>${escapeHTML(section.blurb || "")}</p>
            <div class="qsection-meta">${count} question${count === 1 ? "" : "s"} &middot; ${req ? `${req} required` : "all optional"}</div>
          </div>
        </div>
        <ol class="qlist">
          ${section.questions.map(q => `
            <li class="qrow">
              <div class="qrow-num">Q${String(++n).padStart(2, "0")}</div>
              <div class="qrow-body">
                <div class="qrow-text">${escapeHTML(q.text)}</div>
                <div class="qrow-hint">${escapeHTML(q.hint || "")}${q.fromProfile ? " Filled in from your application." : ""}</div>
              </div>
              <span class="q-badge ${q.required ? "q-badge-req" : "q-badge-opt"}">${q.required ? "Required" : "Optional"}</span>
            </li>
          `).join("")}
        </ol>
      </div>
    `;
  }).join("");

  extra.innerHTML = `
    <div class="qsection">
      <div class="qsection-head">
        <div>
          <h2>Add your own questions</h2>
          <p>
            Something you'd rather be asked than answer the standard way? Add up to
            ${CUSTOM_QUESTION_LIMIT} custom questions of your own - write the question and
            your answer. Need a nudge? Here are some that have worked well:
          </p>
          <div class="qsection-meta">Up to ${CUSTOM_QUESTION_LIMIT} &middot; optional</div>
        </div>
      </div>
      <ul class="qideas">
        ${CUSTOM_QUESTION_IDEAS.map(idea => `<li><span class="q-badge q-badge-custom">Your own</span> ${escapeHTML(idea)}</li>`).join("")}
      </ul>
    </div>
  `;
}

// person.html is served for /interview/<category>/<slug> (rewrite) and, for older links,
// person.html?slug=<slug>.
function initPerson() {
  const m = /^\/interview\/([^/]+)\/([^/]+)\/?$/.exec(location.pathname);
  const slug = m ? decodeURIComponent(m[2]) : new URLSearchParams(location.search).get("slug");
  const p = findInterview(slug);
  const root = document.getElementById("person-root");
  if (!p) {
    root.innerHTML = `<div class="not-found"><p>No interview found for &ldquo;${escapeHTML(slug || "")}&rdquo;.</p><br><a class="btn btn-ghost" href="index.html">&larr; Back to all conversations</a></div>`;
    return;
  }
  renderPersonPage(root, p);
}

// Renders the full interview page for `p` into `root`. Also used by the backoffice preview
// (backoffice/preview.html) so the preview is byte-for-byte what gets published.
function renderPersonPage(root, p, opts = {}) {
  if (!opts.preview) document.title = `${p.name} - ProductMoat`;

  const hasCoords = typeof p.lat === "number" && typeof p.lng === "number";

  root.innerHTML = `
    <section class="profile-hero">
      <div class="wrap">
        <div class="hero-content">
          <div class="hero-content-top">
            ${opts.preview ? "" : `<a class="back-link" href="index.html">&larr; All conversations</a>`}
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
              ${p.links.linkedin ? `<a class="bracket-link" href="${escapeHTML(p.links.linkedin)}" target="_blank" rel="noopener">[ LinkedIn ]</a>` : ""}
              ${p.links.website ? `<a class="bracket-link" href="${escapeHTML(p.links.website)}" target="_blank" rel="noopener">[ Website ]</a>` : ""}
              ${p.links.twitter ? `<a class="bracket-link" href="${escapeHTML(p.links.twitter)}" target="_blank" rel="noopener">[ X ]</a>` : ""}
            </div>

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
        ${p.pullQuote ? `<div class="hero-quote"><blockquote class="pull-quote">&ldquo;${escapeHTML(p.pullQuote)}&rdquo;</blockquote></div>` : ""}
      </div>
    </section>

    ${p.foreword ? `
    <section class="foreword">
      <div class="wrap">
        <div class="foreword-inner">
          <div class="label-mono">Foreword</div>
          <p>${escapeHTML(p.foreword)}</p>
          <div class="foreword-byline">- Martin Knapic, ProductMoat</div>
        </div>
      </div>
    </section>` : ""}

    <section class="qna">
      <div class="wrap">
        <div class="qna-inner">
          ${renderInterview(p)}
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
  if (!opts.preview) renderProfileNav(p);
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

// Flat, non-interactive mercator preview - the original mini-map. Kept as a fallback;
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

// Mini globe - same globe projection, basemap, and sky treatment as the main map
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
    <a href="${interviewURL(prev)}">&larr; ${escapeHTML(prev.name)}</a>
    <a class="next" href="${interviewURL(next)}">${escapeHTML(next.name)} &rarr;</a>
  `;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------- Apply page ----------
// On submit the application is sent to /api/apply, which files it in the backoffice candidate
// list (source: applied). Identity comes from the LinkedIn session, not from this form.

// POSTs JSON, disabling the button meanwhile; shows an inline error under it on failure.
async function submitJSON(url, payload, btn, idleLabel, onConflict) {
  let err = document.getElementById("submit-error");
  if (!err) {
    err = document.createElement("p");
    err.id = "submit-error";
    err.className = "hint-inline li-error";
    btn.closest(".form-submit-row").appendChild(err);
  }
  err.hidden = true;
  btn.setAttribute("aria-disabled", "true");
  btn.textContent = "Sending…";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });
    if (resp.status === 409 && onConflict) {
      onConflict(await resp.json().catch(() => ({})));
      return false;
    }
    if (!resp.ok) throw new Error(String(resp.status));
    return true;
  } catch (e) {
    err.textContent = "Something went wrong sending that - please try again in a moment.";
    err.hidden = false;
    btn.removeAttribute("aria-disabled");
    btn.textContent = idleLabel;
    return false;
  }
}

// Someone already on the candidate list (applied, invited or published) can't apply again: swap the
// form for where they stand. The server enforces this too (409 from /api/apply).
function showAlreadyApplied(d) {
  const box = document.getElementById("apply-exists");
  const form = document.getElementById("apply-form");
  if (!box || !form) return;
  form.hidden = true;
  box.querySelector("#apply-exists-text").innerHTML = applicationStatusHTML(d);
  box.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initApply() {
  const form = document.getElementById("apply-form");
  if (!form) return;

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
      photoFilename.textContent = "No file selected - falls back to initials.";
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
      photoFileName: photoInput.files[0] ? photoInput.files[0].name : null,
      contactEmail: data.get("contactEmail").trim(),
      contactPhone: data.get("contactPhone").trim(),
      networkOptIn: data.get("networkOptIn") === "on" // explicit tick only; unticked by default
    };

    submitJSON("/api/apply", application, submitBtn, "Submit application", d => showAlreadyApplied(d)).then(ok => {
      if (!ok) return;
      form.hidden = true;
      document.getElementById("apply-success").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ---------- LinkedIn verification gate (apply.html) ----------
// The Client ID is public by design - LinkedIn OAuth apps embed it in frontend
// code, only the Client Secret is sensitive (it lives in Vercel env vars and is
// used exclusively by the /api/linkedin-callback function). Replace this with
// your app's Client ID from https://www.linkedin.com/developers/apps.
const LINKEDIN_CLIENT_ID = "778t1x9svtemxo";

// ---------- "Before you continue" newsletter prompt ----------
// Every "Sign up / Sign in with LinkedIn" button goes through withNewsletterPrompt(). If the
// newsletter box next to it is already ticked the sign-in just starts. If not, a modal makes
// the case once more: "Subscribe me" ticks the box and continues, the quiet "Skip" continues
// without, and the close button / Esc / clicking outside cancels (the visitor stays on the
// page). The choice is then carried across the LinkedIn round trip exactly as before: the
// caller's startSignIn() copies the box into sessionStorage (li_newsletter / su_newsletter /
// iv_newsletter) - the same place the one-time OAuth nonce lives, so the two survive together -
// and the page applies it via /api/member-signup once LinkedIn sends the visitor back.
function withNewsletterPrompt(box, go) {
  if (!box || box.checked) return go();
  openNewsletterPrompt().then(choice => {
    if (!choice) return; // cancelled
    if (choice === "subscribe") {
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    go();
  });
}

function openNewsletterPrompt() {
  return new Promise(resolve => {
    if (document.querySelector(".nl-overlay")) return resolve(null); // one at a time
    const opener = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "nl-overlay";
    overlay.innerHTML = `
      <div class="nl-modal" role="dialog" aria-modal="true" aria-labelledby="nl-title" aria-describedby="nl-lede">
        <button type="button" class="nl-close" aria-label="Close and go back">&times;</button>
        <div class="eyebrow">Before you continue</div>
        <h2 id="nl-title">You haven't subscribed to the newsletter.</h2>
        <p class="nl-lede" id="nl-lede">Once a week we send you stories from product people around the world - and the occasional deal we think you'll like. Here's what you'd get:</p>
        <ul class="nl-benefits">
          <li><strong>Every new interview</strong> in your inbox, so you hear how product leaders think, what they've shipped and how AI is changing the craft.</li>
          <li><strong>Deals and perks</strong> we line up for product people, sent your way when there's something worth your time.</li>
          <li><strong>First to know</strong> when we open something new, like calls to be featured or new ways to connect with the community.</li>
          <li><strong>Free and easy to leave.</strong> One email a week at most, with an unsubscribe link in every issue.</li>
        </ul>
        <div class="nl-actions">
          <button type="button" class="btn btn-primary" data-nl="subscribe">Subscribe me</button>
          <button type="button" class="nl-skip" data-nl="skip">Skip, continue without subscribing</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("nl-open");
    const modal = overlay.querySelector(".nl-modal");
    const primary = overlay.querySelector('[data-nl="subscribe"]');
    primary.focus();

    function close(result) {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      document.body.classList.remove("nl-open");
      if (opener && opener.focus) opener.focus();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(null); return; }
      if (e.key !== "Tab") return;
      const items = [...modal.querySelectorAll("button")];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("click", e => {
      if (e.target === overlay || e.target.closest(".nl-close")) return close(null);
      const b = e.target.closest("[data-nl]");
      if (b) close(b.dataset.nl);
    });
  });
}

// The newsletter checkbox (#li-newsletter) sits next to every LinkedIn sign-in
// button that isn't signup.html (which has its own #su-newsletter). It's opt-in:
// unchecked by default, and only if it was ticked before the redirect do we
// record a subscription once the sign-in comes back successfully.
function rememberNewsletterChoice() {
  const box = document.getElementById("li-newsletter");
  sessionStorage.setItem("li_newsletter", box && box.checked ? "1" : "0");
}

async function applyNewsletterChoice(page) {
  const wanted = sessionStorage.getItem("li_newsletter") === "1";
  sessionStorage.removeItem("li_newsletter");
  if (!wanted) return;
  try {
    await fetch("/api/member-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ newsletter: true, source: page })
    });
  } catch (err) { /* the form itself still works; a failed subscribe shouldn't block it */ }
}

// ---------- Already signed in? ----------
// A LinkedIn member session (pm_session) is set by every successful LinkedIn sign-in and lasts
// 30 days. On pages that gate on LinkedIn (Apply, Recommend, Put yourself on the map, Sign up)
// a visitor who already has one shouldn't be asked to sign in again - the page shows who
// they're signed in as and unlocks. The server still re-checks the session on every submit.

async function fetchMemberProfile() {
  try {
    const resp = await fetch("/api/member-me", { credentials: "same-origin" });
    return resp.ok ? await resp.json() : null;
  } catch (err) {
    return null;
  }
}

// The details a member keeps on My profile (null if signed out / none saved yet); used to prefill forms.
async function fetchMemberDetails() {
  try {
    const resp = await fetch("/api/member-profile", { credentials: "same-origin" });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.saved ? data.details : null;
  } catch (err) {
    return null;
  }
}

// Fill a field only if the person hasn't typed anything there.
function fillIfEmpty(id, value) {
  const el = document.getElementById(id);
  if (el && !el.disabled && value != null && String(value) !== "" && !el.value) el.value = value;
}

function sessionGateHTML(profile) {
  return `
    <div class="li-badge"><span class="li-badge-check">&check;</span> Signed in as ${escapeHTML(profile.name || "LinkedIn member")} via LinkedIn</div>
    <div class="form-checkbox-row li-newsletter-row newsletter-checkbox-row">
      <input type="checkbox" id="li-newsletter">
      <label for="li-newsletter" id="li-newsletter-label">Subscribe me to the ProductMoat newsletter <span class="li-optional">(optional)</span>.</label>
    </div>`;
}

// Ticking the box subscribes right away (there's no redirect to carry the choice across).
function wireSessionNewsletter(gate, page) {
  const box = gate.querySelector("#li-newsletter");
  if (!box) return;
  box.addEventListener("change", async () => {
    if (!box.checked) return; // unsubscribing happens through the link in each newsletter issue
    box.disabled = true;
    const label = gate.querySelector("#li-newsletter-label");
    try {
      const resp = await fetch("/api/member-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ newsletter: true, source: page })
      });
      if (!resp.ok) throw new Error("subscribe failed");
      label.textContent = "You're subscribed to the newsletter - every issue has an unsubscribe link.";
    } catch (err) {
      box.checked = false;
      box.disabled = false;
      label.textContent = "Couldn't subscribe just now - please try again.";
    }
  });
}

// Generic gate: locks every field in `formId` (except the sign-in button and
// the submit button, which gets an aria-disabled treatment instead) until the
// visitor verifies via LinkedIn OAuth. `page` is embedded in the OAuth
// `state` param so /api/linkedin-callback knows which page to redirect back
// to - keep it in sync with ALLOWED_PAGES in that file. `onVerified(profile)`
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
    rememberNewsletterChoice();
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

  signInBtn.addEventListener("click", () => withNewsletterPrompt(document.getElementById("li-newsletter"), startSignIn));

  async function completeSignIn() {
    try {
      const resp = await fetch("/api/linkedin-profile", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("not verified");
      const profile = await resp.json();
      applyNewsletterChoice(page);
      setLocked(false);
      gate.innerHTML = `<div class="li-badge"><span class="li-badge-check">&check;</span> Verified as ${escapeHTML(profile.name || "LinkedIn member")} via LinkedIn</div>`;
      if (onVerified) onVerified(profile);
    } catch (err) {
      showError();
    }
  }

  const params = new URLSearchParams(window.location.search);
  const li = params.get("li");
  if (!li) {
    // no OAuth round trip in progress: already signed in?
    fetchMemberProfile().then(profile => {
      if (!profile) return;
      setLocked(false);
      gate.innerHTML = sessionGateHTML(profile);
      wireSessionNewsletter(gate, page);
      if (onVerified) onVerified(profile);
    });
    return;
  }

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
      // already on the list? then there's nothing to apply for
      fetch("/api/my-interview", { credentials: "same-origin" })
        .then(resp => (resp.ok ? resp.json() : null))
        .then(d => { if (d && d.state !== "none") showAlreadyApplied(d); })
        .catch(() => {});
      document.getElementById("f-name").value = profile.name || "";
      document.getElementById("f-email").value = profile.email || "";
      // everything else they've saved on My profile
      fetchMemberDetails().then(d => {
        if (!d) return;
        if (d.name) document.getElementById("f-name").value = d.name;
        fillIfEmpty("f-role", d.role); fillIfEmpty("f-company", d.company); fillIfEmpty("f-location", d.location);
        fillIfEmpty("f-years", d.yearsExperience); fillIfEmpty("f-linkedin", d.linkedin);
        fillIfEmpty("f-website", d.website); fillIfEmpty("f-twitter", d.twitter);
        fillIfEmpty("f-snippet", d.snippet); fillIfEmpty("f-quote", d.pullQuote);
        if (d.focusTags && d.focusTags[0]) fillIfEmpty("f-focus", d.focusTags[0]);
        const snip = document.getElementById("f-snippet"), counter = document.getElementById("snippet-counter");
        if (snip && counter) counter.textContent = `${snip.value.length} / ${snip.maxLength}`;
      });
      if (profile.picture) {
        document.getElementById("photo-preview").innerHTML = `<img src="${profile.picture}" alt="">`;
        document.getElementById("photo-filename").textContent = "Using your LinkedIn photo - choose a file to replace it.";
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
// Sent to /api/recommend, which adds the recommended person to the backoffice candidate list
// (source: recommended). Gated behind initRecommendLinkedInGate() - yourName/yourEmail
// arrive pre-filled (and read-only) from the verified profile.

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
      yourLinkedin: (data.get("yourLinkedin") || "").trim(),
      stayAnonymous: data.get("stayAnonymous") === "on"
    };

    submitJSON("/api/recommend", recommendation, submitBtn, "Send recommendation").then(ok => {
      if (!ok) return;
      form.hidden = true;
      document.getElementById("recommend-success").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ---------- Put yourself on the map (join-map.html) ----------
// Two states, never both at once. Signed out, the page is just the sign-up call to action
// ("Sign up with LinkedIn"); the OAuth round trip lands back on this same page. Signed in,
// the page is only the pin request: a pin on the mini map plus city, country, role and
// company - all mandatory. Name, email and photo come from the LinkedIn session, so they're
// never asked for. See api/join-map.js for where the submission lands (it re-checks that
// every field is present).

const JM_MAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
};

function jmInitials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function initJoinMap() {
  const signupEl = document.getElementById("jm-signup");
  const formEl = document.getElementById("jm-form");
  if (!signupEl || !formEl || typeof maplibregl === "undefined") return;

  const hint = document.getElementById("jm-picker-hint");
  const signinBtn = document.getElementById("li-signin-btn");
  const errorEl = document.getElementById("li-error");
  const submitWrap = document.getElementById("jm-submit-wrap");
  const submitBtn = document.getElementById("jm-submit-btn");
  const submitError = document.getElementById("jm-submit-error");
  const ledeOut = document.getElementById("jm-lede-out");
  const ledeIn = document.getElementById("jm-lede-in");
  const fields = ["jm-city", "jm-country", "jm-role", "jm-company"].map(id => document.getElementById(id));

  let picked = null; // { lat, lng }
  let picker = null;
  let marker = null;
  let submitting = false;

  // ----- which of the two views is showing -----
  function showSignup(withError) {
    formEl.hidden = true;
    signupEl.hidden = false;
    ledeOut.hidden = false;
    ledeIn.hidden = true;
    errorEl.hidden = !withError;
  }

  function showForm(p) {
    signupEl.hidden = true;
    formEl.hidden = false;
    ledeOut.hidden = true;
    ledeIn.hidden = false;
    document.getElementById("jm-preview-avatar").innerHTML = p.picture
      ? `<img src="${escapeHTML(p.picture)}" alt="">`
      : `<div class="avatar">${escapeHTML(jmInitials(p.name))}</div>`;
    document.getElementById("jm-preview-name").textContent = p.name || "";
    document.getElementById("jm-preview-email").textContent = p.email || "";
    ensurePicker();
    prefillFromProfile();
    guardAlreadyOnMap();
    refreshLocks();
  }

  // The map is created only once its container is visible (MapLibre can't size a hidden one).
  function ensurePicker() {
    if (picker) { picker.resize(); return; }
    const theme = document.body.classList.contains("light") ? "light" : "dark";
    picker = new maplibregl.Map({
      container: "jm-picker-map",
      style: JM_MAP_STYLES[theme],
      center: [8.2, 30],
      zoom: 1.3,
      attributionControl: { compact: true }
    });
    picker.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    picker.on("click", (e) => setPicked(e.lngLat));
  }

  // City / country / role / company from My profile (location is saved as "City, Country")
  function prefillFromProfile() {
    fetchMemberDetails().then(d => {
      if (!d) return;
      const parts = (d.location || "").split(",").map(x => x.trim()).filter(Boolean);
      fillIfEmpty("jm-city", parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] || "");
      fillIfEmpty("jm-country", parts.length > 1 ? parts[parts.length - 1] : "");
      fillIfEmpty("jm-role", d.role);
      fillIfEmpty("jm-company", d.company);
      refreshLocks();
    });
  }

  // One pin per person: once we know who they are, check whether they're already on the map and,
  // if so, swap the form for a message (the server refuses a second pin regardless).
  function showAlreadyOnMap() {
    formEl.hidden = true;
    ledeIn.hidden = true;
    document.getElementById("jm-already").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function guardAlreadyOnMap() {
    return fetch("/api/member-map", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.onMap) showAlreadyOnMap(); })
      .catch(() => { /* the server still refuses a second pin */ });
  }

  // ----- the pin request: everything mandatory -----
  function isComplete() {
    return !!picked && fields.every(f => f.value.trim() !== "");
  }

  function refreshLocks() {
    const locked = !isComplete();
    if (locked) submitBtn.setAttribute("aria-disabled", "true");
    else submitBtn.removeAttribute("aria-disabled");
    submitWrap.classList.toggle("locked", locked);
    if (!locked) submitError.hidden = true;
  }
  fields.forEach(f => f.addEventListener("input", refreshLocks));

  function setPicked(lngLat) {
    picked = { lat: lngLat.lat, lng: lngLat.lng };
    hint.textContent = `Pin set at ${picked.lat.toFixed(3)}, ${picked.lng.toFixed(3)} - drag it to adjust.`;
    if (marker) {
      marker.setLngLat(lngLat);
    } else {
      marker = new maplibregl.Marker({ draggable: true, color: "#e6432b" }).setLngLat(lngLat).addTo(picker);
      marker.on("dragend", () => setPicked(marker.getLngLat()));
    }
    refreshLocks();
  }

  // Clicking the (dimmed) button explains what's missing instead of doing nothing.
  function explainMissing() {
    formEl.classList.add("was-validated");
    const missing = [];
    if (!picked) missing.push("a pin on the map");
    fields.forEach(f => { if (f.value.trim() === "") missing.push(f.name); });
    submitError.textContent = `Still needed: ${missing.join(", ")}.`;
    submitError.hidden = false;
    const target = !picked ? document.getElementById("jm-picker-map") : fields.find(f => f.value.trim() === "");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target && target.focus && picked) target.focus({ preventScroll: true });
  }

  async function submitPin() {
    if (submitting) return;
    if (!isComplete()) return explainMissing();
    submitting = true;
    submitError.hidden = true;
    submitBtn.setAttribute("aria-disabled", "true");
    submitBtn.textContent = "Adding you…";

    try {
      const resp = await fetch("/api/join-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          city: document.getElementById("jm-city").value.trim(),
          country: document.getElementById("jm-country").value.trim(),
          role: document.getElementById("jm-role").value.trim(),
          company: document.getElementById("jm-company").value.trim(),
          lat: picked.lat,
          lng: picked.lng
        })
      });
      if (resp.status === 409) return showAlreadyOnMap();
      if (!resp.ok) throw new Error("submit failed");

      formEl.hidden = true;
      ledeIn.hidden = true;
      document.getElementById("jm-success").hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      submitError.textContent = "Something went wrong submitting your pin - try again.";
      submitError.hidden = false;
      submitBtn.removeAttribute("aria-disabled");
      submitBtn.textContent = "Add me to the map";
    } finally {
      submitting = false;
    }
  }
  submitBtn.addEventListener("click", submitPin);

  // ----- sign up (LinkedIn) and the return trip to this page -----
  function startSignIn() {
    errorEl.hidden = true;
    const nonce = crypto.randomUUID();
    sessionStorage.setItem("li_oauth_state", nonce);
    rememberNewsletterChoice();
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
  signinBtn.addEventListener("click", () => withNewsletterPrompt(document.getElementById("li-newsletter"), startSignIn));

  // Back from LinkedIn: create the member profile (with the newsletter choice made before
  // leaving), then show the pin request.
  async function completeSignUp() {
    try {
      const resp = await fetch("/api/linkedin-profile", { credentials: "same-origin" });
      if (!resp.ok) throw new Error("not verified");
      const profile = await resp.json();

      const wantsNewsletter = sessionStorage.getItem("li_newsletter") === "1";
      sessionStorage.removeItem("li_newsletter");
      await fetch("/api/member-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ newsletter: wantsNewsletter, source: "join-map" })
      }).catch(() => { /* the pin request itself still works without the profile record */ });

      showForm(profile);
    } catch (err) {
      showSignup(true);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const li = params.get("li");
  if (!li) {
    // Signed in already (nav sign-up, apply, …)? Straight to the pin request. Otherwise the CTA.
    fetchMemberProfile().then(p => (p ? showForm(p) : showSignup(false)));
    return;
  }

  const returnedState = params.get("state");
  history.replaceState(null, "", window.location.pathname);
  const expectedState = sessionStorage.getItem("li_oauth_state");
  sessionStorage.removeItem("li_oauth_state");

  if (li !== "ok" || !returnedState || returnedState !== expectedState) {
    showSignup(true);
    return;
  }
  completeSignUp();
}

// ---------- Calendar (calendar.html) ----------
// 52 weeks, grouped into 4 quarters of 13 weeks each, months labeled within
// each quarter. Weeks are Monday-start, running from the Monday on/before
// Jan 1 of the target year. Only interviews already published (publishedDate
// <= today) are ever shown - future weeks only ever render as "open".

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
  const range = `${calFormatShort(week.start)} - ${calFormatShort(week.end)}`;

  let bodyHTML;
  if (interview) {
    bodyHTML = `
      <a class="cal-card" href="${interviewURL(interview)}" title="${escapeHTML(interview.name)} - ${escapeHTML(interview.role)}">
        ${avatarHTML(interview, "avatar cal-card-avatar")}
        <span class="cal-card-name">${escapeHTML(interview.name)}</span>
      </a>`;
  } else if (status === "gap") {
    bodyHTML = `<div class="cal-empty"><span class="cal-empty-label">-</span></div>`;
  } else {
    bodyHTML = `<div class="cal-empty"><span class="cal-empty-label">Open</span></div>`;
  }

  // Only an "open" week (current or future, nothing published for it yet) is
  // actually available to apply for or recommend someone into - a published
  // week is already taken, and a past "gap" week can't be filled retroactively.
  const hoverHTML = status === "open"
    ? `<div class="cal-hover">
        <a class="cal-hover-btn" href="/apply.html">Apply</a>
        <a class="cal-hover-btn" href="/recommend.html">Recommend</a>
      </div>`
    : "";

  return `
    <td class="cal-cell" data-status="${status}"${isCurrent ? ' data-current="true"' : ""}>
      <div class="cal-cell-inner">
        <div class="cal-cell-head">
          <span class="cal-week-no">W${String(week.index).padStart(2, "0")}</span>
          <span class="cal-week-range">${range}</span>
        </div>
        ${bodyHTML}
      </div>
      ${hoverHTML}
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
        <span class="cal-quarter-range">${firstMonth} - ${lastMonth} ${year}</span>
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
