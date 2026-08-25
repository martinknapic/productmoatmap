// ProductMoat Backoffice — dummy data
//
// Every record here is flagged `isDemo: true`. This is placeholder data only —
// nothing on productmoat.com currently writes real submissions anywhere (apply.html
// and recommend.html just log to the console; there's no backend or database yet).
// Once real submissions are actually being captured somewhere, real records should
// come in with `isDemo: false` (or simply omit the flag) so the two are easy to tell
// apart in the dashboard, and filter/delete demo rows here before going live.

const DUMMY_APPLICATIONS = [
  {
    id: "app-demo-01",
    isDemo: true,
    submittedAt: "2026-08-20",
    status: "pending",
    name: "Jordan Ellis",
    role: "Senior Product Manager",
    company: "Northwind Analytics",
    location: "Toronto, Canada",
    focusTag: "ai",
    yearsExperience: 8,
    linkedin: "https://www.linkedin.com/in/jordan-ellis-demo",
    website: "",
    twitter: "",
    snippet: "Building forecasting tools for supply chain teams navigating tariff volatility.",
    contactEmail: "jordan.ellis@example.com",
    contactPhone: ""
  },
  {
    id: "app-demo-02",
    isDemo: true,
    submittedAt: "2026-08-18",
    status: "pending",
    name: "Marisol Reyes",
    role: "Group Product Manager",
    company: "Fielo Health",
    location: "Mexico City, Mexico",
    focusTag: "health",
    yearsExperience: 11,
    linkedin: "https://www.linkedin.com/in/marisol-reyes-demo",
    website: "https://marisolreyes.example.com",
    twitter: "",
    snippet: "On bringing telehealth to rural clinics without reliable broadband.",
    contactEmail: "marisol@example.com",
    contactPhone: "+52 55 5555 0100"
  },
  {
    id: "app-demo-03",
    isDemo: true,
    submittedAt: "2026-08-14",
    status: "accepted",
    name: "Tom Whitfield",
    role: "VP of Product",
    company: "Ledgerpoint",
    location: "Edinburgh, UK",
    focusTag: "fintech",
    yearsExperience: 17,
    linkedin: "https://www.linkedin.com/in/tom-whitfield-demo",
    website: "",
    twitter: "https://x.com/tomwhitfield_demo",
    snippet: "On rebuilding a legacy core banking product one migration at a time.",
    contactEmail: "tom.whitfield@example.com",
    contactPhone: ""
  },
  {
    id: "app-demo-04",
    isDemo: true,
    submittedAt: "2026-08-11",
    status: "rejected",
    name: "Aiko Tanaka",
    role: "Product Manager",
    company: "Loopgrid",
    location: "Tokyo, Japan",
    focusTag: "platform",
    yearsExperience: 4,
    linkedin: "https://www.linkedin.com/in/aiko-tanaka-demo",
    website: "",
    twitter: "",
    snippet: "Early-career platform PM figuring out internal developer experience.",
    contactEmail: "aiko.t@example.com",
    contactPhone: ""
  },
  {
    id: "app-demo-05",
    isDemo: true,
    submittedAt: "2026-08-05",
    status: "pending",
    name: "Deborah Okafor",
    role: "Director of Product",
    company: "Rentwise",
    location: "Nairobi, Kenya",
    focusTag: "marketplace",
    yearsExperience: 13,
    linkedin: "https://www.linkedin.com/in/deborah-okafor-demo",
    website: "",
    twitter: "",
    snippet: "On building trust into a property marketplace where most listings start as a phone photo.",
    contactEmail: "d.okafor@example.com",
    contactPhone: ""
  }
];

const DUMMY_RECOMMENDATIONS = [
  {
    id: "rec-demo-01",
    isDemo: true,
    submittedAt: "2026-08-19",
    status: "pending",
    candidateName: "Priya Sharma",
    candidateLinkedin: "https://www.linkedin.com/in/priya-sharma-demo",
    reason: "She turned around a failing marketplace product in six months and is refreshingly candid about what almost didn't work.",
    yourName: "Alex Torres",
    yourEmail: "alex.torres@example.com",
    stayAnonymous: false
  },
  {
    id: "rec-demo-02",
    isDemo: true,
    submittedAt: "2026-08-16",
    status: "pending",
    candidateName: "Bram Janssen",
    candidateLinkedin: "https://www.linkedin.com/in/bram-janssen-demo",
    reason: "Leads a small platform team at a logistics company that ships genuinely novel AI routing features.",
    yourName: "",
    yourEmail: "",
    stayAnonymous: true
  },
  {
    id: "rec-demo-03",
    isDemo: true,
    submittedAt: "2026-08-09",
    status: "contacted",
    candidateName: "Naledi Mokoena",
    candidateLinkedin: "https://www.linkedin.com/in/naledi-mokoena-demo",
    reason: "",
    yourName: "Sipho Dlamini",
    yourEmail: "sipho.d@example.com",
    stayAnonymous: false
  },
  {
    id: "rec-demo-04",
    isDemo: true,
    submittedAt: "2026-08-02",
    status: "declined",
    candidateName: "Erik Lindqvist",
    candidateLinkedin: "https://www.linkedin.com/in/erik-lindqvist-demo",
    reason: "Great storyteller, very online about product-led growth, might be a fun contrarian voice.",
    yourName: "",
    yourEmail: "",
    stayAnonymous: true
  }
];
