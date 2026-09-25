// Vercel Function — clears the site-wide member session cookie and sends the
// browser back to wherever it logged out from (falls back to the homepage).
//
// `next` is attacker-controllable (it's a query param), so it's restricted to
// same-site relative paths only — anything else (an absolute URL, or `//host`
// which browsers treat as protocol-relative) is rejected in favor of the
// default, closing off an open-redirect via this endpoint.

function safeNext(raw) {
  if (typeof raw !== "string") return "/index.html";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/index.html";
  return raw;
}

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", "pm_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  res.setHeader("Location", safeNext(req.query.next));
  return res.status(302).end();
};
