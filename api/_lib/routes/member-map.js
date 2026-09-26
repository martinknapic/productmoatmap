// Vercel Function — the signed-in member's place on the map (the Map tab on their profile).
//
// GET -> { pins: [{ city, country, status, submittedAt }], interview: { location, url } | null, onMap }
//   pins       their "Put yourself on the map" submissions (matched by the LinkedIn-verified email
//              or LinkedIn ID), newest first; status is pending | approved | rejected | removed
//   interview  set when their published interview puts them on the map
//   onMap      true when they can't add another pin (see C.findMapPresence)
//
// Only the caller's own records are ever returned.

const C = require("../common");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const session = C.memberSession(req);
  if (!session || !session.email) return res.status(401).json({ error: "not_authenticated" });

  try {
    const { pins, live, onMap } = await C.findMapPresence(session);
    const interview = live ? { location: live.profile.location || "", url: C.toPublicInterview(live).url } : null;
    return res.status(200).json({
      pins: pins.map(s => ({ city: s.city || "", country: s.country || "", status: s.status || "pending", submittedAt: s.submittedAt || null })),
      interview,
      onMap
    });
  } catch (err) {
    console.error("[member-map] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
