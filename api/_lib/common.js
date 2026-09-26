// Shared helpers for the candidate / interview functions. The underscore prefix keeps
// Vercel from exposing this file as a route of its own.

const crypto = require("crypto");
const { list, get, put, del } = require("@vercel/blob");
const defaults = require("../../assets/questions-default.js");

const SESSION_COOKIE = "bo_session"; // admin (backoffice) session
const MEMBER_COOKIE = "pm_session";  // site-wide LinkedIn member session

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function verifySigned(cookieValue, secret) {
  if (!cookieValue || !secret) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function adminSession(req) {
  return verifySigned(parseCookies(req.headers.cookie)[SESSION_COOKIE], process.env.LINKEDIN_CLIENT_SECRET);
}
function memberSession(req) {
  return verifySigned(parseCookies(req.headers.cookie)[MEMBER_COOKIE], process.env.LINKEDIN_CLIENT_SECRET);
}

// Admin = a backoffice session, or a signed-in member whose LinkedIn email is on the admin list.
// (Used to let admins see private previews while browsing the public site.)
function adminEmails() {
  return (process.env.BACKOFFICE_ALLOWED_EMAIL || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
}
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

const CANDIDATE_PREFIX = "candidates/";
const QUESTION_BANK_PATH = "config/question-bank.json";

const newId = () => crypto.randomBytes(24).toString("base64url");
const ID_RE = /^[A-Za-z0-9_-]{20,64}$/;

const readCandidate = id => (ID_RE.test(id || "") ? readJSON(`${CANDIDATE_PREFIX}${id}.json`) : Promise.resolve(null));

async function saveCandidate(c) {
  c.updatedAt = new Date().toISOString();
  c.status = deriveStatus(c);
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
    invitation: null,     // { channel, sentAt, estimatedPublishDate }
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
    linkedin: cleanUrl(p.linkedin, 300),
    website: cleanUrl(p.website, 300),
    twitter: cleanUrl(p.twitter, 300),
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

async function saveMemberDetails(session, details) {
  const existing = await readMember(session.email);
  const record = {
    name: session.name || (existing && existing.name) || "",
    email: session.email,
    picture: session.picture || (existing && existing.picture) || null,
    newsletter: !!(existing && existing.newsletter),
    source: (existing && existing.source) || "profile",
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    details
  };
  if (existing && existing.network) record.network = existing.network;
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
    name: session.name || "", email: session.email, picture: session.picture || null,
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
    picture: session.picture || null,
    newsletter: !!newsletter || !!(existing && existing.newsletter),
    source: (existing && existing.newsletter && !newsletter) ? (existing.source || source) : source,
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existing && existing.details) record.details = existing.details; // keep the profile details they've saved
  if (existing && existing.network) record.network = existing.network;
  await writeJSON(pathname, record);
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
    links: { linkedin: p.linkedin, website: p.website, twitter: p.twitter },
    snippet: p.snippet,
    pullQuote: p.pullQuote,
    publishedDate: pub.displayDate || (pub.publishedAt || pub.scheduledPublishAt || new Date().toISOString()).slice(0, 10),
    foreword: pub.foreword || "",
    interview: {
      sections,
      custom: (c.custom || []).filter(x => x.q && x.a)
    }
  };
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
  slugify, CATEGORIES, defaultCategory, toPublicInterview, takenSlugs, FOCUS_LABELS
};
