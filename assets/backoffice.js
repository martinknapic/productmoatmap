// ProductMoat Backoffice — login gate + applications/recommendations tables
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

// ---------- Applications page ----------

function boRenderApplications() {
  const hidden = boGetHiddenIds();
  const overrides = boGetStatusOverrides();
  const rows = (typeof DUMMY_APPLICATIONS !== "undefined" ? DUMMY_APPLICATIONS : [])
    .filter(a => !hidden.has(a.id));

  boPaginate("applications", rows, a => `
    <tr data-id="${boEscapeHTML(a.id)}">
      <td>${boDemoBadge(a.isDemo)}</td>
      <td class="bo-cell-strong">${boEscapeHTML(a.name)}</td>
      <td>${boEscapeHTML(a.role)}<br><span class="bo-cell-dim">${boEscapeHTML(a.company)}</span></td>
      <td>${boEscapeHTML(a.location)}</td>
      <td>${boEscapeHTML(boFocusLabel(a.focusTag))}</td>
      <td>${a.yearsExperience != null ? `${boEscapeHTML(a.yearsExperience)} yrs` : "—"}</td>
      <td>${a.linkedin ? `<a class="bracket-link" href="${boEscapeHTML(a.linkedin)}" target="_blank" rel="noopener">[ Profile ]</a>` : "—"}</td>
      <td>${boEscapeHTML(a.contactEmail) || "—"}</td>
      <td>${boEscapeHTML(a.submittedAt)}</td>
      <td>${boStatusSelect(a.id, overrides[a.id] || a.status, BO_APPLICATION_STATUSES)}</td>
      <td>${a.isDemo ? `<button type="button" class="bo-row-remove" data-remove-id="${boEscapeHTML(a.id)}">[ Remove ]</button>` : ""}</td>
    </tr>
  `, { bodyId: "bo-applications-body", countId: "bo-app-count", emptyId: "bo-applications-empty", paginationId: "bo-applications-pagination" });
}

async function initBackofficeApplications() {
  if (!(await boCurrentGuard())) return;
  boRenderApplications();
  boWireRowActions(boRenderApplications);
  boWirePaginationControls({ applications: boRenderApplications });
}

// ---------- Recommendations page ----------

function boRenderRecommendations() {
  const hidden = boGetHiddenIds();
  const overrides = boGetStatusOverrides();
  const rows = (typeof DUMMY_RECOMMENDATIONS !== "undefined" ? DUMMY_RECOMMENDATIONS : [])
    .filter(r => !hidden.has(r.id));

  boPaginate("recommendations", rows, r => `
    <tr data-id="${boEscapeHTML(r.id)}">
      <td>${boDemoBadge(r.isDemo)}</td>
      <td class="bo-cell-strong">${boEscapeHTML(r.candidateName) || "—"}</td>
      <td>${r.candidateLinkedin ? `<a class="bracket-link" href="${boEscapeHTML(r.candidateLinkedin)}" target="_blank" rel="noopener">[ Profile ]</a>` : "—"}</td>
      <td>${r.stayAnonymous ? `<span class="bo-cell-dim">Anonymous</span>` : (boEscapeHTML(r.yourName) || "—")}</td>
      <td class="bo-cell-reason">${boEscapeHTML(r.reason) || "—"}</td>
      <td>${boEscapeHTML(r.submittedAt)}</td>
      <td>${boStatusSelect(r.id, overrides[r.id] || r.status, BO_RECOMMENDATION_STATUSES)}</td>
      <td>${r.isDemo ? `<button type="button" class="bo-row-remove" data-remove-id="${boEscapeHTML(r.id)}">[ Remove ]</button>` : ""}</td>
    </tr>
  `, { bodyId: "bo-recommendations-body", countId: "bo-rec-count", emptyId: "bo-recommendations-empty", paginationId: "bo-recommendations-pagination" });
}

async function initBackofficeRecommendations() {
  if (!(await boCurrentGuard())) return;
  boRenderRecommendations();
  boWireRowActions(boRenderRecommendations);
  boWirePaginationControls({ recommendations: boRenderRecommendations });
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
    const questionCount = (p.sections || []).reduce((n, s) => n + s.questions.length, 0);
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
      <td><a class="bracket-link" href="../person.html?slug=${boEscapeHTML(p.slug)}" target="_blank" rel="noopener">[ View ]</a></td>
    </tr>
  `;
  }, { bodyId: "bo-profiles-body", countId: "bo-profile-count", emptyId: "bo-profiles-empty", paginationId: "bo-profiles-pagination" });
}

async function initBackofficeProfiles() {
  if (!(await boCurrentGuard())) return;
  boRenderProfiles();
  boWirePaginationControls({ profiles: boRenderProfiles });
}
