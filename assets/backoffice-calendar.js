// Product Moat Backoffice - the publishing calendar (backoffice/calendar.html)
//
// One column per week, four quarters per year, filled from the live candidate pipeline
// (/api/candidates): a candidate lands on the week of their publish date - the date it went
// live, the date it is scheduled for, or (failing both) the estimated date they were told.
// Declined candidates and candidates with no date yet are left off.
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
  return date ? { c, kind, date } : null;
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

const boCalNameOf = c => c.profile.name || "(name not known yet)";
const boCalHref = c => `candidate?id=${encodeURIComponent(c.id)}`;
const boCalKindTag = e => `<span class="cal-kind cal-kind-${e.kind}">${BO_CAL_KIND_LABELS[e.kind]}</span>`;

function boCalRenderCell(week, today, entries) {
  entries = entries || [];
  const isCurrent = today >= week.start && today <= week.end;
  const isPast = week.end < today;
  const status = entries.some(e => e.kind === "published") ? "published" : entries.length ? "planned" : isPast ? "gap" : "open";
  const range = `${calFormatShort(week.start)} - ${calFormatShort(week.end)}`;

  let bodyHTML;
  if (entries.length === 1) {
    const e = entries[0];
    bodyHTML = `
      <a class="cal-card" href="${boCalHref(e.c)}" title="${boEscapeHTML(boCalNameOf(e.c))}">
        ${boCandAvatar(e.c.profile, "cal-card-avatar")}
        <span class="cal-card-name">${boEscapeHTML(boCalNameOf(e.c))}</span>
        ${boCalKindTag(e)}
      </a>`;
  } else if (entries.length > 1) {
    bodyHTML = `
      <button type="button" class="cal-multi" data-week="${week.index}" aria-haspopup="true" aria-label="${entries.length} candidates in week ${week.index}">
        <span class="cal-multi-count">${entries.length}</span>
        <span class="cal-multi-label">candidates</span>
      </button>`;
  } else {
    bodyHTML = `<div class="cal-empty"><span class="cal-empty-label">${isPast ? "-" : "Open"}</span></div>`;
  }

  // Recommending someone into a week only makes sense while it is still ahead of (or under) us.
  const hoverHTML = isPast ? "" : `<div class="cal-hover"><a class="cal-hover-btn" href="/recommend" target="_blank" rel="noopener">Recommend</a></div>`;

  return `
    <td class="cal-cell" data-status="${status}"${isCurrent ? ' data-current="true"' : ""}>
      <div class="cal-cell-inner">
        <div class="cal-cell-head">
          <span class="cal-week-no">W${boCalPad(week.index)}</span>
          <span class="cal-week-range">${range}</span>
        </div>
        ${bodyHTML}
      </div>
      ${hoverHTML}
    </td>`;
}

// One floating list for every "N candidates" cell (position: fixed, so the table's horizontal
// scroll can't clip it). Opens on hover or keyboard focus, and stays open while the pointer is
// over it so the names in it can be clicked.
function boCalWirePopover(board, weekEntries) {
  let pop = document.getElementById("cal-pop");
  if (!pop) { pop = document.createElement("div"); pop.id = "cal-pop"; pop.className = "cal-pop"; pop.hidden = true; document.body.appendChild(pop); }
  let timer = null;

  const hide = () => { pop.hidden = true; };
  const hideSoon = () => { clearTimeout(timer); timer = setTimeout(hide, 120); };
  const keep = () => clearTimeout(timer);

  function show(btn) {
    keep();
    const list = weekEntries().get(Number(btn.dataset.week)) || [];
    pop.innerHTML = list.map(e => `
      <a class="cal-pop-row" href="${boCalHref(e.c)}">
        ${boCandAvatar(e.c.profile, "cal-pop-avatar")}
        <span class="cal-pop-main">
          <span class="cal-pop-name">${boEscapeHTML(boCalNameOf(e.c))}</span>
          <span class="cal-pop-sub">${boEscapeHTML([e.c.profile.role, e.c.profile.company].filter(Boolean).join(" at ") || "-")}</span>
        </span>
        <span class="cal-pop-meta">${boCalKindTag(e)}<span class="cal-pop-date">${boEscapeHTML(new Date(`${e.date}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short" }))}</span></span>
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

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const thisYear = today.getUTCFullYear();
  const years = [thisYear, thisYear + 1, thisYear + 2]; // the current year, always, plus two ahead
  let year = thisYear;
  let shown = new Map(); // week index -> entries, for the year on screen

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

  const inYear = y => { const weeks = calBuildYearWeeks(y); return entries.filter(e => boCalWeekOf(weeks, y, e.date)); };

  function render() {
    yearsEl.innerHTML = years.map(y =>
      `<button type="button" class="bo-chip${y === year ? " is-active" : ""}" data-year="${y}">${y} <span>${inYear(y).length}</span></button>`
    ).join("");

    const weeks = calBuildYearWeeks(year);
    const byWeek = new Map();
    entries.forEach(e => {
      const i = boCalWeekOf(weeks, year, e.date);
      if (i) byWeek.set(i, [...(byWeek.get(i) || []), e]);
    });
    byWeek.forEach(list => list.sort((a, b) => a.date.localeCompare(b.date) || boCalNameOf(a.c).localeCompare(boCalNameOf(b.c))));

    board.innerHTML = [1, 2, 3, 4].map(q =>
      calRenderQuarter(weeks.filter(w => w.quarter === q), q, today, byWeek, boCalRenderCell)
    ).join("");
    shown = byWeek;
  }

  boCalWirePopover(board, () => shown);
  yearsEl.addEventListener("click", e => {
    const b = e.target.closest("[data-year]");
    if (!b) return;
    year = Number(b.dataset.year);
    render();
  });

  if (noteEl && undated > 0) noteEl.textContent = `${undated} ${undated === 1 ? "candidate has" : "candidates have"} no publish date yet, so ${undated === 1 ? "it isn't" : "they aren't"} on the calendar.`;
  render();
}
