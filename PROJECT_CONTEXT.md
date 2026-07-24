# ProductMoat Globe — Project Context

Paste this into the Claude Project's knowledge base. It's the full context needed to
write Claude Code terminal prompts that continue this build without re-deriving
decisions already made.

## What this is

An interactive, Google-Earth-style 3D globe that displays product managers as
zoomable clusters. Zoom out → see continent/country-level clusters. Zoom in → clusters
break apart into smaller regional/city clusters. Zoom in fully → individual avatar
tiles appear; clicking one opens a profile card (avatar, name, role, company,
location, bio snippet). Drag to rotate the globe freely.

Purpose: a landing-page-style feature for **productmoat.com** — displayed immediately
on arrival, no login/interaction required to see it working.

Status: **MVP built and manually verified in-browser. Validates the core interaction
model.** Not yet deployed. Not yet loaded with real/full data.

## Repo location

```
/Users/martinknapic/Claude/Developer/Productmoatmap
```

Git repo initialized locally (`git init` done, one commit so far: "Initial MVP:
interactive globe of product managers"). **No remote configured yet** — not pushed to
GitHub. No CI/CD.

## Tech stack (deliberately minimal)

- **MapLibre GL JS** (v5.6.0, loaded from unpkg CDN) — open-source Mapbox GL fork,
  used in **globe projection mode**. This is what gives the 3D sphere/rotation.
- **Basemap**: Carto's free "dark-matter-gl" vector style (`basemaps.cartocdn.com`) —
  free tier, no API key required. Flagged as fine for demo/low traffic; would need a
  MapTiler key or self-hosted tiles for production-scale traffic.
- **Vanilla HTML/CSS/JS** — no framework, no bundler, no build step, no npm
  dependencies. Static files only.
- No backend. No database. Data lives in a plain JS file.

## File structure

```
index.html   — page shell, loads MapLibre CSS/JS from CDN, then data.js, then app.js
style.css    — dark space theme: header, hint pill, avatar markers, profile card popup
app.js       — map setup, clustering config, coordinate resolution, avatar rendering,
               marker sync on zoom/pan, popup on click, idle auto-rotation
data.js      — the PEOPLE dataset + geocoding lookup tables (see below)
README.md    — setup/run/deploy instructions (already written)
.claude/launch.json — dev server config for Claude Code's browser-preview tool
                       (python3 -m http.server 8765)
```

## Data model (`data.js`)

`PEOPLE` is an array of objects:

```js
{
  name: "Jane Doe",
  role: "Senior Product Manager",
  city: "Berlin",
  country: "Germany",
  company: "Acme",
  snippet: "Short one-line bio.",
  photo: "https://…/jane.jpg",   // optional; falls back to a colored-initials avatar
  lng: 13.4, lat: 52.5           // optional explicit override
}
```

**Coordinate resolution order** (see `resolveCoords()` in app.js):
explicit `lng`/`lat` → `CITY_COORDS[city]` → `COMPANY_HQ[company]` →
`COUNTRY_COORDS[country]`. All three lookup tables live in `data.js` and currently
only cover the cities/companies/countries needed for the demo set — **must be
extended** as new cities/companies show up in real data.

People sharing a city are auto-jittered (`jitter()`, golden-angle spiral) so they
visually separate once zoomed in, instead of stacking exactly on top of each other.

**Current dataset**: 10 sample records, all Swiss product managers, manually
transcribed from a demo CSV (`product_managers_switzerland.csv`, columns: Full Name,
Role, City, Country, Company, Snippet). No photos in the source data — everyone
currently renders as a colored initials avatar (`avatarStyle()` hashes the name to
pick a hue, so colors are stable/deterministic per person).

## What's implemented and verified working

- Globe projection with atmosphere/sky styling, slow auto-rotation that stops on
  first user interaction (drag/scroll/touch)
- MapLibre's built-in clustering (`clusterMaxZoom: 13`, `clusterRadius: 55`) — cluster
  circles sized/colored by count via `step` expressions
- Click-to-zoom on clusters (`getClusterExpansionZoom`)
- Custom HTML markers (not MapLibre's default pins) for unclustered points — these are
  synced on every `move`/`moveend`/`sourcedata` event by querying rendered features
  and diffing against currently-mounted markers (`activeMarkers` Map) to avoid
  re-creating DOM nodes unnecessarily
- Profile popup card on marker click, styled to match the dark theme
- Manually tested full zoom path in-browser: world cluster (10) → regional split
  (6 Zürich-area / 4 Lausanne-area) → city-level sub-clusters → individual avatars →
  profile card. All confirmed working via screenshots during the build session.

## Known gaps / likely next steps

- **Only 10 sample people, one country.** Real dataset (more countries, more people)
  not yet loaded — will stress-test clustering performance and the geocoding lookup
  tables at scale.
- **No photos yet** — `photo` field exists and is wired up (avatar + popup both check
  for it) but untested with real image URLs (loading states, broken-image fallback,
  CORS not yet considered).
- **Geocoding is manual lookup tables, not a real geocoding service.** Fine for a
  curated dataset; will not scale if data starts coming from an uncontrolled source
  with arbitrary city names.
- **No CSV import automation.** Data was hand-transcribed from CSV into `data.js`.
  A script to convert CSV → `data.js` (or to load CSV/JSON at runtime via fetch)
  would remove this manual step.
- **No deployment yet.** Static site, so deploy is just "upload the 4 files to a
  static host" — but productmoat.com hosting/DNS/deploy pipeline not set up.
- **No search/filter UI** (by country, company, role) — would matter once the
  dataset grows past a couple hundred people.
- **No tests.** No CI. No linting configured.
- **Not committed to a remote.** Local git only.

## How to run locally

```bash
cd /Users/martinknapic/Claude/Developer/Productmoatmap
python3 -m http.server 8765
```

Then open `http://localhost:8765`. No build step — edit `app.js`/`style.css`/`data.js`
and refresh.

## How I'll use this Claude Project

This project chat is for drafting **prompts to run in Claude Code in the terminal**
against the repo above. It is not writing code itself — it's helping me plan/word the
next Claude Code session. Good prompts should reference the file names and decisions
above directly rather than re-explaining the app from scratch.
