// Vercel Function: serves the IndexNow ownership key at /indexnow.txt (see api/_lib/indexnow.js).
// 404 until INDEXNOW_KEY is set, so nothing is advertised on a deployment that hasn't opted in.

module.exports = (req, res) => {
  const key = process.env.INDEXNOW_KEY;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (!key) return res.status(404).send("");
  return res.status(200).send(key);
};
