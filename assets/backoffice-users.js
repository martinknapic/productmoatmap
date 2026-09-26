// ProductMoat Backoffice - All users (users.html)
//
// One row per person the site knows about (members, candidates, map pins), with their newsletter
// opt-in and the double opt-in status read back from the newsletter service (SendFox).
// Data: /api/backoffice-users (admin session). Shares helpers with backoffice-candidates.js
// (avatars, toast, tooltips, confirmation dialog), which the page loads first.

const BO_NL_SOURCES = { signup: "Sign-up page", apply: "Apply", recommend: "Recommend", "join-map": "Put yourself on the map", interview: "Interview page", profile: "My profile", network: "Alumni network" };
const BO_DBL_FILTERS = new Set(["confirmed", "pending", "subscribed", "not_synced", "unsubscribed"]);

async function boUsersApi(payload) {
  const resp = await fetch("/api/backoffice-users", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Object.assign(new Error(data.error || "request failed"), { data });
  return data;
}

async function initBackofficeUsers() {
  if (!(await boCurrentGuard())) return;

  const state = { users: [], newsletter: { configured: false }, statuses: {}, statusLoaded: false, type: "all", nl: "all", dbl: "all", q: "" };
  const body = document.getElementById("bo-users-body");
  const fmtDay = iso => (iso ? new Date(iso).toLocaleDateString([], { dateStyle: "medium" }) : "");
  const e = boEscapeHTML;

  // ----- what to show in the Double opt-in column -----
  // returns { key, text, cls, tip } where key is the filter value
  function dblOf(u) {
    if (!u.newsletter.optedIn) return { key: "none", text: "-", cls: "", tip: "" };
    if (!state.newsletter.configured) return { key: "off", text: "Sync off", cls: "dim", tip: "Add SENDFOX_API_TOKEN and SENDFOX_LIST_ID as environment variables in Vercel to send opted-in people to the list." };
    const local = u.newsletter.sync;
    const s = state.statuses[u.email];
    if (s && s.state !== "error") {
      switch (s.state) {
        case "confirmed": return { key: "confirmed", text: "Confirmed", cls: "nl-confirmed", tip: `Confirmed their subscription${s.at ? ` on ${fmtDay(s.at)}` : ""}.` };
        case "pending": return { key: "pending", text: "Awaiting confirmation", cls: "nl-pending", tip: s.confirmationSentAt ? `Confirmation email sent ${fmtDay(s.confirmationSentAt)}; waiting for them to click it.` : "On the list; waiting for them to confirm." };
        case "subscribed": return { key: "subscribed", text: "Subscribed", cls: "nl-subscribed", tip: "On the list. This list doesn't use double opt-in, so no confirmation is needed." };
        case "unsubscribed": return { key: "unsubscribed", text: "Unsubscribed", cls: "nl-off", tip: `Unsubscribed${s.at ? ` on ${fmtDay(s.at)}` : ""}.` };
        case "bounced": return { key: "problem", text: "Bounced", cls: "nl-bad", tip: "Emails to this address bounce." };
        case "not_synced":
          if (local && local.state === "failed") return { key: "problem", text: "Sync failed", cls: "nl-bad", tip: `${(local.error || "The newsletter service refused the request").replace(/\.?$/, ".")} Use the send icon to retry.` };
          return { key: "not_synced", text: "Not sent yet", cls: "nl-todo", tip: "Opted in, but not on the list yet. Use the send icon to add them now." };
      }
    }
    if (s && s.state === "error") return { key: "problem", text: "Check failed", cls: "nl-bad", tip: `Couldn't read their status: ${s.error || "unknown error"}` };
    if (local && local.state === "failed") return { key: "problem", text: "Sync failed", cls: "nl-bad", tip: `${(local.error || "The newsletter service refused the request").replace(/\.?$/, ".")} Use the send icon to retry.` };
    return { key: "checking", text: state.statusLoaded ? "Unknown" : "Checking...", cls: "dim", tip: "Reading their status from the newsletter list." };
  }

  const typeBadges = u => [
    u.isMember ? `<span class="bo-badge bo-badge-src">Member</span>` : "",
    u.candidate ? `<span class="bo-badge bo-badge-src">Candidate</span> ${boPill(u.candidate.status)}` : "",
    u.pin ? `<span class="bo-badge bo-badge-src">Map pin</span> <span class="bo-cell-dim">${e(u.pin.status)}</span>` : ""
  ].filter(Boolean).join("<br>");

  function actionsOf(u) {
    const a = [];
    const d = dblOf(u);
    if (u.candidate) a.push(`<a class="bo-icon-btn" href="candidate.html?id=${encodeURIComponent(u.candidate.id)}" data-tip="Open their candidate page" aria-label="Open their candidate page">${BO_ICONS.edit}</a>`);
    if (u.newsletter.optedIn && state.newsletter.configured && (d.key === "not_synced" || d.key === "problem")) a.push(`<button type="button" class="bo-icon-btn" data-act="sync" data-email="${e(u.email)}" data-tip="Send to the newsletter list now" aria-label="Send to the newsletter list now">${BO_ICONS.send}</button>`);
    if (u.email) a.push(`<button type="button" class="bo-icon-btn" data-act="copy" data-email="${e(u.email)}" data-tip="Copy email address" aria-label="Copy email address">${BO_COPY_SVG}</button>`);
    return `<div class="bo-actions">${a.join("")}</div>`;
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return state.users.filter(u => {
      if (state.type === "member" && !u.isMember) return false;
      if (state.type === "candidate" && !u.candidate) return false;
      if (state.type === "pin" && !u.pin) return false;
      if (state.nl === "in" && !u.newsletter.optedIn) return false;
      if (state.nl === "out" && u.newsletter.optedIn) return false;
      if (state.dbl !== "all") { const k = dblOf(u).key; if (state.dbl === "problem" ? k !== "problem" : k !== state.dbl) return false; }
      return !q || [u.name, u.company, u.role, u.email, u.location].join(" ").toLowerCase().includes(q);
    });
  }

  function render() {
    const all = state.users;
    const optedIn = all.filter(u => u.newsletter.optedIn);
    const keys = optedIn.map(u => dblOf(u).key);
    const n = k => keys.filter(x => x === k).length;
    document.getElementById("bo-users-summary").innerHTML = [
      [all.length, "users"], [optedIn.length, "opted in to the newsletter"], [n("confirmed"), "confirmed"], [n("pending"), "awaiting confirmation"], [n("not_synced") + n("problem"), "not on the list yet"]
    ].map(([v, l]) => `<div class="bo-sum"><strong>${v}</strong><span>${e(l)}</span></div>`).join("");

    const counts = { all: all.length, member: all.filter(u => u.isMember).length, candidate: all.filter(u => u.candidate).length, pin: all.filter(u => u.pin).length };
    document.getElementById("bo-users-chips").innerHTML = [["all", "All"], ["member", "Members"], ["candidate", "Candidates"], ["pin", "Map pins"]]
      .map(([k, l]) => `<button type="button" class="bo-chip${state.type === k ? " is-active" : ""}" data-type="${k}">${l} <span>${counts[k]}</span></button>`).join("");

    const rows = filtered();
    document.getElementById("bo-users-count").textContent = `(${rows.length})`;
    document.getElementById("bo-users-empty").hidden = rows.length > 0;
    body.innerHTML = rows.map(u => {
      const d = dblOf(u);
      const nl = u.newsletter.optedIn
        ? `<span class="bo-pill bo-pill-nl-confirmed" data-tip="${e(`Opted in${u.newsletter.at ? ` on ${fmtDay(u.newsletter.at)}` : ""}${u.newsletter.source ? ` via ${BO_NL_SOURCES[u.newsletter.source] || u.newsletter.source}` : ""}.`)}" tabindex="0">Opted in</span>`
        : `<span class="bo-pill bo-pill-nl-off" data-tip="Hasn't opted in to the newsletter." tabindex="0">Not opted in</span>`;
      return `<tr>
        <td class="bo-cell-photo">${boCandAvatar({ name: u.name || u.email, photo: u.picture })}</td>
        <td class="bo-cell-strong">${e(u.name || "(no name)")}
          ${u.linkedin ? `<a class="bo-rec bo-li-inline" href="${e(u.linkedin)}" target="_blank" rel="noopener noreferrer" data-tip="Open their LinkedIn profile" aria-label="Open ${e(u.name)}'s LinkedIn profile">${BO_LINKEDIN_SVG}</a>` : ""}
          <br><span class="bo-cell-dim">${e(u.email || "no email")}</span></td>
        <td>${e(u.role) || "-"}<br><span class="bo-cell-dim">${e(u.company)}</span></td>
        <td>${e(u.location) || "-"}</td>
        <td>${typeBadges(u)}</td>
        <td>${e(fmtDay(u.since)) || "-"}</td>
        <td>${nl}</td>
        <td>${d.key === "none" ? `<span class="bo-cell-dim">-</span>` : `<span class="bo-pill bo-pill-${e(d.cls || "nl-off")}" ${d.tip ? `data-tip="${e(d.tip)}" tabindex="0"` : ""}>${e(d.text)}</span>`}</td>
        <td class="bo-cell-actions">${actionsOf(u)}</td>
      </tr>`;
    }).join("");
  }

  function renderBanner() {
    const el = document.getElementById("bo-users-banner");
    const nl = state.newsletter;
    el.hidden = false;
    if (!nl.configured) {
      el.className = "bo-banner is-warn";
      el.innerHTML = `<strong>Newsletter sync is off.</strong> Add <code>SENDFOX_API_TOKEN</code> and <code>SENDFOX_LIST_ID</code> as environment variables in Vercel (never in the code) and redeploy. Until then opt-ins are recorded here but not sent anywhere.`;
    } else if (nl.error) {
      el.className = "bo-banner is-warn";
      el.innerHTML = `<strong>Couldn't reach SendFox:</strong> ${e(nl.error)}. Check the token and list id.`;
    } else {
      el.className = "bo-banner";
      el.innerHTML = `Opted-in people are sent to the SendFox list <strong>${e(nl.name)}</strong> (${nl.subscribed} subscribed). Double opt-in on this list is <strong>${nl.doubleOptIn ? "on" : "off"}</strong>${nl.doubleOptIn ? "" : ": SendFox only asks people to confirm when the list has a confirmation email, so everyone shows as Subscribed. Turn one on for the list in SendFox to get a confirmation step."}`;
    }
    document.getElementById("bo-users-syncall").disabled = !nl.configured || !!nl.error;
    document.getElementById("bo-users-refresh").disabled = !nl.configured || !!nl.error;
  }

  async function loadStatus() {
    if (!state.newsletter.configured || state.newsletter.error) { state.statusLoaded = true; render(); return; }
    try {
      const r = await boUsersApi({ action: "status" });
      state.statuses = r.statuses || {};
      if (r.list) Object.assign(state.newsletter, r.list);
      renderBanner();
    } catch (err) { boToast("Couldn't read the newsletter statuses just now."); }
    state.statusLoaded = true;
    render();
  }

  // ----- events -----
  document.getElementById("bo-users-chips").addEventListener("click", ev => { const b = ev.target.closest("[data-type]"); if (b) { state.type = b.dataset.type; render(); } });
  document.getElementById("bo-users-nl").addEventListener("change", ev => { state.nl = ev.target.value; render(); });
  document.getElementById("bo-users-dbl").addEventListener("change", ev => { state.dbl = ev.target.value; render(); });
  document.getElementById("bo-users-search").addEventListener("input", ev => { state.q = ev.target.value; render(); });
  boIconTooltips(body);

  body.addEventListener("click", async ev => {
    const btn = ev.target.closest("[data-act]");
    if (!btn) return;
    const email = btn.dataset.email;
    if (btn.dataset.act === "copy") {
      try { await navigator.clipboard.writeText(email); boToast("Email copied"); } catch (err) { window.prompt("Copy:", email); }
      return;
    }
    if (btn.dataset.act === "sync") {
      btn.disabled = true;
      try {
        await boUsersApi({ action: "sync", email });
        boToast("Sent to the newsletter list");
      } catch (err) { boToast("The newsletter service didn't accept that. Try again in a moment."); }
      await refreshAll();
    }
  });

  document.getElementById("bo-users-refresh").addEventListener("click", async () => { state.statusLoaded = false; state.statuses = {}; render(); await loadStatus(); boToast("Status refreshed"); });
  document.getElementById("bo-users-syncall").addEventListener("click", async () => {
    const todo = state.users.filter(u => u.newsletter.optedIn && ["not_synced", "problem", "checking"].includes(dblOf(u).key));
    if (!(await boConfirm({ title: "Send everyone opted in to the list?", message: `Every member who opted in and isn't on <strong>${e(state.newsletter.name || "the list")}</strong> yet (${todo.length} right now) is added, and the service then sends its confirmation email if the list uses double opt-in. People who didn't opt in are never sent.`, confirmLabel: "Send to the list" }))) return;
    try {
      const r = await boUsersApi({ action: "syncAll" });
      boToast(`${r.sent} sent${r.failed ? `, ${r.failed} failed` : ""}`);
    } catch (err) { boToast("That didn't work. Try again."); }
    await refreshAll();
  });

  async function refreshAll() {
    const data = await (await fetch("/api/backoffice-users", { credentials: "same-origin" })).json();
    state.users = data.users || []; state.newsletter = data.newsletter || { configured: false };
    renderBanner(); render();
    await loadStatus();
  }

  try {
    const data = await (await fetch("/api/backoffice-users", { credentials: "same-origin" })).json();
    if (!data.users) throw new Error("bad");
    state.users = data.users; state.newsletter = data.newsletter || { configured: false };
    renderBanner(); render();
    loadStatus();
  } catch (err) {
    console.error("[all users] couldn't render:", err);
    document.getElementById("bo-users-error").hidden = false;
  }
}
