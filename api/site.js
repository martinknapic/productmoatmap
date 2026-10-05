// Vercel Function — one entry point for the site's small JSON/redirect endpoints.
//
// Vercel's Hobby plan allows at most 12 functions per deployment, so instead of one file per
// endpoint these routes live in api/_lib/routes/ (underscore = not a function of its own) and
// this dispatcher runs the right one. vercel.json rewrites keep the public URLs unchanged —
// e.g. /api/apply -> /api/site?op=apply — so nothing in the site or the OAuth setup moves.
// Every route still does its own authentication.

const routes = {
  "apply": require("./_lib/routes/apply"),
  "recommend": require("./_lib/routes/recommend"),
  "candidates": require("./_lib/routes/candidates"),
  "interview": require("./_lib/routes/interview"),
  "interview-photo": require("./_lib/routes/interview-photo"),
  "profile-photo": require("./_lib/routes/profile-photo"),
  "my-interview": require("./_lib/routes/my-interview"),
  "published": require("./_lib/routes/published"),
  "home": require("./_lib/routes/home"),
  "person": require("./_lib/routes/person"),
  "sitemap": require("./_lib/routes/sitemap"),
  "indexnow-key": require("./_lib/routes/indexnow-key"),
  "question-bank": require("./_lib/routes/question-bank"),
  "member-me": require("./_lib/routes/member-me"),
  "member-profile": require("./_lib/routes/member-profile"),
  "member-network": require("./_lib/routes/member-network"),
  "member-map": require("./_lib/routes/member-map"),
  "subscribe": require("./_lib/routes/subscribe"),
  "member-logout": require("./_lib/routes/member-logout"),
  "backoffice-me": require("./_lib/routes/backoffice-me"),
  "backoffice-users": require("./_lib/routes/backoffice-users"),
  "backoffice-logout": require("./_lib/routes/backoffice-logout")
};

module.exports = async (req, res) => {
  const op = req.query && req.query.op;
  const handler = Object.prototype.hasOwnProperty.call(routes, op) ? routes[op] : null;
  if (!handler) return res.status(404).json({ error: "not_found" });
  return handler(req, res);
};
