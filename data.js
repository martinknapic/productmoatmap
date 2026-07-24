// ProductMoat — people data
// Each person: name, role, city, country, company, snippet, photo (optional URL),
// and optional lat/lng override. If lat/lng are missing the app resolves them
// from CITY_COORDS, then COMPANY_HQ, then COUNTRY_COORDS (see below).
// To update the dataset, regenerate this array from your CSV (same column order).

const PEOPLE = [
  {
    name: "Sonia Wieser",
    role: "Product Manager",
    city: "Zürich",
    country: "Switzerland",
    company: "",
    snippet: "Focuses on collaboration and positivity while solving complex product problems."
  },
  {
    name: "Neelima Dahiya",
    role: "Senior Product Manager, AI (Information Retrieval)",
    city: "Lausanne",
    country: "Switzerland",
    company: "Google",
    snippet: "Leads AI-focused information retrieval products at Google, started October 2025."
  },
  {
    name: "Axelle Justafré",
    role: "Senior Global Product Manager",
    city: "",
    country: "",
    company: "Logitech",
    snippet: "Also leads a part-time sustainability program alongside her PM role."
  },
  {
    name: "Irene Ackermann",
    role: "Product Manager Passenger Information",
    city: "Zurich",
    country: "Switzerland",
    company: "Zürcher Verkehrsverbund ZVV",
    snippet: "Background spans digital innovation, AI projects, and generative AI initiatives."
  },
  {
    name: "Lina Yakunina",
    role: "Product Manager",
    city: "",
    country: "",
    company: "Sherpany",
    snippet: "Builds B2B SaaS features focused on customer needs and AI capabilities."
  },
  {
    name: "Tobias Zellweger",
    role: "Product Manager Online Platforms",
    city: "",
    country: "Switzerland",
    company: "aha! Allergiezentrum Schweiz",
    snippet: "Manages online platforms for the Swiss Allergy Centre, focused on digital innovation."
  },
  {
    name: "Pascal Hofmann",
    role: "Product Manager",
    city: "Zürich",
    country: "",
    company: "Google",
    snippet: "Studied business at Oxford's Said Business School before joining Google."
  },
  {
    name: "Céline Rihs",
    role: "Product & Data Manager",
    city: "",
    country: "Switzerland",
    company: "MOVE Mobility",
    snippet: "Previously managed e-mobility products at Romande Energie in Morges."
  },
  {
    name: "Abdul Rahman",
    role: "Product Manager",
    city: "Zürich",
    country: "Switzerland",
    company: "Westermo Neratec AG",
    snippet: "Works at the intersection of business and technology across product roles."
  },
  {
    name: "Stef D.",
    role: "Product Manager (Home Appliance)",
    city: "Zürich",
    country: "Switzerland",
    company: "Samsung Switzerland",
    snippet: "Home appliance PM based in Zurich with Samsung Switzerland."
  }
];

// City name → [lng, lat]. Add cities here as your dataset grows.
const CITY_COORDS = {
  "zurich": [8.5417, 47.3769],
  "zürich": [8.5417, 47.3769],
  "geneva": [6.1432, 46.2044],
  "genève": [6.1432, 46.2044],
  "lausanne": [6.6323, 46.5197],
  "bern": [7.4474, 46.9480],
  "basel": [7.5886, 47.5596],
  "lugano": [8.9511, 46.0037],
  "zug": [8.5155, 47.1662],
  "winterthur": [8.7241, 47.4997],
  "lucerne": [8.3093, 47.0502],
  "st. gallen": [9.3767, 47.4245],
  "morges": [6.4983, 46.5091],
  "london": [-0.1276, 51.5072],
  "paris": [2.3522, 48.8566],
  "berlin": [13.4050, 52.5200],
  "munich": [11.5820, 48.1351],
  "amsterdam": [4.9041, 52.3676],
  "madrid": [-3.7038, 40.4168],
  "barcelona": [2.1734, 41.3851],
  "milan": [9.1900, 45.4642],
  "vienna": [16.3738, 48.2082],
  "dublin": [-6.2603, 53.3498],
  "stockholm": [18.0686, 59.3293],
  "copenhagen": [12.5683, 55.6761],
  "oslo": [10.7522, 59.9139],
  "lisbon": [-9.1393, 38.7223],
  "warsaw": [21.0122, 52.2297],
  "prague": [14.4378, 50.0755],
  "new york": [-74.0060, 40.7128],
  "san francisco": [-122.4194, 37.7749],
  "seattle": [-122.3321, 47.6062],
  "boston": [-71.0589, 42.3601],
  "austin": [-97.7431, 30.2672],
  "toronto": [-79.3832, 43.6532],
  "singapore": [103.8198, 1.3521],
  "tokyo": [139.6917, 35.6895],
  "sydney": [151.2093, -33.8688],
  "tel aviv": [34.7818, 32.0853],
  "bangalore": [77.5946, 12.9716],
  "dubai": [55.2708, 25.2048]
};

// Company → HQ [lng, lat], used when a person has no usable city/country.
const COMPANY_HQ = {
  "logitech": [6.6323, 46.5197],          // Lausanne
  "sherpany": [8.5417, 47.3769],          // Zürich
  "move mobility": [7.4474, 46.9480],     // Bern
  "aha! allergiezentrum schweiz": [7.4474, 46.9480] // Bern
};

// Country → centroid [lng, lat]. Fallback when only the country is known.
const COUNTRY_COORDS = {
  "switzerland": [8.2275, 46.8182],
  "germany": [10.4515, 51.1657],
  "france": [2.2137, 46.2276],
  "italy": [12.5674, 41.8719],
  "austria": [14.5501, 47.5162],
  "united kingdom": [-3.4360, 55.3781],
  "uk": [-3.4360, 55.3781],
  "spain": [-3.7492, 40.4637],
  "portugal": [-8.2245, 39.3999],
  "netherlands": [5.2913, 52.1326],
  "belgium": [4.4699, 50.5039],
  "ireland": [-8.2439, 53.4129],
  "sweden": [18.6435, 60.1282],
  "norway": [8.4689, 60.4720],
  "denmark": [9.5018, 56.2639],
  "finland": [25.7482, 61.9241],
  "poland": [19.1451, 51.9194],
  "czech republic": [15.4730, 49.8175],
  "united states": [-98.5795, 39.8283],
  "usa": [-98.5795, 39.8283],
  "canada": [-106.3468, 56.1304],
  "brazil": [-51.9253, -14.2350],
  "india": [78.9629, 20.5937],
  "china": [104.1954, 35.8617],
  "japan": [138.2529, 36.2048],
  "singapore": [103.8198, 1.3521],
  "australia": [133.7751, -25.2744],
  "israel": [34.8516, 31.0461],
  "united arab emirates": [53.8478, 23.4241]
};
