// Vercel Routing Middleware — real, server-enforced gate for the backoffice
// dashboard pages. Runs before the static HTML is served, so an unauthenticated
// request never reaches the page at all (unlike the old client-side-only check
// that assets/backoffice.js used to do).
//
// Only the dashboard pages are matched — backoffice/index.html (the login page)
// and every /api/backoffice-* route stay reachable without a session.

import { next } from "@vercel/functions";
import session from "./api/_lib/session.js";

export const config = {
  runtime: "nodejs",
  // Listed both as the real file path (/*.html) and as the clean URL (cleanUrls
  // in vercel.json strips the extension) since which form middleware sees isn't
  // documented — matching both keeps the gate solid either way.
  matcher: [
    "/backoffice/candidates.html", "/backoffice/candidates",
    "/backoffice/candidate.html", "/backoffice/candidate",
    "/backoffice/preview.html", "/backoffice/preview",
    "/backoffice/questions.html", "/backoffice/questions",
    "/backoffice/users.html", "/backoffice/users",
    "/backoffice/profiles.html", "/backoffice/profiles",
    "/backoffice/map-submissions.html", "/backoffice/map-submissions",
    "/backoffice/calendar.html", "/backoffice/calendar",
    "/backoffice/featured.html", "/backoffice/featured"
  ]
};

export default function middleware(request) {
  // Admin cookies only: signed for the "admin" type and re-checked against BACKOFFICE_ALLOWED_EMAIL
  // (a LinkedIn member's own pm_session cookie is not accepted here).
  if (!session.fromHeader("admin", request.headers.get("cookie"))) {
    return Response.redirect(new URL("/backoffice", request.url));
  }

  return next();
}
