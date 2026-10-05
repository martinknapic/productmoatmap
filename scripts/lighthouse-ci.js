#!/usr/bin/env node
// Performance guard: `node scripts/lighthouse-ci.js` (also `npm run check:perf`, and CI on every push / PR).
//
// Starts the local dev server (same code as production: the server-rendered interview page, the
// asset pipeline, the lazy globe), runs Lighthouse against a sample interview on mobile and desktop
// three times each, and fails if the MEDIAN falls below the thresholds. The runs use software WebGL
// like PageSpeed's test machines, which is what exposed the globe's main-thread cost.
//
// The dev server sends uncompressed files with no CDN, so absolute scores and LCP are lower than
// production. The thresholds therefore guard what regresses silently and is stable here: category
// scores, blocking time and layout shift, not LCP. Tighten them as you see fit.
//
//   CHROME_PATH=/path/to/chrome node scripts/lighthouse-ci.js
//   LH_URL=https://www.productmoat.com/interview/productmanagement/<slug> node scripts/lighthouse-ci.js
//     (audits a live URL instead of starting the dev server; use looser LH_MIN_* values there)

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RUNS = Number(process.env.LH_RUNS) || 3;
const PORT = Number(process.env.LH_PORT) || 8798;
const num = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);

const THRESHOLDS = {
  mobile:  { performance: num("LH_MIN_MOBILE", 85),  accessibility: 95, "best-practices": 95, seo: 100, tbt: 200, cls: 0.05 },
  desktop: { performance: num("LH_MIN_DESKTOP", 95), accessibility: 95, "best-practices": 95, seo: 100, tbt: 100, cls: 0.05 }
};

const chrome = process.env.CHROME_PATH || [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"
].find(p => fs.existsSync(p));
if (!chrome) { console.error("No Chrome found. Set CHROME_PATH."); process.exit(2); }

const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

function firstSlug() {
  const src = fs.readFileSync(path.join(ROOT, "assets/people-data.js"), "utf8");
  return /^\s*slug:\s*"([^"]+)"/m.exec(src)[1];
}

function lighthouse(url, preset, out) {
  const flags = "--headless=new --no-sandbox --disable-gpu --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader";
  const args = ["-y", "lighthouse@13", url, "--output=json", `--output-path=${out}`, `--chrome-flags=${flags}`, "--quiet"];
  if (preset === "desktop") args.push("--preset=desktop");
  const r = spawnSync("npx", args, { env: { ...process.env, CHROME_PATH: chrome }, stdio: ["ignore", "ignore", "inherit"], timeout: 240000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`lighthouse failed (${preset})`);
  const j = JSON.parse(fs.readFileSync(out, "utf8"));
  const score = id => Math.round((j.categories[id].score || 0) * 100);
  return {
    performance: score("performance"), accessibility: score("accessibility"), "best-practices": score("best-practices"), seo: score("seo"),
    tbt: j.audits["total-blocking-time"].numericValue, cls: j.audits["cumulative-layout-shift"].numericValue, lcp: j.audits["largest-contentful-paint"].numericValue
  };
}

(async () => {
  let server = null, url = process.env.LH_URL;
  if (!url) {
    server = spawn("node", ["scripts/dev-server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
    url = `http://localhost:${PORT}/interview/productmanagement/${firstSlug()}`;
    for (let i = 0; i < 40; i++) { try { if ((await fetch(url)).ok) break; } catch (e) { /* not up yet */ } await sleep(250); }
  }
  console.log(`Lighthouse on ${url} (${RUNS} runs each, median)\n`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-"));
  let failed = 0;
  try {
    for (const preset of ["mobile", "desktop"]) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(lighthouse(url, preset, path.join(tmp, `${preset}-${i}.json`)));
      const med = k => median(runs.map(r => r[k]));
      const t = THRESHOLDS[preset];
      console.log(`${preset.toUpperCase()}  (performance per run: ${runs.map(r => r.performance).join(", ")})`);
      const rows = [
        ["performance", med("performance"), v => v >= t.performance, `>= ${t.performance}`],
        ["accessibility", med("accessibility"), v => v >= t.accessibility, `>= ${t.accessibility}`],
        ["best-practices", med("best-practices"), v => v >= t["best-practices"], `>= ${t["best-practices"]}`],
        ["seo", med("seo"), v => v >= t.seo, `>= ${t.seo}`],
        ["total blocking time (ms)", Math.round(med("tbt")), v => v <= t.tbt, `<= ${t.tbt}`],
        ["layout shift (CLS)", Number(med("cls").toFixed(3)), v => v <= t.cls, `<= ${t.cls}`],
        ["LCP (ms, info only)", Math.round(med("lcp")), () => true, ""]
      ];
      for (const [name, value, ok, want] of rows) {
        if (!ok(value)) failed++;
        console.log(`  ${ok(value) ? "ok  " : "FAIL"}  ${name.padEnd(26)} ${String(value).padStart(6)}  ${want}`);
      }
      console.log("");
    }
  } finally {
    if (server) server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failed) { console.error(`${failed} performance check(s) failed.`); process.exit(1); }
  console.log("Performance checks passed.");
})().catch(err => { console.error(err.message); process.exit(2); });
