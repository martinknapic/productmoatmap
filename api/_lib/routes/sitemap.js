// Vercel Function: /sitemap.xml, generated from the live data so a newly published interview is
// listed (and an unpublished one dropped) without anyone touching a file.

const C = require("../common");
const S = require("../seo");

// Public pages that aren't interviews. Anything private or noindex stays out of here.
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/map", priority: "0.7", changefreq: "weekly" },
  { path: "/about", priority: "0.5", changefreq: "monthly" },
  { path: "/apply", priority: "0.6", changefreq: "monthly" },
  { path: "/why-apply", priority: "0.5", changefreq: "monthly" },
  { path: "/process", priority: "0.5", changefreq: "monthly" },
  { path: "/questions", priority: "0.4", changefreq: "monthly" },
  { path: "/privacy", priority: "0.2", changefreq: "yearly" }
];

const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const day = v => (/^\d{4}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : null);

module.exports = async (req, res) => {
  let live = [];
  try {
    live = (await C.listCandidates()).filter(C.isLive);
  } catch (err) {
    console.error("[sitemap] storage failed:", (err && err.stack) || err);
  }
  const touched = {};
  live.forEach(c => { if (c.publish && c.publish.slug) touched[c.publish.slug] = day(c.updatedAt); });

  const interviews = S.allInterviews(live.map(C.toPublicInterview));
  const dates = interviews.map(p => day(touched[p.slug]) || day(p.publishedDate)).filter(Boolean).sort();
  const newest = dates[dates.length - 1];

  const urls = STATIC_PAGES.map(s => ({ loc: S.SITE_URL + (s.path === "/" ? "/" : s.path), lastmod: s.path === "/" ? newest : null, changefreq: s.changefreq, priority: s.priority }));
  interviews.forEach(p => urls.push({ loc: S.SITE_URL + S.urlPath(p), lastmod: day(touched[p.slug]) || day(p.publishedDate), changefreq: "monthly", priority: "0.8" }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url>\n    <loc>${xml(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ""}    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
  return res.status(200).send(body);
};
