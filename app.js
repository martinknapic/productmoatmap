/* ProductMoat — interactive globe of product managers */

// ---------- Geocoding ----------

function resolveCoords(person) {
  const city = (person.city || "").trim().toLowerCase();
  const country = (person.country || "").trim().toLowerCase();
  const company = (person.company || "").trim().toLowerCase();

  if (typeof person.lng === "number" && typeof person.lat === "number") {
    return [person.lng, person.lat];
  }
  if (city && CITY_COORDS[city]) return CITY_COORDS[city];
  if (company && COMPANY_HQ[company]) return COMPANY_HQ[company];
  if (country && COUNTRY_COORDS[country]) return COUNTRY_COORDS[country];
  return null;
}

// Deterministic jitter so people in the same city separate at high zoom.
function jitter(index, coords) {
  const angle = (index * 137.508) * (Math.PI / 180); // golden-angle spiral
  const radius = 0.006 + 0.004 * (index % 5);
  return [
    coords[0] + Math.cos(angle) * radius,
    coords[1] + Math.sin(angle) * radius * 0.7
  ];
}

// ---------- Avatars ----------
// Flat ink-on-paper medallions (see .person-avatar / .sp-avatar-initials in style.css) —
// no per-person color, consistent with the rest of the site's monochrome system.

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function avatarHTML(person, cls) {
  if (person.photo) {
    return `<div class="${cls}"><img src="${person.photo}" alt="${person.name}"></div>`;
  }
  return `<div class="${cls}">${initials(person.name)}</div>`;
}

// ---------- Theme colors for MapLibre paint properties ----------
// MapLibre's WebGL canvas can't read CSS custom properties, so cluster/sky colors are
// mirrored here to match the tokens in assets/swiss.css.

const THEME_COLORS = {
  dark: {
    accent: "#e6432b",
    ink: "#f4f3ee",
    paper: "#121212",
    clusterSteps: ["#3a3a38", "#6b2620", "#a8362a", "#e6432b"]
  },
  light: {
    accent: "#b3311f",
    ink: "#111111",
    paper: "#f2f1ec",
    clusterSteps: ["#cfcdc2", "#8a4038", "#9c352a", "#b3311f"]
  }
};

// ---------- Merge in the interview portal's people ----------
// Every published interview (assets/people-data.js) also appears on the globe, adapted
// into the same shape as the demo PEOPLE dataset. `slug` is carried through so the side
// panel can link back to the full interview.

function interviewToPersonShape(p) {
  const [city, country] = p.location.split(",").map(s => s.trim());
  return {
    name: p.name, role: p.role, city, country, company: p.company,
    snippet: p.snippet, photo: p.photo, lng: p.lng, lat: p.lat, slug: p.slug
  };
}

const ALL_PEOPLE = PEOPLE.concat(
  (typeof INTERVIEWS !== "undefined" ? INTERVIEWS : []).map(interviewToPersonShape)
);

// ---------- Data → GeoJSON ----------

const features = [];
const coordsByIndex = {};
const countries = new Set();

ALL_PEOPLE.forEach((person, i) => {
  const base = resolveCoords(person);
  if (!base) {
    console.warn(`No coordinates found for ${person.name} — skipped.`);
    return;
  }
  if (person.country) countries.add(person.country.trim().toLowerCase());
  const coords = jitter(i, base);
  coordsByIndex[i] = coords;
  features.push({
    type: "Feature",
    id: i,
    properties: { index: i },
    geometry: { type: "Point", coordinates: coords }
  });
});

const statsEl = document.getElementById("stats");
statsEl.textContent = `${features.length} product people on the map`;

// ---------- Map ----------

const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
};

let currentTheme = document.body.classList.contains("light") ? "light" : "dark";
let mapListenersAdded = false;

// Bigger default globe on spacious viewports; scaled back down on small
// screens so it still lands fully in view instead of overflowing.
function getInitialZoom() {
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  if (minDim < 480) return 1.65;
  if (minDim < 700) return 1.9;
  if (minDim < 1000) return 2.15;
  return 2.35;
}

const map = new maplibregl.Map({
  container: "map",
  style: STYLES[currentTheme],
  center: [8.2, 30],
  zoom: getInitialZoom(),
  minZoom: 0.8,
  maxZoom: 17,
  attributionControl: { compact: true }
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

// ---------- Markers ----------

const activeMarkers = new Map(); // person index → maplibregl.Marker

// ---------- Layer setup — runs on every style.load ----------

async function handleClusterClick(e) {
  const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
  if (!feature) return;
  const zoom = await map.getSource("people").getClusterExpansionZoom(feature.properties.cluster_id);
  map.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.4, duration: 900 });
}
function handleClusterEnter() { map.getCanvas().style.cursor = "pointer"; }
function handleClusterLeave() { map.getCanvas().style.cursor = ""; }

function setupMapLayers() {
  map.setProjection({ type: "globe" });
  const c = THEME_COLORS[currentTheme];

  if (currentTheme === "dark") {
    map.setSky({
      "sky-color": "#121212",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#2a2a28",
      "horizon-fog-blend": 0.5,
      "fog-color": "#121212",
      "fog-ground-blend": 0.3,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 1, 11, 0]
    });
  } else {
    map.setSky({
      "sky-color": "#f2f1ec",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#e9e7de",
      "horizon-fog-blend": 0.5,
      "fog-color": "#f2f1ec",
      "fog-ground-blend": 0.3,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 1, 11, 0]
    });
  }

  // Clear markers before re-adding layers
  for (const [, marker] of activeMarkers) marker.remove();
  activeMarkers.clear();
  closeSidePanel();

  map.addSource("people", {
    type: "geojson",
    data: { type: "FeatureCollection", features },
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 55
  });

  map.addLayer({
    id: "cluster-glow",
    type: "circle",
    source: "people",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": c.accent,
      "circle-opacity": 0.18,
      "circle-radius": ["step", ["get", "point_count"], 26, 5, 32, 15, 40, 50, 50]
    }
  });

  map.addLayer({
    id: "clusters",
    type: "circle",
    source: "people",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step", ["get", "point_count"],
        c.clusterSteps[0], 5, c.clusterSteps[1], 15, c.clusterSteps[2], 50, c.clusterSteps[3]
      ],
      "circle-radius": ["step", ["get", "point_count"], 17, 5, 22, 15, 28, 50, 36],
      "circle-stroke-width": 2,
      "circle-stroke-color": c.paper
    }
  });

  map.addLayer({
    id: "cluster-count",
    type: "symbol",
    source: "people",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Montserrat SemiBold", "Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-size": 13
    },
    paint: { "text-color": "#ffffff" }
  });

  // Remove then re-add layer-specific listeners so they don't stack on theme switch.
  map.off("click", "clusters", handleClusterClick);
  map.off("mouseenter", "clusters", handleClusterEnter);
  map.off("mouseleave", "clusters", handleClusterLeave);
  map.on("click", "clusters", handleClusterClick);
  map.on("mouseenter", "clusters", handleClusterEnter);
  map.on("mouseleave", "clusters", handleClusterLeave);

  // Map movement listeners — add once only.
  if (!mapListenersAdded) {
    map.on("move", syncMarkers);
    map.on("moveend", syncMarkers);
    map.on("sourcedata", (e) => {
      if (e.sourceId === "people" && e.isSourceLoaded) syncMarkers();
    });
    mapListenersAdded = true;
  }
}

map.on("style.load", setupMapLayers);

// ---------- Theme toggle ----------
// toggleTheme() (from assets/site.js) flips the shared 'light' class + localStorage;
// this wraps it to also restyle the map itself.

function toggleMapTheme() {
  toggleTheme();
  currentTheme = document.body.classList.contains("light") ? "light" : "dark";
  map.setStyle(STYLES[currentTheme]);
}

// ---------- Side panel ----------

function showSidePanel(person) {
  const panel = document.getElementById("side-panel");
  const location = [person.city, person.country].filter(Boolean).join(", ");

  const avatarEl = person.photo
    ? `<img class="sp-avatar-img" src="${person.photo}" alt="${person.name}">`
    : `<div class="sp-avatar-initials">${initials(person.name)}</div>`;

  panel.innerHTML = `
    <div class="sp-header">
      <button class="sp-close" onclick="closeSidePanel()">[ Close ]</button>
      <div class="sp-avatar-wrap">${avatarEl}</div>
    </div>
    <div class="sp-body">
      <div class="sp-top-row">
        <div>
          <div class="sp-name">${person.name}</div>
          <div class="sp-role">${person.role || ""}</div>
        </div>
        <a class="bracket-link" href="https://linkedin.com/in/martinknapic" target="_blank" rel="noopener">[ LinkedIn ]</a>
      </div>
      ${location || person.company ? `
      <div class="sp-meta">
        ${location ? `<div class="meta-item"><div class="meta-label">Location</div><div class="meta-value">${location}</div></div>` : ""}
        ${person.company ? `<div class="meta-item"><div class="meta-label">Company</div><div class="meta-value">${person.company}</div></div>` : ""}
      </div>` : ""}
      ${person.snippet ? `<div class="sp-snippet">${person.snippet}</div>` : ""}
      ${person.slug ? `<a class="btn btn-primary sp-interview-link" href="person.html?slug=${person.slug}">Read the full interview &rarr;</a>` : ""}
    </div>`;

  panel.classList.add("open");
}

function closeSidePanel() {
  document.getElementById("side-panel").classList.remove("open");
}

// ---------- HTML avatar markers for unclustered people ----------
// Deliberately uses querySourceFeatures (reads the loaded tile cache) rather than
// queryRenderedFeatures (reads the WebGL render buffer): in globe projection,
// queryRenderedFeatures reliably returns zero results for viewport/bbox-style queries
// (point queries, like the cluster click handler's, are unaffected) — see MapLibre's
// globe projection limitations. querySourceFeatures isn't scoped to the current
// viewport or reliably screen-accurate at low globe zoom, so results are just deduped
// by index; the dataset is small enough that mounting a marker per unclustered person
// and letting maplibregl.Marker position (and occlude, on the far side of the globe)
// it correctly is cheap and simpler than re-deriving screen bounds ourselves.
function syncMarkers() {
  if (!map.getSource("people")) return;

  const seen = new Set();
  const visibleIds = new Set();

  const leaves = map.querySourceFeatures("people", { filter: ["!", ["has", "point_count"]] });

  for (const f of leaves) {
    const idx = f.properties.index;
    if (seen.has(idx)) continue;
    seen.add(idx);
    visibleIds.add(idx);

    if (activeMarkers.has(idx)) continue;

    const person = ALL_PEOPLE[idx];
    const el = document.createElement("div");
    el.className = "person-marker";
    el.innerHTML = `${avatarHTML(person, "person-avatar")}<div class="person-label">${person.name}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat(f.geometry.coordinates)
      .addTo(map);

    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showSidePanel(person);
    });

    activeMarkers.set(idx, marker);
  }

  for (const [idx, marker] of activeMarkers) {
    if (!visibleIds.has(idx)) {
      marker.remove();
      activeMarkers.delete(idx);
    }
  }
}

// ---------- Idle auto-rotation ----------

let userInteracted = false;
const SPIN_DEGREES_PER_SEC = 4;

function spinGlobe() {
  if (userInteracted || map.getZoom() > 4) return;
  const center = map.getCenter();
  center.lng -= SPIN_DEGREES_PER_SEC / 10;
  map.easeTo({ center, duration: 100, easing: (t) => t });
}

map.on("moveend", () => spinGlobe());

["mousedown", "wheel", "touchstart", "dragstart"].forEach((evt) =>
  map.on(evt, () => {
    userInteracted = true;
    document.getElementById("hint").classList.add("hidden");
  })
);

// ---------- Deep link from a profile page's mini-map (map.html?slug=...) ----------

const deepLinkSlug = new URLSearchParams(location.search).get("slug");

map.on("load", () => {
  if (deepLinkSlug) {
    userInteracted = true;
    document.getElementById("hint").classList.add("hidden");
    const idx = ALL_PEOPLE.findIndex(p => p.slug === deepLinkSlug);
    if (idx !== -1 && coordsByIndex[idx]) {
      map.once("moveend", () => showSidePanel(ALL_PEOPLE[idx]));
      map.flyTo({ center: coordsByIndex[idx], zoom: 10.5, duration: 2200 });
    }
  } else {
    spinGlobe();
    setTimeout(() => document.getElementById("hint").classList.add("hidden"), 12000);
  }
});
