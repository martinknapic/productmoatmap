// Newsletter list sync (SendFox, https://api.sendfox.com).
//
// Configured only through environment variables, never from the repo:
//   SENDFOX_API_TOKEN   personal access token (sendfox.com/account/oauth)
//   SENDFOX_LIST_ID     numeric id of the list opted-in people are added to
//   SENDFOX_API_BASE    optional override (used by the local mock in development)
// Without the first two everything here is a quiet no-op and the site works as before.
//
// Double opt-in is a list setting inside SendFox (a confirmation campaign on the list). We don't
// control it from here; we only read it back: a contact with `confirmed_at` has confirmed, one with
// `confirmation_sent_at` is waiting, and on a list with no confirmation campaign a subscriber is
// simply subscribed ("single opt-in").

const base = () => (process.env.SENDFOX_API_BASE || "https://api.sendfox.com").replace(/\/$/, "");
const token = () => process.env.SENDFOX_API_TOKEN || "";
const listId = () => Number(process.env.SENDFOX_LIST_ID) || 0;
const configured = () => !!(token() && listId());

async function api(method, path, body) {
  const resp = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(9000)
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (err) { /* not JSON */ }
  if (!resp.ok) throw Object.assign(new Error((data && (data.message || data.error)) || `newsletter service answered ${resp.status}`), { status: resp.status, data });
  return data;
}

const splitName = name => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || "", last_name: parts.slice(1).join(" ") };
};

const findContact = async email => {
  const r = await api("GET", `/contacts?email=${encodeURIComponent(email)}`);
  return (r && r.data && r.data[0]) || null;
};

// Adds (or updates) the contact and puts them on the configured list.
async function subscribe({ email, name }) {
  const contact = await api("POST", "/contacts", { email, ...splitName(name), lists: [listId()] });
  return contact && contact.id ? contact : findContact(email);
}

let listCache = null; // { at, value } - the list's name and whether it does double opt-in; changes rarely
async function listInfo() {
  if (listCache && Date.now() - listCache.at < 5 * 60 * 1000) return listCache.value;
  const l = await api("GET", `/lists/${listId()}`);
  const value = { id: l.id, name: l.name, doubleOptIn: !!l.confirmation_campaign_id, subscribed: l.subscribed_contacts_count, unsubscribed: l.unsubscribed_contacts_count };
  listCache = { at: Date.now(), value };
  return value;
}

// The double opt-in status of one contact.
//   not_synced | pending | confirmed | subscribed (single opt-in list) | unsubscribed | bounced
function statusOf(contact, list) {
  if (!contact) return { state: "not_synced" };
  const s = { contactId: contact.id, confirmedAt: contact.confirmed_at || null, confirmationSentAt: contact.confirmation_sent_at || null };
  if (contact.unsubscribed_at) return { ...s, state: "unsubscribed", at: contact.unsubscribed_at };
  if (contact.bounced_at) return { ...s, state: "bounced", at: contact.bounced_at };
  if (contact.confirmed_at) return { ...s, state: "confirmed", at: contact.confirmed_at };
  if (contact.confirmation_sent_at || (list && list.doubleOptIn)) return { ...s, state: "pending", at: contact.confirmation_sent_at || null };
  return { ...s, state: "subscribed" };
}

// Runs fn over items with limited parallelism (the service is rate limited).
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const n = i++; out[n] = await fn(items[n], n); }
  }));
  return out;
}

module.exports = { configured, listId, subscribe, findContact, listInfo, statusOf, mapLimit };
