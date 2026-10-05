// Vercel Function: email-only newsletter signup from the homepage hero.
// POST /api/subscribe {email, website}  ->  adds the address to the SendFox list (see _lib/newsletter.js).
//
// No account or session: the visitor typed their own address under the consent line. Double opt-in
// is a setting on the SendFox list, so SendFox sends the confirmation email if the list has one.
// `website` is a honeypot (hidden field humans never fill); bots that fill it get a fake success.
// The throttle is per warm function instance - a speed bump, not a guarantee.

const N = require("../newsletter");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const hits = new Map(); // ip -> [timestamps]
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 5;

function throttled(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > MAX_HITS;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.website) return res.status(200).json({ ok: true });

  const email = String(body.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: "invalid_email" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (throttled(ip)) return res.status(429).json({ error: "too_many_requests" });

  if (!N.configured()) return res.status(503).json({ error: "not_configured" });

  try {
    await N.subscribe({ email, name: "" });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[subscribe] sendfox failed:", (err && err.message) || err);
    return res.status(502).json({ error: "subscribe_failed" });
  }
};
