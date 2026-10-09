// Shared helpers for the candidate / interview functions. The underscore prefix keeps
// Vercel from exposing this file as a route of its own.

const crypto = require("crypto");
const { list, get, put, del } = require("@vercel/blob");
const defaults = require("../../assets/questions-default.js");

const session = require("./session");
const { parseCookies } = session;

function adminSession(req) { return session.fromHeader("admin", req.headers.cookie); }
function memberSession(req) { return session.fromHeader("member", req.headers.cookie); }

// Admin = a backoffice session, or a signed-in member whose LinkedIn email is on the admin list.
// (Used to let admins see private previews while browsing the public site.)
const adminEmails = session.adminEmails;
function isAdminRequest(req) {
  if (adminSession(req)) return true;
  const m = memberSession(req);
  return !!(m && m.email && adminEmails().includes(String(m.email).trim().toLowerCase()));
}

// Returns the admin session, or sends 401 and returns null.
function requireAdmin(req, res) {
  const session = adminSession(req);
  if (!session) res.status(401).json({ error: "not_authenticated" });
  return session;
}

function clip(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// ---------- Blob storage (all records are private JSON) ----------

async function readJSON(pathname) {
  const result = await get(pathname, { access: "private" });
  if (!result || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

function writeJSON(pathname, value) {
  return put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

// ---------- Featured photo (uploaded by the person, shown above their story) ----------
// Distinct from profile.photo, the small round picture that comes from LinkedIn. The upload is
// resized in the browser and stored as a private JSON blob (interview-photos/<id>.json: the image
// as base64 plus which candidate it belongs to); api/_lib/routes/
// interview-photo.js serves it: publicly once the interview is live, otherwise only to its owner
// and admins. The id is random and changes on every upload, so a replaced photo never shows a stale
// copy and the candidate's personal link token never appears in a public URL.

const PHOTO_PREFIX = "interview-photos/";
const PHOTO_ID_RE = /^[a-f0-9]{32}$/;
const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

// Does the data start with the magic bytes of the type it claims to be?
function photoMagicOk(type, buf) {
  if (type === "image/jpeg") return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (type === "image/png") return buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return buf.length > 12 && buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP";
  return false;
}

// "data:image/jpeg;base64,...." -> { type, buffer }, or null if it isn't an acceptable image.
function parsePhotoDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(typeof dataUrl === "string" ? dataUrl : "");
  if (!m) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (!buffer.length || buffer.length > PHOTO_MAX_BYTES || !photoMagicOk(m[1], buffer)) return null;
  return { type: m[1], buffer };
}

// Stored as ONE private JSON blob (base64 inside), through the same writeJSON / readJSON path every
// other record on this site uses, rather than as a separate binary blob. Photos are capped at 3 MB
// (about 4 MB as base64), well within what that path handles.
async function savePhoto(candidateId, { type, buffer, width, height }) {
  const id = crypto.randomBytes(16).toString("hex");
  await writeJSON(`${PHOTO_PREFIX}${id}.json`, { candidateId, type, width, height, data: buffer.toString("base64"), at: new Date().toISOString() });
  return id;
}

async function readPhoto(id) {
  if (!PHOTO_ID_RE.test(id || "")) return null;
  const rec = await readJSON(`${PHOTO_PREFIX}${id}.json`);
  if (!rec || typeof rec.data !== "string") return null;
  const { data, ...meta } = rec;
  return { meta, buffer: Buffer.from(data, "base64") };
}

function deletePhoto(id) {
  if (!PHOTO_ID_RE.test(id || "")) return Promise.resolve();
  return del(`${PHOTO_PREFIX}${id}.json`).catch(() => {});
}

// ---------- Profile photo (the round picture): mirrored from LinkedIn into our own storage ----------
// LinkedIn photo URLs are signed and expire (the "e=" timestamp), so hotlinking them eventually leaves
// a broken image. Whenever a LinkedIn photo URL is saved we download it once and keep our own copy
// (profile-photos/<id>.json, same base64-JSON shape as the featured photo) served by
// api/_lib/routes/profile-photo.js. The id is derived from the source URL, so saving the same URL again
// overwrites the same blob. If the download fails we keep the original URL, so a save never fails on it.

const PROFILE_PHOTO_PREFIX = "profile-photos/";
const PROFILE_PHOTO_URL_RE = /^\/api\/profile-photo\?id=[a-f0-9]{32}$/;

function isLinkedInPhotoUrl(u) {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "licdn.com" || url.hostname.endsWith(".licdn.com"));
  } catch (e) { return false; }
}

async function mirrorProfilePhoto(url) {
  if (!isLinkedInPhotoUrl(url)) return url;
  try {
    const resp = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
    const type = String(resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!resp.ok || !PHOTO_TYPES[type]) return url;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (!buffer.length || buffer.length > PHOTO_MAX_BYTES || !photoMagicOk(type, buffer)) return url;
    const id = crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
    await writeJSON(`${PROFILE_PHOTO_PREFIX}${id}.json`, { type, data: buffer.toString("base64"), at: new Date().toISOString() });
    return `/api/profile-photo?id=${id}`;
  } catch (err) {
    console.error("[profile-photo] mirror failed, keeping original url:", (err && err.message) || err);
    return url;
  }
}

// The person's own upload (already cropped square and resized in their browser). Random id, so a
// replaced picture never shows a stale cached copy. Returns the site path to store on the records.
async function saveProfilePhoto({ type, buffer }) {
  const id = crypto.randomBytes(16).toString("hex");
  await writeJSON(`${PROFILE_PHOTO_PREFIX}${id}.json`, { type, data: buffer.toString("base64"), source: "upload", at: new Date().toISOString() });
  return `/api/profile-photo?id=${id}`;
}

// Make `url` the round picture everywhere this person appears: their member record (network, nav,
// My profile), every interview page of theirs, and their map pin. `exceptCandidateId` is a candidate
// the caller has already updated and saved itself.
async function applyMemberPhoto(session, url, exceptCandidateId) {
  const email = lowerTrim(session && session.email);
  if (!email) return;
  const member = await readMember(email);
  if (member) { member.picture = url; member.updatedAt = new Date().toISOString(); await writeJSON(memberPath(email), member); }
  for (const c of await findCandidatesByEmail([email], String((session && session.sub) || ""))) {
    if (c.id === exceptCandidateId) continue;
    c.profile.photo = url;
    await saveCandidate(c);
  }
  const { blobs } = await list({ prefix: MAP_PREFIX });
  const sub = String((session && session.sub) || "");
  for (const b of blobs) {
    const pin = await readJSON(b.pathname).catch(() => null);
    if (!pin || !((lowerTrim(pin.email) === email) || (sub && pin.linkedinId === sub))) continue;
    pin.picture = url;
    await put(b.pathname, JSON.stringify(pin), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
  }
}

async function readProfilePhoto(id) {
  if (!PHOTO_ID_RE.test(id || "")) return null;
  const rec = await readJSON(`${PROFILE_PHOTO_PREFIX}${id}.json`);
  if (!rec || typeof rec.data !== "string") return null;
  return { type: rec.type, buffer: Buffer.from(rec.data, "base64") };
}

// What the pages get: where to load it from and its real size (used to avoid stretching small photos).
function photoView(c) {
  const f = c && c.featuredPhoto;
  return f && f.id ? { url: `/api/interview-photo?id=${f.id}`, width: f.width, height: f.height } : null;
}

const CANDIDATE_PREFIX = "candidates/";
const QUESTION_BANK_PATH = "config/question-bank.json";

const newId = () => crypto.randomBytes(24).toString("base64url");
const ID_RE = /^[A-Za-z0-9_-]{20,64}$/;

const readCandidate = id => (ID_RE.test(id || "") ? readJSON(`${CANDIDATE_PREFIX}${id}.json`) : Promise.resolve(null));

async function saveCandidate(c) {
  c.updatedAt = new Date().toISOString();
  c.status = deriveStatus(c);
  if (c.profile) c.profile.photo = await mirrorProfilePhoto(c.profile.photo);
  await writeJSON(`${CANDIDATE_PREFIX}${c.id}.json`, c);
  return c;
}

async function listCandidates() {
  const { blobs } = await list({ prefix: CANDIDATE_PREFIX });
  const all = (await Promise.all(blobs.map(b => readJSON(b.pathname)))).filter(Boolean);
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return all;
}

function deleteCandidate(id) {
  return del(`${CANDIDATE_PREFIX}${id}.json`);
}

// Every candidate record tied to one of these emails (the LinkedIn-verified one or the contact
// email typed on the form), declined ones included — callers decide what counts.
// A LinkedIn member ID (the OIDC `sub`), when given, matches too — same person, different email.
async function findCandidatesByEmail(emails, linkedinId) {
  const wanted = new Set((emails || []).map(e => String(e || "").trim().toLowerCase()).filter(Boolean));
  const sub = String(linkedinId || "");
  if (!wanted.size && !sub) return [];
  return (await listCandidates()).filter(c =>
    [c.profile && c.profile.email, c.verified && c.verified.email].some(e => e && wanted.has(String(e).trim().toLowerCase())) ||
    !!(sub && c.verified && c.verified.linkedinId === sub)
  );
}

// ---------- "Put yourself on the map" pins ----------

const MAP_PREFIX = "map-submissions/";
const lowerTrim = v => String(v || "").trim().toLowerCase();

// Everything that already puts this signed-in person on the map: their pins (matched on the
// LinkedIn-verified email or LinkedIn ID) and a published interview with a location. One place
// answers "is this person already on the map?" for both the form (blocks a second pin) and the
// My map page. Only a rejected pin doesn't count, so they can try again with a corrected one.
async function findMapPresence(session) {
  const email = lowerTrim(session && session.email);
  const sub = String((session && session.sub) || "");
  const { blobs } = await list({ prefix: MAP_PREFIX });
  const pins = (await Promise.all(blobs.map(b => readJSON(b.pathname))))
    .filter(s => s && ((email && lowerTrim(s.email) === email) || (sub && s.linkedinId === sub)))
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const live = (await findCandidatesByEmail([email], sub))
    .find(c => isLive(c) && typeof c.profile.lat === "number" && typeof c.profile.lng === "number") || null;
  return { pins, live, onMap: !!live || pins.some(s => (s.status || "pending") !== "rejected") };
}

// One record per person. Pins written before the one-pin-per-person rule can leave the same person
// with several records; anyone sharing an email or LinkedIn ID is one person. Keeps the record that
// is (or is closest to being) on the map: approved, then pending, then removed, then rejected —
// newest first within a status. Order of the input is otherwise preserved.
const MAP_STATUS_RANK = { approved: 0, pending: 1, removed: 2, rejected: 3 };
function dedupeMapPins(pins) {
  const groupOf = pins.map((_, i) => i);
  const find = i => (groupOf[i] === i ? i : (groupOf[i] = find(groupOf[i])));
  const seen = new Map();
  pins.forEach((s, i) => {
    [lowerTrim(s.email) && `e:${lowerTrim(s.email)}`, s.linkedinId && `l:${s.linkedinId}`].filter(Boolean).forEach(key => {
      if (seen.has(key)) groupOf[find(i)] = find(seen.get(key));
      else seen.set(key, i);
    });
  });
  const rank = s => (MAP_STATUS_RANK[s.status || "pending"] ?? 1);
  const best = new Map();
  pins.forEach((s, i) => {
    const g = find(i);
    const cur = best.get(g);
    if (!cur || rank(s) < rank(cur) || (rank(s) === rank(cur) && String(s.submittedAt) > String(cur.submittedAt))) best.set(g, s);
  });
  const keep = new Set(best.values());
  return pins.filter(s => keep.has(s));
}

// Deterministic per person, so two simultaneous submissions land on the same blob and the second
// is refused by the storage layer (allowOverwrite: false) instead of slipping past the check above.
const mapPinId = session => crypto.createHash("sha256").update(lowerTrim(session.email) || `li:${session.sub}`).digest("hex");

// ---------- Question bank ----------

function defaultBank() {
  return { sections: JSON.parse(JSON.stringify(defaults.INTERVIEW_SECTIONS)), updatedAt: null };
}

async function readBank() {
  return (await readJSON(QUESTION_BANK_PATH)) || defaultBank();
}

// Validate + normalise a list of sections coming from the admin UI.
// Question ids are kept when present (answers are keyed by them) and minted when not.
function cleanSections(input) {
  if (!Array.isArray(input) || !input.length || input.length > 20) return null;
  const seen = new Set();
  const sections = [];
  for (const s of input) {
    const title = clip(s && s.title, 120);
    if (!title) return null;
    const questions = [];
    for (const q of Array.isArray(s.questions) ? s.questions.slice(0, 60) : []) {
      const text = clip(q && q.text, 300);
      if (!text) continue;
      let id = typeof q.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(q.id) ? q.id : `x${crypto.randomBytes(4).toString("hex")}`;
      if (seen.has(id)) id = `x${crypto.randomBytes(4).toString("hex")}`;
      seen.add(id);
      const item = { id, text, hint: clip(q.hint, 300), required: q.required === true };
      if (q.fromProfile === true) item.fromProfile = true;
      questions.push(item);
    }
    let sid = typeof s.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(s.id) ? s.id : `s${crypto.randomBytes(4).toString("hex")}`;
    sections.push({ id: sid, title, blurb: clip(s.blurb, 300), questions });
  }
  return sections;
}

// ---------- Candidate lifecycle ----------

// pipeline: new -> invited -> drafting -> ready -> locked -> scheduled -> published (or declined)
function deriveStatus(c) {
  if (c.declined) return "declined";
  const pub = c.publish || {};
  if (pub.publishedAt) return "published";
  if (pub.scheduledPublishAt && c.locked) return Date.parse(pub.scheduledPublishAt) <= Date.now() ? "published" : "scheduled";
  if (c.locked) return "locked";
  if (c.approval && c.approval.approved) return "ready";
  if (c.invitation && (c.answersUpdatedAt || Object.keys(c.answers || {}).length)) return "drafting";
  if (c.invitation) return "invited";
  return "new";
}

const isLive = c => {
  if (c.declined) return false;
  const pub = c.publish || {};
  if (pub.publishedAt) return true;
  return !!(pub.scheduledPublishAt && c.locked && Date.parse(pub.scheduledPublishAt) <= Date.now());
};

function blankCandidate(source, profile, extra) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    source, // applied | manual | recommended
    profile: cleanProfile(profile),
    recommendation: null,
    notes: "",
    invitation: null,     // { channel, sentAt, answersDueDate, estimatedPublishDate }
    linkRevoked: false,
    questionnaire: null,  // { sections } snapshot taken at invite time, editable by admin
    answers: {},
    custom: [],
    answersUpdatedAt: null,
    approval: { approved: false, by: null, at: null },
    locked: false,
    lockedAt: null,
    declined: false,
    publish: { scheduledPublishAt: null, displayDate: null, publishedAt: null, slug: null, category: null, foreword: "" },
    status: "new",
    createdAt: now,
    updatedAt: now,
    ...extra
  };
}

const FOCUS_TAGS = ["ai", "b2b", "design", "growth", "fintech", "platform", "marketplace", "health", "leadership", "other"];

// Only http(s) URLs (or a site-relative path) may reach the public pages' href/src attributes.
function cleanUrl(value, max) {
  const v = clip(value, max);
  if (!v) return "";
  if (/^https?:\/\//i.test(v) && !/[\s"'<>]/.test(v)) return v;
  if (/^assets\/[\w./-]+$/.test(v)) return v;
  if (PROFILE_PHOTO_URL_RE.test(v)) return v;
  return "";
}

// Profile text ends up in HTML templates on public pages: drop angle brackets outright.
const plain = (value, max) => clip(value, max).replace(/[<>]/g, "");

function cleanProfile(p) {
  p = p || {};
  const years = Number(p.yearsExperience);
  const num = v => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  const lat = num(p.lat), lng = num(p.lng);
  return {
    name: plain(p.name, 200),
    email: plain(p.email, 200),
    phone: plain(p.phone, 60),
    role: plain(p.role, 200),
    company: plain(p.company, 200),
    location: plain(p.location, 200),
    yearsExperience: Number.isFinite(years) && p.yearsExperience !== "" && p.yearsExperience != null ? Math.max(0, Math.min(60, Math.round(years))) : null,
    focusTag: FOCUS_TAGS.includes(p.focusTag) ? p.focusTag : "other",
    linkedin: looseUrl(p.linkedin, 300),
    website: looseUrl(p.website, 300),
    twitter: looseUrl(p.twitter, 300),
    snippet: plain(p.snippet, 200),
    pullQuote: plain(p.pullQuote, 160),
    photo: cleanUrl(p.photo, 1000),
    lat: lat != null && lat >= -90 && lat <= 90 ? lat : null,
    lng: lng != null && lng >= -180 && lng <= 180 ? lng : null
  };
}

// ---------- Members (private profile + newsletter choice, written when someone signs up) ----------

const memberPath = (email) => `members/${crypto.createHash("sha256").update(String(email).toLowerCase()).digest("hex")}.json`;

// "twitter.com/x" / "www.site.com" -> https://…, then the usual http(s)-only rule
function looseUrl(value, max) {
  const v = clip(value, max);
  return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? cleanUrl(`https://${v}`, max) : cleanUrl(v, max);
}

// The details a member can keep on their My profile page (the same things collected on Apply).
// Focus areas are a list: a person can work across several.
function cleanMemberDetails(d) {
  d = d || {};
  const years = Number(d.yearsExperience);
  const tags = [...new Set((Array.isArray(d.focusTags) ? d.focusTags : []).filter(t => FOCUS_TAGS.includes(t)))];
  return {
    name: plain(d.name, 200),
    role: plain(d.role, 200),
    company: plain(d.company, 200),
    location: plain(d.location, 200),
    yearsExperience: d.yearsExperience === "" || d.yearsExperience == null || !Number.isFinite(years) ? null : Math.max(0, Math.min(60, Math.round(years))),
    focusTags: tags,
    linkedin: looseUrl(d.linkedin, 300),
    website: looseUrl(d.website, 300),
    twitter: looseUrl(d.twitter, 300),
    snippet: plain(d.snippet, 200),
    pullQuote: plain(d.pullQuote, 160)
  };
}

async function readMember(email) {
  try { return await readJSON(memberPath(email)); } catch (err) { return null; }
}

async function listMembers() {
  const { blobs } = await list({ prefix: "members/" });
  return (await Promise.all(blobs.map(b => readJSON(b.pathname).catch(() => null)))).filter(Boolean);
}

// Fields a member record carries besides the basics, kept whenever it is rewritten.
function keepMemberExtras(existing, record) {
  if (!existing) return record;
  ["details", "network", "newsletterAt", "newsletterSync"].forEach(k => { if (existing[k] !== undefined && record[k] === undefined) record[k] = existing[k]; });
  return record;
}

// Adds an opted-in member to the newsletter list and records the outcome on their record. Never
// throws: a failure is stored as newsletterSync.state = "failed" so it shows in the backoffice and
// can be retried there, and signing up is never held up by it.
async function syncMemberToList(record) {
  const newsletter = require("./newsletter");
  if (!record.newsletter || !newsletter.configured()) return record;
  try {
    const contact = await newsletter.subscribe({ email: record.email, name: record.name });
    record.newsletterSync = { state: "sent", at: new Date().toISOString(), contactId: (contact && contact.id) || null };
  } catch (err) {
    console.error("[newsletter] sync failed:", (err && err.message) || err);
    record.newsletterSync = { state: "failed", at: new Date().toISOString(), error: String((err && err.message) || "failed").slice(0, 200) };
  }
  await writeJSON(memberPath(record.email), record);
  return record;
}

// A picture we already mirrored is kept (a fresh LinkedIn sign-in only carries the 100px thumbnail and
// must not replace a better one); otherwise mirror the session's picture.
async function memberPicture(session, existing) {
  const kept = existing && existing.picture;
  if (kept && PROFILE_PHOTO_URL_RE.test(kept)) return kept;
  return (await mirrorProfilePhoto(session.picture || kept || null)) || null;
}

async function saveMemberDetails(session, details) {
  const existing = await readMember(session.email);
  const record = {
    name: session.name || (existing && existing.name) || "",
    email: session.email,
    picture: await memberPicture(session, existing),
    newsletter: !!(existing && existing.newsletter),
    source: (existing && existing.source) || "profile",
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    details
  };
  keepMemberExtras(existing, record);
  await writeJSON(memberPath(session.email), record);
  return record;
}

// ---------- Alumni network: explicit, reciprocal opt-in ----------
// A member who ticks the box agrees to be visible (profile + email) to the other members of the
// network — once they've been interviewed — and in return gets access to the network directory.
// Leaving removes both at once.
const isNetworkMember = (member) => !!(member && member.network && member.network.optedIn);

async function setNetworkOptIn(session, optedIn, source) {
  const existing = await readMember(session.email);
  const now = new Date().toISOString();
  const record = existing || {
    name: session.name || "", email: session.email, picture: await memberPicture(session, null),
    newsletter: false, source: source || "network", createdAt: now
  };
  record.network = optedIn
    ? { optedIn: true, at: (existing && existing.network && existing.network.at) || now, source: (existing && existing.network && existing.network.source) || source || "network" }
    : { optedIn: false, at: null, leftAt: now };
  record.updatedAt = now;
  await writeJSON(memberPath(session.email), record);
  return record;
}

// Overwrites in place, keeps createdAt, and never drops an existing newsletter subscription
// (unsubscribing happens through the link in each newsletter issue).
async function upsertMember(session, newsletter, source) {
  const pathname = memberPath(session.email);
  const existing = await readMember(session.email);
  const record = {
    name: session.name || "",
    email: session.email,
    picture: await memberPicture(session, existing),
    newsletter: !!newsletter || !!(existing && existing.newsletter),
    source: (existing && existing.newsletter && !newsletter) ? (existing.source || source) : source,
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  keepMemberExtras(existing, record); // the profile details they've saved, their network choice, newsletter sync state
  if (record.newsletter && !record.newsletterAt) record.newsletterAt = new Date().toISOString();
  await writeJSON(pathname, record);
  // the moment someone opts in (or an earlier attempt failed), send them to the newsletter list
  if (record.newsletter && !(record.newsletterSync && record.newsletterSync.state === "sent")) await syncMemberToList(record);
  return record;
}

// How many required questions are answered (profile-backed Q1–Q5 count via the profile fields).
const PROFILE_FIELD_BY_QID = { q1: "name", q2: "role", q3: "company", q4: "location", q5: "yearsExperience" };
function requiredProgress(c) {
  const req = ((c.questionnaire && c.questionnaire.sections) || []).flatMap(s => s.questions).filter(q => q.required);
  const filled = q => q.fromProfile
    ? String(c.profile[PROFILE_FIELD_BY_QID[q.id]] == null ? "" : c.profile[PROFILE_FIELD_BY_QID[q.id]]).trim() !== ""
    : typeof (c.answers || {})[q.id] === "string" && c.answers[q.id].trim() !== "";
  return { required: req.length, done: req.filter(filled).length };
}

// ---------- Publishing helpers ----------

function slugify(name) {
  return String(name || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "interview";
}

const CATEGORIES = ["productmanagement", "productux"];
const defaultCategory = profile => (profile && profile.focusTag === "design" ? "productux" : "productmanagement");

const FOCUS_LABELS = {
  ai: "AI & ML Products", b2b: "B2B SaaS", design: "Design Systems", growth: "Consumer & Growth", fintech: "Fintech",
  platform: "Platform & Infra", marketplace: "Marketplace", health: "Healthtech", leadership: "Product Leadership", other: "Other"
};

// The public shape (same as an INTERVIEWS entry in assets/people-data.js). Nothing private
// (email, phone, notes, tokens, recommender) ever leaves through here.
// True while a planned feature week (publish.featureOn, Monday to Sunday) has not started yet.
function featureHeldBack(pub, now = new Date()) {
  if (!pub || !/^\d{4}-\d{2}-\d{2}$/.test(pub.featureOn || "")) return false;
  const d = new Date(`${pub.featureOn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10) > now.toISOString().slice(0, 10);
}

function toPublicInterview(c) {
  const p = c.profile;
  const pub = c.publish || {};
  const answers = c.answers || {};
  const sections = ((c.questionnaire && c.questionnaire.sections) || []).map(s => ({
    id: s.id,
    title: s.title,
    questions: s.questions
      .filter(q => !q.fromProfile && typeof answers[q.id] === "string" && answers[q.id].trim())
      .map(q => ({ id: q.id, text: q.text, answer: answers[q.id] }))
  })).filter(s => s.questions.length);
  const category = pub.category || defaultCategory(p);
  return {
    slug: pub.slug,
    category,
    url: `/interview/${category}/${pub.slug}`,
    name: p.name,
    role: p.role,
    company: p.company,
    location: p.location,
    lat: p.lat, lng: p.lng,
    focus: FOCUS_LABELS[p.focusTag] || "",
    focusTag: p.focusTag,
    yearsExperience: p.yearsExperience,
    photo: p.photo || null,
    featuredPhoto: photoView(c),
    links: { linkedin: p.linkedin, website: p.website, twitter: p.twitter },
    snippet: p.snippet,
    pullQuote: p.pullQuote,
    publishedDate: pub.displayDate || (pub.publishedAt || pub.scheduledPublishAt || new Date().toISOString()).slice(0, 10),
    foreword: pub.foreword || "",
    // false = published without taking the homepage spotlight, or held back until the week an admin
    // planned for featuring it (publish.featureOn) begins
    featured: pub.featured !== false && !featureHeldBack(pub),
    featureHeld: featureHeldBack(pub), // still waiting for its planned feature week
    interview: {
      sections,
      custom: (c.custom || []).filter(x => x.q && x.a)
    }
  };
}

// Looks a free-text "City, Country" up on OpenStreetMap so a published interview lands on the globe
// without anyone typing coordinates. Returns { lat, lng } or null (never throws).
async function geocodeLocation(location) {
  const q = String(location || "").trim();
  if (!q) return null;
  try {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "ProductMoat/1.0 (https://www.productmoat.com)", "Accept": "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (!resp.ok) return null;
    const hit = (await resp.json())[0];
    const lat = hit && Number(hit.lat), lng = hit && Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch (err) {
    console.error("[geocode] failed:", (err && err.message) || err);
    return null;
  }
}

// Fills profile.lat/lng from the location when missing. True when the profile changed.
async function ensureCoords(c) {
  const p = c.profile;
  if (!p || (typeof p.lat === "number" && typeof p.lng === "number")) return false;
  const hit = await geocodeLocation(p.location);
  if (!hit) return false;
  p.lat = hit.lat; p.lng = hit.lng;
  return true;
}

async function takenSlugs(exceptId) {
  const all = await listCandidates();
  const set = new Set();
  // slugs of the hand-written example interviews in assets/people-data.js
  try {
    const src = require("fs").readFileSync(require("path").join(__dirname, "../../assets/people-data.js"), "utf8");
    for (const m of src.matchAll(/^\s*slug:\s*"([^"]+)"/gm)) set.add(m[1]);
  } catch (err) { /* file not bundled: candidates' own slugs still checked below */ }
  all.forEach(c => { if (c.id !== exceptId && c.publish && c.publish.slug) set.add(c.publish.slug); });
  return set;
}

module.exports = {
  crypto, defaults,
  parseCookies, adminSession, memberSession, requireAdmin, isAdminRequest, clip,
  readJSON, writeJSON, readCandidate, saveCandidate, listCandidates, findCandidatesByEmail, deleteCandidate, MAP_PREFIX, findMapPresence, mapPinId, dedupeMapPins,
  upsertMember, readMember, saveMemberDetails, setNetworkOptIn, isNetworkMember, cleanMemberDetails, FOCUS_TAGS, readBank, defaultBank, cleanSections, QUESTION_BANK_PATH,
  requiredProgress, deriveStatus, isLive, blankCandidate, cleanProfile, ID_RE, newId,
  geocodeLocation, ensureCoords, slugify, CATEGORIES, defaultCategory, toPublicInterview, takenSlugs, FOCUS_LABELS,
  mirrorProfilePhoto, readProfilePhoto, saveProfilePhoto, applyMemberPhoto, isLinkedInPhotoUrl, parsePhotoDataUrl, savePhoto, readPhoto, deletePhoto, photoView,
  listMembers, syncMemberToList, memberPath
};
