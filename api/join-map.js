// Vercel Function — accepts a "Put yourself on the map" submission and stores
// it as a pending record in Vercel Blob (needs the BLOB_READ_WRITE_TOKEN env
// var, added automatically once Blob storage is connected to this Vercel
// project). Records are private — they hold an email address — and only
// readable server-side with that token, never via a public URL. Every
// submission goes into api/map-submissions.js's moderation queue first;
// nothing here writes straight to the public globe. See api/map-people.js
// for what actually ends up rendered.
//
// Who is submitting comes from the visitor's verified LinkedIn session cookie
// (set by api/linkedin-callback.js), never from the request body — the form only
// supplies the pin and its optional city / country / role / company. One pin per
// person: anyone already on the map (a pin that's pending, approved or removed, or a
// published interview with a location), matched on the verified email or LinkedIn
// ID, is refused with 409. A rejected pin doesn't count, so they can try again.

const { put } = require("@vercel/blob");
const C = require("./_lib/common");

function clip(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max).replace(/[<>]/g, "") : "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = C.memberSession(req);
  if (!session || (!session.email && !session.sub)) return res.status(401).json({ error: "not_verified" });

  const { city, country, role, company, lat, lng } = req.body || {};
  if (!clip(session.name, 200)) return res.status(400).json({ error: "missing_profile" });
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "missing_location" });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "invalid_location" });
  }

  try {
    const { pins, live, onMap } = await C.findMapPresence(session);
    if (onMap) {
      return res.status(409).json({ error: "already_on_map", state: live ? "published" : (pins[0] && pins[0].status) || "pending" });
    }

    const id = C.mapPinId(session);
    const submission = {
      id,
      name: clip(session.name, 200),
      email: clip(session.email, 200),
      linkedinId: clip(session.sub, 100),
      picture: typeof session.picture === "string" ? clip(session.picture, 1000) : null,
      city: clip(city, 200),
      country: clip(country, 200),
      role: clip(role, 200),
      company: clip(company, 200),
      lat,
      lng,
      status: "pending",
      submittedAt: new Date().toISOString()
    };

    // Only an earlier *rejected* pin of theirs may be replaced; otherwise the write must be a
    // first one, which is what stops two simultaneous submissions from both getting through.
    const replacingRejected = pins.some(p => p.id === id);
    try {
      await put(`${C.MAP_PREFIX}${id}.json`, JSON.stringify(submission), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: replacingRejected,
        contentType: "application/json"
      });
    } catch (err) {
      if (/already exists/i.test(String((err && err.message) || ""))) {
        return res.status(409).json({ error: "already_on_map", state: "pending" });
      }
      throw err;
    }
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error("[join-map] blob write failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
