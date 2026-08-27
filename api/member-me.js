// Vercel Function — returns the current site-wide member session as JSON, so
// the nav (and account.html) can show the signed-in avatar without the
// HttpOnly `pm_session` cookie ever being readable from client-side JS.
//
// Unlike linkedin-profile.js (which consumes its one-shot cookie on every
// read), this session is persistent: it's only cleared by member-logout.js
// or by expiring on its own.

const crypto = require("crypto");

const SESSION_COOKIE = "pm_session";

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function verify(cookieValue, secret) {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.exp || Date.now() > data.exp) return null;
  return data;
}

module.exports = async (req, res) => {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  const cookies = parseCookies(req.headers.cookie);
  const session = secret ? verify(cookies[SESSION_COOKIE], secret) : null;

  if (!session) {
    return res.status(401).json({ error: "not_authenticated" });
  }

  return res.status(200).json({
    name: session.name,
    email: session.email,
    picture: session.picture
  });
};
