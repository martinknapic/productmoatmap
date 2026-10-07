// Vercel Function — persists a private member profile (name/email/picture,
// taken from the signed session, not from anything the client asserts) plus
// the newsletter opt-in/out choice made on signup.html's consent screen.
//
// This is what makes "creating a private profile" concrete: api/linkedin-
// callback.js sets the pm_session cookie for apply/recommend/join-map too,
// but only this endpoint — reached only from signup.html, after the visitor
// has seen the consent copy — writes anything to storage. Requires an
// existing pm_session (i.e. the visitor must have just completed LinkedIn
// sign-in on signup.html) so this can't be called to enroll someone else.

const crypto = require("crypto");
const C = require("./_lib/common");

// Where the newsletter tick-box was checked. signup.html always calls this (it
// creates the profile); apply/recommend/join-map only call it when the visitor
// explicitly ticked "Subscribe me to the newsletter" next to the LinkedIn button.
const ALLOWED_SOURCES = new Set(["signup", "apply", "recommend", "join-map"]);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const session = C.memberSession(req);

  if (!session || !session.email) {
    return res.status(401).json({ error: "not_authenticated" });
  }

  const newsletter = !!(req.body && req.body.newsletter === true);
  const source = req.body && ALLOWED_SOURCES.has(req.body.source) ? req.body.source : "signup";
  const emailKey = crypto.createHash("sha256").update(session.email.toLowerCase()).digest("hex");

  try {
    const record = await C.upsertMember(session, newsletter, source);
    return res.status(200).json({ ok: true, newsletter: record.newsletter });
  } catch (err) {
    console.error("[member-signup] blob write failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
