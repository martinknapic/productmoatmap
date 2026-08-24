# ProductMoat

An interview portal for productmoat.com: conversations with product managers and product
people around the world, on building product at the intersection of AI. Plus a secondary
feature — an interactive 3D globe of product people, at `map.html`.

## Site structure

| Page | Purpose |
|------|---------|
| `index.html` | Homepage — hero, stats, featured interview, filterable directory grid |
| `person.html?slug=...` | Individual interview page — career snapshot, links, pull quote, Q&A, prev/next |
| `map.html` | The interactive globe (see below) |

Both `index.html` and `person.html` are rendered client-side from `assets/people-data.js`
by `assets/site.js`. No build step — plain static files.

**Design system**: `assets/swiss.css` holds the shared tokens and chrome (colors, type,
the masthead nav, buttons, the flat ink-on-paper avatar medallions) used by every page,
including `map.html`. `assets/site.css` layers portal-only layout on top (hero, directory
grid, person page). `style.css` layers map-only layout on top the same way (globe canvas,
marker pins, side panel). Deliberately no Google Fonts, no gradients, no blur, no rounded
corners — a Swiss/editorial system (system Helvetica/Arial + a single red accent) chosen
specifically to avoid the generic "AI-generated site" look. Load `assets/swiss.css` before
any page-specific stylesheet.

## Updating interview content

Edit `assets/people-data.js`. Each entry is one interviewee — see the comment at the top
of the file for the exact shape (slug, name, role, company, location, focus tag, years of
experience, social links, pull quote, and a `questions` array of `{ q, a }` pairs). The
current entries are placeholder personas; replace them with real interviews as you conduct
them. Focus tags drive the filter chips on the homepage — add a new tag to `FOCUS_LABELS`
in `assets/site.js` if you introduce one.

## The globe (`map.html`)

Interactive world globe (Google-Earth style) showing product people as zoomable clusters.
Built with [MapLibre GL JS](https://maplibre.org/) (globe projection) and the free Carto
dark basemap — no API keys, no build step, fully static.

### How it works

- **World view** — the globe slowly spins until you interact. People are grouped into
  clusters (circles with a count).
- **Zoom in** (scroll, pinch, or click a cluster) — clusters break apart into smaller
  regional/city clusters.
- **Fully zoomed** — individuals appear as avatar tiles with their name; clicking one
  opens a side panel with photo/initials, name, role, company, location, and bio snippet.
- **Drag** to rotate the globe and pan anywhere.

### Files

| File | Purpose |
|------|---------|
| `map.html` | Page shell, loads MapLibre from CDN |
| `style.css`  | All styling (dark space theme, avatar markers, side panel) |
| `app.js`     | Globe setup, clustering, markers, popups, auto-rotation |
| `data.js`    | The people dataset + geo lookup tables |

### Updating the map data

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

It's a static site — upload the whole repo (`index.html`, `person.html`, `map.html`,
`style.css`, `app.js`, `data.js`, and the `assets/` folder) to any static host (Vercel,
Netlify, GitHub Pages, or your existing web root). No server code or environment
variables needed.

Note: the basemap uses Carto's free tile service, which is fine for light/demo use.
For a high-traffic production site, consider a MapTiler key or self-hosted tiles.
