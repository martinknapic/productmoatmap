// Vercel Function — every published interview, in the same shape as an INTERVIEWS entry in
// assets/people-data.js.
//
// GET /api/published?format=js  -> a script that appends them to INTERVIEWS (index, person,
//                                  calendar and map pages load it right after people-data.js,
//                                  so the rest of the site needs no changes)
// GET /api/published            -> the same list as JSON
//
// "Published" means published now, or scheduled with a publish time that has passed — so
// scheduled interviews go live without any cron job. Only public fields ever leave here.

const C = require("../common");

module.exports = async (req, res) => {
  let list = [];
  try {
    list = (await C.listCandidates()).filter(C.isLive).map(C.toPublicInterview);
  } catch (err) {
    console.error("[published] failed:", (err && err.stack) || err);
  }

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
  if ((req.query || {}).format === "js") {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    // JSON.stringify output is a valid JS literal except for U+2028/2029, escaped here.
    const json = JSON.stringify(list)
      .split(String.fromCharCode(0x2028)).join("\\u2028")
      .split(String.fromCharCode(0x2029)).join("\\u2029");
    return res.status(200).send(`(function(){var p=${json};if(typeof INTERVIEWS!=="undefined"){p.forEach(function(x){if(!INTERVIEWS.some(function(e){return e.slug===x.slug})){INTERVIEWS.push(x)}})}})();`);
  }
  return res.status(200).json(list);
};
