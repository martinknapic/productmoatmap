// Vercel Function — the standard interview question bank.
//
// GET  -> the current bank (public: questions.html shows it; falls back to the built-in default
//         in assets/questions-default.js until the admin saves a change).
// POST -> { sections } admin only. Replaces the bank. New invitations copy the bank at the
//         moment they're created; people already invited keep their own (editable) copy, so
//         changing the bank never rewrites someone's in-progress interview.

const C = require("./_lib/common");

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const bank = await C.readBank();
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json(bank);
    } catch (err) {
      return res.status(200).json(C.defaultBank());
    }
  }

  if (req.method === "POST") {
    if (!C.requireAdmin(req, res)) return;
    const sections = C.cleanSections((req.body || {}).sections);
    if (!sections) return res.status(400).json({ error: "invalid_sections" });
    try {
      const bank = { sections, updatedAt: new Date().toISOString() };
      await C.writeJSON(C.QUESTION_BANK_PATH, bank);
      return res.status(200).json({ ok: true, ...bank });
    } catch (err) {
      console.error("[question-bank] save failed:", (err && err.stack) || err);
      return res.status(500).json({ error: "storage_failed" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
};
