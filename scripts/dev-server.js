#!/usr/bin/env node
// Local development server — `node scripts/dev-server.js` (default http://localhost:8766).
//
// Serves the static site, applies the same rewrites as vercel.json, and runs the api/*.js
// functions with an in-memory @vercel/blob stand-in (persisted to .dev-data/blob.json, which
// is git-ignored) and a throwaway signing secret — so the whole candidate → invitation →
// interview → publish flow works offline. Nothing here touches production.
//
//   /dev-login         signs you in as the backoffice admin (then opens the candidates list)
//   /dev-member-login  signs you in as a LinkedIn member (needed to test Apply / Recommend / My interview);
//                      pick who with ?email=jane@example.com&name=Jane
//   /dev-logout        clears both dev sessions

const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), zlib = require("zlib"), Module = require("module");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8766;
const DATA_FILE = path.join(ROOT, ".dev-data", "blob.json");
process.env.LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "dev-only-secret";
process.env.BACKOFFICE_ALLOWED_EMAIL = process.env.BACKOFFICE_ALLOWED_EMAIL || "admin@dev.local";
const session = require("../api/_lib/session");

let store = new Map();
try { store = new Map(Object.entries(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")))); } catch (err) { /* fresh store */ }
const persist = () => {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(store)));
};

const blobMock = {
  async put(p, body) { store.set(p, Buffer.isBuffer(body) ? "b64:" + body.toString("base64") : String(body)); persist(); return { pathname: p }; },
  async get(p) {
    if (!store.has(p)) return null;
    const v = store.get(p);
    return { stream: new Response(v.startsWith("b64:") ? Buffer.from(v.slice(4), "base64") : v).body }; // binary blobs (photos) are kept as base64
  },
  async list({ prefix }) { return { blobs: [...store.keys()].filter(k => k.startsWith(prefix)).map(pathname => ({ pathname })) }; },
  async del(p) { store.delete(p); persist(); }
};
const origLoad = Module._load;
Module._load = function (request, ...rest) { return request === "@vercel/blob" ? blobMock : origLoad.call(this, request, ...rest); };

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const rewrites = vercelConfig.rewrites || [];
const redirects = vercelConfig.redirects || [];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };

function signedCookie(type, data) {
  return `${session.TYPES[type]}=${session.issue(type, data, 8 * 3600)}; Path=/`;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  const redirect = redirects.find(r => r.source === url.pathname);
  if (redirect) { res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination }); return res.end(); }

  if (url.pathname === "/dev-login") {
    res.writeHead(302, { "Set-Cookie": signedCookie("admin", { email: "admin@dev.local", name: "Dev Admin" }), Location: "/backoffice/candidates" });
    return res.end();
  }
  if (url.pathname === "/dev-member-login") {
    const email = url.searchParams.get("email") || "member@dev.local";
    const name = url.searchParams.get("name") || "Dev Member";
    res.writeHead(302, { "Set-Cookie": signedCookie("member", { email, name }), Location: url.searchParams.get("to") || "/apply" });
    return res.end();
  }
  if (url.pathname === "/dev-logout") {
    res.writeHead(302, { "Set-Cookie": ["bo_session=; Max-Age=0; Path=/", "pm_session=; Max-Age=0; Path=/"], Location: "/" });
    return res.end();
  }

  // Pretty URLs that production rewrites to the api/site.js dispatcher (vercel.json): the
  // server-rendered homepage and interview pages, the sitemap and the IndexNow key.
  const iv = /^\/interview\/(productmanagement|productux)\/([^/]+)\/?$/.exec(url.pathname);
  if (iv) { url.pathname = "/api/site"; url.searchParams.set("op", "person"); url.searchParams.set("category", iv[1]); url.searchParams.set("slug", decodeURIComponent(iv[2])); }
  else if (url.pathname === "/") { url.pathname = "/api/site"; url.searchParams.set("op", "home"); }
  else if (url.pathname === "/sitemap.xml") { url.pathname = "/api/site"; url.searchParams.set("op", "sitemap"); }
  else if (url.pathname === "/indexnow.txt") { url.pathname = "/api/site"; url.searchParams.set("op", "indexnow-key"); }

  if (url.pathname.startsWith("/api/")) {
    // same /api rewrites as vercel.json (e.g. /api/apply -> /api/site?op=apply)
    let apiPath = url.pathname;
    for (const rw of rewrites) {
      if (rw.source === url.pathname && rw.destination.startsWith("/api/")) {
        const dest = new URL(rw.destination, "http://x");
        apiPath = dest.pathname;
        dest.searchParams.forEach((val, key) => { if (!url.searchParams.has(key)) url.searchParams.set(key, val); });
        break;
      }
    }
    const file = path.join(ROOT, `${apiPath}.js`);
    if (!file.startsWith(path.join(ROOT, "api")) || path.basename(file).startsWith("_") || !fs.existsSync(file)) { res.writeHead(404); return res.end("{}"); }
    let raw = ""; for await (const chunk of req) raw += chunk; // (photo uploads arrive as base64 JSON, a few MB at most)
    let body; try { body = raw ? JSON.parse(raw) : undefined; } catch (err) { body = undefined; }
    const r = { method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body };
    const out = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { res.statusCode = c; return out; },
      json(o) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); },
      send(s) {
        // gzip text like Vercel does, so local Lighthouse numbers resemble production
        const type = String(res.getHeader("Content-Type") || "");
        if (/gzip/.test(req.headers["accept-encoding"] || "") && /text|javascript|json|xml|svg/.test(type) && String(s).length > 1024) {
          res.setHeader("Content-Encoding", "gzip"); res.setHeader("Vary", "Accept-Encoding");
          return res.end(zlib.gzipSync(Buffer.from(String(s))));
        }
        res.end(s);
      },
      set statusCode(c) { res.statusCode = c; },
      get statusCode() { return res.statusCode; },
      end(body) { res.end(body); }
    };
    try { await require(file)(r, out); } catch (err) { console.error(err); res.statusCode = 500; res.end("{}"); }
    return;
  }

  let pathname = decodeURIComponent(url.pathname);

  // Mirror vercel.json's "cleanUrls": true — a request for the literal *.html
  // URL redirects (308) to the extensionless path, same as production.
  if (pathname.endsWith(".html")) {
    res.writeHead(308, { Location: pathname.slice(0, -".html".length) + url.search });
    return res.end();
  }

  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  else if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`; // cleanUrls: /about -> about.html
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
  const type = types[path.extname(file)] || "application/octet-stream";
  const headers = { "Content-Type": type, "Cache-Control": "no-store" };
  if (/gzip/.test(req.headers["accept-encoding"] || "") && /text|javascript|json|svg/.test(type)) {
    res.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Vary": "Accept-Encoding" });
    return fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
  }
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Product Moat dev server on http://localhost:${PORT}  (admin: /dev-login, member: /dev-member-login)`));
