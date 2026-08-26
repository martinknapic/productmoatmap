// Vercel Routing Middleware — real, server-enforced gate for the backoffice
// dashboard pages. Runs before the static HTML is served, so an unauthenticated
// request never reaches the page at all (unlike the old client-side-only check
// that assets/backoffice.js used to do).
//
// Only the dashboard pages are matched — backoffice/index.html (the login page)
// and every /api/backoffice-* route stay reachable without a session.

import { next } from "@vercel/functions";
import { createHmac, timingSafeEqual } from "node:crypto";

export const config = {
  runtime: "nodejs",
  matcher: [
    "/backoffice/applications.html",
    "/backoffice/recommendations.html",
    "/backoffice/profiles.html"
  ]
};

const SESSION_COOKIE = "bo_session";

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function verify(cookieValue, secret) {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.exp || Date.now() > data.exp) return null;
  return data;
}

export default function middleware(request) {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  const cookies = parseCookies(request.headers.get("cookie"));
  const session = secret ? verify(cookies[SESSION_COOKIE], secret) : null;

  if (!session) {
    return Response.redirect(new URL("/backoffice/index.html", request.url));
  }

  return next();
}
