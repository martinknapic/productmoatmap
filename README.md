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

## LinkedIn verification on the Apply page (`apply.html`)

The "Apply to be featured" form is locked behind LinkedIn sign-in: every field renders
dimmed and disabled until the applicant verifies who they are via LinkedIn OAuth, then
the form unlocks with name/email pre-filled and their LinkedIn photo (if any) dropped
into the headshot preview. This is an identity check only — it doesn't autofill the rest
of the application, and no token or session is persisted beyond the OAuth redirect
round-trip.

### Files

| File | Purpose |
|------|---------|
| `apply.html` | Form markup — the `#li-gate` block (sign-in button / error / verified badge) |
| `assets/site.js` | `initLinkedInGate()` — locks/unlocks the form, drives the OAuth redirect and profile fetch |
| `assets/site.css` | `.li-gate`, `.li-badge`, disabled-state dimming, submit-button hover/focus hint |
| `api/linkedin-callback.js` | Vercel Function — OAuth redirect target; exchanges the code for tokens server-side |
| `api/linkedin-profile.js` | Vercel Function — hands the decoded profile back to the frontend after redirect |

### How it works

1. `initLinkedInGate()` disables every form control on load and shows "Sign in with
   LinkedIn to apply" above the profile fields.
2. Clicking it redirects to LinkedIn's OAuth 2.0 authorize endpoint (`response_type=code`,
   scopes `openid profile email`, plus a random `state` stashed in `sessionStorage` for
   CSRF checking).
3. LinkedIn redirects to `/api/linkedin-callback`, which exchanges the code for an access
   token + ID token using the Client Secret (server-side only), decodes the ID token, and
   packs `name`/`email`/`picture` into a short-lived, HMAC-signed, `HttpOnly` cookie —
   never into the URL. It then redirects to `/apply.html?li=ok&state=…` (or `li=denied` /
   `li=error` on failure).
4. The frontend checks the echoed `state` against what it stashed, then calls
   `/api/linkedin-profile`, which verifies the cookie's signature/expiry, returns the
   profile as JSON, and clears the cookie (one-time use).
5. The form unlocks, name/email are pre-filled (still editable), the photo preview picks
   up the LinkedIn picture if one came back (falls back to the existing upload/initials
   flow if not), and the sign-in button is replaced with a "✓ Verified as … via LinkedIn"
   badge.

### Required environment variables

Set these in the Vercel dashboard under **Project → Settings → Environment Variables**
(apply to Production, Preview, and Development as needed):

| Variable | Value |
|----------|-------|
| `LINKEDIN_CLIENT_ID` | From your LinkedIn app at https://www.linkedin.com/developers/apps — also hardcode this same value into the `LINKEDIN_CLIENT_ID` constant near the top of `assets/site.js` (it's public by design, so it ships in frontend JS; only the secret below is kept server-side) |
| `LINKEDIN_CLIENT_SECRET` | From the same LinkedIn app page — used only inside `api/linkedin-callback.js` and `api/linkedin-profile.js`, never sent to the browser |

In your LinkedIn app's **Auth** settings, add `https://productmoat.com/api/linkedin-callback`
(and any Vercel preview domain you test against) to the list of authorized redirect URLs —
LinkedIn rejects callbacks to unregistered URIs.

### Manual test checklist

- [ ] **Happy path** — load `apply.html`, confirm all fields are visibly dimmed and
      disabled and the submit button shows the "Sign in with LinkedIn to unlock this
      form" hint on hover/focus. Click "Sign in with LinkedIn," approve on LinkedIn's
      consent screen, and confirm you land back on `apply.html` with the form unlocked,
      Full name and Email pre-filled, the sign-in button replaced by the "✓ Verified as…"
      badge, and the submit button enabled.
- [ ] **Denied permission** — start sign-in, then click "Cancel" / deny on LinkedIn's
      consent screen. Confirm you land back on `apply.html` with the inline error
      ("LinkedIn sign-in didn't go through — try again.") shown near the button and the
      form still fully locked.
- [ ] **No-photo account** — sign in with a LinkedIn account that has no profile photo.
      Confirm the form still unlocks normally and the headshot preview falls back to the
      existing "＋" / upload placeholder rather than erroring.
- [ ] **Submit blocked while locked** — before signing in, try pressing Enter inside any
      text field and clicking the submit button directly; confirm neither submits the
      form or shows the success state.
- [ ] **Override LinkedIn photo** — after a successful sign-in with a photo, use "Choose
      photo" to upload a different image and confirm it replaces the LinkedIn photo in
      the preview.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. Note: the LinkedIn sign-in flow needs the `/api`
functions, which a plain static server can't run — use `vercel dev` (or a Preview
deployment) to test that part end-to-end.

## Deploy to productmoat.com

It's a static site with two small serverless functions — deploy the whole repo
(`index.html`, `person.html`, `map.html`, `apply.html`, `style.css`, `app.js`, `data.js`,
the `assets/` folder, and `api/`) to Vercel. No build step or npm dependencies are
required; Vercel picks up `api/*.js` as Node.js Functions automatically. Set the two
environment variables described above before the LinkedIn sign-in flow will work — every
other page stays fully static with no server code or environment variables needed.

Note: the basemap uses Carto's free tile service, which is fine for light/demo use.
For a high-traffic production site, consider a MapTiler key or self-hosted tiles.
