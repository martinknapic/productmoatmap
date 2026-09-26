// Vercel Function — receives the "Apply to be featured" form and files it in the backoffice
// candidate list (source: applied). Identity comes from the visitor's verified LinkedIn
// session cookie (set by api/linkedin-callback.js), not from anything the form claims.

const C = require("../common");

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
    // One application per person: anyone already on the candidate list (applied, invited,
    // published...) can't apply again. Declined applications don't count. Matched on the
    // verified LinkedIn email and on the contact email typed into the form.
    const existing = (await C.findCandidatesByEmail([session.email, profile.email])).filter(c => !c.declined);
    if (existing.length) {
      const live = existing.find(C.isLive);
      const state = live ? "published" : existing.some(c => c.invitation) ? "invited" : "applied";
      return res.status(409).json({ error: "already_applied", state });
    }

    const networkOptIn = b.networkOptIn === true; // explicit tick on the form; never assumed
    const c = C.blankCandidate("applied", profile, {
      verified: { name: session.name || "", email: session.email || "" },
      networkOptIn: networkOptIn ? { optedIn: true, at: new Date().toISOString() } : null
    });
    await C.saveCandidate(c);
    if (networkOptIn) await C.setNetworkOptIn(session, true, "apply");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[apply] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
