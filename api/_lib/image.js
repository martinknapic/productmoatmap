// On-the-fly photo resizing for the photo routes (?w=<pixels>).
//
// Photos are stored once at the size they were uploaded (up to 1600 px, 800 px for profile pictures)
// but shown at 130-650 px, so serving the original wastes 100-200 KB per image on a phone. With
// ?w= the route returns a smaller WebP instead (JPEG/PNG for the rare browser without WebP). The CDN
// caches each size. If sharp can't load for any reason the original is served: never a broken image.

let sharp = null;
try { sharp = require("sharp"); } catch (err) { console.error("[image] sharp unavailable, serving originals:", err && err.message); }

const MIN_W = 64, MAX_W = 2000;

// Returns { buffer, type } to send. `type`/`buffer` are the stored original; `req` supplies ?w= and Accept.
async function sized(req, type, buffer) {
  // ?og=1: a 1200x630 JPEG for link previews (LinkedIn / Facebook / X crop anything else), cropped
  // around the most interesting region so faces stay in frame.
  if (sharp && String((req.query || {}).og || "") === "1" && /^image\/(jpeg|png|webp)$/.test(type)) {
    try {
      const out = await sharp(buffer, { failOn: "none" }).rotate()
        .resize({ width: 1200, height: 630, fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      return { buffer: out, type: "image/jpeg", varyAccept: false };
    } catch (err) {
      console.error("[image] og crop failed, serving original:", (err && err.message) || err);
    }
  }
  const w = Math.round(Number((req.query || {}).w));
  if (!sharp || !(w >= MIN_W) || !/^image\/(jpeg|png|webp)$/.test(type)) return { buffer, type, varyAccept: false };
  try {
    const wantsWebp = /image\/webp/.test((req.headers && req.headers.accept) || "");
    let img = sharp(buffer, { failOn: "none" }).rotate().resize({ width: Math.min(w, MAX_W), withoutEnlargement: true });
    img = wantsWebp ? img.webp({ quality: 78 }) : type === "image/png" ? img.png() : img.jpeg({ quality: 80, mozjpeg: true });
    const out = await img.toBuffer();
    if (out.length >= buffer.length) return { buffer, type, varyAccept: true }; // never make it bigger
    return { buffer: out, type: wantsWebp ? "image/webp" : type, varyAccept: true };
  } catch (err) {
    console.error("[image] resize failed, serving original:", (err && err.message) || err);
    return { buffer, type, varyAccept: false };
  }
}

module.exports = { sized };
