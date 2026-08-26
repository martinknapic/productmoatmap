// Vercel Function — accepts a "Put yourself on the map" submission and stores
// it as a pending record in Vercel Blob (needs the BLOB_READ_WRITE_TOKEN env
// var, added automatically once Blob storage is connected to this Vercel
// project). Records are private — they hold an email address — and only
// readable server-side with that token, never via a public URL. Every
// submission goes into api/map-submissions.js's moderation queue first;
// nothing here writes straight to the public globe. See api/map-people.js
// for what actually ends up rendered.
//
// The name/email/picture came from a verified LinkedIn sign-in (join-map.html
// fetches them from /api/linkedin-profile before this call), same trust model
// as apply.html/recommend.html: the OAuth gate proves the visitor controls
// that LinkedIn account, this endpoint just persists what they submit.

const crypto = require("crypto");
const { put } = require("@vercel/blob");

function clip(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const body = req.body || {};
  const { name, email, picture, city, country, role, company, lat, lng } = body;

  if (!clip(name, 200) || !clip(email, 200)) {
    return res.status(400).json({ error: "missing_profile" });
  }
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "missing_location" });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: "invalid_location" });
  }

  const submission = {
    id: crypto.randomUUID(),
    name: clip(name, 200),
    email: clip(email, 200),
    picture: typeof picture === "string" ? clip(picture, 1000) : null,
    city: clip(city, 200),
    country: clip(country, 200),
    role: clip(role, 200),
    company: clip(company, 200),
    lat,
    lng,
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  try {
    await put(`map-submissions/${submission.id}.json`, JSON.stringify(submission), {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json"
    });
    return res.status(200).json({ ok: true, id: submission.id });
  } catch (err) {
    console.error("[join-map] blob write failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
