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

const AVATAR_HUES = [212, 262, 172, 340, 28, 200, 292, 152, 8, 232];

function avatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  return `background: linear-gradient(135deg, hsl(${hue}, 72%, 52%), hsl(${(hue + 40) % 360}, 68%, 40%))`;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function avatarHTML(person, cls) {
  if (person.photo) {
    return `<div class="${cls}"><img src="${person.photo}" alt="${person.name}"></div>`;
  }
  return `<div class="${cls}" style="${avatarStyle(person.name)}">${initials(person.name)}</div>`;
}

// ---------- Data → GeoJSON ----------

const features = [];
const countries = new Set();

PEOPLE.forEach((person, i) => {
  const base = resolveCoords(person);
  if (!base) {
    console.warn(`No coordinates found for ${person.name} — skipped.`);
    return;
  }
  if (person.country) countries.add(person.country.trim().toLowerCase());
  features.push({
    type: "Feature",
    id: i,
    properties: { index: i },
    geometry: { type: "Point", coordinates: jitter(i, base) }
  });
});

const statsEl = document.getElementById("stats");
statsEl.textContent = `${features.length} product people on the map`;

// ---------- Map ----------

const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
};

let currentTheme = "dark";
let mapListenersAdded = false;

const map = new maplibregl.Map({
  container: "map",
  style: STYLES.dark,
  center: [8.2, 30],
  zoom: 1.6,
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
  const zoom = await map.getSource("people").getClusterExpansionZoom(feature.properties.cluster_id);
  map.easeTo({ center: feature.geometry.coordinates, zoom: zoom + 0.4, duration: 900 });
}
function handleClusterEnter() { map.getCanvas().style.cursor = "pointer"; }
function handleClusterLeave() { map.getCanvas().style.cursor = ""; }

function setupMapLayers() {
  map.setProjection({ type: "globe" });

  if (currentTheme === "dark") {
    map.setSky({
      "sky-color": "#05070f",
      "sky-horizon-blend": 0.6,
      "horizon-color": "#3d6bd6",
      "horizon-fog-blend": 0.6,
      "fog-color": "#0b1026",
      "fog-ground-blend": 0.4,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 1, 11, 0]
    });
  } else {
    map.setSky({
      "sky-color": "#d4e8f7",
      "sky-horizon-blend": 0.5,
      "horizon-color": "#f0f6ff",
      "horizon-fog-blend": 0.5,
      "fog-color": "#e8f2fb",
      "fog-ground-blend": 0.4,
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
      "circle-color": "#5b8cff",
      "circle-opacity": 0.25,
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
        "#4f7df2", 5, "#7a5cf0", 15, "#c04ad4", 50, "#e8447a"
      ],
      "circle-radius": ["step", ["get", "point_count"], 17, 5, 22, 15, 28, 50, 36],
      "circle-stroke-width": 2,
      "circle-stroke-color": "rgba(255,255,255,0.85)"
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

  // Invisible layer used only to query which points are unclustered in view.
  map.addLayer({
    id: "unclustered-point",
    type: "circle",
    source: "people",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-radius": 1, "circle-opacity": 0 }
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

function toggleMapTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.getElementById("theme-toggle").textContent = currentTheme === "dark" ? "☀" : "🌙";
  document.body.classList.toggle("map-light", currentTheme === "light");
  map.setStyle(STYLES[currentTheme]);
}

// ---------- Side panel ----------

function showSidePanel(person) {
  const panel = document.getElementById("side-panel");
  const location = [person.city, person.country].filter(Boolean).join(", ");

  let hash = 0;
  for (let i = 0; i < person.name.length; i++) hash = (hash * 31 + person.name.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  const hue2 = (hue + 40) % 360;

  const avatarEl = person.photo
    ? `<img class="sp-avatar-img" src="${person.photo}" alt="${person.name}">`
    : `<div class="sp-avatar-initials" style="${avatarStyle(person.name)}">${initials(person.name)}</div>`;

  panel.innerHTML = `
    <div class="sp-header" style="background: linear-gradient(135deg, hsl(${hue},68%,62%), hsl(${hue2},72%,38%))">
      <button class="sp-close" onclick="closeSidePanel()">✕</button>
      <div class="sp-avatar-wrap">
        ${avatarEl}
        <div class="sp-online-dot"></div>
      </div>
    </div>
    <div class="sp-body">
      <div class="sp-top-row">
        <div>
          <div class="sp-name">${person.name}</div>
          <div class="sp-role">${person.role || ""}</div>
        </div>
        <button class="sp-bookmark" title="Save">🔖</button>
      </div>
      ${location || person.company ? `
      <div class="sp-meta">
        ${location ? `<span>📍 ${location}</span>` : ""}
        ${person.company ? `<span>🏢 ${person.company}</span>` : ""}
      </div>` : ""}
      ${person.snippet ? `<div class="sp-snippet">${person.snippet}</div>` : ""}
    </div>`;

  panel.classList.add("open");
}

function closeSidePanel() {
  document.getElementById("side-panel").classList.remove("open");
}

// ---------- HTML avatar markers for unclustered people ----------

function syncMarkers() {
  if (!map.getLayer("unclustered-point")) return;

  const visible = map.queryRenderedFeatures({ layers: ["unclustered-point"] });
  const visibleIds = new Set();

  for (const f of visible) {
    const idx = f.properties.index;
    visibleIds.add(idx);
    if (activeMarkers.has(idx)) continue;

    const person = PEOPLE[idx];
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

map.on("load", () => {
  spinGlobe();
  setTimeout(() => document.getElementById("hint").classList.add("hidden"), 12000);
});
