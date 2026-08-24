// ProductMoat — interview portal data (placeholder set)
// Replace/extend with real interviewees. Shape:
// {
//   slug, name, role, company, location, focus, focusTag, yearsExperience,
//   lat, lng,   // coordinates for the profile page's mini-map + the main globe (map.html)
//   links: { linkedin, website, twitter },
//   snippet, pullQuote, publishedDate: "YYYY-MM-DD",
//   photo: "assets/photos/....jpg",  // optional — falls back to initials medallion
//   questions: [{ q, a }, ...]
// }

const INTERVIEWS = [
  {
    slug: "samantha-nair",
    name: "Samantha Nair",
    role: "VP of Product",
    company: "Solventra",
    location: "Barcelona, Spain",
    lat: 41.3851, lng: 2.1734,
    focus: "Product Leadership",
    focusTag: "leadership",
    yearsExperience: 16,
    photo: "assets/photos/samantha-nair.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On what changes — and what doesn't — about product leadership once your org starts building with AI, and why she moved her whole team to Barcelona.",
    pullQuote: "The org chart stopped being the interesting design problem. The human-AI handoff is.",
    publishedDate: "2026-08-24",
    questions: [
      { q: "You relocated your entire product org to Barcelona last year. Why?", a: "Talent density and quality of life turned out to matter more than proximity to head office once half our meetings were with a model anyway. We kept the senior team together, hired locally for the rest, and nobody's commute got worse. It's a smaller move than it sounds — most of what makes a product org work was never about the building." },
      { q: "What's different about leading a product org now versus five years ago?", a: "I used to spend most of my time on org design — who owns what, how decisions escalate. Now the interesting design problem is the handoff between a person and a model: which decisions the team makes, which ones an agent proposes and a human approves, and which ones just happen. Get that boundary wrong and it doesn't matter how clean your org chart is." },
      { q: "What's a leadership instinct you've had to unlearn?", a: "Rewarding certainty. I used to promote the PM who walked into a room with the most confident answer. Now I'm more interested in the one who can tell me exactly how confident the model's answer is and why, because that's the skill that actually prevents expensive mistakes." },
      { q: "What do you look for when hiring product leaders now?", a: "Whether they've ever had to kill a feature that tested well but that they didn't trust. AI makes it cheap to generate plausible-looking wins. The judgment to say no to one anyway is the same judgment it's always been — it's just being tested more often now." }
    ]
  },
  {
    slug: "priya-nair",
    name: "Priya Nair",
    role: "Senior Product Manager, AI Platform",
    company: "Northlight",
    location: "Bengaluru, India",
    lat: 12.9716, lng: 77.5946,
    focus: "AI & ML Products",
    focusTag: "ai",
    yearsExperience: 9,
    photo: "assets/photos/priya-nair.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On shipping probabilistic features when your users expect deterministic ones, and why eval suites are now part of the PM job.",
    pullQuote: "The spec used to be the contract. Now the eval suite is the contract.",
    publishedDate: "2026-08-10",
    questions: [
      { q: "What changed most about your job in the last two years?", a: "I used to write specs that described exact behavior. Now I write specs that describe a distribution of acceptable behavior, and the eval suite is what actually enforces the contract with engineering. If I can't define 'good enough' in a way a script can check, I haven't finished the spec." },
      { q: "How do you decide when an AI feature is ready to ship?", a: "Three gates: the eval score is stable across two consecutive model versions, the failure modes are boring rather than surprising, and support can explain a wrong answer to a customer in one sentence. If any of those fail, it's not ready, no matter how good the demo looked." },
      { q: "What's a product instinct that stopped serving you?", a: "Reflexively de-risking. In deterministic software, shipping the safe version first was almost always right. With generative features, the safe version is often the boring one, and you learn less from it than from a bolder version with a tight fallback." },
      { q: "What do you wish engineers understood about your role right now?", a: "That 'make it more accurate' isn't a real request without a metric attached, and that I need their help defining that metric before we can even scope the work. The best AI-era engineering partners I've had treat evals as a joint deliverable, not a QA afterthought." },
      { q: "One thing you'd tell a PM starting out today?", a: "Learn to read a confusion matrix before you learn to run a stakeholder workshop. The workshop skills transfer from any era of software. The measurement skills are what's actually new." }
    ]
  },
  {
    slug: "mateus-albuquerque",
    name: "Mateus Albuquerque",
    role: "Group Product Manager",
    company: "Fernwave",
    location: "São Paulo, Brazil",
    lat: -23.5505, lng: -46.6333,
    focus: "B2B SaaS",
    focusTag: "b2b",
    yearsExperience: 12,
    photo: "assets/photos/mateus-albuquerque.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On selling outcomes instead of features to enterprise buyers, and keeping a roadmap honest when every deal wants a custom promise.",
    pullQuote: "Every 'quick custom field' request is a future migration you haven't scheduled yet.",
    publishedDate: "2026-07-22",
    questions: [
      { q: "What's the hardest part of B2B roadmapping right now?", a: "Enterprise buyers are asking for AI features they saw in a demo somewhere, without a real workflow behind the ask. Half my job is translating 'we want AI too' into an actual job-to-be-done before it goes anywhere near the backlog." },
      { q: "How do you protect the roadmap from sales-driven scope creep?", a: "I make the cost of a custom request visible immediately, in the same room as the ask. Not 'we'll look into it' — a real number, tied to what it displaces. It changes the conversation from a favor to a trade-off." },
      { q: "What's an underrated skill for enterprise PMs?", a: "Reading a contract redline. The features your legal and security teams are quietly negotiating away tell you more about what enterprise customers actually value than any interview does." },
      { q: "How has AI changed enterprise buyer expectations?", a: "Procurement teams now ask about model provenance and data handling before they ask about the feature itself. That question used to come from security three months into a pilot. Now it's slide two of the first call." }
    ]
  },
  {
    slug: "elin-forsberg",
    name: "Elin Forsberg",
    role: "Head of Product Design",
    company: "Anchorpoint",
    location: "Stockholm, Sweden",
    lat: 59.3293, lng: 18.0686,
    focus: "Design Systems",
    focusTag: "design",
    yearsExperience: 14,
    photo: "assets/photos/elin-forsberg.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On designing interfaces for outputs that are different every time, and why a design system needs rules for uncertainty now, not just spacing.",
    pullQuote: "A design system used to define pixels. Now it has to define how a screen behaves when it's wrong.",
    publishedDate: "2026-07-05",
    questions: [
      { q: "What's the biggest gap in most design systems today?", a: "Almost none of them have patterns for partial confidence, streaming content, or graceful wrongness. We spent a decade perfecting empty states and loading states. Now we need 'plausible but unverified' states, and most component libraries have nothing for that." },
      { q: "How do you design trust into an AI feature?", a: "Show your work in the smallest possible unit — a source, a confidence signal, an easy undo — rather than a giant disclaimer banner. People calibrate trust from small, repeated cues, not from a paragraph they'll skip." },
      { q: "What's a mistake you see teams make with AI UI?", a: "Treating the chat box as the default interface for everything. Half the time a form, a slider, or a plain button gets the job done faster and with less ambiguity than a prompt ever will." },
      { q: "What hasn't changed about good design?", a: "Legibility of intent. Whether it's a dialog box or a generative agent, the user should be able to guess what happens next before they click. That principle predates computers and it'll outlast this AI cycle too." },
      { q: "Advice for designers moving into AI product work?", a: "Sit in on the eval reviews, not just the design crits. Watching a hundred real model outputs teaches you more about the actual failure modes than any Figma prototype will." }
    ]
  },
  {
    slug: "daniel-osei",
    name: "Daniel Osei",
    role: "Product Manager, Growth",
    company: "Rivergate",
    location: "Accra, Ghana",
    lat: 5.6037, lng: -0.1870,
    focus: "Consumer & Growth",
    focusTag: "growth",
    yearsExperience: 6,
    photo: "assets/photos/daniel-osei.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On growth loops that don't rely on paid acquisition, and treating AI-written copy as a first draft engineers still have to earn.",
    pullQuote: "AI gave us more first drafts. It didn't give us more good ideas.",
    publishedDate: "2026-06-18",
    questions: [
      { q: "What does 'growth' mean on your team today?", a: "Fewer paid channels, more compounding loops — referrals, content that ranks, integrations that pull people in sideways. Paid got more expensive and less trustworthy at the same time, so we had to get more patient." },
      { q: "How do you use AI in your day-to-day growth work?", a: "Mostly for volume at the top of the funnel — more headline variants, more onboarding copy drafts — with a human bar for what actually ships. It widens the funnel of ideas; it doesn't replace judgment about which one is honest and on-brand." },
      { q: "What's a growth tactic you've stopped believing in?", a: "Gamified streaks bolted onto a product that isn't inherently habit-forming. They spike a vanity metric for two weeks and then everyone quietly turns them off in settings." },
      { q: "What's underrated in growth right now?", a: "Retention debugging. Everyone wants to talk acquisition, but going deep on why week-two users vanish is where the biggest, cheapest wins still hide." }
    ]
  },
  {
    slug: "camille-durand",
    name: "Camille Durand",
    role: "Director of Product",
    company: "Ledgerline",
    location: "Paris, France",
    lat: 48.8566, lng: 2.3522,
    focus: "Fintech",
    focusTag: "fintech",
    yearsExperience: 15,
    photo: "assets/photos/camille-durand.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On why fintech is the slowest and most careful adopter of generative AI, and what that caution is actually protecting.",
    pullQuote: "In fintech, 'move fast' was never the value. 'Fail loudly and cheaply' was.",
    publishedDate: "2026-05-30",
    questions: [
      { q: "Why has fintech been slower to adopt generative AI than other sectors?", a: "Because a wrong answer about someone's money isn't a bad UX moment, it's a regulatory incident. Every AI feature we ship goes through the same scrutiny as a new lending model, and it should." },
      { q: "Where has AI actually earned its place in your product?", a: "Fraud pattern detection and support triage — places where the model flags something for a human rather than acting alone. Autonomy is the thing we're careful with, not intelligence." },
      { q: "What's a regulatory constraint that secretly makes the product better?", a: "Explainability requirements. Being forced to justify every automated decision in plain language has made our internal logic simpler and more defensible, model or no model." },
      { q: "What do younger PMs get wrong about fintech?", a: "They assume compliance is a blocker to route around. It's closer to a design constraint, like screen size — annoying at first, and it usually forces a better answer than the one you started with." }
    ]
  },
  {
    slug: "jonas-brandt",
    name: "Jonas Brandt",
    role: "Principal Product Manager, Platform",
    company: "Kestrel Systems",
    location: "Berlin, Germany",
    lat: 52.5200, lng: 13.4050,
    focus: "Platform & Infra",
    focusTag: "platform",
    yearsExperience: 11,
    photo: "assets/photos/jonas-brandt.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On managing a product with no UI, and treating internal developer experience as seriously as any customer-facing feature.",
    pullQuote: "My users are all engineers. Their bug reports are pull requests. It's the best PM job I've had.",
    publishedDate: "2026-05-12",
    questions: [
      { q: "How do you do discovery for a platform with no UI?", a: "API usage logs are my interview transcripts. What people retry, what they wrap in a helper function, what they route around — that tells me more than a survey ever could." },
      { q: "What's the hardest trade-off in platform PM work?", a: "Flexibility versus opinionated defaults. Every escape hatch you add for one team becomes a compatibility promise you're keeping for years, often for a use case you never fully understood." },
      { q: "How has AI changed platform work specifically?", a: "We now ship inference infrastructure the same way we used to ship storage — as a primitive, not a feature. Teams expect to compose it, not just consume a fixed endpoint." },
      { q: "What's a metric you track that most platform teams ignore?", a: "Time to first successful call for a brand-new integrator. It's a better proxy for documentation and API design quality than almost anything in a satisfaction survey." }
    ]
  },
  {
    slug: "amara-chukwu",
    name: "Amara Chukwu",
    role: "Product Manager, Marketplace Trust",
    company: "Harborlist",
    location: "Lagos, Nigeria",
    lat: 6.5244, lng: 3.3792,
    focus: "Marketplace",
    focusTag: "marketplace",
    yearsExperience: 7,
    photo: "assets/photos/amara-chukwu.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On fighting AI-generated fraud with AI-assisted detection, and keeping a two-sided marketplace fair when both sides are getting more automated.",
    pullQuote: "Every tool we ship to help sellers, a fraud ring evaluates for abuse before our own team finishes the retro.",
    publishedDate: "2026-04-20",
    questions: [
      { q: "What's the newest threat model in marketplace trust work?", a: "Synthetic listings and reviews generated at a volume and quality that our old heuristics never anticipated. We're now in an arms race where both sides use similar tooling, which is a strange position to build product in." },
      { q: "How do you balance trust and friction?", a: "We push verification to the moment it matters — payout, high-value listings — instead of the moment someone signs up. Front-loading friction kills good sellers faster than it stops bad ones." },
      { q: "What's a trust feature that quietly worked really well?", a: "Response-time badges for sellers. A simple, honest signal outperformed several more elaborate reputation scores we tried before it." },
      { q: "What do you want the next generation of trust tooling to do?", a: "Explain itself to the person it just penalized. A seller who gets suspended deserves a reason specific enough to act on, not a form-letter policy citation." }
    ]
  },
  {
    slug: "hana-kobayashi",
    name: "Hana Kobayashi",
    role: "Product Lead, Clinical Tools",
    company: "Meridian Health",
    location: "Osaka, Japan",
    lat: 34.6937, lng: 135.5023,
    focus: "Healthtech",
    focusTag: "health",
    yearsExperience: 10,
    photo: "assets/photos/hana-kobayashi.jpg",
    links: { linkedin: "#", website: "#", twitter: "#" },
    snippet: "On building AI-assisted tools for clinicians who will lose their license for a mistake the software helped cause, and why 'human in the loop' has to be a real design constraint, not a slide.",
    pullQuote: "'Human in the loop' is easy to write on a roadmap slide. It's hard to design when the human is exhausted at 2 a.m.",
    publishedDate: "2026-03-28",
    questions: [
      { q: "What's different about shipping AI in a clinical setting?", a: "The cost of overconfidence is measured in patient outcomes, not churn. Every AI-assisted feature we ship has to degrade to a safe, clearly labeled manual fallback, and we test that fallback path as hard as the happy path." },
      { q: "How do you design for an exhausted user making a high-stakes decision?", a: "Minimize what the interface asks the clinician to hold in their head. Surface the model's reasoning inline, in the same glance as the recommendation, not behind a link they're too tired to click at 2 a.m." },
      { q: "What's a hard lesson from a clinical AI feature that didn't work?", a: "We once auto-summarized patient histories in a way that was accurate on average and dangerously wrong on outliers. Average accuracy is close to meaningless in this domain; we now report confidence per-field, not per-document." },
      { q: "What do you wish AI vendors understood about healthcare?", a: "That 'human in the loop' is a design constraint with real cost, not a checkbox. If reviewing the model's output takes as long as doing the task manually, you haven't actually saved the clinician anything." }
    ]
  }
];

function findInterview(slug) {
  return INTERVIEWS.find(p => p.slug === slug);
}
