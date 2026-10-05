// Server-side rendering + SEO metadata for the public interview pages.
//
// The interview page used to be an empty shell that assets/site.js filled in in the browser, so
// crawlers and link previews saw no content, a generic title and no description. This module renders
// the page on the server instead. It does it by running the site's OWN render code
// (renderPersonPage in assets/site.js) inside a sandbox with a tiny DOM stub, so there is exactly one
// template: edit the page layout in site.js and the server output follows, nothing to keep in sync.
//
// Everything is derived from the published interview data, so a newly published interview gets its
// title, description, canonical URL, Open Graph / Twitter tags, JSON-LD and sitemap entry with no
// manual step. See scripts/check-seo.js for the automated checks.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "../..");
const ASSETS = path.join(ROOT, "assets");

const SITE_URL = (process.env.SITE_URL || "https://www.productmoat.com").replace(/\/+$/, "");
const SITE_NAME = "Product Moat";
const DEFAULT_IMAGE = "/assets/og-default.png"; // 1200x630, used when an interview has no photo
const LOGO = "/assets/logo-frame.png";

// Same escaping as the browser's textContent -> innerHTML round trip (& < > and nbsp, not quotes),
// so server markup matches what the client would have produced.
const domEscape = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, "&nbsp;");
const attr = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const read = file => fs.readFileSync(file, "utf8");

const abs = u => (/^https?:\/\//i.test(u) ? u : `${SITE_URL}/${String(u).replace(/^\/+/, "")}`);

// Runs the site scripts in an isolated context. `published` (the live interviews from storage) is
// appended to INTERVIEWS exactly like /api/published?format=js does in the browser.
function createSandbox(published) {
  const captured = {};
  const stubEl = () => ({ classList: { add() {}, remove() {}, contains: () => false }, addEventListener() {}, style: {}, setAttribute() {} });
  const document = {
    createElement() {
      const el = stubEl();
      Object.defineProperty(el, "textContent", { set(v) { el._t = v; } });
      Object.defineProperty(el, "innerHTML", { get: () => domEscape(el._t) });
      return el;
    },
    // Only the elements renderPersonPage/renderProfileNav write into are captured.
    getElementById(id) {
      if (!["profile-nav", "chip-row", "grid"].includes(id)) return null;
      return captured[id] || (captured[id] = { set innerHTML(v) { this.html = v; }, querySelectorAll: () => [] });
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { classList: { contains: () => true, add() {}, remove() {} }, hasAttribute: () => false },
    documentElement: stubEl(),
    title: ""
  };
  const ctx = { document, location: { pathname: "/", search: "" }, localStorage: { getItem: () => null }, console, navigator: {}, setTimeout() {}, fetch: () => Promise.resolve() };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ["questions-default.js", "people-data.js", "site.js"]) {
    vm.runInContext(read(path.join(ASSETS, f)), ctx, { filename: f });
  }
  ctx.__published = published || [];
  vm.runInContext("__published.forEach(function (x) { if (!INTERVIEWS.some(function (e) { return e.slug === x.slug; })) INTERVIEWS.push(x); });", ctx);
  return { ctx, captured };
}

// All interviews, newest first would be the site's order; callers sort if they care.
function allInterviews(published) {
  const { ctx } = createSandbox(published);
  return vm.runInContext("INTERVIEWS.slice()", ctx);
}

const categoryOf = p => p.category || (p.focusTag === "design" ? "productux" : "productmanagement");
const urlPath = p => `/interview/${categoryOf(p)}/${encodeURIComponent(p.slug)}`;

// Cuts at a word boundary so descriptions never end mid-word.
function clip(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:!?-]+$/, "") + "\u2026";
}

function titleFor(p) {
  const tries = [
    `${p.name}, ${p.role} at ${p.company} | ${SITE_NAME}`,
    `${p.name} - ${p.company} | ${SITE_NAME}`,
    `${p.name} | ${SITE_NAME}`
  ];
  return tries.find(t => t.length <= 62) || tries[tries.length - 1];
}

function descriptionFor(p) {
  const lead = `${p.name} is ${/^[aeiou]/i.test(p.role || "") ? "an" : "a"} ${p.role} at ${p.company}.`;
  const body = p.pullQuote ? `\u201c${p.pullQuote}\u201d` : (p.snippet || "");
  return clip(`${lead} ${body}`.trim(), 158);
}

function imageFor(p) {
  const u = (p.featuredPhoto && p.featuredPhoto.url) || p.photo || DEFAULT_IMAGE;
  return abs(u);
}

function jsonLd(obj) {
  // "<" escaped so a stray "</script>" in interview text can never break out of the tag.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")}</script>`;
}

function headTags(p) {
  const url = SITE_URL + urlPath(p);
  const title = titleFor(p);
  const description = descriptionFor(p);
  const image = imageFor(p);
  const published = /^\d{4}-\d{2}-\d{2}/.test(p.publishedDate || "") ? p.publishedDate : null;
  const sameAs = [p.links && p.links.linkedin, p.links && p.links.website, p.links && p.links.twitter].filter(u => /^https?:\/\//i.test(u || ""));
  const org = { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: `${SITE_URL}/`, logo: abs(LOGO) };
  const person = {
    "@type": "Person", "@id": `${url}#person`, name: p.name, jobTitle: p.role,
    worksFor: { "@type": "Organization", name: p.company },
    image, url, ...(sameAs.length ? { sameAs } : {}),
    ...(p.location ? { homeLocation: { "@type": "Place", name: p.location } } : {})
  };
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      org,
      person,
      {
        "@type": "ProfilePage", "@id": `${url}#profile`, url, name: title, description, inLanguage: "en",
        mainEntity: { "@id": `${url}#person` },
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
        ...(published ? { datePublished: published, dateModified: published } : {})
      },
      {
        "@type": "Article", "@id": `${url}#article`, headline: `${p.name}, ${p.role} at ${p.company}: a Product Moat interview`,
        description, image: [image], inLanguage: "en", mainEntityOfPage: url,
        about: { "@id": `${url}#person` },
        author: { "@type": "Person", name: "Martin Knapic" },
        publisher: { "@id": `${SITE_URL}/#organization` },
        ...(published ? { datePublished: published, dateModified: published } : {}),
        ...(p.focus ? { articleSection: p.focus } : {})
      },
      {
        "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Interviews", item: `${SITE_URL}/#directory` },
          { "@type": "ListItem", position: 2, name: p.name, item: url }
        ]
      }
    ]
  };
  return [
    `<meta name="description" content="${attr(description)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<link rel="canonical" href="${attr(url)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${attr(url)}">`,
    `<meta property="og:image" content="${attr(image)}">`,
    `<meta property="og:image:alt" content="${attr(`${p.name}, ${p.role} at ${p.company}`)}">`,
    published ? `<meta property="article:published_time" content="${published}">` : "",
    p.focus ? `<meta property="article:section" content="${attr(p.focus)}">` : "",
    `<meta name="twitter:card" content="${p.featuredPhoto && p.featuredPhoto.url ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${attr(title)}">`,
    `<meta name="twitter:description" content="${attr(description)}">`,
    `<meta name="twitter:image" content="${attr(image)}">`,
    jsonLd(graph)
  ].filter(Boolean).join("\n  ");
}

// The two stylesheets are small (about 11 KB compressed) and block the first paint, so each costs a
// round trip before anything shows. The server inlines them into the page instead. Relative url()s
// are rooted because the CSS no longer lives next to its images.
function inlineCss(html) {
  return html.replace(/<link rel="stylesheet" href="assets\/(swiss|site|hero-fx)\.css[^"]*">/g, (m, name) => {
    const css = read(path.join(ASSETS, `${name}.css`)).replace(/url\((["']?)(?!data:|https?:|\/)([^"')]+)\1\)/g, 'url($1/assets/$2$1)');
    return `<style>${css}</style>`;
  });
}

// Renders the full page HTML for one interview. Returns null when the slug is unknown.
function renderPerson(slug, published) {
  const { ctx, captured } = createSandbox(published);
  ctx.__slug = slug;
  const p = vm.runInContext("INTERVIEWS.find(function (e) { return e.slug === __slug; }) || null", ctx);
  if (!p) return null;

  const root = { set innerHTML(v) { this.html = v; }, querySelector: () => ({ classList: { add() {} }, addEventListener() {} }) };
  ctx.__root = root;
  ctx.__p = p;
  vm.runInContext("renderPersonPage(__root, __p)", ctx); // also fills #profile-nav (prev / next links)

  let html = inlineCss(read(path.join(ROOT, "person.html")));
  const title = titleFor(p);
  ctx.__cls = "avatar-xl";
  const avatar = vm.runInContext("avatarSrc(__p, __cls)", ctx);
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${domEscape(title)}</title>\n  ${headTags(p)}${avatar ? `\n  <link rel="preload" as="image" href="${attr(avatar)}" fetchpriority="high">` : ""}`)
    .replace('<div id="person-root"></div>', `<main id="main"><div id="person-root" data-ssr="${attr(p.slug)}">${root.html}</div>`)
    .replace('<div class="profile-nav" id="profile-nav"></div>', `<div class="profile-nav" id="profile-nav">${(captured["profile-nav"] && captured["profile-nav"].html) || ""}</div></main>`);
  return { html, person: p };
}

// The homepage: templates/home.html with the interview grid and focus chips already rendered (so
// crawlers see a link to every interview and nothing below the hero shifts), the stylesheets inlined,
// and the spotlight photo preloaded. The animated hero itself is still drawn by assets/hero-fx.js.
function renderHome(published) {
  const { ctx, captured } = createSandbox(published);
  vm.runInContext("renderChips(); renderGrid();", ctx);
  const latest = vm.runInContext("featuredInterview()", ctx);
  ctx.__p = latest;
  const photo = latest ? vm.runInContext("spotlightPhoto(__p)", ctx) : { src: null };
  let html = inlineCss(read(path.join(ROOT, "api/_lib/templates/home.html")));
  if (photo.src) html = html.replace('<link rel="icon"', `<link rel="preload" as="image" href="${attr(photo.src)}" fetchpriority="high">\n  <link rel="icon"`);
  return html
    .replace('<div class="chip-row" id="chip-row"></div>', `<div class="chip-row" id="chip-row">${(captured["chip-row"] && captured["chip-row"].html) || ""}</div>`)
    .replace('<div class="grid" id="grid"></div>', `<div class="grid" id="grid">${(captured["grid"] && captured["grid"].html) || ""}</div>`);
}

function renderNotFound() {
  let html = read(path.join(ROOT, "person.html"));
  return html.replace(/<title>[^<]*<\/title>/, `<title>Interview not found | ${SITE_NAME}</title>\n  <meta name="robots" content="noindex">`)
    .replace('<div id="person-root"></div>', '<main id="main"><div id="person-root"></div>')
    .replace('<div class="profile-nav" id="profile-nav"></div>', '<div class="profile-nav" id="profile-nav"></div></main>');
}

// Problems that would weaken an interview's search result or link preview. Used by
// scripts/check-seo.js and logged by the page route, so a thin or incomplete article is flagged
// by the machine instead of noticed (or not) by a person.
function auditPerson(p, html) {
  const issues = [];
  const title = titleFor(p), description = descriptionFor(p);
  if (!p.pullQuote && !p.snippet) issues.push("no pull quote or snippet: the meta description falls back to a bare name/role sentence");
  if (description.length < 70) issues.push(`meta description is short (${description.length} chars)`);
  if (title.length > 62) issues.push(`title is long (${title.length} chars)`);
  if (!(p.featuredPhoto && p.featuredPhoto.url) && !p.photo) issues.push("no photo: link previews use the generic Product Moat image");
  if (typeof p.lat !== "number" || typeof p.lng !== "number") issues.push("no coordinates: not shown on the map");
  if (html) {
    const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    if (text.length < 1500) issues.push(`very little indexable text (${text.length} chars)`);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) issues.push("page must have exactly one <h1>");
    if (!html.includes('rel="canonical"')) issues.push("canonical link missing");
    if (/<img(?![^>]*\balt=)[^>]*>/.test(html)) issues.push("image without alt text");
  }
  return issues;
}

module.exports = { renderHome, auditPerson, SITE_URL, SITE_NAME, allInterviews, renderPerson, renderNotFound, urlPath, categoryOf, titleFor, descriptionFor, headTags, createSandbox };
