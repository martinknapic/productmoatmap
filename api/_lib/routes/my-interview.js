// Vercel Function — "My interview" for a signed-in member.
//
// Looks up the caller's own candidate record by the LinkedIn-verified email in their member
// session (pm_session) and reports where they stand, so the nav's "My interview" link can send
// them to their private questionnaire, or explain how to apply if there's nothing yet.
//
// GET -> { state, ... }
//   none       no record for this email (or it was declined)
//   applied    we have their application/recommendation, no invitation yet
//   invited    invited and the questionnaire is open -> { token }  (interview.html?t=<token>)
//   published  interview is live -> { url }
//
// Matching is by email only, so an admin who adds someone by hand should use the email
// tied to their LinkedIn account for the link to find them.

const C = require("../common");

const RANK = { published: 4, invited: 3, applied: 2, none: 0 };

function classify(c) {
  if (c.declined) return { state: "none" };
  if (C.isLive(c)) return { state: "published", url: `/interview/${(c.publish && c.publish.category) || C.defaultCategory(c.profile)}/${c.publish.slug}` };
  if (c.invitation && c.questionnaire && !c.linkRevoked) return { state: "invited", token: c.id, status: c.status, locked: !!c.locked };
  return { state: "applied" };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const session = C.memberSession(req);
  if (!session || !session.email) return res.status(401).json({ error: "not_authenticated" });
  const email = session.email.trim().toLowerCase();

  try {
    const mine = (await C.listCandidates()).filter(c =>
      [c.profile && c.profile.email, c.verified && c.verified.email].some(e => e && e.trim().toLowerCase() === email)
    );
    let best = { state: "none" };
    mine.forEach(c => { const r = classify(c); if (RANK[r.state] > RANK[best.state]) best = r; });
    return res.status(200).json(best);
  } catch (err) {
    console.error("[my-interview] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
