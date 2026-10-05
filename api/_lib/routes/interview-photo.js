// Vercel Function - serves a featured interview photo (see "Featured photo" in ../common.js).
//
// GET ?id=<32 hex chars>
//   - once the interview is live: anyone, briefly cached (the id changes with every upload)
//   - before that: only the person it belongs to (signed-in member with the matching email) and admins
// A photo that has since been replaced or removed is a 404.

const C = require("../common");
const { sized } = require("../image");

const norm = e => String(e || "").trim().toLowerCase();

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const id = String((req.query || {}).id || "");

  try {
    const photo = await C.readPhoto(id);
    if (!photo) { console.error("[interview-photo] no stored photo for id", id); return res.status(404).json({ error: "not_found" }); }
    const c = await C.readCandidate(photo.meta.candidateId).catch(() => null);
    if (!c || !c.featuredPhoto || c.featuredPhoto.id !== id) { console.error("[interview-photo] photo no longer current for id", id); return res.status(404).json({ error: "not_found" }); }

    const live = C.isLive(c);
    if (!live) {
      const session = C.memberSession(req);
      const email = session ? norm(session.email) : "";
      const owner = !!email && [c.verified && c.verified.email, c.profile && c.profile.email].some(e => norm(e) === email);
      if (!C.isAdminRequest(req) && !owner) { console.error("[interview-photo] not live and requester is neither owner nor admin"); return res.status(404).json({ error: "not_found" }); }
    }

    const out = await sized(req, photo.meta.type, photo.buffer); // ?w=<px> returns a smaller WebP
    if (out.varyAccept) res.setHeader("Vary", "Accept");
    res.setHeader("Content-Type", out.type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Cached for a while (a photo never changes under its id), but not "forever": if the person removes
    // it, it stops being served from browsers within the hour and from the CDN within minutes.
    res.setHeader("Cache-Control", live ? "public, max-age=3600, s-maxage=300" : "private, no-store");
    res.setHeader("Content-Length", String(out.buffer.length));
    res.statusCode = 200;
    return res.end(out.buffer);
  } catch (err) {
    console.error("[interview-photo] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
