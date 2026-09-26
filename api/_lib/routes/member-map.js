// Vercel Function — the signed-in member's place on the map (the Map tab on their profile).
//
// GET -> { pins: [{ city, country, status, submittedAt }], interview: { location, url } | null }
//   pins       their "Put yourself on the map" submissions (matched by the LinkedIn-verified email),
//              newest first; status is pending | approved | rejected
//   interview  set when their published interview puts them on the map
//
// Only the caller's own records are ever returned.

const { list } = require("@vercel/blob");
const C = require("../common");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const session = C.memberSession(req);
  if (!session || !session.email) return res.status(401).json({ error: "not_authenticated" });
  const email = session.email.trim().toLowerCase();

  try {
    const { blobs } = await list({ prefix: "map-submissions/" });
    const pins = (await Promise.all(blobs.map(b => C.readJSON(b.pathname))))
      .filter(s => s && s.email && String(s.email).trim().toLowerCase() === email)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
      .map(s => ({ city: s.city || "", country: s.country || "", status: s.status || "pending", submittedAt: s.submittedAt || null }));

    const live = (await C.findCandidatesByEmail([email])).find(c => C.isLive(c) && typeof c.profile.lat === "number" && typeof c.profile.lng === "number");
    const interview = live ? { location: live.profile.location || "", url: C.toPublicInterview(live).url } : null;

    return res.status(200).json({ pins, interview });
  } catch (err) {
    console.error("[member-map] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
