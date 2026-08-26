// Vercel Function — backoffice-only moderation queue for "Put yourself on the
// map" submissions written by api/join-map.js. Session check mirrors
// api/backoffice-me.js (this route isn't covered by middleware.js's page
// matcher, so it re-checks bo_session itself). Submissions are private blobs
// (they hold an email address), so every read here goes through the SDK's
// authenticated get() rather than a bare fetch of a public URL.
//
// GET  -> list every submission, newest first.
// POST -> { id, status } to set a submission's status ("pending" |
//          "approved" | "rejected"). Only "approved" ones are picked up by
//          api/map-people.js for the public globe.

const crypto = require("crypto");
const { list, get, put } = require("@vercel/blob");

const SESSION_COOKIE = "bo_session";
const PREFIX = "map-submissions/";
const STATUSES = new Set(["pending", "approved", "rejected"]);

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function verifySession(cookieValue, secret) {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.exp || Date.now() > data.exp) return null;
  return data;
}

async function readSubmission(pathname) {
  const result = await get(pathname, { access: "private" });
  if (!result || !result.stream) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

module.exports = async (req, res) => {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  const cookies = parseCookies(req.headers.cookie);
  const session = secret ? verifySession(cookies[SESSION_COOKIE], secret) : null;

  if (!session) {
    return res.status(401).json({ error: "not_authenticated" });
  }

  if (req.method === "GET") {
    try {
      const { blobs } = await list({ prefix: PREFIX });
      const submissions = (await Promise.all(blobs.map(b => readSubmission(b.pathname))))
        .filter(Boolean)
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
      return res.status(200).json(submissions);
    } catch (err) {
      console.error("[map-submissions] list failed:", (err && err.stack) || err);
      return res.status(500).json({ error: "storage_failed" });
    }
  }

  if (req.method === "POST") {
    const { id, status } = req.body || {};
    if (typeof id !== "string" || !id || !STATUSES.has(status)) {
      return res.status(400).json({ error: "invalid_request" });
    }

    try {
      const pathname = `${PREFIX}${id}.json`;
      const submission = await readSubmission(pathname);
      if (!submission) return res.status(404).json({ error: "not_found" });

      submission.status = status;
      await put(pathname, JSON.stringify(submission), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json"
      });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[map-submissions] update failed:", (err && err.stack) || err);
      return res.status(500).json({ error: "storage_failed" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
};
