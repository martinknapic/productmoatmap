#!/usr/bin/env node
// Cache-busting for the long-lived asset cache.
//
// vercel.json serves /assets/*.js and *.css as "immutable, 1 year" so repeat visits and the browser
// cache are fast. That is only safe if the ?v= in every reference changes whenever the file's
// content does. This script makes that automatic: it sets each ?v= to a hash of the file's content.
//
//   node scripts/version-assets.js           rewrite stale ?v= values (the pre-commit hook does this)
//   node scripts/version-assets.js --check   exit 1 if any are stale (CI)
//
// Handles references in *.html (root and backoffice/) and inside assets/*.js (e.g. hero-fx.js loads
// hero-land.js). JS files are processed first so a rewritten reference changes that file's own hash.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const CHECK = process.argv.includes("--check");
const REF = /(assets\/[A-Za-z0-9_\/.-]+\.(?:js|css))\?v=[A-Za-z0-9]+/g;

const hashOf = rel => crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex").slice(0, 8);
let stale = 0;

function process_(rel) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = src.replace(REF, (m, asset) => {
    if (!fs.existsSync(path.join(ROOT, asset))) { console.warn(`  missing  ${rel} -> ${asset}`); return m; }
    return `${asset}?v=${hashOf(asset)}`;
  });
  if (out !== src) {
    stale++;
    console.log(`${CHECK ? "  stale   " : "  updated "} ${rel}`);
    if (!CHECK) fs.writeFileSync(file, out);
  }
}

const list = dir => fs.readdirSync(path.join(ROOT, dir)).filter(f => !fs.statSync(path.join(ROOT, dir, f)).isDirectory()).map(f => path.join(dir, f));
list("assets").filter(f => f.endsWith(".js")).forEach(process_);
[...list("."), ...list("backoffice")].filter(f => f.endsWith(".html")).forEach(process_);

if (CHECK && stale) { console.error(`\n${stale} file(s) reference stale asset versions. Run: node scripts/version-assets.js`); process.exit(1); }
console.log(stale ? `${stale} file(s) ${CHECK ? "stale" : "updated"}` : "asset versions up to date");
