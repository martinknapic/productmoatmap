// Vercel Function — LinkedIn OAuth redirect target.
//
// Exchanges the authorization code for tokens server-side (the Client Secret
// never reaches the browser), decodes the OpenID Connect ID token, and hands
// the result to the frontend without ever putting PII in a URL: the decoded
// profile is packed into a short-lived, HMAC-signed, HttpOnly cookie that only
// this Vercel Function can read back (see linkedin-profile.js). The frontend
// only ever sees a `li=ok` flag in the redirect.
//
// The ID token comes straight from LinkedIn's token endpoint over a
// server-to-server HTTPS call (not from anything the client supplied), so its
// claims are trusted without a separate JWKS signature check — this is an
// identity-verification gate for the apply/recommend/join-map forms, not a
// login system on its own.
//
// It also doubles as account registration: alongside the short-lived gate
// cookie, this sets a separate, longer-lived `pm_session` cookie (see
// member-me.js / member-logout.js) so the visitor stays recognized site-wide
// afterward — avatar + "My profile"/"Log out" in the nav. That happens on
// every allowed page below, but only signup.html (via api/member-signup.js,
// after showing the consent/newsletter copy) actually persists a profile
// record to storage — apply/recommend/join-map just leave the session
// cookie set as a side effect of verifying for their own form.

const crypto = require("crypto");

const COOKIE_NAME = "li_verify";
const COOKIE_TTL_SECONDS = 300; // just long enough to survive the redirect + profile fetch

const SESSION_COOKIE_NAME = "pm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// The frontend embeds which page started the OAuth flow into the `state`
// param as `<nonce>:<page>` (the nonce is still what's checked for CSRF,
// client-side). Whitelisted here so this can't be turned into an open
// redirect by a crafted state value.
const ALLOWED_PAGES = new Set(["apply", "recommend", "join-map", "signup", "interview"]);

// "interview" carries the personal-page token as a third part — `<nonce>:interview:<token>` —
// so a recommended person can register from their questionnaire page and land straight back on
// it. The token is only ever echoed into the redirect after matching a strict pattern.
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function parseState(rawState) {
  if (typeof rawState !== "string") return { nonce: null, page: "apply", token: null };
  const [nonce, page, token] = rawState.split(":");
  if (page === undefined) return { nonce, page: "apply", token: null };
  if (page === "interview") {
    return TOKEN_RE.test(token || "") ? { nonce, page, token } : { nonce, page: "apply", token: null };
  }
  return { nonce, page: ALLOWED_PAGES.has(page) ? page : "apply", token: null };
}

function redirectToApply(res, page, query, token) {
  res.setHeader("Location", `/${page}.html?${token ? `t=${token}&` : ""}${query}`);
  res.status(302).end();
}

function decodeIdToken(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

module.exports = async (req, res) => {
  const { code, error, state } = req.query;
  const { nonce, page, token } = parseState(state);

  if (error) {
    console.error("[linkedin-callback] denied by user:", error, req.query.error_description);
    return redirectToApply(res, page, "li=denied", token);
  }
  if (!code || typeof code !== "string") {
    console.error("[linkedin-callback] missing/invalid code param:", req.query);
    return redirectToApply(res, page, "li=error", token);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[linkedin-callback] missing env vars:", { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    return redirectToApply(res, page, "li=error", token);
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/linkedin-callback`;
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
      console.error("[linkedin-callback] token exchange failed:", tokenResp.status, errBody, "redirectUri used:", redirectUri);
      return redirectToApply(res, page, "li=error", token);
    }

    const tokenData = await tokenResp.json();
    if (!tokenData.id_token) {
      console.error("[linkedin-callback] no id_token in token response:", Object.keys(tokenData));
      return redirectToApply(res, page, "li=error", token);
    }

    const claims = decodeIdToken(tokenData.id_token);
    const profile = {
      sub: claims.sub || "", // LinkedIn's stable member ID — used to spot the same person under another email
      name: claims.name || "",
      email: claims.email || "",
      picture: claims.picture || null
    };

    const payload = Buffer.from(
      JSON.stringify({ ...profile, exp: Date.now() + COOKIE_TTL_SECONDS * 1000 })
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", clientSecret).update(payload).digest("base64url");
    const cookieValue = `${payload}.${signature}`;

    const sessionPayload = Buffer.from(
      JSON.stringify({ ...profile, exp: Date.now() + SESSION_TTL_SECONDS * 1000 })
    ).toString("base64url");
    const sessionSignature = crypto.createHmac("sha256", clientSecret).update(sessionPayload).digest("base64url");
    const sessionCookieValue = `${sessionPayload}.${sessionSignature}`;

    res.setHeader("Set-Cookie", [
      `${COOKIE_NAME}=${cookieValue}; Max-Age=${COOKIE_TTL_SECONDS}; Path=/api; HttpOnly; Secure; SameSite=Lax`,
      `${SESSION_COOKIE_NAME}=${sessionCookieValue}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
    ]);

    const query = new URLSearchParams({ li: "ok" });
    if (nonce) query.set("state", nonce);
    return redirectToApply(res, page, query.toString(), token);
  } catch (err) {
    console.error("[linkedin-callback] unexpected exception:", err && err.stack || err);
    return redirectToApply(res, page, "li=error", token);
  }
};
