// Vercel Function — backoffice-only: the candidate pipeline.
//
// Every person who applies, is recommended, or is added by hand lands here as a candidate
// record (candidates/<id>.json). The admin invites them (manually, by email or LinkedIn),
// which creates their personal questionnaire; the admin can edit its questions and the
// answers, mark it ready or lock it on the person's behalf, then schedule/publish it.
//
// GET  ?id=<id>  -> one candidate (+ the public preview shape)
// GET            -> every candidate, newest first
// POST { action, id?, ... } -> see the switch below.

const C = require("../common");

const STATUS_ACTIONS_NEED_ID = new Set([
  "update", "invite", "setQuestionnaire", "resetQuestionnaire", "setAnswers", "approve", "lock", "decline",
  "revokeLink", "setPublishing", "publish", "unpublish", "delete"
]);

function withPreview(c) {
  return { ...c, preview: c.publish && c.publish.slug ? C.toPublicInterview(c) : C.toPublicInterview({ ...c, publish: { ...c.publish, slug: c.publish.slug || C.slugify(c.profile.name) } }) };
}

const isDate = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isDateTime = v => typeof v === "string" && !Number.isNaN(Date.parse(v));

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!C.requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const id = (req.query || {}).id;
      if (id) {
        const c = await C.readCandidate(id);
        return c ? res.status(200).json(withPreview(c)) : res.status(404).json({ error: "not_found" });
      }
      return res.status(200).json(await C.listCandidates());
    }
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    const body = req.body || {};
    const action = body.action;

    if (action === "create") {
      const profile = C.cleanProfile(body.profile);
      if (!profile.name) return res.status(400).json({ error: "missing_name" });
      const c = C.blankCandidate("manual", profile, { notes: C.clip(body.notes, 2000) });
      await C.saveCandidate(c);
      return res.status(200).json({ ok: true, id: c.id });
    }

    if (!STATUS_ACTIONS_NEED_ID.has(action)) return res.status(400).json({ error: "unknown_action" });

    const c = await C.readCandidate(body.id);
    if (!c) return res.status(404).json({ error: "not_found" });

    switch (action) {
      case "update": {
        if (body.profile) c.profile = C.cleanProfile({ ...c.profile, ...body.profile });
        if (typeof body.notes === "string") c.notes = C.clip(body.notes, 4000);
        break;
      }

      case "invite": {
        // Creates (or refreshes) the personal questionnaire and records that the invitation
        // was sent. Sending itself is manual — the admin pastes the link into an email or a
        // LinkedIn message (see backoffice/candidate.html).
        const channel = body.channel === "linkedin" ? "linkedin" : "email";
        if (!c.questionnaire) c.questionnaire = { sections: (await C.readBank()).sections };
        const est = body.estimatedPublishDate;
        c.invitation = {
          channel,
          sentAt: (c.invitation && c.invitation.sentAt) || new Date().toISOString(),
          estimatedPublishDate: isDate(est) ? est : (c.invitation && c.invitation.estimatedPublishDate) || null
        };
        c.linkRevoked = false;
        break;
      }

      case "setQuestionnaire": {
        const sections = C.cleanSections(body.sections);
        if (!sections) return res.status(400).json({ error: "invalid_sections" });
        c.questionnaire = { sections };
        break;
      }

      case "resetQuestionnaire": {
        c.questionnaire = { sections: (await C.readBank()).sections };
        break;
      }

      case "setAnswers": {
        // Admin editing on the person's behalf.
        const ids = new Set(((c.questionnaire && c.questionnaire.sections) || []).flatMap(s => s.questions.map(q => q.id)));
        const answers = {};
        Object.keys(body.answers || {}).forEach(id => {
          const v = C.clip(body.answers[id], 4000);
          if (ids.has(id) && v) answers[id] = v;
        });
        c.answers = answers;
        c.custom = (Array.isArray(body.custom) ? body.custom : []).slice(0, 10)
          .map(x => ({ q: C.clip(x && x.q, 300), a: C.clip(x && x.a, 4000) })).filter(x => x.q && x.a);
        c.answersUpdatedAt = new Date().toISOString();
        c.approval = { approved: false, by: null, at: null }; // edited -> needs re-approval
        break;
      }

      case "approve": {
        const on = body.approved !== false;
        c.approval = on ? { approved: true, by: "admin", at: new Date().toISOString() } : { approved: false, by: null, at: null };
        break;
      }

      case "lock": {
        const on = body.locked !== false;
        if (!on && C.isLive(c)) return res.status(400).json({ error: "unpublish_first" });
        c.locked = on;
        c.lockedAt = on ? new Date().toISOString() : null;
        if (!on) c.publish.scheduledPublishAt = null;
        break;
      }

      case "decline": c.declined = body.declined !== false; break;
      case "revokeLink": c.linkRevoked = body.revoked !== false; break;

      case "setPublishing": {
        const pub = c.publish;
        if (body.category !== undefined) {
          if (!C.CATEGORIES.includes(body.category)) return res.status(400).json({ error: "invalid_category" });
          pub.category = body.category;
        }
        if (typeof body.foreword === "string") pub.foreword = C.clip(body.foreword, 2000);
        if (body.displayDate !== undefined) {
          if (body.displayDate !== null && body.displayDate !== "" && !isDate(body.displayDate)) return res.status(400).json({ error: "invalid_date" });
          pub.displayDate = body.displayDate || null;
        }
        if (body.scheduledPublishAt !== undefined) {
          if (body.scheduledPublishAt && !isDateTime(body.scheduledPublishAt)) return res.status(400).json({ error: "invalid_date" });
          pub.scheduledPublishAt = body.scheduledPublishAt ? new Date(body.scheduledPublishAt).toISOString() : null;
        }
        if (body.estimatedPublishDate !== undefined && c.invitation) {
          c.invitation.estimatedPublishDate = isDate(body.estimatedPublishDate) ? body.estimatedPublishDate : null;
        }
        if (typeof body.slug === "string" && !pub.publishedAt) {
          const slug = C.slugify(body.slug);
          if ((await C.takenSlugs(c.id)).has(slug)) return res.status(409).json({ error: "slug_taken" });
          pub.slug = slug;
        }
        if (body.profile) c.profile = C.cleanProfile({ ...c.profile, ...body.profile });
        break;
      }

      case "publish": {
        // mode "now" publishes immediately; mode "schedule" goes live at publish.scheduledPublishAt.
        if (!c.locked) return res.status(400).json({ error: "lock_first" });
        if (!c.profile.name) return res.status(400).json({ error: "missing_name" });
        const pub = c.publish;
        if (!pub.slug) {
          const taken = await C.takenSlugs(c.id);
          const base = C.slugify(c.profile.name);
          let slug = base, n = 2;
          while (taken.has(slug)) slug = `${base}-${n++}`;
          pub.slug = slug;
        }
        if (!pub.category) pub.category = C.defaultCategory(c.profile);
        if (body.mode === "now") {
          pub.publishedAt = new Date().toISOString();
          pub.scheduledPublishAt = null;
          if (!pub.displayDate) pub.displayDate = pub.publishedAt.slice(0, 10);
        } else if (body.mode === "schedule") {
          if (!pub.scheduledPublishAt) return res.status(400).json({ error: "missing_schedule" });
          if (!pub.displayDate) pub.displayDate = pub.scheduledPublishAt.slice(0, 10);
        } else {
          return res.status(400).json({ error: "invalid_mode" });
        }
        break;
      }

      case "unpublish": {
        c.publish.publishedAt = null;
        c.publish.scheduledPublishAt = null;
        break;
      }

      case "delete": {
        await C.deleteCandidate(c.id);
        return res.status(200).json({ ok: true, deleted: true });
      }
    }

    await C.saveCandidate(c);
    return res.status(200).json({ ok: true, candidate: withPreview(c) });
  } catch (err) {
    console.error("[candidates] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "storage_failed" });
  }
};
