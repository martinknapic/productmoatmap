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
  parseCookies, adminSession, memberSession, requireAdmin, clip,
  readJSON, writeJSON, readCandidate, saveCandidate, listCandidates, deleteCandidate,
  readBank, defaultBank, cleanSections, QUESTION_BANK_PATH,
  deriveStatus, isLive, blankCandidate, cleanProfile, ID_RE, newId,
  slugify, CATEGORIES, defaultCategory, toPublicInterview, takenSlugs, FOCUS_LABELS
};
