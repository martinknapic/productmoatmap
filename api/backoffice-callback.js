// Vercel Function — LinkedIn OAuth redirect target for backoffice login.
//
// Reuses the same LinkedIn app as the public Apply form's verification gate
// (apply.html / linkedin-callback.js), but this is a real login: it checks the
// verified LinkedIn email against BACKOFFICE_ALLOWED_EMAIL and, if it matches,
// issues a persistent signed session cookie instead of a one-shot handoff.

const crypto = require("crypto");

const SESSION_COOKIE = "bo_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function allowedEmails() {
  return (process.env.BACKOFFICE_ALLOWED_EMAIL || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function redirectToLogin(res, query) {
  res.setHeader("Location", `/backoffice/index.html${query ? `?${query}` : ""}`);
  res.status(302).end();
}

function decodeIdToken(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

module.exports = async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error("[backoffice-callback] denied by user:", error);
    return redirectToLogin(res, "bo=denied");
  }
  if (!code || typeof code !== "string") {
    console.error("[backoffice-callback] missing/invalid code param");
    return redirectToLogin(res, "bo=error");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[backoffice-callback] missing LinkedIn env vars");
    return redirectToLogin(res, "bo=error");
  }

  const allowed = allowedEmails();
  if (!allowed.length) {
    console.error("[backoffice-callback] BACKOFFICE_ALLOWED_EMAIL is not configured");
    return redirectToLogin(res, "bo=error");
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/backoffice-callback`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text().catch(() => "<unreadable>");
      console.error("[backoffice-callback] token exchange failed:", tokenResp.status, errBody);
      return redirectToLogin(res, "bo=error");
    }

    const tokenData = await tokenResp.json();
    if (!tokenData.id_token) {
      console.error("[backoffice-callback] no id_token in token response");
      return redirectToLogin(res, "bo=error");
    }

    const claims = decodeIdToken(tokenData.id_token);
    const email = (claims.email || "").toLowerCase();

    if (!allowed.includes(email)) {
      console.error("[backoffice-callback] email not on allow-list:", email);
      return redirectToLogin(res, "bo=unauthorized");
    }

    const payload = Buffer.from(
      JSON.stringify({ email, name: claims.name || "", exp: Date.now() + SESSION_TTL_SECONDS * 1000 })
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", clientSecret).update(payload).digest("base64url");
    const cookieValue = `${payload}.${signature}`;

    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${cookieValue}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
    );
    res.setHeader("Location", "/backoffice/applications.html");
    return res.status(302).end();
  } catch (err) {
    console.error("[backoffice-callback] unexpected exception:", err && err.stack || err);
    return redirectToLogin(res, "bo=error");
  }
};
