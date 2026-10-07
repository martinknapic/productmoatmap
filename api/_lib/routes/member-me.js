// Vercel Function — returns the current site-wide member session as JSON, so
// the nav (and account.html) can show the signed-in avatar without the
// HttpOnly `pm_session` cookie ever being readable from client-side JS.
//
// Unlike linkedin-profile.js (which consumes its one-shot cookie on every
// read), this session is persistent: it's only cleared by member-logout.js
// or by expiring on its own.

const { readMember } = require("../common");
const S = require("../session");

module.exports = async (req, res) => {
  const session = S.fromHeader("member", req.headers.cookie);

  if (!session) {
    // 200 + null rather than 401: being signed out is normal, and a 401 shows up as a console error
    // (and a Lighthouse Best Practices failure) on every page view of every anonymous visitor.
    return res.status(200).json(null);
  }

  // Lets the nav show a "Backoffice" link to admins only. It's a UI hint: the backoffice pages
  // themselves are still gated by middleware.js and their own LinkedIn login.
  const admins = (process.env.BACKOFFICE_ALLOWED_EMAIL || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = !!session.email && admins.includes(String(session.email).trim().toLowerCase());
  const member = await readMember(session.email);

  return res.status(200).json({
    name: session.name,
    email: session.email,
    picture: (member && member.picture) || session.picture,
    isAdmin,
    newsletter: !!(member && member.newsletter)
  });
};
