// Product Moat Backoffice - the publishing calendar (backoffice/calendar.html)
//
// One column per week, four quarters per year, filled from the live candidate pipeline
// (/api/candidates): a candidate lands on the week of their publish date - the date it went
// live, the date it is scheduled for, or (failing both) the estimated date they were told.
// Declined candidates and candidates with no date yet are left off.
//
// A switch above the board flips between two views of the same data: "Publishing" (the week each
// candidate goes live) and "Featured" (who is featured on the main page that week, with the
// from-to dates). The homepage features the newest interview, so a candidate is featured for the
// full Monday to Sunday week of their publish date.
//
// Candidates that are not live yet can be dragged to another week (cards, or the rows of the
// "N candidates" list). That moves every date the person is placed by - the estimated date they
// were told, and for a scheduled interview its go-live time and display date - by whole weeks,
// keeping the weekday. Published interviews stay where they are.
//
// Reuses the week maths and quarter table from site.js (calBuildYearWeeks, calRenderQuarter)
// and the avatar / escaping helpers from backoffice-candidates.js and backoffice.js.

const BO_CAL_KIND_LABELS = { published: "Published", scheduled: "Scheduled", estimated: "Est." };

const boCalPad = n => String(n).padStart(2, "0");
const boCalLocalDay = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${boCalPad(d.getMonth() + 1)}-${boCalPad(d.getDate())}`;
};
const boCalDay = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : v ? boCalLocalDay(v) : "");

// The one date a candidate is placed by, and what kind of date it is.
function boCalEntry(c) {
  if (c.status === "declined") return null;
  const pub = c.publish || {};
  let kind = "", date = "";
  if (c.status === "published") { kind = "published"; date = boCalDay(pub.displayDate) || boCalDay(pub.publishedAt) || boCalDay(pub.scheduledPublishAt); }
  else if (pub.scheduledPublishAt) { kind = "scheduled"; date = boCalDay(pub.scheduledPublishAt); }
  else if (c.invitation && c.invitation.estimatedPublishDate) { kind = "estimated"; date = boCalDay(c.invitation.estimatedPublishDate); }
  // The week they are featured on the homepage. A planned feature date (publish.featureOn, set by an
  // admin, never automatic) counts when it is not before the publish date. A live interview that is
  // already featured is featured from its own date; one published without the spotlight has no feature
  // week until an admin plans one.
  const plan = /^\d{4}-\d{2}-\d{2}$/.test(pub.featureOn || "") && pub.featureOn >= date ? pub.featureOn : "";
  const notFeatured = kind === "published" && pub.featured === false;
  const feat = notFeatured ? plan : kind === "published" ? date : plan || date;
  return date ? { c, kind, date, feat } : null;
}

// Which week (1..52) of `year` a YYYY-MM-DD date falls in, or 0. The trailing days of a year that
// has a 53rd Monday fall after week 52 - those go on week 52 rather than vanishing.
function boCalWeekOf(weeks, year, dateStr) {
  const d = calDateUTC(dateStr);
  const w = weeks.find(x => d >= x.start && d <= x.end);
  if (w) return w.index;
  const last = weeks[weeks.length - 1];
  return d > last.end && d.getUTCFullYear() === year ? last.index : 0;
}

// The date a candidate sits on in each view: the publish date, or the date they are featured.
const boCalKeyDate = (e, mode) => (mode === "featured" ? e.feat : e.date); // "" = not on this calendar

const BO_CAL_MODES = { publishing: "Publishing", featured: "Featured" };
const BO_CAL_EYEBROWS = { publishing: "The publishing calendar", featured: "The featured calendar" };
const BO_CAL_MODE_KEY = "bo-cal-mode";
const BO_CAL_HIDE_KEY = "bo-cal-hide-past";

// "Mon 5 Oct" for a week boundary (the week dates are UTC midnights, see calBuildYearWeeks).
const boCalDayLabel = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const boCalNameOf = c => c.profile.name || "(name not known yet)";
const boCalHref = c => `candidate?id=${encodeURIComponent(c.id)}`;
// Every card can be picked up and dropped on another week.
const boCalDragAttrs = e => ` draggable="true" data-drag-id="${boEscapeHTML(e.c.id)}"`;
const boCalKindTag = e => `<span class="cal-kind cal-kind-${e.kind}">${BO_CAL_KIND_LABELS[e.kind]}</span>`;

// The from-to block on a featured card: the week the candidate holds the homepage, Monday to Sunday.
const boCalFeaturedDates = week => `
  <span class="cal-feat">
    <span class="cal-feat-row"><span class="cal-feat-lbl">From</span>${boEscapeHTML(boCalDayLabel(week.start))}</span>
    <span class="cal-feat-row"><span class="cal-feat-lbl">To</span>${boEscapeHTML(boCalDayLabel(week.end))}</span>
  </span>`;

// Hover text in the Featured view: the week the person is featured and the date that puts them there.
const boCalFeaturedTitle = (e, week) =>
  `${boCalNameOf(e.c)} - ${e.kind === "published" ? "featured" : "planned to be featured"} ${boCalDayLabel(week.start)} to ${boCalDayLabel(week.end)} (${e.kind === "published" ? "published" : BO_CAL_KIND_LABELS[e.kind].toLowerCase() + " publish date"} ${boCalDayLabel(calDateUTC(e.date))})`;

function boCalRenderCell(week, today, entries, mode) {
  entries = entries || [];
  const featured = mode === "featured";
  const isCurrent = today >= week.start && today <= week.end;
  const isPast = week.end < today;
  const status = entries.some(e => e.kind === "published") ? "published" : entries.length ? "planned" : isPast ? "gap" : "open";
  const range = `${calFormatShort(week.start)} - ${calFormatShort(week.end)}`;

  let bodyHTML;
  if (entries.length === 1) {
    const e = entries[0];
    bodyHTML = `
      <a class="cal-card" href="${boCalHref(e.c)}" title="${boEscapeHTML(featured ? boCalFeaturedTitle(e, week) : boCalNameOf(e.c))}${" - drag to another week to move"}"${boCalDragAttrs(e)}>
        ${boCandAvatar(e.c.profile, "cal-card-avatar")}
        <span class="cal-card-name">${boEscapeHTML(boCalNameOf(e.c))}</span>
        ${featured ? boCalFeaturedDates(week) : boCalKindTag(e)}
      </a>`;
  } else if (entries.length > 1) {
    bodyHTML = `
      <button type="button" class="cal-multi" data-week="${week.index}" aria-haspopup="true" aria-label="${entries.length} candidates ${featured ? "featured" : "publishing"} in week ${week.index}">
        <span class="cal-multi-count">${entries.length}</span>
        <span class="cal-multi-label">${featured ? "overlap" : "candidates"}</span>
      </button>`;
  } else {
    bodyHTML = `<div class="cal-empty"><span class="cal-empty-label">${isPast ? "-" : "Open"}</span></div>`;
  }

  // Recommending someone into a week only makes sense while it is still ahead of (or under) us.
  const hoverHTML = isPast ? "" : `<div class="cal-hover"><a class="cal-hover-btn" href="/recommend" target="_blank" rel="noopener">Recommend</a></div>`;

  return `
    <td class="cal-cell" data-status="${status}" data-week="${week.index}" data-droppable="true"${isCurrent ? ' data-current="true"' : ""}>
      <div class="cal-cell-inner">
        <div class="cal-cell-head">
          <span class="cal-week-no">W${boCalPad(week.index)}</span>
          ${featured && entries.length ? "" : `<span class="cal-week-range">${range}</span>`}
        </div>
        ${bodyHTML}
      </div>
      ${hoverHTML}
    </td>`;
}

// One floating list for every "N candidates" cell (position: fixed, so the table's horizontal
// scroll can't clip it). Opens on hover or keyboard focus, and stays open while the pointer is
// over it so the names in it can be clicked.
function boCalWirePopover(board, weekEntries, weekOf, mode) {
  let pop = document.getElementById("cal-pop");
  if (!pop) { pop = document.createElement("div"); pop.id = "cal-pop"; pop.className = "cal-pop"; pop.hidden = true; document.body.appendChild(pop); }
  let timer = null;

  const hide = () => { if (!pop.classList.contains("is-dragging")) pop.hidden = true; };
  const hideSoon = () => { clearTimeout(timer); timer = setTimeout(hide, 120); };
  const keep = () => clearTimeout(timer);

  function show(btn) {
    keep();
    const list = weekEntries().get(Number(btn.dataset.week)) || [];
    const week = weekOf(Number(btn.dataset.week));
    const featured = mode() === "featured" && week;
    pop.innerHTML = list.map(e => `
      <a class="cal-pop-row" href="${boCalHref(e.c)}" title="${boEscapeHTML(featured ? boCalFeaturedTitle(e, week) : boCalNameOf(e.c))}"${boCalDragAttrs(e)}>
        ${boCandAvatar(e.c.profile, "cal-pop-avatar")}
        <span class="cal-pop-main">
          <span class="cal-pop-name">${boEscapeHTML(boCalNameOf(e.c))}</span>
          <span class="cal-pop-sub">${boEscapeHTML([e.c.profile.role, e.c.profile.company].filter(Boolean).join(" at ") || "-")}</span>
        </span>
        <span class="cal-pop-meta">${boCalKindTag(e)}<span class="cal-pop-date">${boEscapeHTML(featured
            ? `${boCalDayLabel(week.start)} - ${boCalDayLabel(week.end)}`
            : new Date(`${boCalKeyDate(e, mode())}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short" }))}</span></span>
      </a>`).join("");
    pop.hidden = false;
    const r = btn.closest(".cal-cell").getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    const below = r.bottom + 6;
    const top = below + h > window.innerHeight - 8 && r.top - h - 6 > 8 ? r.top - h - 6 : below;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  board.addEventListener("mouseover", e => { const b = e.target.closest(".cal-multi"); if (b) show(b); });
  board.addEventListener("mouseout", e => { if (e.target.closest(".cal-multi")) hideSoon(); });
  board.addEventListener("focusin", e => { const b = e.target.closest(".cal-multi"); if (b) show(b); });
  board.addEventListener("focusout", e => { if (e.target.closest(".cal-multi")) hideSoon(); });
  pop.onmouseenter = keep;
  pop.onmouseleave = hideSoon;
  window.addEventListener("scroll", hide, { passive: true });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hide(); });
}

async function initBackofficeCalendar() {
  if (!(await boCurrentGuard())) return;

  const board = document.getElementById("cal-board");
  const yearsEl = document.getElementById("cal-years");
  const noteEl = document.getElementById("cal-note");
  const modeEl = document.getElementById("cal-mode");
  const eyebrowEl = document.getElementById("cal-eyebrow");

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const thisYear = today.getUTCFullYear();
  const years = [thisYear, thisYear + 1, thisYear + 2]; // the current year, always, plus two ahead
  let year = thisYear;
  let shown = new Map(); // week index -> entries, for the year on screen
  let shownWeeks = [];
  let mode = "publishing";
  const params = new URLSearchParams(location.search);
  const focusDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date") : "";
  if (params.get("mode") in BO_CAL_MODES) mode = params.get("mode");
  else try { if (localStorage.getItem(BO_CAL_MODE_KEY) in BO_CAL_MODES) mode = localStorage.getItem(BO_CAL_MODE_KEY); } catch (e) { /* storage blocked: default view */ }

  let focusDone = false;
  if (focusDate) year = Number(focusDate.slice(0, 4));
  if (!years.includes(year)) year = thisYear;
  let hidePast = false;
  try { hidePast = localStorage.getItem(BO_CAL_HIDE_KEY) === "1"; } catch (e) { /* default: show everything */ }
  const hideEl = document.getElementById("cal-hide-past");
  hideEl.checked = hidePast;
  hideEl.addEventListener("change", () => {
    hidePast = hideEl.checked;
    try { localStorage.setItem(BO_CAL_HIDE_KEY, hidePast ? "1" : "0"); } catch (err) { /* per-viewer convenience only */ }
    render();
  });
  let entries = [];
  let undated = 0;
  try {
    const resp = await fetch("/api/candidates", { credentials: "same-origin" });
    if (!resp.ok) throw new Error("load failed");
    const all = await resp.json();
    entries = all.map(boCalEntry).filter(Boolean);
    undated = all.filter(c => c.status !== "declined").length - entries.length;
  } catch (err) {
    board.innerHTML = `<p class="cal-error">Couldn't load the candidates. Reload the page to try again.</p>`;
    return;
  }

  const inYear = y => { const weeks = calBuildYearWeeks(y); return entries.filter(e => boCalKeyDate(e, mode) && boCalWeekOf(weeks, y, boCalKeyDate(e, mode))); };

  function render() {
    modeEl.innerHTML = Object.entries(BO_CAL_MODES).map(([k, label]) =>
      `<button type="button" role="radio" aria-checked="${k === mode}" class="cal-mode-btn${k === mode ? " is-active" : ""}" data-mode="${k}">${label}</button>`
    ).join("");
    eyebrowEl.textContent = BO_CAL_EYEBROWS[mode];
    board.dataset.mode = mode;
    yearsEl.innerHTML = years.map(y =>
      `<button type="button" class="bo-chip${y === year ? " is-active" : ""}" data-year="${y}">${y} <span>${inYear(y).length}</span></button>`
    ).join("");

    const weeks = calBuildYearWeeks(year);
    const byWeek = new Map();
    entries.forEach(e => {
      const i = boCalKeyDate(e, mode) && boCalWeekOf(weeks, year, boCalKeyDate(e, mode));
      if (i) byWeek.set(i, [...(byWeek.get(i) || []), e]);
    });
    byWeek.forEach(list => list.sort((a, b) => boCalKeyDate(a, mode).localeCompare(boCalKeyDate(b, mode)) || boCalNameOf(a.c).localeCompare(boCalNameOf(b.c))));

    // "Hide past quarters": in the current year, the quarters that ended before this one.
    const currentQ = Math.floor(today.getUTCMonth() / 3) + 1;
    const quarters = [1, 2, 3, 4].filter(q => !(hidePast && year === thisYear && q < currentQ));
    board.innerHTML = quarters.map(q =>
      calRenderQuarter(weeks.filter(w => w.quarter === q), q, today, byWeek, (w, t, list) => boCalRenderCell(w, t, list, mode))
    ).join("");
    shown = byWeek;
    shownWeeks = weeks;
    // Arrived from a date link (e.g. the Featured column on Candidates): show that week.
    if (focusDate) {
      const cell = board.querySelector(`[data-week="${boCalWeekOf(weeks, year, focusDate)}"]`);
      if (cell && calDateUTC(focusDate).getUTCFullYear() === year) {
        cell.classList.add("is-focus");
        if (!focusDone) { focusDone = true; cell.scrollIntoView({ block: "center", inline: "center" }); }
      }
    }
  }

  boCalWirePopover(board, () => shown, i => shownWeeks.find(w => w.index === i), () => mode);
  modeEl.addEventListener("click", e => {
    const b = e.target.closest("[data-mode]");
    if (!b || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    try { localStorage.setItem(BO_CAL_MODE_KEY, mode); } catch (err) { /* per-viewer convenience only */ }
    render();
  });
  // ---- drag and drop: move a not-yet-live candidate to another week ----
  let dragId = null, overCell = null, saving = false;
  const clearDrag = () => {
    dragId = null;
    if (overCell) overCell.classList.remove("is-drop-target");
    overCell = null;
    board.classList.remove("is-dragging");
    const pop = document.getElementById("cal-pop");
    if (pop) { pop.classList.remove("is-dragging"); pop.hidden = true; }
  };
  const dayStr = d => d.toISOString().slice(0, 10);

  const mondayOf = day => { const d = calDateUTC(day); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; };
  const BO_CAL_ERRORS = {
    feature_before_publish: "can't be featured before they are published. Pick their publish week or a later one.",
    date_in_past: "can't be scheduled in the past. Pick a later week.",
    invite_first: "has no invitation yet, so there is no estimated date to move."
  };

  async function moveTo(id, weekIndex) {
    const entry = entries.find(x => x.c.id === id);
    const target = shownWeeks.find(w => w.index === weekIndex);
    const featuredView = mode === "featured";
    const fromDate = entry && boCalKeyDate(entry, mode);
    const fromIndex = entry && boCalWeekOf(shownWeeks, year, fromDate);
    const source = shownWeeks.find(w => w.index === fromIndex);
    if (!entry || !target || !source || fromIndex === weekIndex || saving) return;
    const name = boCalNameOf(entry.c), live = entry.kind === "published";
    const unfeatured = live && entry.c.publish.featured === false;
    const movesFeature = featuredView && (!live || unfeatured); // only the plan moves, never the publish date

    // Same weekday in the target week.
    const offset = Math.min(6, Math.max(0, Math.round((calDateUTC(fromDate) - source.start) / 864e5)));
    const next = new Date(target.start);
    next.setUTCDate(next.getUTCDate() + offset);
    let newDay = dayStr(next);

    // Moving a live interview's own date can't go into the future (the homepage would pick it up at
    // once); anything planned can't go into a week that has passed.
    if (!movesFeature && live && target.start > today) { boToast(`${name} is already live, so they can't be moved to a future week.`); return; }
    if (!movesFeature && live && newDay > dayStr(today)) newDay = dayStr(today);
    if ((movesFeature || !live) && target.end < today) { boToast(`${name} can't be moved to a week that has passed.`); return; }
    if ((movesFeature || !live) && newDay < dayStr(today)) newDay = dayStr(today);

    const payload = { action: "setDates", id };
    if (movesFeature) {
      // Only the plan moves. It can't start before the week the interview goes live, and it never
      // features anyone: an admin does that by hand.
      if (target.end < mondayOf(entry.date)) {
        boToast(`${name} can't be featured before they are published. They ${live ? "went live" : "go live"} ${boCalDayLabel(calDateUTC(entry.date))}: pick that week or a later one${live ? "" : ", or move the publish date first in the Publishing view"}.`);
        return;
      }
      payload.featureDate = newDay < entry.date ? entry.date : newDay; // same week as publishing, but not before it
    } else {
      // Publishing view (or a live, already featured interview, which has one date): the publish date
      // moves, and a planned feature date moves with it unless it was set to a later week on purpose.
      payload.publishDate = newDay;
      const plan = entry.c.publish && entry.c.publish.featureOn;
      if (!live && plan) payload.featureDate = entry.feat === entry.date ? newDay : (entry.feat > newDay ? entry.feat : newDay);
    }

    saving = true;
    board.classList.add("is-saving");
    try {
      const resp = await boCandApi(payload);
      const moved = boCalEntry(resp.candidate);
      entries = entries.map(x => (x.c.id === id ? (moved || x) : x));
      render();
      boToast(`${boCalNameOf(entry.c)} moved to W${boCalPad(weekIndex)} (${boCalDayLabel(target.start)} - ${boCalDayLabel(target.end)})`);
    } catch (err) {
      boToast(BO_CAL_ERRORS[err && err.message] ? `${name} ${BO_CAL_ERRORS[err.message]}` : `Couldn't move ${name}. Nothing was changed.`);
    } finally {
      saving = false;
      board.classList.remove("is-saving");
    }
  }

  document.addEventListener("dragstart", e => {
    const el = e.target.closest && e.target.closest("[data-drag-id]");
    if (!el || saving) return;
    dragId = el.dataset.dragId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
    board.classList.add("is-dragging");
    // The hover list sits over the board: fade it (after the browser has taken the drag image)
    // so the weeks underneath can be dropped on.
    setTimeout(() => { const pop = document.getElementById("cal-pop"); if (pop && dragId) pop.classList.add("is-dragging"); }, 0);
  });
  document.addEventListener("dragend", clearDrag);
  board.addEventListener("dragover", e => {
    const cell = dragId && e.target.closest("[data-droppable]");
    if (overCell && overCell !== cell) overCell.classList.remove("is-drop-target");
    overCell = cell || null;
    if (!cell) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    cell.classList.add("is-drop-target");
  });
  board.addEventListener("drop", e => {
    const cell = dragId && e.target.closest("[data-droppable]");
    if (!cell) return;
    e.preventDefault();
    const id = dragId, week = Number(cell.dataset.week);
    clearDrag();
    moveTo(id, week);
  });

  yearsEl.addEventListener("click", e => {
    const b = e.target.closest("[data-year]");
    if (!b) return;
    year = Number(b.dataset.year);
    render();
  });

  if (noteEl && undated > 0) noteEl.textContent = `${undated} ${undated === 1 ? "candidate has" : "candidates have"} no publish date yet, so ${undated === 1 ? "it isn't" : "they aren't"} on the calendar.`;
  render();
}
