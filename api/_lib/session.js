// Signed session cookies: one implementation for every cookie the site issues.
//
// Each cookie carries a `typ` claim ("admin" backoffice session, "member" site-wide LinkedIn session,
// "liverify" one-shot sign-in handoff) and is signed with a key derived from the app secret AND that
// type, so a cookie issued for one purpose can never be replayed as another (a member session copied
// into the bo_session cookie used to be accepted as an admin session). Admin sessions are also
// re-checked against BACKOFFICE_ALLOWED_EMAIL every time they are verified.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). Used by the functions and by
// middleware.js. The underscore keeps Vercel from exposing this file as a route.

const crypto = require("crypto");

const TYPES = { admin: "bo_session", member: "pm_session", liverify: "li_verify" };

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

const secret = () => process.env.LINKEDIN_CLIENT_SECRET || "";
const keyFor = type => crypto.createHmac("sha256", secret()).update(`productmoat-cookie-key:${type}`).digest();
const sign = (type, payload) => crypto.createHmac("sha256", keyFor(type)).update(payload).digest("base64url");

function adminEmails() {
  return (process.env.BACKOFFICE_ALLOWED_EMAIL || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
}

// -> the signed cookie value for `claims`, valid for ttlSeconds
function issue(type, claims, ttlSeconds) {
  if (!TYPES[type] || !secret()) throw new Error("session: cannot sign");
  const payload = Buffer.from(JSON.stringify({ ...claims, typ: type, exp: Date.now() + ttlSeconds * 1000 })).toString("base64url");
  return `${payload}.${sign(type, payload)}`;
}

// -> the claims, or null when the cookie is missing, forged, expired, of another type, or (admin) not allow-listed
function verify(type, cookieValue) {
  if (!TYPES[type] || !secret() || typeof cookieValue !== "string") return null;
  const [payload, signature, extra] = cookieValue.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(type, payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch (err) { return null; }
  if (!data || data.typ !== type || !data.exp || Date.now() > data.exp) return null;
  if (type === "admin" && !adminEmails().includes(String(data.email || "").trim().toLowerCase())) return null;
  return data;
}

// -> verified claims from the request's cookie header (a Node req or a fetch Request's header string)
const fromHeader = (type, cookieHeader) => verify(type, parseCookies(cookieHeader)[TYPES[type]]);

module.exports = { TYPES, parseCookies, issue, verify, fromHeader, adminEmails };
