// Vercel Function — returns the current backoffice session's identity as JSON,
// so the dashboard pages can show "Logged in as ..." without the HttpOnly
// session cookie ever being readable from client-side JS.

const S = require("../session");

module.exports = async (req, res) => {
  const session = S.fromHeader("admin", req.headers.cookie);

  if (!session) {
    return res.status(401).json({ error: "not_authenticated" });
  }

  return res.status(200).json({ email: session.email, name: session.name });
};
