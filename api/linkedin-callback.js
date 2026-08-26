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

function redirectToApply(res, query) {
  res.setHeader("Location", `/apply.html?${query}`);
  res.status(302).end();
}

function decodeIdToken(idToken) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

module.exports = async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return redirectToApply(res, "li=denied");
  }
  if (!code || typeof code !== "string") {
    return redirectToApply(res, "li=error");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToApply(res, "li=error");
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
      return redirectToApply(res, "li=error");
    }

    const tokenData = await tokenResp.json();
    if (!tokenData.id_token) {
      return redirectToApply(res, "li=error");
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
    if (typeof state === "string") query.set("state", state);
    return redirectToApply(res, query.toString());
  } catch (err) {
    return redirectToApply(res, "li=error");
  }
};
