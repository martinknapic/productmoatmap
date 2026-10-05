// Vercel Function — the signed-in member's own profile details (My profile page).
//
// GET  -> { account: { name, email, picture }, details }   details = what they've saved (or blanks)
// POST { details } -> validates and saves them on the member's private record
//
// Everything is keyed by the LinkedIn-verified email in the session, so people can only ever read or
// change their own. The details are private: they're used to prefill Apply and Put yourself on the
// map, and are never published by themselves.

const C = require("../common");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const session = C.memberSession(req);
  if (!session || !session.email) return res.status(401).json({ error: "not_authenticated" });

  try {
    if (req.method === "GET") {
      const member = await C.readMember(session.email);
      const details = (member && member.details) || C.cleanMemberDetails({ name: session.name });
      return res.status(200).json({ account: { name: session.name, email: session.email, picture: (member && member.picture) || session.picture || null }, details, saved: !!(member && member.details), network: C.isNetworkMember(member) });
    }
    if (req.method === "POST" && (req.body || {}).photo) {
      // The member's own picture (cropped square in their browser): becomes the round picture everywhere.
      const photo = req.body.photo;
      const img = C.parsePhotoDataUrl(photo.dataUrl);
      if (!img) return res.status(400).json({ error: "invalid_photo" });
      if (!(Number(photo.width) >= 200) || !(Number(photo.height) >= 200)) return res.status(400).json({ error: "photo_too_small" });
      if (!(await C.readMember(session.email))) await C.upsertMember(session, false, "profile");
      const picture = await C.saveProfilePhoto(img);
      await C.applyMemberPhoto(session, picture);
      return res.status(200).json({ ok: true, picture });
    }
    if (req.method === "POST") {
      const details = C.cleanMemberDetails((req.body || {}).details);
      if (!details.name) return res.status(400).json({ error: "missing_name" });
      await C.saveMemberDetails(session, details);
      return res.status(200).json({ ok: true, details });
    }
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (err) {
    console.error("[member-profile] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
