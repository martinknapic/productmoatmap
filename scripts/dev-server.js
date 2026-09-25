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

const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), Module = require("module");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8766;
const DATA_FILE = path.join(ROOT, ".dev-data", "blob.json");
process.env.LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "dev-only-secret";

let store = new Map();
try { store = new Map(Object.entries(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")))); } catch (err) { /* fresh store */ }
const persist = () => {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(store)));
};

const blobMock = {
  async put(p, body) { store.set(p, String(body)); persist(); return { pathname: p }; },
  async get(p) { return store.has(p) ? { stream: new Response(store.get(p)).body } : null; },
  async list({ prefix }) { return { blobs: [...store.keys()].filter(k => k.startsWith(prefix)).map(pathname => ({ pathname })) }; },
  async del(p) { store.delete(p); persist(); }
};
const origLoad = Module._load;
Module._load = function (request, ...rest) { return request === "@vercel/blob" ? blobMock : origLoad.call(this, request, ...rest); };

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };

function signedCookie(name, data) {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 8 * 3600e3 })).toString("base64url");
  const sig = crypto.createHmac("sha256", process.env.LINKEDIN_CLIENT_SECRET).update(payload).digest("base64url");
  return `${name}=${payload}.${sig}; Path=/`;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/dev-login") {
    res.writeHead(302, { "Set-Cookie": signedCookie("bo_session", { email: "admin@dev.local", name: "Dev Admin" }), Location: "/backoffice/candidates.html" });
    return res.end();
  }
  if (url.pathname === "/dev-member-login") {
    const email = url.searchParams.get("email") || "member@dev.local";
    const name = url.searchParams.get("name") || "Dev Member";
    res.writeHead(302, { "Set-Cookie": signedCookie("pm_session", { email, name }), Location: url.searchParams.get("to") || "/apply.html" });
    return res.end();
  }
  if (url.pathname === "/dev-logout") {
    res.writeHead(302, { "Set-Cookie": ["bo_session=; Max-Age=0; Path=/", "pm_session=; Max-Age=0; Path=/"], Location: "/" });
    return res.end();
  }

  if (url.pathname.startsWith("/api/")) {
    const file = path.join(ROOT, `${url.pathname}.js`);
    if (!file.startsWith(path.join(ROOT, "api")) || path.basename(file).startsWith("_") || !fs.existsSync(file)) { res.writeHead(404); return res.end("{}"); }
    let raw = ""; for await (const chunk of req) raw += chunk;
    let body; try { body = raw ? JSON.parse(raw) : undefined; } catch (err) { body = undefined; }
    const r = { method: req.method, headers: req.headers, query: Object.fromEntries(url.searchParams), body };
    const out = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { res.statusCode = c; return out; },
      json(o) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); },
      send(s) { res.end(s); },
      end() { res.end(); }
    };
    try { await require(file)(r, out); } catch (err) { console.error(err); res.statusCode = 500; res.end("{}"); }
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (/^\/interview\/(productmanagement|productux)\/[^/]+\/?$/.test(pathname)) pathname = "/person.html"; // vercel.json rewrite
  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`ProductMoat dev server on http://localhost:${PORT}  (admin: /dev-login, member: /dev-member-login)`));
