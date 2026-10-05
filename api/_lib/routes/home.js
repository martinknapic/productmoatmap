// Vercel Function: the homepage, rendered on the server (see renderHome in api/_lib/seo.js).
// GET /  (rewritten here by vercel.json). Same data and caching rules as the interview pages.

const C = require("../common");
const S = require("../seo");

module.exports = async (req, res) => {
  let published = [];
  try {
    published = (await C.listCandidates()).filter(C.isLive).map(C.toPublicInterview);
  } catch (err) {
    console.error("[home] storage failed:", (err && err.stack) || err);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
  return res.status(200).send(S.renderHome(published));
};
