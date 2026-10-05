// Tells IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver...) the moment an interview is
// published, updated or unpublished, so they don't wait for the next sitemap crawl. Google doesn't
// use IndexNow; it picks changes up from /sitemap.xml.
//
// Opt-in: set INDEXNOW_KEY (any 8-128 char string of letters, digits and dashes) in the Vercel
// project. Without it this does nothing. Never throws, never blocks a publish for more than a few
// seconds.

const SITE_URL = (process.env.SITE_URL || "https://www.productmoat.com").replace(/\/+$/, "");

async function ping(paths) {
  const key = process.env.INDEXNOW_KEY;
  const urlList = (paths || []).filter(Boolean).map(p => SITE_URL + p);
  if (!key || !urlList.length) return false;
  try {
    const resp = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE_URL).host, key, keyLocation: `${SITE_URL}/indexnow.txt`, urlList }),
      signal: AbortSignal.timeout(4000)
    });
    return resp.ok;
  } catch (err) {
    console.error("[indexnow] ping failed:", (err && err.message) || err);
    return false;
  }
}

module.exports = { ping };
