// Vercel Function — persists a private member profile (name/email/picture,
// taken from the signed session, not from anything the client asserts) plus
// the newsletter opt-in/out choice made on signup.html's consent screen.
//
// This is what makes "creating a private profile" concrete: api/linkedin-
// callback.js sets the pm_session cookie for apply/recommend/join-map too,
// but only this endpoint — reached only from signup.html, after the visitor
// has seen the consent copy — writes anything to storage. Requires an
// existing pm_session (i.e. the visitor must have just completed LinkedIn
// sign-in on signup.html) so this can't be called to enroll someone else.

const crypto = require("crypto");
const { put } = require("@vercel/blob");

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

function verifySession(cookieValue, secret) {
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  const cookies = parseCookies(req.headers.cookie);
  const session = secret ? verifySession(cookies[SESSION_COOKIE], secret) : null;

  if (!session || !session.email) {
    return res.status(401).json({ error: "not_authenticated" });
  }

  const newsletter = !!(req.body && req.body.newsletter === true);
  const emailKey = crypto.createHash("sha256").update(session.email.toLowerCase()).digest("hex");

  const record = {
    name: session.name || "",
    email: session.email,
    picture: session.picture || null,
    newsletter,
    updatedAt: new Date().toISOString()
  };

  try {
    await put(`members/${emailKey}.json`, JSON.stringify(record), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json"
    });
    return res.status(200).json({ ok: true, newsletter });
  } catch (err) {
    console.error("[member-signup] blob write failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
