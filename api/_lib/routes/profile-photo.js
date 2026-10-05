// Vercel Function - serves a mirrored profile photo (see "Profile photo" in ../common.js).
//
// GET ?id=<32 hex chars>. Public: the id is an unguessable hash of the source URL and the picture is
// the same one already shown on the person's public page, the map and the network.

const C = require("../common");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  try {
    const photo = await C.readProfilePhoto(String((req.query || {}).id || ""));
    if (!photo) return res.status(404).json({ error: "not_found" });
    res.setHeader("Content-Type", photo.type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=3600");
    res.setHeader("Content-Length", String(photo.buffer.length));
    res.statusCode = 200;
    return res.end(photo.buffer);
  } catch (err) {
    console.error("[profile-photo] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
