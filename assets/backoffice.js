// ProductMoat Backoffice — login gate + shared table helpers, profiles and map submissions
// (the candidate pipeline lives in backoffice-candidates.js)
//
// Login is real LinkedIn OAuth (same app as the public Apply form's verification
// gate), checked server-side against an allow-list — see api/backoffice-callback.js.
// The session itself is an HttpOnly signed cookie; middleware.js enforces access to
// the dashboard pages at the edge, before they're ever served, so this file's own
// checks are for display/UX (who's logged in, wiring sign-out) rather than the
// security boundary.

const BACKOFFICE_LINKEDIN_CLIENT_ID = "778t1x9svtemxo"; // same LinkedIn app as apply.html
const BO_HIDDEN_KEY = "bo-hidden-ids";
const BO_STATUS_KEY = "bo-status-overrides";
const BO_APPLICATION_STATUSES = ["pending", "accepted", "rejected"];
const BO_RECOMMENDATION_STATUSES = ["pending", "contacted", "declined"];

const BO_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const BO_DEFAULT_PAGE_SIZE = 50;
const BO_PAGE_SIZE_KEY_PREFIX = "bo-page-size-";
const boPageState = {}; // tableKey -> current page number (in-memory only, resets per load)

function boEscapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function boGetHiddenIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BO_HIDDEN_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}

function boHideIds(ids) {
  const hidden = boGetHiddenIds();
  ids.forEach(id => hidden.add(id));
  localStorage.setItem(BO_HIDDEN_KEY, JSON.stringify([...hidden]));
}

function boGetStatusOverrides() {
  try {
    return JSON.parse(localStorage.getItem(BO_STATUS_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function boSetStatus(id, status) {
  const overrides = boGetStatusOverrides();
  overrides[id] = status;
  localStorage.setItem(BO_STATUS_KEY, JSON.stringify(overrides));
}

async function boCurrentGuard() {
  const logoutBtn = document.getElementById("bo-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      location.href = "/api/backoffice-logout";
    });
  }

  try {
    const resp = await fetch("/api/backoffice-me", { credentials: "same-origin" });
    if (!resp.ok) throw new Error("not authenticated");
    const me = await resp.json();
    const userEl = document.getElementById("bo-user");
    if (userEl) userEl.textContent = `Logged in as ${me.name || me.email}`;
    return true;
  } catch (err) {
    location.replace("index.html");
    return false;
  }
}

// ---------- Login page ----------

function initBackofficeLogin() {
  const btn = document.getElementById("bo-li-signin-btn");
  const error = document.getElementById("bo-login-error");
  if (!btn) return;

  const params = new URLSearchParams(window.location.search);
  const bo = params.get("bo");
  if (bo) {
    history.replaceState(null, "", window.location.pathname);
    error.textContent = bo === "unauthorized"
      ? "This LinkedIn account isn't authorized for backoffice access."
      : "LinkedIn sign-in didn't go through — try again.";
    error.hidden = false;
  }

  btn.addEventListener("click", () => {
    const redirectUri = `${window.location.origin}/api/backoffice-callback`;
    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: BACKOFFICE_LINKEDIN_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "openid profile email"
    });
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${authParams.toString()}`;
  });
}

// ---------- Shared helpers ----------

function boFocusLabel(tag) {
  const labels = {
    ai: "AI & ML", b2b: "B2B SaaS", design: "Design Systems", growth: "Consumer & Growth",
    fintech: "Fintech", platform: "Platform & Infra", marketplace: "Marketplace",
    health: "Healthtech", leadership: "Product Leadership", other: "Other"
  };
  return labels[tag] || tag || "—";
}

function boStatusSelect(id, currentStatus, options) {
  const opts = options.map(s =>
    `<option value="${s}"${s === currentStatus ? " selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
  ).join("");
  return `<select class="bo-status-select bo-status-${boEscapeHTML(currentStatus)}" data-status-id="${boEscapeHTML(id)}">${opts}</select>`;
}

function boDemoBadge(isDemo) {
  return isDemo ? `<span class="bo-badge bo-badge-demo">DEMO</span>` : "";
}

// ---------- Pagination (shared across every table page) ----------

function boGetPageSize(tableKey) {
  const n = parseInt(localStorage.getItem(BO_PAGE_SIZE_KEY_PREFIX + tableKey), 10);
  return BO_PAGE_SIZE_OPTIONS.includes(n) ? n : BO_DEFAULT_PAGE_SIZE;
}

function boSetPageSize(tableKey, size) {
  localStorage.setItem(BO_PAGE_SIZE_KEY_PREFIX + tableKey, String(size));
}

function boPaginationControlsHTML(tableKey, page, totalPages, total, pageSize) {
  if (total === 0) return "";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const sizeOptions = BO_PAGE_SIZE_OPTIONS
    .map(n => `<option value="${n}"${n === pageSize ? " selected" : ""}>${n}</option>`)
    .join("");

  return `
    <div class="bo-page-size">
      <label for="bo-page-size-${tableKey}">Rows per page</label>
      <select id="bo-page-size-${tableKey}" data-page-size-for="${tableKey}">${sizeOptions}</select>
    </div>
    <div class="bo-page-nav">
      <button type="button" class="bo-page-btn" data-page-nav="${tableKey}" data-dir="prev"${page <= 1 ? " disabled" : ""}>&larr; Prev</button>
      <span class="bo-page-info">${start}&ndash;${end} of ${total}</span>
      <button type="button" class="bo-page-btn" data-page-nav="${tableKey}" data-dir="next"${page >= totalPages ? " disabled" : ""}>Next &rarr;</button>
    </div>
  `;
}

// Slices `rows` to the current page for `tableKey`, renders them into the table body
// via `renderRow`, updates the count/empty state, and renders the pagination bar.
function boPaginate(tableKey, rows, renderRow, ids) {
  const pageSize = boGetPageSize(tableKey);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let page = boPageState[tableKey] || 1;
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  boPageState[tableKey] = page;

  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  document.getElementById(ids.bodyId).innerHTML = pageRows.map(renderRow).join("");
  document.getElementById(ids.countId).textContent = `(${total})`;
  document.getElementById(ids.emptyId).hidden = total > 0;

  const paginationEl = document.getElementById(ids.paginationId);
  if (paginationEl) {
    paginationEl.innerHTML = boPaginationControlsHTML(tableKey, page, totalPages, total, pageSize);
  }
}

const boRerenderers = {}; // tableKey -> function that re-runs that table's render
let boPaginationWired = false;

function boWirePaginationControls(rerenderers) {
  Object.assign(boRerenderers, rerenderers);
  if (boPaginationWired) return;
  boPaginationWired = true;

  document.addEventListener("change", (e) => {
    const select = e.target.closest("[data-page-size-for]");
    if (!select) return;
    const tableKey = select.dataset.pageSizeFor;
    boSetPageSize(tableKey, parseInt(select.value, 10));
    boPageState[tableKey] = 1;
    if (boRerenderers[tableKey]) boRerenderers[tableKey]();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page-nav]");
    if (!btn || btn.disabled) return;
    const tableKey = btn.dataset.pageNav;
    const current = boPageState[tableKey] || 1;
    boPageState[tableKey] = btn.dataset.dir === "next" ? current + 1 : current - 1;
    if (boRerenderers[tableKey]) boRerenderers[tableKey]();
  });
}

function boWireRowActions(rerender) {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-id]");
    if (!btn) return;
    boHideIds([btn.dataset.removeId]);
    rerender();
  });

  document.addEventListener("change", (e) => {
    const select = e.target.closest("[data-status-id]");
    if (!select) return;
    boSetStatus(select.dataset.statusId, select.value);
    select.className = `bo-status-select bo-status-${select.value}`;
  });
}

// ---------- Profiles page ----------
// Reads the real, published dataset (assets/people-data.js) — not demo data, so no
// DEMO badge, status, or remove/clear actions here. Add/edit/remove a profile by
// editing that file directly.

function boInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function boAvatarHTML(person) {
  // Photo paths in people-data.js are root-relative (e.g. "assets/photos/x.jpg"),
  // but backoffice pages live one directory down, hence the "../" prefix.
  if (person.photo) {
    return `<div class="avatar"><img src="../${boEscapeHTML(person.photo)}" alt="${boEscapeHTML(person.name)}"></div>`;
  }
  return `<div class="avatar">${boEscapeHTML(boInitials(person.name))}</div>`;
}

function boRenderProfiles() {
  const rows = typeof INTERVIEWS !== "undefined" ? INTERVIEWS : [];

  boPaginate("profiles", rows, p => {
    const iv = p.interview || { answers: {}, custom: [] };
    const questionCount = Object.values(iv.answers || {}).filter(a => a && String(a).trim()).length + (iv.custom || []).length;
    return `
    <tr data-slug="${boEscapeHTML(p.slug)}">
      <td>${boAvatarHTML(p)}</td>
      <td class="bo-cell-strong">${boEscapeHTML(p.name)}</td>
      <td>${boEscapeHTML(p.role)}<br><span class="bo-cell-dim">${boEscapeHTML(p.company)}</span></td>
      <td>${boEscapeHTML(p.location)}</td>
      <td>${boEscapeHTML(boFocusLabel(p.focusTag))}</td>
      <td>${p.yearsExperience != null ? `${boEscapeHTML(p.yearsExperience)} yrs` : "—"}</td>
      <td>${questionCount}</td>
      <td>${boEscapeHTML(p.publishedDate)}</td>
      <td>${p.links && p.links.linkedin ? `<a class="bracket-link" href="${boEscapeHTML(p.links.linkedin)}" target="_blank" rel="noopener">[ Profile ]</a>` : "—"}</td>
      <td><a class="bracket-link" href="${boEscapeHTML(`/interview/${p.focusTag === "design" ? "productux" : "productmanagement"}/${encodeURIComponent(p.slug)}`)}" target="_blank" rel="noopener">[ View ]</a></td>
    </tr>
  `;
  }, { bodyId: "bo-profiles-body", countId: "bo-profile-count", emptyId: "bo-profiles-empty", paginationId: "bo-profiles-pagination" });
}

async function initBackofficeProfiles() {
  if (!(await boCurrentGuard())) return;
  boRenderProfiles();
  boWirePaginationControls({ profiles: boRenderProfiles });
}

// ---------- Map submissions page ----------
// Unlike Applications/Recommendations (dummy client-side data with localStorage
// overrides), this is real data — read and written via api/map-submissions.js,
// backed by Vercel Blob. Approving here is what makes a pin show up on the
// public globe (api/map-people.js only returns status:"approved" records).

let boMapSubmissions = [];

function boMapAvatarHTML(s) {
  if (s.picture) return `<div class="avatar"><img src="${boEscapeHTML(s.picture)}" alt="${boEscapeHTML(s.name)}"></div>`;
  return `<div class="avatar">${boEscapeHTML(boInitials(s.name))}</div>`;
}

const BO_MAP_STATUS_LABELS = { pending: "Pending", approved: "Approved", rejected: "Rejected", removed: "Removed" };

function boMapStatusBadge(status) {
  return `<span class="bo-status-badge bo-status-${boEscapeHTML(status)}">${boEscapeHTML(BO_MAP_STATUS_LABELS[status] || status)}</span>`;
}

// Approve / Reject / Delete / Edit. A button that would repeat the current status is left out.
function boMapActions(s) {
  const btn = (action, label, cls = "") => `<button type="button" class="bo-action ${cls}" data-map-action="${action}" data-map-id="${boEscapeHTML(s.id)}">${label}</button>`;
  return `<div class="bo-actions">
    ${s.status !== "approved" ? btn("approved", "Approve", "bo-action-primary") : ""}
    ${s.status !== "rejected" ? btn("rejected", "Reject") : ""}
    ${btn("edit", "Edit")}
    ${s.status !== "removed" ? btn("removed", "Delete", "bo-action-danger") : ""}
  </div>`;
}

function boRenderMapSubmissions() {
  boPaginate("map-submissions", boMapSubmissions, s => `
    <tr data-id="${boEscapeHTML(s.id)}">
      <td>${boMapAvatarHTML(s)}</td>
      <td class="bo-cell-strong">${boEscapeHTML(s.name)}</td>
      <td>${boEscapeHTML(s.email)}</td>
      <td>${boEscapeHTML(s.role) || "—"}<br><span class="bo-cell-dim">${boEscapeHTML(s.company)}</span></td>
      <td>${boEscapeHTML([s.city, s.country].filter(Boolean).join(", ")) || "—"}<br><span class="bo-cell-dim">${s.lat.toFixed(2)}, ${s.lng.toFixed(2)}</span></td>
      <td>${boEscapeHTML(new Date(s.submittedAt).toLocaleDateString())}</td>
      <td>${boMapStatusBadge(s.status)}</td>
      <td class="bo-col-actions">${boMapActions(s)}</td>
    </tr>
  `, { bodyId: "bo-map-submissions-body", countId: "bo-map-count", emptyId: "bo-map-submissions-empty", paginationId: "bo-map-submissions-pagination" });
}

async function boPostMapSubmission(payload) {
  const resp = await fetch("/api/map-submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error(String(resp.status));
  return (await resp.json()).submission;
}

async function boSetMapSubmissionStatus(id, status) {
  const submission = boMapSubmissions.find(s => s.id === id);
  if (!submission) return;
  if (status === "removed" && !window.confirm(`Delete ${submission.name}'s pin? It comes off the public map right away; you can bring it back with Approve.`)) return;
  try {
    await boPostMapSubmission({ id, status });
    submission.status = status;
  } catch (err) {
    console.error("Failed to update map submission status:", err);
    window.alert("Couldn't update that pin — please try again.");
  }
  boRenderMapSubmissions();
}

// Edit dialog: drag the pin (or click the map) to adjust where it sits, and correct the details.
let boEditMap = null;
function boCloseMapEditor() {
  const dlg = document.getElementById("bo-map-editor");
  if (boEditMap) { boEditMap.remove(); boEditMap = null; }
  if (dlg) dlg.remove();
}

function boOpenMapEditor(id) {
  const s = boMapSubmissions.find(x => x.id === id);
  if (!s || typeof maplibregl === "undefined") return;
  boCloseMapEditor();
  const field = (name, label, value) => `<label class="bo-field"><span>${label}</span><input type="text" name="${name}" maxlength="200" value="${boEscapeHTML(value || "")}"></label>`;
  const dlg = document.createElement("div");
  dlg.id = "bo-map-editor";
  dlg.className = "bo-modal";
  dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-label", `Edit ${s.name}'s pin`);
  dlg.innerHTML = `
    <div class="bo-modal-card">
      <h3>Edit pin — ${boEscapeHTML(s.name)}</h3>
      <p class="bo-section-note">Drag the pin, or click the map, to move it.</p>
      <div class="bo-editor-map" id="bo-editor-map"></div>
      <p class="bo-cell-dim" id="bo-editor-coords"></p>
      <form id="bo-editor-form" class="bo-editor-form">
        ${field("city", "City", s.city)}${field("country", "Country", s.country)}
        ${field("role", "Role", s.role)}${field("company", "Company", s.company)}
      </form>
      <div class="bo-modal-actions">
        <button type="button" class="bo-action bo-action-primary" id="bo-editor-save">Save pin</button>
        <button type="button" class="bo-action" id="bo-editor-cancel">Cancel</button>
        <span class="bo-cell-dim" id="bo-editor-status" role="status"></span>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  let pos = { lat: s.lat, lng: s.lng };
  const coords = document.getElementById("bo-editor-coords");
  const showCoords = () => { coords.textContent = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`; };
  showCoords();

  boEditMap = new maplibregl.Map({
    container: "bo-editor-map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [pos.lng, pos.lat],
    zoom: 4,
    attributionControl: { compact: true }
  });
  boEditMap.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
  const marker = new maplibregl.Marker({ draggable: true, color: "#e6432b" }).setLngLat([pos.lng, pos.lat]).addTo(boEditMap);
  const moved = ll => { pos = { lat: ll.lat, lng: ((ll.lng + 540) % 360) - 180 }; showCoords(); };
  marker.on("dragend", () => moved(marker.getLngLat()));
  boEditMap.on("click", e => { marker.setLngLat(e.lngLat); moved(e.lngLat); });

  dlg.addEventListener("click", e => { if (e.target === dlg) boCloseMapEditor(); });
  document.getElementById("bo-editor-cancel").addEventListener("click", boCloseMapEditor);
  document.getElementById("bo-editor-save").addEventListener("click", async () => {
    const f = document.getElementById("bo-editor-form").elements;
    const status = document.getElementById("bo-editor-status");
    status.textContent = "Saving…";
    try {
      const saved = await boPostMapSubmission({
        id, edit: { lat: pos.lat, lng: pos.lng, city: f.city.value, country: f.country.value, role: f.role.value, company: f.company.value }
      });
      Object.assign(s, saved);
      boCloseMapEditor();
      boRenderMapSubmissions();
    } catch (err) {
      console.error("Failed to save pin:", err);
      status.textContent = "Couldn't save — please try again.";
    }
  });
}

let boMapStatusWired = false;
function boWireMapSubmissionActions() {
  if (boMapStatusWired) return;
  boMapStatusWired = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-map-action]");
    if (!btn) return;
    const { mapAction: action, mapId: id } = btn.dataset;
    if (action === "edit") boOpenMapEditor(id);
    else boSetMapSubmissionStatus(id, action);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") boCloseMapEditor(); });
}

async function initBackofficeMapSubmissions() {
  if (!(await boCurrentGuard())) return;
  boWireMapSubmissionActions();
  boWirePaginationControls({ "map-submissions": boRenderMapSubmissions });

  try {
    const resp = await fetch("/api/map-submissions", { credentials: "same-origin" });
    if (!resp.ok) throw new Error("list failed");
    boMapSubmissions = await resp.json();
    boRenderMapSubmissions();
  } catch (err) {
    console.error("Failed to load map submissions:", err);
    document.getElementById("bo-map-submissions-empty").hidden = true;
    const errorEl = document.getElementById("bo-map-submissions-error");
    if (errorEl) errorEl.hidden = false;
  }
}
