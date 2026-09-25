// Vercel Function — receives the "Apply to be featured" form and files it in the backoffice
// candidate list (source: applied). Identity comes from the visitor's verified LinkedIn
// session cookie (set by api/linkedin-callback.js), not from anything the form claims.

const C = require("./_lib/common");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const session = C.memberSession(req);
  if (!session) return res.status(401).json({ error: "not_verified" });

  const b = req.body || {};
  const links = b.links || {};
  const profile = C.cleanProfile({
    name: b.name || session.name,
    email: b.contactEmail || session.email,
    phone: b.contactPhone,
    role: b.role,
    company: b.company,
    location: b.location,
    yearsExperience: b.yearsExperience,
    focusTag: b.focusTag,
    linkedin: links.linkedin,
    website: links.website,
    twitter: links.twitter,
    snippet: b.snippet,
    pullQuote: b.pullQuote,
    photo: session.picture || ""
  });
  if (!profile.name || !profile.role || !profile.company) return res.status(400).json({ error: "missing_fields" });

  try {
    const c = C.blankCandidate("applied", profile, {
      verified: { name: session.name || "", email: session.email || "" }
    });
    await C.saveCandidate(c);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[apply] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
