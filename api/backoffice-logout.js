// Vercel Function — clears the backoffice session cookie and sends the browser
// back to the login page.

module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", "bo_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  res.setHeader("Location", "/backoffice/index.html");
  return res.status(302).end();
};
