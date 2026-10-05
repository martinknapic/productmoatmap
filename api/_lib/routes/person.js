// Vercel Function: the public interview page, rendered on the server.
//
// GET /interview/:category/:slug  (rewritten here by vercel.json)
//
// Serves person.html with the interview's content, title, description, canonical URL, Open Graph
// tags and JSON-LD already in the HTML (see api/_lib/seo.js). The browser script then hydrates it
// (map, lightbox) instead of building it from scratch. Every published interview gets all of this
// automatically: nothing per article to maintain.

const C = require("../common");
const S = require("../seo");

async function livePublished() {
  try {
    return (await C.listCandidates()).filter(C.isLive).map(C.toPublicInterview);
  } catch (err) {
    console.error("[person] storage failed:", (err && err.stack) || err);
    return [];
  }
}

module.exports = async (req, res) => {
  const slug = String((req.query || {}).slug || "");
  const category = String((req.query || {}).category || "");
  const out = slug ? S.renderPerson(slug, await livePublished()) : null;

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!out) {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10");
    return res.status(404).send(S.renderNotFound());
  }

  // Surfaces a thin or incomplete article in the Vercel logs instead of letting it ship unnoticed.
  const issues = S.auditPerson(out.person, out.html);
  if (issues.length) console.warn(`[seo] ${out.person.slug}: ${issues.join("; ")}`);

  // One canonical URL per interview: /interview/productux/x for a productmanagement interview 301s.
  const canonical = S.urlPath(out.person);
  if (category && category !== S.categoryOf(out.person)) {
    res.setHeader("Location", canonical);
    return res.status(301).send("");
  }

  // Short edge cache and no stale-while-revalidate, same reasoning as /api/published: edits and
  // unpublishing show up within a minute.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
  return res.status(200).send(out.html);
};
