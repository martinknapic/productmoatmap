// Vercel Function — receives "Recommend a product hero" and files the recommended person in
// the backoffice candidate list (source: recommended). The recommender is identified by their
// verified LinkedIn session; the private details never appear on any public page.

const C = require("./_lib/common");

// linkedin.com/in/jane-doe-1a2b3c -> "Jane Doe" (a starting guess the admin can correct)
function guessName(url) {
  const m = /linkedin\.com\/in\/([^/?#]+)/i.exec(url || "");
  if (!m) return "";
  return decodeURIComponent(m[1]).replace(/-[0-9a-f]{5,}$/i, "").split(/[-_]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const session = C.memberSession(req);
  if (!session) return res.status(401).json({ error: "not_verified" });

  const b = req.body || {};
  const linkedin = C.clip(b.candidateLinkedin, 300);
  if (!linkedin) return res.status(400).json({ error: "missing_linkedin" });

  try {
    const c = C.blankCandidate("recommended", { name: guessName(linkedin), linkedin }, {
      recommendation: {
        reason: C.clip(b.reason, 2000),
        recommenderName: C.clip(b.yourName, 200) || session.name || "",
        recommenderEmail: C.clip(b.yourEmail, 200) || session.email || "",
        stayAnonymous: b.stayAnonymous === true
      }
    });
    await C.saveCandidate(c);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[recommend] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
