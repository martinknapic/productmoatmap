// ProductMoat — private preview of a personal interview (interview-preview.html?t=<token>)
//
// Shows the interview exactly as it would look once published, but it isn't live. The API only
// returns it to the signed-in person the interview is for, and to admins; anyone else gets a
// short explanation instead.

function initInterviewPreview() {
  const token = new URLSearchParams(location.search).get("t") || "";
  const top = document.getElementById("ivp-bar-top");
  const bottom = document.getElementById("ivp-bar-bottom");
  const root = document.getElementById("person-root");
  const back = `interview.html?t=${encodeURIComponent(token)}`;

  const message = (title, body, actions = "") => {
    top.innerHTML = `<div class="wrap ivp-message"><h1>${title}</h1><p>${body}</p><div class="iv-actions">${actions}</div></div>`;
  };

  if (!token) return message("This link isn't working.", "The preview link is incomplete.");

  let data = null;

  function toast(text, isError) {
    const el = document.getElementById("iv-toast");
    el.hidden = false; el.textContent = text; el.classList.toggle("is-error", !!isError);
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function actionButtons() {
    const missing = data.missing.length;
    let approve = "";
    if (data.locked || data.status === "published") approve = "";
    else if (data.approval && data.approval.approved) approve = `<span class="iv-final-badge"><span class="li-badge-check">&check;</span> Marked as your final version</span>`;
    else approve = `<span class="submit-wrap${missing ? " locked" : ""}"><button type="button" class="btn btn-primary js-approve" ${missing ? 'aria-disabled="true"' : ""}>I'm happy with this version</button>${missing ? `<span class="submit-hint" role="tooltip">${missing} required answer${missing === 1 ? "" : "s"} still missing — go back to finish</span>` : ""}</span>`;
    return `<a class="btn btn-ghost" href="${back}">&larr; Back to my answers</a>${approve}`;
  }

  function render() {
    const heading = data.asAdmin ? "PRIVATE PREVIEW — VIEWING AS PRODUCTMOAT ADMIN" : "PRIVATE PREVIEW — NOT PUBLISHED";
    top.innerHTML = `
      <div class="wrap ivp-inner">
        <div>
          <div class="ivp-tag">${heading}</div>
          <p>This is how your interview will look once it's published. It isn't live: only you and the ProductMoat team can see this page.</p>
        </div>
        <div class="iv-actions">${actionButtons()}</div>
      </div>`;
    bottom.hidden = false;
    bottom.innerHTML = `<div class="wrap ivp-inner"><p>Happy with how it looks? Tell us — or go back and keep editing.</p><div class="iv-actions">${actionButtons()}</div></div>`;
    renderPersonPage(root, data.preview, { preview: true });
    document.title = `Preview — ${data.preview.name} — ProductMoat`;
  }

  document.addEventListener("click", async (e) => {
    if (!e.target.closest(".js-approve")) return;
    if (data.missing.length) { toast("Some required answers are still missing — go back to finish them.", true); return; }
    try {
      const resp = await fetch("/api/interview", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ t: token, approve: true })
      });
      const res = await resp.json().catch(() => ({}));
      if (!resp.ok) throw res;
      data.approval = res.approval;
      render();
      toast("Marked as your final version — thank you!");
    } catch (err) {
      toast("Couldn't update just now — please try again.", true);
    }
  });

  fetch(`/api/interview?t=${encodeURIComponent(token)}&preview=1`, { credentials: "same-origin" })
    .then(async resp => {
      if (resp.status === 401) {
        return message("Sign in to see your preview.",
          "The preview is private. Sign in with the LinkedIn account tied to your interview to see how it will look — you'll find the sign-in on your interview page.",
          `<a class="btn btn-primary" href="${back}">Go to my interview page &rarr;</a>`);
      }
      if (resp.status === 403) {
        return message("This preview isn't available to this account.",
          "Only the person the interview is for, and the ProductMoat team, can see the preview. If that's you, sign in with the LinkedIn account tied to it.",
          `<a class="btn btn-ghost" href="${back}">Back to the interview page</a>`);
      }
      if (!resp.ok) return message("This link isn't working.", "It may have expired or been replaced. Reply to the message we sent you and we'll get you a fresh one.");
      data = await resp.json();
      render();
    })
    .catch(() => message("Something went wrong.", "We couldn't load the preview just now. Please refresh in a moment."));
}
