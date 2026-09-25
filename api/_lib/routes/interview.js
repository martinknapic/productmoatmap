// Vercel Function — the public side of a person's personal questionnaire.
//
// The invitee opens /interview.html?t=<token>; the token is the candidate record's own id
// (unguessable, 192 bits) and is the only credential — no sign-in, nothing is ever listed.
// It only works once the admin has invited the person, and stops working if the link is
// revoked, the candidate was declined, or after publishing.
//
// GET  ?t=<token>                          -> profile, questionnaire, answers, status
// POST { t, profile?, answers?, custom? }  -> save (blocked while locked)
// POST { t, approve: true|false }          -> the person signals "I'm happy with this version"
//
// Editing after approving clears the approval (a changed version needs a fresh yes).

const C = require("../common");

const MAX_ANSWER = 2000;
const MAX_CUSTOM = 3;

function view(c) {
  const inv = c.invitation || {};
  return {
    profile: {
      name: c.profile.name, role: c.profile.role, company: c.profile.company, location: c.profile.location,
      yearsExperience: c.profile.yearsExperience, focusTag: c.profile.focusTag, linkedin: c.profile.linkedin,
      website: c.profile.website, twitter: c.profile.twitter, snippet: c.profile.snippet, pullQuote: c.profile.pullQuote,
      photo: c.profile.photo
    },
    questionnaire: c.questionnaire,
    answers: c.answers || {},
    custom: c.custom || [],
    customLimit: MAX_CUSTOM,
    status: c.status,
    locked: !!c.locked,
    approval: c.approval,
    estimatedPublishDate: inv.estimatedPublishDate || null,
    published: c.status === "published" ? { url: `/interview/${c.publish.category || C.defaultCategory(c.profile)}/${c.publish.slug}` } : null,
    updatedAt: c.answersUpdatedAt,
    registered: !!c.verified // a signed-in member has linked their LinkedIn identity to this page
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const raw = req.method === "GET" ? (req.query || {}).t : (req.body || {}).t;
  const c = await C.readCandidate(typeof raw === "string" ? raw : "").catch(() => null);
  if (!c || !c.invitation || !c.questionnaire || c.linkRevoked || c.declined) {
    return res.status(404).json({ error: "not_found" });
  }

  if (req.method === "GET" && (req.query || {}).preview) {
    // Private preview: exactly what would be published, visible only to the person this interview is
    // for (a signed-in member whose LinkedIn email is linked to it) and to admins.
    const member = C.memberSession(req);
    if (!member && !C.isAdminRequest(req)) return res.status(401).json({ error: "not_authenticated" });
    const email = member && member.email ? String(member.email).trim().toLowerCase() : "";
    const owner = !!email && [c.verified && c.verified.email, c.profile && c.profile.email].some(e => e && String(e).trim().toLowerCase() === email);
    if (!owner && !C.isAdminRequest(req)) return res.status(403).json({ error: "not_owner" });
    const pub = { ...c, publish: { ...c.publish, slug: (c.publish && c.publish.slug) || C.slugify(c.profile.name) } };
    return res.status(200).json({ preview: C.toPublicInterview(pub), approval: c.approval, status: c.status, locked: !!c.locked, missing: requiredMissing(c), asAdmin: !owner });
  }

  if (req.method === "GET") return res.status(200).json(view(c));
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const body = req.body || {};

  // A recommended person can register from this page (LinkedIn sign-in, then back here). The
  // member session proves who they are; holding the personal link proves which page is theirs.
  //   claim: true            link this page to the signed-in member (so "My interview" finds it,
  //                          and their email/photo fill in). Never overwrites an earlier link.
  //   claim + register: true also creates their private member profile (with the newsletter choice
  //                          they made next to the sign-up button) — same record as signup.html.
  if (body.claim === true) {
    const session = C.memberSession(req);
    if (!session || !session.email) return res.status(401).json({ error: "not_authenticated" });
    try {
      if (body.register === true) await C.upsertMember(session, body.newsletter === true, "interview");
      const mine = !c.verified || String(c.verified.email || "").toLowerCase() === session.email.toLowerCase();
      if (mine) {
        c.verified = { name: session.name || "", email: session.email };
        if (!c.profile.email) c.profile.email = C.cleanProfile({ email: session.email }).email;
        if (!c.profile.name) c.profile.name = C.cleanProfile({ name: session.name }).name;
        if (!c.profile.photo && session.picture) c.profile.photo = C.cleanProfile({ photo: session.picture }).photo;
        await C.saveCandidate(c);
      }
      return res.status(200).json({ ok: true, linked: mine, ...view(c), photo: c.profile.photo || null });
    } catch (err) {
      console.error("[interview] claim failed:", (err && err.stack) || err);
      return res.status(500).json({ error: "storage_failed" });
    }
  }

  if (c.locked || c.status === "published") return res.status(423).json({ error: "locked", ...view(c) });

  try {
    if (typeof body.approve === "boolean") {
      if (body.approve) {
        // must have the required questions answered (profile-backed ones count via the profile)
        const missing = requiredMissing(c);
        if (missing.length) return res.status(400).json({ error: "missing_required", missing });
        c.approval = { approved: true, by: "user", at: new Date().toISOString() };
      } else {
        c.approval = { approved: false, by: null, at: null };
      }
      await C.saveCandidate(c);
      return res.status(200).json({ ok: true, ...view(c) });
    }

    if (body.profile && typeof body.profile === "object") {
      const allowed = ["name", "role", "company", "location", "yearsExperience", "focusTag", "linkedin", "website", "twitter", "snippet", "pullQuote"];
      const patch = {};
      allowed.forEach(k => { if (k in body.profile) patch[k] = body.profile[k]; });
      c.profile = C.cleanProfile({ ...c.profile, ...patch });
    }

    if (body.answers && typeof body.answers === "object") {
      const ids = new Set(c.questionnaire.sections.flatMap(s => s.questions.filter(q => !q.fromProfile).map(q => q.id)));
      const answers = {};
      Object.keys(body.answers).forEach(id => {
        if (!ids.has(id)) return;
        const text = C.clip(body.answers[id], MAX_ANSWER);
        if (text) answers[id] = text;
      });
      c.answers = answers;
    }
    if (Array.isArray(body.custom)) {
      c.custom = body.custom.slice(0, MAX_CUSTOM)
        .map(x => ({ q: C.clip(x && x.q, 200), a: C.clip(x && x.a, MAX_ANSWER) })).filter(x => x.q && x.a);
    }

    c.answersUpdatedAt = new Date().toISOString();
    if (c.approval && c.approval.approved) c.approval = { approved: false, by: null, at: null };
    await C.saveCandidate(c);
    return res.status(200).json({ ok: true, ...view(c) });
  } catch (err) {
    console.error("[interview] save failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};

const PROFILE_FIELD = { q1: "name", q2: "role", q3: "company", q4: "location", q5: "yearsExperience" };

function requiredMissing(c) {
  return c.questionnaire.sections.flatMap(s => s.questions).filter(q => {
    if (!q.required) return false;
    if (q.fromProfile) {
      const v = c.profile[PROFILE_FIELD[q.id]];
      return v == null || String(v).trim() === "";
    }
    return !(typeof c.answers[q.id] === "string" && c.answers[q.id].trim());
  }).map(q => q.id);
}
