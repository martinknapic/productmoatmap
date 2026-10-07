// Vercel Function — hands the decoded LinkedIn profile to the frontend.
//
// Reads the signed, HttpOnly cookie set by linkedin-callback.js, verifies its
// HMAC signature and expiry, and returns the profile as JSON. The cookie is
// cleared on every call (success or failure) — it's a one-time handoff, not a
// session.

const S = require("./_lib/session");

const COOKIE_NAME = S.TYPES.liverify;

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`);

  const profile = S.fromHeader("liverify", req.headers.cookie);

  if (!profile) {
    return res.status(401).json({ error: "not_verified" });
  }

  return res.status(200).json({
    name: profile.name,
    email: profile.email,
    picture: profile.picture
  });
};
