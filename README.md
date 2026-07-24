# ProductMoat Globe

Interactive world globe (Google-Earth style) showing product managers as zoomable clusters.
Built with [MapLibre GL JS](https://maplibre.org/) (globe projection) and the free Carto
dark basemap — no API keys, no build step, fully static.

## How it works

- **World view** — the globe slowly spins until you interact. People are grouped into
  clusters (circles with a count).
- **Zoom in** (scroll, pinch, or click a cluster) — clusters break apart into smaller
  regional/city clusters.
- **Fully zoomed** — individuals appear as avatar tiles with their name; clicking one
  opens a profile card with photo/initials, name, role, company, location, and bio snippet.
- **Drag** to rotate the globe and pan anywhere.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell, loads MapLibre from CDN |
| `style.css`  | All styling (dark space theme, avatar markers, profile cards) |
| `app.js`     | Globe setup, clustering, markers, popups, auto-rotation |
| `data.js`    | The people dataset + geo lookup tables |

## Updating the data

Edit `data.js`. Each person is an object:

```js
{
  name: "Jane Doe",
  role: "Senior Product Manager",
  city: "Berlin",
  country: "Germany",
  company: "Acme",
  snippet: "Short one-line bio.",
  photo: "https://…/jane.jpg",   // optional — initials avatar used if missing
  lng: 13.4, lat: 52.5           // optional — overrides the lookup below
}
```

Coordinates are resolved in this order: explicit `lng`/`lat` → `CITY_COORDS` →
`COMPANY_HQ` → `COUNTRY_COORDS`. Add new cities/countries to those tables in `data.js`
as the dataset grows. People in the same city are automatically spread apart slightly
so they separate at high zoom.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy to productmoat.com

It's a static site — upload `index.html`, `style.css`, `app.js`, and `data.js` to any
static host (Vercel, Netlify, GitHub Pages, or your existing web root). No server code
or environment variables needed.

Note: the basemap uses Carto's free tile service, which is fine for light/demo use.
For a high-traffic production site, consider a MapTiler key or self-hosted tiles.
