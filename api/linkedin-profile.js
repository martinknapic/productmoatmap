// Vercel Function — hands the decoded LinkedIn profile to the frontend.
//
// Reads the signed, HttpOnly cookie set by linkedin-callback.js, verifies its
// HMAC signature and expiry, and returns the profile as JSON. The cookie is
// cleared on every call (success or failure) — it's a one-time handoff, not a
// session.

const crypto = require("crypto");

const COOKIE_NAME = "li_verify";

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
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`);

  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const cookies = parseCookies(req.headers.cookie);
  const profile = clientSecret ? verify(cookies[COOKIE_NAME], clientSecret) : null;

  if (!profile) {
    return res.status(401).json({ error: "not_verified" });
  }

  return res.status(200).json({
    name: profile.name,
    email: profile.email,
    picture: profile.picture
  });
};
