// Vercel Function - backoffice-only: everyone the site knows about, and their newsletter status.
//
// GET                    -> { users, newsletter }   fast, from our own records
// POST { action: "status" }          -> { statuses: { <email>: state }, list }   live double opt-in status
//                                       from the newsletter service, for the opted-in people
// POST { action: "sync", email }     -> add one opted-in member to the newsletter list now
// POST { action: "syncAll" }         -> add every opted-in member not yet on the list
//
// A "user" is anyone with a record here: a member (signed up / signed in with LinkedIn and saved a
// profile or newsletter choice), a candidate (applied, recommended, added by hand) or a map pin.
// The same person in several places is one row, matched on email. Newsletter opt-in lives on the
// member record; whether it reached the list, and the double opt-in state, come from the service
// (see ../newsletter.js).

const C = require("../common");
const N = require("../newsletter");
const { list } = require("@vercel/blob");

const norm = e => String(e || "").trim().toLowerCase();

async function readPins() {
  try {
    const { blobs } = await list({ prefix: C.MAP_PREFIX });
    return (await Promise.all(blobs.map(b => C.readJSON(b.pathname).catch(() => null)))).filter(Boolean);
  } catch (err) { return []; }
}

async function buildUsers() {
  const [members, candidates, pins] = await Promise.all([C.listMembers().catch(() => []), C.listCandidates().catch(() => []), readPins()]);
  const byKey = new Map();
  const row = (email, fallbackKey) => {
    const key = norm(email) || fallbackKey;
    if (!byKey.has(key)) byKey.set(key, { key, email: norm(email), name: "", picture: null, role: "", company: "", location: "", linkedin: "", member: null, candidate: null, pin: null, since: null });
    return byKey.get(key);
  };
  const earliest = (u, iso) => { if (iso && (!u.since || iso < u.since)) u.since = iso; };
  const fill = (u, o) => { Object.entries(o).forEach(([k, v]) => { if (!u[k] && v) u[k] = v; }); };

  candidates.forEach(c => {
    const u = row((c.verified && c.verified.email) || c.profile.email, `cand:${c.id}`);
    u.candidate = { id: c.id, status: c.status, source: c.source, published: c.status === "published" };
    fill(u, { name: c.profile.name, picture: c.profile.photo, role: c.profile.role, company: c.profile.company, location: c.profile.location, linkedin: c.profile.linkedin });
    earliest(u, c.createdAt);
    if (c.profile.email && norm(c.profile.email) !== u.email && byKey.has(norm(c.profile.email))) { /* same person under two emails: left as two rows */ }
  });
  members.forEach(m => {
    const u = row(m.email, `mem:${m.email}`);
    u.member = { source: m.source || "", newsletter: !!m.newsletter, newsletterAt: m.newsletterAt || (m.newsletter ? m.createdAt : null), sync: m.newsletterSync || null, network: !!(m.network && m.network.optedIn) };
    const d = m.details || {};
    fill(u, { name: m.name || d.name, picture: m.picture, role: d.role, company: d.company, location: d.location, linkedin: d.linkedin });
    earliest(u, m.createdAt);
  });
  pins.forEach(p => {
    const u = row(p.email, `pin:${p.id}`);
    u.pin = { status: p.status || "pending" };
    fill(u, { name: p.name, picture: p.picture, role: p.role, company: p.company, location: [p.city, p.country].filter(Boolean).join(", ") });
    earliest(u, p.submittedAt);
  });

  return [...byKey.values()].map(u => ({
    key: u.key, email: u.email, name: u.name, picture: u.picture, role: u.role, company: u.company, location: u.location, linkedin: u.linkedin,
    isMember: !!u.member, candidate: u.candidate, pin: u.pin, since: u.since,
    newsletter: { optedIn: !!(u.member && u.member.newsletter), at: u.member ? u.member.newsletterAt : null, source: u.member ? u.member.source : "", sync: u.member ? u.member.sync : null }
  })).sort((a, b) => String(b.since || "").localeCompare(String(a.since || "")));
}

async function listSummary() {
  if (!N.configured()) return { configured: false };
  try { return { configured: true, ...(await N.listInfo()) }; }
  catch (err) { return { configured: true, error: String((err && err.message) || "unreachable").slice(0, 160) }; }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!C.requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") return res.status(200).json({ users: await buildUsers(), newsletter: await listSummary() });
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
    const body = req.body || {};

    if (!N.configured()) return res.status(400).json({ error: "newsletter_not_configured" });

    if (body.action === "status") {
      const users = (await buildUsers()).filter(u => u.newsletter.optedIn && u.email);
      const info = await N.listInfo();
      const statuses = {};
      await N.mapLimit(users, 5, async u => {
        try { statuses[u.email] = N.statusOf(await N.findContact(u.email), info); }
        catch (err) { statuses[u.email] = { state: "error", error: String((err && err.message) || "").slice(0, 120) }; }
      });
      return res.status(200).json({ statuses, list: info });
    }

    const syncOne = async email => {
      const m = await C.readMember(email);
      if (!m || !m.newsletter) return { ok: false, error: "not_opted_in" };
      await C.syncMemberToList(m);
      return { ok: !!(m.newsletterSync && m.newsletterSync.state === "sent"), sync: m.newsletterSync };
    };

    if (body.action === "sync") {
      const r = await syncOne(norm(body.email));
      return res.status(r.ok ? 200 : 502).json(r);
    }
    if (body.action === "syncAll") {
      const todo = (await C.listMembers()).filter(m => m.newsletter && !(m.newsletterSync && m.newsletterSync.state === "sent"));
      const results = await N.mapLimit(todo, 4, m => syncOne(m.email));
      return res.status(200).json({ ok: true, attempted: todo.length, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
    }
    return res.status(400).json({ error: "unknown_action" });
  } catch (err) {
    console.error("[backoffice-users] failed:", (err && err.stack) || err);
    return res.status(500).json({ error: "server_error" });
  }
};
