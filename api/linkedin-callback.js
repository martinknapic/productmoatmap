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
// identity-verification gate, not a persistent login/session system.

const crypto = require("crypto");

const COOKIE_NAME = "li_verify";
const COOKIE_TTL_SECONDS = 300; // just long enough to survive the redirect + profile fetch

// The frontend embeds which page started the OAuth flow into the `state`
// param as `<nonce>:<page>` (the nonce is still what's checked for CSRF,
// client-side). Whitelisted here so this can't be turned into an open
// redirect by a crafted state value.
const ALLOWED_PAGES = new Set(["apply", "recommend"]);

function parseState(rawState) {
  if (typeof rawState !== "string") return { nonce: null, page: "apply" };
  const idx = rawState.indexOf(":");
  if (idx === -1) return { nonce: rawState, page: "apply" };
  const nonce = rawState.slice(0, idx);
  const page = rawState.slice(idx + 1);
  return { nonce, page: ALLOWED_PAGES.has(page) ? page : "apply" };
}

function redirectToApply(res, page, query) {
  res.setHeader("Location", `/${page}.html?${query}`);
  res.status(302).end();
}

function decodeIdToken(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

module.exports = async (req, res) => {
  const { code, error, state } = req.query;
  const { nonce, page } = parseState(state);

  if (error) {
    console.error("[linkedin-callback] denied by user:", error, req.query.error_description);
    return redirectToApply(res, page, "li=denied");
  }
  if (!code || typeof code !== "string") {
    console.error("[linkedin-callback] missing/invalid code param:", req.query);
    return redirectToApply(res, page, "li=error");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[linkedin-callback] missing env vars:", { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    return redirectToApply(res, page, "li=error");
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
      return redirectToApply(res, page, "li=error");
    }

    const tokenData = await tokenResp.json();
    if (!tokenData.id_token) {
      console.error("[linkedin-callback] no id_token in token response:", Object.keys(tokenData));
      return redirectToApply(res, page, "li=error");
    }

    const claims = decodeIdToken(tokenData.id_token);
    const profile = {
      name: claims.name || "",
      email: claims.email || "",
      picture: claims.picture || null
    };

    const payload = Buffer.from(
      JSON.stringify({ ...profile, exp: Date.now() + COOKIE_TTL_SECONDS * 1000 })
    ).toString("base64url");
    const signature = crypto.createHmac("sha256", clientSecret).update(payload).digest("base64url");
    const cookieValue = `${payload}.${signature}`;

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${cookieValue}; Max-Age=${COOKIE_TTL_SECONDS}; Path=/api; HttpOnly; Secure; SameSite=Lax`
    );

    const query = new URLSearchParams({ li: "ok" });
    if (nonce) query.set("state", nonce);
    return redirectToApply(res, page, query.toString());
  } catch (err) {
    console.error("[linkedin-callback] unexpected exception:", err && err.stack || err);
    return redirectToApply(res, page, "li=error");
  }
};
