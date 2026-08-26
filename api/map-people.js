// Vercel Function — public read endpoint for approved "Put yourself on the
// map" submissions, in the same shape app.js expects for a person. Only
// status:"approved" records (set via the backoffice moderation queue, see
// api/map-submissions.js) are returned, and only the public-facing fields —
// email is never included in this response even though it's approved,
// since submissions are private blobs internally. Fails open to an empty
// array so the globe still renders its static dataset if Blob storage isn't
// configured yet or the read fails.

const { list, get } = require("@vercel/blob");

const PREFIX = "map-submissions/";

async function readSubmission(pathname) {
  const result = await get(pathname, { access: "private" });
  if (!result || !result.stream) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  try {
    const { blobs } = await list({ prefix: PREFIX });
    const submissions = (await Promise.all(blobs.map(b => readSubmission(b.pathname)))).filter(Boolean);

    const people = submissions
      .filter(s => s.status === "approved")
      .map(s => ({
        name: s.name,
        role: s.role || "",
        company: s.company || "",
        city: s.city || "",
        country: s.country || "",
        photo: s.picture || null,
        lat: s.lat,
        lng: s.lng
      }));

    return res.status(200).json(people);
  } catch (err) {
    console.error("[map-people] read failed:", (err && err.stack) || err);
    return res.status(200).json([]);
  }
};
