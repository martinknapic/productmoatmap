// Vercel Function — the signed-in member's place on the map (the Map tab on their profile).
//
// GET -> { pins: [{ city, country, status, submittedAt, approvedAt, name, role, company, picture, lat, lng }],
//         interview: { location, url, slug, lat, lng } | null, onMap }
//   pins       one entry at most: the single submission that represents this person (see
//              C.dedupeMapPins - the pin that's on the map, or failing that their latest one).
//              status is pending | approved | rejected | removed; approvedAt is set once the pin
//              was first approved (kept even if it's since been removed).
//   interview  set when their published interview puts them on the map
//   The pin's coordinates and profile fields are returned so map.html?me=1 can fly to their own pin
//   (even while it's pending review and not on the public map yet).
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
    const pin = C.dedupeMapPins(pins)[0] || null;
    const pub = live ? C.toPublicInterview(live) : null;
    const interview = live ? { location: live.profile.location || "", url: pub.url, slug: pub.slug, lat: pub.lat, lng: pub.lng } : null;
    return res.status(200).json({
      pins: pin ? [{
        city: pin.city || "", country: pin.country || "", status: pin.status || "pending",
        submittedAt: pin.submittedAt || null, approvedAt: pin.approvedAt || null,
        name: pin.name || "", role: pin.role || "", company: pin.company || "", picture: pin.picture || null,
        lat: typeof pin.lat === "number" ? pin.lat : null, lng: typeof pin.lng === "number" ? pin.lng : null
      }] : [],
      interview,
      onMap
    });
  } catch (err) {
    console.error("[member-map] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
