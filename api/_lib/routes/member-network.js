// Vercel Function — the alumni network (members-only directory of interviewed product people).
//
// GET  -> { joined, people? }   people only when the caller has opted in
// POST { join: true|false } -> opt in / leave
//
// The deal is reciprocal and explicit: ticking the box (on Apply, here, or on My profile) means you
// agree to be visible to other members — name, photo, role, company, location, focus, bio, links
// and email — once you've been interviewed, and in exchange you can browse the directory. Only
// people who are BOTH interviewed (published) AND opted in are listed. Leaving removes both.

const C = require("../common");

function focusTagsOf(candidate, member) {
  const tags = new Set();
  if (candidate.profile.focusTag) tags.add(candidate.profile.focusTag);
  ((member.details && member.details.focusTags) || []).forEach(t => tags.add(t));
  return [...tags];
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const session = C.memberSession(req);
  if (!session || !session.email) return res.status(401).json({ error: "not_authenticated" });

  try {
    if (req.method === "POST") {
      const join = (req.body || {}).join === true;
      await C.setNetworkOptIn(session, join, "network");
      return res.status(200).json({ ok: true, joined: join });
    }
    if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

    const me = await C.readMember(session.email);
    if (!C.isNetworkMember(me)) return res.status(200).json({ joined: false });

    const people = [];
    const seen = new Set();
    for (const c of (await C.listCandidates()).filter(C.isLive)) {
      // the member account behind this interview (LinkedIn-linked email first, application email second)
      let member = null;
      for (const email of [c.verified && c.verified.email, c.profile.email]) {
        if (!email) continue;
        const m = await C.readMember(email);
        if (m) { member = m; break; }
      }
      if (!C.isNetworkMember(member) || seen.has(member.email.toLowerCase())) continue;
      seen.add(member.email.toLowerCase());
      const pub = C.toPublicInterview(c);
      people.push({
        name: c.profile.name,
        role: c.profile.role,
        company: c.profile.company,
        location: c.profile.location,
        focusTags: focusTagsOf(c, member),
        snippet: c.profile.snippet,
        photo: c.profile.photo || member.picture || null,
        links: { linkedin: c.profile.linkedin, website: c.profile.website, twitter: c.profile.twitter },
        email: member.email,
        interviewUrl: pub.url,
        you: member.email.toLowerCase() === session.email.toLowerCase()
      });
    }
    people.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json({ joined: true, people });
  } catch (err) {
    console.error("[member-network] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
