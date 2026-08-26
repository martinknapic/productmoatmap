// Vercel Function — returns the current backoffice session's identity as JSON,
// so the dashboard pages can show "Logged in as ..." without the HttpOnly
// session cookie ever being readable from client-side JS.

const crypto = require("crypto");

const SESSION_COOKIE = "bo_session";

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

  return res.status(200).json({ email: session.email, name: session.name });
};
