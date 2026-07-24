#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const count = parseInt(process.argv[2], 10) || 10000;

// ---- Name pools ----

const FIRST_NAMES = [
  "Alex", "Jordan", "Morgan", "Taylor", "Casey", "Riley", "Quinn", "Avery", "Drew", "Blake",
  "Sam", "Jamie", "Reese", "Finley", "Skyler", "Peyton", "Cameron", "Logan", "Harper", "Emery",
  "Aisha", "Priya", "Mei", "Yuki", "Fatima", "Amara", "Kenji", "Ravi", "Lior", "Nadia",
  "Elena", "Lucas", "Sofia", "Omar", "Ana", "Jan", "Nina", "Max", "Sara", "Kai"
];

const LAST_NAMES = [
  "Chen", "Patel", "Kim", "Singh", "Müller", "Smith", "Johnson", "Williams", "Brown", "Garcia",
  "Anderson", "Taylor", "Lee", "Martin", "Jackson", "Thompson", "White", "Lopez", "Davis", "Wilson",
  "Kumar", "Sharma", "Park", "Nakamura", "Santos", "Fernández", "Rossi", "Novak", "Weber", "Cohen",
  "Okonkwo", "Mensah", "Johansson", "Nielsen", "Dubois", "Becker", "Petrov", "Ivanov", "Yıldız", "Öztürk"
];

// ---- PM roles ----

const ROLES = [
  "Product Manager",
  "Senior Product Manager",
  "Principal Product Manager",
  "Group Product Manager",
  "Director of Product",
  "Head of Product",
  "VP of Product",
  "Associate Product Manager",
  "Product Lead",
  "Chief Product Officer"
];

// ---- Bio snippets ----

const SNIPPETS = [
  "Passionate about turning user insights into products people love.",
  "Obsessed with the 0→1 phase and early-stage product discovery.",
  "Bridges engineering and design to ship features that actually stick.",
  "Former engineer who crossed over to product and never looked back.",
  "Builds product strategy rooted in continuous customer feedback loops.",
  "Specialises in B2B SaaS growth and monetisation experiments.",
  "Drives cross-functional alignment across design, eng, and marketing.",
  "Loves data but knows when to trust gut instinct over a dashboard.",
  "Focused on developer-facing products and API design.",
  "Champions accessibility and inclusive design in every sprint.",
  "Scaled a fintech product from zero to one million active users.",
  "Leads product operations and discovery for a remote-first team.",
  "Deep background in machine learning brought to the PM world.",
  "Obsessed with reducing time-to-value for enterprise customers.",
  "Builds pricing and packaging strategy from first principles."
];

// ---- Procedural company names (~500 unique) ----

const CO_WORDS = [
  "Scale", "Launch", "Growth", "Lean", "Agile", "Flux", "Pivot", "Sprint",
  "Ship", "Merge", "Build", "Clear", "Swift", "Pulse", "Edge", "Core",
  "Peak", "Glide", "Stride", "Flow", "Bright", "Smart", "Hyper", "Meta",
  "Ultra", "Micro", "Nano", "Deep", "Open", "Next", "Bold", "Crisp",
  "Sharp", "Vibe", "Beam", "Spark", "Nimble", "Solid", "Keen", "Dash",
  "Loom", "Craft", "Grid", "Arch", "Apex", "Orbit", "Nova", "Zenith",
  "Prism", "Axiom"
];

const CO_SUFFIXES = [
  "AI", "Data", "Cloud", "Ops", "Hub", "Stack", "Desk", "Board", "Base", "Flow",
  "Labs", "Works", "HQ", "Io", "Ly", "Co", "Sync", "Link", "Forge", "Craft"
];

const COMPANIES = [];
for (const w of CO_WORDS) {
  for (const s of CO_SUFFIXES) {
    COMPANIES.push(w + s);
    if (COMPANIES.length === 500) break;
  }
  if (COMPANIES.length === 500) break;
}

// ---- Country table: [name, city, lng, lat, weight] ----
// Weight is relative population/PM-market size.

const COUNTRIES = [
  // Tier 1 — dominant tech/PM markets
  ["United States",       "San Francisco",    -122.4194,  37.7749,  600],
  ["India",               "Bangalore",          77.5946,  12.9716,  500],
  ["United Kingdom",      "London",             -0.1276,  51.5072,  350],
  ["Germany",             "Berlin",             13.4050,  52.5200,  280],
  ["Canada",              "Toronto",           -79.3832,  43.6532,  200],
  // Tier 2 — strong tech ecosystems
  ["France",              "Paris",               2.3522,  48.8566,  180],
  ["Israel",              "Tel Aviv",           34.7818,  32.0853,  160],
  ["Australia",           "Sydney",            151.2093, -33.8688,  140],
  ["Netherlands",         "Amsterdam",           4.9041,  52.3676,  130],
  ["Sweden",              "Stockholm",          18.0686,  59.3293,  110],
  ["Singapore",           "Singapore",         103.8198,   1.3521,  110],
  ["Brazil",              "São Paulo",         -46.6333, -23.5505,  100],
  ["China",               "Shanghai",          121.4737,  31.2304,   90],
  ["Japan",               "Tokyo",             139.6917,  35.6895,   90],
  ["Switzerland",         "Zürich",              8.5417,  47.3769,   80],
  // Tier 3 — solid EU/APAC/LATAM hubs
  ["Spain",               "Madrid",             -3.7038,  40.4168,   75],
  ["Ireland",             "Dublin",             -6.2603,  53.3498,   70],
  ["Denmark",             "Copenhagen",         12.5683,  55.6761,   65],
  ["Finland",             "Helsinki",           24.9384,  60.1699,   55],
  ["Norway",              "Oslo",               10.7522,  59.9139,   55],
  ["Austria",             "Vienna",             16.3738,  48.2082,   50],
  ["Poland",              "Warsaw",             21.0122,  52.2297,   50],
  ["Belgium",             "Brussels",            4.3517,  50.8503,   45],
  ["Portugal",            "Lisbon",             -9.1393,  38.7223,   45],
  ["Mexico",              "Mexico City",        -99.1332,  19.4326,  40],
  ["Argentina",           "Buenos Aires",      -58.3816, -34.6037,   40],
  ["South Korea",         "Seoul",             126.9780,  37.5665,   40],
  ["Taiwan",              "Taipei",            121.5654,  25.0330,   35],
  ["New Zealand",         "Auckland",          174.7633, -36.8485,   35],
  ["South Africa",        "Cape Town",          18.4241, -33.9249,   30],
  ["Nigeria",             "Lagos",               3.3792,   6.5244,   30],
  ["Egypt",               "Cairo",              31.2357,  30.0444,   25],
  ["Turkey",              "Istanbul",           28.9784,  41.0082,   25],
  ["Czech Republic",      "Prague",             14.4378,  50.0755,   25],
  ["Hong Kong",           "Hong Kong",         114.1694,  22.3193,   22],
  ["United Arab Emirates","Dubai",              55.2708,  25.2048,   20],
  ["Romania",             "Bucharest",          26.1025,  44.4268,   20],
  ["Ukraine",             "Kyiv",               30.5234,  50.4501,   20],
  ["Hungary",             "Budapest",           19.0402,  47.4979,   20],
  ["Greece",              "Athens",             23.7275,  37.9838,   18],
  ["Colombia",            "Bogotá",            -74.0721,   4.7110,   15],
  ["Chile",               "Santiago",          -70.6693, -33.4489,   15],
  ["Thailand",            "Bangkok",           100.5018,  13.7563,   14],
  ["Indonesia",           "Jakarta",           106.8456,  -6.2088,   14],
  ["Malaysia",            "Kuala Lumpur",      101.6869,   3.1390,   13],
  ["Vietnam",             "Ho Chi Minh City",  106.6297,  10.8231,   12],
  ["Philippines",         "Manila",            120.9842,  14.5995,   12],
  ["Pakistan",            "Karachi",            67.0011,  24.8607,   10],
  ["Bangladesh",          "Dhaka",              90.4125,  23.8103,   10],
  ["Sri Lanka",           "Colombo",            79.8612,   6.9271,    8],
  ["Peru",                "Lima",              -77.0428, -12.0464,    8],
  ["Kenya",               "Nairobi",            36.8219,  -1.2921,    8],
  ["Ghana",               "Accra",              -0.1870,   5.6037,    7],
  ["Morocco",             "Casablanca",         -7.5898,  33.5731,    7],
  ["Saudi Arabia",        "Riyadh",             46.6753,  24.6877,    7],
  ["Jordan",              "Amman",              35.9106,  31.9539,    5],
  ["Lebanon",             "Beirut",             35.4960,  33.8938,    5],
  ["Kazakhstan",          "Almaty",             76.9286,  43.2220,    5],
  ["Slovakia",            "Bratislava",         17.1077,  48.1486,    5],
  ["Croatia",             "Zagreb",             15.9819,  45.8150,    5],
  ["Slovenia",            "Ljubljana",          14.5058,  46.0569,    5],
  ["Serbia",              "Belgrade",           20.4651,  44.8176,    5],
  ["Bulgaria",            "Sofia",              23.3219,  42.6977,    5],
  ["Lithuania",           "Vilnius",            25.2799,  54.6872,    4],
  ["Latvia",              "Riga",               24.1052,  56.9496,    4],
  ["Estonia",             "Tallinn",            24.7536,  59.4370,    4],
  ["Qatar",               "Doha",               51.5310,  25.2854,    4],
  ["Azerbaijan",          "Baku",               49.8671,  40.4093,    4],
  ["Georgia",             "Tbilisi",            44.7908,  41.6938,    4],
  ["Armenia",             "Yerevan",            44.5136,  40.1792,    3],
  ["Belarus",             "Minsk",              27.5615,  53.9045,    3],
  ["Luxembourg",          "Luxembourg City",     6.1296,  49.6117,    3],
  ["Iceland",             "Reykjavik",         -21.9426,  64.1355,    3],
  ["Ecuador",             "Quito",             -78.4678,  -0.1807,    4],
  ["Bolivia",             "La Paz",            -68.1193, -16.4897,    3],
  ["Uruguay",             "Montevideo",        -56.1913, -34.9011,    3],
  ["Venezuela",           "Caracas",           -66.9036,  10.4806,    3],
  ["Dominican Republic",  "Santo Domingo",     -69.9312,  18.4861,    3],
  ["Guatemala",           "Guatemala City",    -90.5069,  14.6349,    3],
  ["Costa Rica",          "San José",          -84.0907,   9.9281,    3],
  ["Panama",              "Panama City",       -79.5197,   8.9936,    3],
  ["Tunisia",             "Tunis",              10.1658,  36.8190,    3],
  ["Algeria",             "Algiers",             3.0588,  36.7372,    3],
  ["Ethiopia",            "Addis Ababa",        38.7469,   9.0320,    3],
  ["Tanzania",            "Dar es Salaam",      39.2083,  -6.7924,    3],
  ["Uganda",              "Kampala",            32.5822,   0.3136,    3],
  ["Rwanda",              "Kigali",             30.0587,  -1.9441,    3],
  ["Senegal",             "Dakar",             -17.4441,  14.7167,    3],
  ["Albania",             "Tirana",             19.8189,  41.3317,    3],
  ["Kuwait",              "Kuwait City",        47.9783,  29.3759,    3],
  ["Bahrain",             "Manama",             50.5860,  26.2154,    3],
  ["Oman",                "Muscat",             58.5922,  23.5880,    3],
  ["Myanmar",             "Yangon",             96.1561,  16.8661,    3],
  ["Nepal",               "Kathmandu",          85.3240,  27.7172,    3],
  ["Uzbekistan",          "Tashkent",           69.2401,  41.2995,    3],
  ["Ivory Coast",         "Abidjan",            -4.0083,   5.3600,    3],
  ["Iran",                "Tehran",             51.3890,  35.6892,    2],
  ["Paraguay",            "Asunción",          -57.5759, -25.2867,    2],
  ["Cuba",                "Havana",            -82.3666,  23.1136,    2],
  ["Honduras",            "Tegucigalpa",       -87.2068,  14.0723,    2],
  ["El Salvador",         "San Salvador",      -89.2073,  13.6929,    2],
  ["Nicaragua",           "Managua",           -86.2919,  12.1328,    2],
  ["Jamaica",             "Kingston",          -76.7936,  17.9970,    2],
  ["Cambodia",            "Phnom Penh",        104.9282,  11.5564,    2],
  ["Laos",                "Vientiane",         102.6331,  17.9757,    2],
  ["Afghanistan",         "Kabul",              69.1711,  34.5253,    2],
  ["Mongolia",            "Ulaanbaatar",       106.9057,  47.8864,    2],
  ["Kyrgyzstan",          "Bishkek",            74.5698,  42.8746,    2],
  ["Tajikistan",          "Dushanbe",           68.7864,  38.5598,    2],
  ["Cameroon",            "Douala",              9.7085,   4.0511,    2],
  ["Angola",              "Luanda",             13.2343,  -8.8368,    2],
  ["Mozambique",          "Maputo",             32.5892, -25.9692,    2],
  ["Zimbabwe",            "Harare",             31.0522, -17.8294,    2],
  ["Zambia",              "Lusaka",             28.3228, -15.4167,    2],
  ["Botswana",            "Gaborone",           25.9201, -24.6541,    2],
  ["Libya",               "Tripoli",            13.1913,  32.8872,    2],
  ["Sudan",               "Khartoum",           32.5599,  15.5007,    2],
  ["Namibia",             "Windhoek",           17.0866, -22.5609,    2],
  ["Madagascar",          "Antananarivo",       47.5079, -18.9249,    2],
  ["Papua New Guinea",    "Port Moresby",      147.1803,  -9.4438,    2],
  ["North Macedonia",     "Skopje",             21.4318,  42.0024,    2],
  ["Bosnia Herzegovina",  "Sarajevo",           18.4131,  43.8476,    2],
  ["Montenegro",          "Podgorica",          19.2636,  42.4304,    2],
  ["Kosovo",              "Pristina",           21.1655,  42.6629,    2],
  ["Moldova",             "Chișinău",           28.8638,  47.0105,    2],
  ["Malta",               "Valletta",           14.5146,  35.8997,    2],
  ["Cyprus",              "Nicosia",            33.3823,  35.1856,    2],
  ["Haiti",               "Port-au-Prince",    -72.3354,  18.5944,    2],
  ["Trinidad and Tobago", "Port of Spain",     -61.5085,  10.6549,    2],
  ["Maldives",            "Malé",               73.5109,   4.1755,    1],
  ["Bhutan",              "Thimphu",            89.6386,  27.4728,    1],
  ["Brunei",              "Bandar Seri Begawan",114.9399,  4.9031,    1],
  ["Mauritius",           "Port Louis",         57.5012, -20.1609,    1],
  ["Fiji",                "Suva",              178.4419, -18.1416,    1],
  ["Samoa",               "Apia",             -171.8860, -13.8506,    1],
  ["Togo",                "Lomé",                1.2255,   6.1375,    1],
  ["Benin",               "Cotonou",             2.3158,   6.3654,    1],
  ["Mali",                "Bamako",             -8.0029,  12.6392,    1],
  ["Niger",               "Niamey",              2.1098,  13.5137,    1],
  ["Chad",                "N'Djamena",          15.0444,  12.1048,    1],
  ["Guinea",              "Conakry",           -13.5784,   9.6412,    1],
  ["Sierra Leone",        "Freetown",          -13.2317,   8.4697,    1],
  ["Liberia",             "Monrovia",          -10.7969,   6.3156,    1],
  ["Somalia",             "Mogadishu",          45.3418,   2.0469,    1],
  ["Eritrea",             "Asmara",             38.9318,  15.3229,    1],
  ["Syria",               "Damascus",           36.2765,  33.5102,    1],
  ["Iraq",                "Baghdad",            44.3661,  33.3152,    1],
  ["Yemen",               "Sana'a",             44.2066,  15.3694,    1],
  ["Turkmenistan",        "Ashgabat",           58.3794,  37.9601,    1],
];

// ---- Weighted random draw ----

const totalWeight = COUNTRIES.reduce((s, c) => s + c[4], 0);

function pickCountry() {
  let r = Math.random() * totalWeight;
  for (const c of COUNTRIES) {
    r -= c[4];
    if (r <= 0) return c;
  }
  return COUNTRIES[COUNTRIES.length - 1];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ---- Generate records ----

function generate(n) {
  const records = [];
  for (let i = 0; i < n; i++) {
    const [country, city, baseLng, baseLat] = pickCountry();
    const jitterRange = randBetween(0.1, 0.3);
    const lng = parseFloat((baseLng + randBetween(-jitterRange, jitterRange)).toFixed(4));
    const lat = parseFloat((baseLat + randBetween(-jitterRange * 0.7, jitterRange * 0.7)).toFixed(4));
    records.push({
      name:    `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      role:    pick(ROLES),
      city,
      country,
      company: pick(COMPANIES),
      snippet: pick(SNIPPETS),
      lng,
      lat
    });
  }
  return records;
}

const data = generate(count);
const outPath = path.resolve(__dirname, "..", "data.stress.js");
const lines = data.map(r => "  " + JSON.stringify(r));
fs.writeFileSync(outPath, `const PEOPLE_STRESS_TEST = [\n${lines.join(",\n")}\n];\n`, "utf8");
console.log(`Wrote ${count} records → ${outPath}`);
