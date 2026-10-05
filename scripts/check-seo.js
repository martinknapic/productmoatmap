#!/usr/bin/env node
// SEO guard: `node scripts/check-seo.js` (also `npm run check:seo`, and CI on every push / PR).
//
// 1. Every public static page: title, description, canonical, Open Graph / Twitter tags, <main>,
//    one <h1>; private pages must be noindex.
// 2. Every interview in assets/people-data.js is rendered through the real server renderer
//    (api/_lib/seo.js) and checked: unique title/description/slug, valid JSON-LD, content present,
//    alt text, canonical URL.
// 3. Site plumbing: robots.txt points at the sitemap, vercel.json rewrites the interview, sitemap
//    and IndexNow routes.
//
// Interviews published through the backoffice run the exact same renderer, so passing here means
// the template guarantees every future article ships with its tags. Exit code 1 on any failure.

const fs = require("fs");
const path = require("path");
const S = require("../api/_lib/seo");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let failures = 0, warnings = 0;
const fail = (where, msg) => { failures++; console.error(`  FAIL  ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; console.warn(`  warn  ${where}: ${msg}`); };

// ---- static pages --------------------------------------------------------------------------------
const PUBLIC = { "index.html": "/", "about.html": "/about", "map.html": "/map", "apply.html": "/apply", "process.html": "/process", "questions.html": "/questions", "why-apply.html": "/why-apply", "privacy.html": "/privacy", "recommend.html": "/recommend", "join-map.html": "/join-map" };
const PRIVATE = ["account.html", "network.html", "my-interview.html", "my-map.html", "interview.html", "interview-preview.html", "signup.html"];
const NO_MAIN = new Set(["map.html"]); // full-screen globe layout, no page body to wrap
const NO_H1 = new Set(["map.html"]);

console.log("Static pages");
for (const [file, route] of Object.entries(PUBLIC)) {
  const html = read(file);
  const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1];
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1];
  if (!title) fail(file, "missing <title>");
  else if (title.length > 70) warn(file, `title is ${title.length} chars`);
  if (!desc) fail(file, "missing meta description");
  else if (desc.length < 50 || desc.length > 175) warn(file, `meta description is ${desc.length} chars (aim for 70-160)`);
  const want = S.SITE_URL + (route === "/" ? "/" : route);
  if (!html.includes(`<link rel="canonical" href="${want}">`)) fail(file, `canonical should be ${want}`);
  for (const t of ["og:title", "og:description", "og:url", "og:image", "og:type"]) if (!html.includes(`property="${t}"`)) fail(file, `missing ${t}`);
  for (const t of ["twitter:card", "twitter:image"]) if (!html.includes(`name="${t}"`)) fail(file, `missing ${t}`);
  if (!NO_MAIN.has(file) && !/<main[\s>]/.test(html)) fail(file, "no <main> landmark");
  if (!NO_H1.has(file) && (html.match(/<h1[\s>]/g) || []).length !== 1) fail(file, "needs exactly one <h1>");
  if (/noindex/i.test(html)) fail(file, "public page is noindex");
}
for (const file of PRIVATE) {
  if (!/<meta name="robots" content="[^"]*noindex/.test(read(file))) fail(file, "private page must be noindex");
}

// ---- interviews ----------------------------------------------------------------------------------
console.log("Interviews");
const interviews = S.allInterviews([]);
const seen = { title: new Map(), desc: new Map(), slug: new Map() };
const dupe = (kind, key, slug) => { if (seen[kind].has(key)) fail(slug, `duplicate ${kind} (also ${seen[kind].get(key)})`); else seen[kind].set(key, slug); };
for (const p of interviews) {
  const out = S.renderPerson(p.slug, []);
  if (!out) { fail(p.slug, "did not render"); continue; }
  const { html } = out;
  dupe("slug", p.slug, p.slug); dupe("title", S.titleFor(p), p.slug); dupe("desc", S.descriptionFor(p), p.slug);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) fail(p.slug, "slug should be lowercase letters, digits and hyphens");
  if (!html.includes(`<h1 class="profile-name">${p.name.replace(/&/g, "&amp;")}</h1>`)) fail(p.slug, "name <h1> not server-rendered");
  if (!/<main[\s>]/.test(html)) fail(p.slug, "no <main> landmark");
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  try { const g = JSON.parse(ld[1])["@graph"]; if (!["Person", "Article", "ProfilePage", "BreadcrumbList"].every(t => g.some(n => n["@type"] === t))) fail(p.slug, "JSON-LD missing a node"); }
  catch (e) { fail(p.slug, "invalid JSON-LD"); }
  for (const msg of S.auditPerson(p, html)) warn(p.slug, msg);
}
console.log(`  ${interviews.length} interviews rendered`);

// ---- plumbing ------------------------------------------------------------------------------------
console.log("Site plumbing");
const robots = read("robots.txt");
if (!robots.includes(`Sitemap: ${S.SITE_URL}/sitemap.xml`)) fail("robots.txt", "must point at the sitemap");
if (/^Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt", "blocks the whole site");
const vercel = JSON.parse(read("vercel.json"));
const rewrites = (vercel.rewrites || []).map(r => `${r.source} -> ${r.destination}`).join("\n");
for (const need of ["/sitemap.xml", "op=person", "/indexnow.txt"]) if (!rewrites.includes(need)) fail("vercel.json", `missing rewrite for ${need}`);
const include = (vercel.functions && vercel.functions["api/site.js"] && vercel.functions["api/site.js"].includeFiles) || "";
for (const need of ["site", "person.html", "people-data", "questions-default"]) if (!include.includes(need)) fail("vercel.json", `api/site.js includeFiles must bundle ${need}`);

console.log(`\n${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures ? 1 : 0);
