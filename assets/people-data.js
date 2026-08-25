// ProductMoat — interview portal data (placeholder set)
// Replace/extend with real interviewees. Shape:
// {
//   slug, name, role, company, location, focus, focusTag, yearsExperience,
//   lat, lng,   // coordinates for the profile page's mini-map + the main globe (map.html)
//   links: { linkedin, website, twitter },
//   snippet, pullQuote, publishedDate: "YYYY-MM-DD",
//   photo: "assets/photos/....jpg",  // optional — falls back to initials medallion
//   foreword: "...",  // short editorial intro written by Martin, not a Q&A
//   sections: [
//     { id, title, questions: [{ q, a }, ...] },  // fixed order: into-product, product-today, ai-in-the-work, outlook
//     ...
//   ]
// }

const SECTION_TITLES = {
  "into-product": "Into Product",
  "product-today": "The Product Today",
  "ai-in-the-work": "AI in the Work",
  "outlook": "Looking Ahead"
};

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
    foreword: "Samantha Nair has spent sixteen years in product, the last four of them rethinking what a leadership job even is once half the org's decisions run through a model before they reach a person. I wanted to open the series with her because she's unusually honest about the parts of leadership that got harder, not just the parts that got automated away. We talked about the move to Barcelona, the instinct she had to unlearn, and what she's actually looking for when she hires now.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "How did you first end up in product, of all the paths you could have taken?", a: "I started in ops at a logistics company, the person everyone came to when a process broke. A director noticed I kept redesigning the workaround instead of just running it, and asked if I'd ever thought about product. I hadn't — I didn't know it was a job title yet. Six months later I had one." },
          { q: "What's something outside work that quietly shapes how you lead?", a: "Sailing, badly. I crew a small boat most weekends and there is nothing more honest than wind — it does not care about your quarterly plan. It's taught me more about reading conditions and adjusting in real time than any leadership book has." },
          { q: "Looking back, what almost pulled you away from product entirely?", a: "A stretch running a P&L directly, no product title at all. I liked the clarity of owning a number, and it's why I still think every product leader should carry one at some point. I came back to product because I missed building the thing, not just measuring it." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Solventra actually build, for someone who's never heard of it?", a: "Treasury and cash-management software for mid-market companies — the tools finance teams use to see where their money sits across banks and currencies, and move it without six spreadsheets and a prayer. Unglamorous, high-stakes, and surprisingly under-served." },
          { q: "How big is the org you're leading product for?", a: "About 40 people across product, design, and research, inside a company of just under 600. Four product pods, each owns a slice of the treasury workflow end to end rather than a horizontal layer, which is deliberate — it keeps teams close to a real customer outcome." },
          { q: "Where does Solventra sit against the big treasury platforms?", a: "We're not trying to be a treasury module built for a company ten times our customer's size — we're for the mid-market company that's outgrown a spreadsheet but would be a rounding error to an enterprise vendor's sales team. Our ICP is a 200–2,000 employee company with a treasurer wearing three other hats. Being the right size for them, not the biggest platform in the category, is the whole positioning." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "Where has AI actually landed in the product itself, not just the roadmap slide?", a: "Cash-flow forecasting and anomaly detection on transactions — both places where a model can propose and a human treasurer has to approve before money moves. Nowhere in the product does an agent move funds unsupervised, and that line is not going to move soon." },
          { q: "How has it changed the way your own team works day to day?", a: "Half our internal spec review is now spent agreeing on eval criteria instead of pixel details. PMs pair with a data scientist earlier than they used to, sometimes before there's a mock at all, because the model behavior has to be scoped before the screen does." },
          { q: "How do you personally keep up with how fast this is moving?", a: "I stopped trying to track every model release and instead track three things weekly: what my best engineers are excited about, what our support queue is telling us, and what one trusted peer group is seeing. Filtered signal beats raw volume every time." },
          { q: "What's a leadership instinct you've had to unlearn?", a: "Rewarding certainty. I used to promote the PM who walked into a room with the most confident answer. Now I'm more interested in the one who can tell me exactly how confident the model's answer is and why, because that's the skill that actually prevents expensive mistakes." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's a topic in product right now that you think is under-discussed?", a: "Accountability when a model is in the decision loop. We've gotten good at measuring model accuracy and terrible at defining who owns the outcome when the model was right, the human overrode it, and the override was the mistake. That's a leadership and process question, not a technical one, and most orgs don't have an answer yet." },
          { q: "Where do you think this is heading over the next few years?", a: "Toward much smaller, more specialized product teams doing what used to take an org twice the size, with the leadership skill shifting from headcount planning to judgment calibration — knowing when to trust the model's output, and teaching your team to know it too. The org chart gets flatter; the trust chart gets more important." },
          { q: "What do you look for when hiring product leaders now?", a: "Whether they've ever had to kill a feature that tested well but that they didn't trust. AI makes it cheap to generate plausible-looking wins. The judgment to say no to one anyway is the same judgment it's always been — it's just being tested more often now." }
        ]
      }
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
    foreword: "Priya Nair joined product from a data science background, which shows in how precisely she talks about what 'ready to ship' means for a probabilistic feature. Nine years in, most of them building AI-facing products, she's become someone I go to for a straight answer on what an eval suite actually replaces in the PM job — not marketing language, the real mechanics.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "You came from a data science background — what pulled you into product specifically?", a: "I was the data scientist stuck explaining model results to a PM who'd then explain them badly to the exec team, twice removed from the actual finding. I got tired of the game of telephone and asked to own the roadmap conversation directly. Turns out I liked owning the trade-off more than I liked owning the model." },
          { q: "What's a hobby that's more connected to your product instincts than people would guess?", a: "Competitive badminton, which I still play at a decent club level. It's a game of small, fast corrections under uncertainty — you don't get to plan three shots ahead, you read the racket angle and adjust. That's most of my actual job now too." },
          { q: "Was there a moment you almost left product?", a: "Early on, yes — a year into a role where I was purely a backlog administrator, no real influence on strategy. I moved teams instead of moving industries, and it was the right call. The title wasn't the problem; the scope was." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Northlight's AI platform actually do for its customers?", a: "We're the information-retrieval layer other software companies plug into instead of building their own search and RAG stack — the part of the product that answers 'find me the right document' correctly, at scale, across messy enterprise data." },
          { q: "Who's the actual customer, and how big is your world inside Northlight?", a: "Our ICP is a mid-to-large B2B software company that has search or RAG on its own roadmap and would rather license a good one than build a mediocre one in nine months. I run a team of six PMs and about 30 engineers across the platform, inside a company of roughly 400." },
          { q: "How does Northlight compete against a team that could just build this in-house?", a: "We don't compete on 'can you build this' — anyone can build a version. We compete on 'can you keep it accurate as your data grows and stays messy,' which is the unglamorous, compounding work most internal teams underestimate and eventually get tired of maintaining." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "What changed most about your job in the last two years?", a: "I used to write specs that described exact behavior. Now I write specs that describe a distribution of acceptable behavior, and the eval suite is what actually enforces the contract with engineering. If I can't define 'good enough' in a way a script can check, I haven't finished the spec." },
          { q: "How do you decide when an AI feature is ready to ship?", a: "Three gates: the eval score is stable across two consecutive model versions, the failure modes are boring rather than surprising, and support can explain a wrong answer to a customer in one sentence. If any of those fail, it's not ready, no matter how good the demo looked." },
          { q: "What's a product instinct that stopped serving you?", a: "Reflexively de-risking. In deterministic software, shipping the safe version first was almost always right. With generative features, the safe version is often the boring one, and you learn less from it than from a bolder version with a tight fallback." },
          { q: "What do you wish engineers understood about your role right now?", a: "That 'make it more accurate' isn't a real request without a metric attached, and that I need their help defining that metric before we can even scope the work. The best AI-era engineering partners I've had treat evals as a joint deliverable, not a QA afterthought." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's a topic you think the industry isn't taking seriously enough yet?", a: "Eval literacy outside the AI team. Legal, support, even sales are all now affected by model behavior they can't independently assess, and most orgs haven't built the muscle to read a confusion matrix outside of engineering. That gap is going to cause real incidents before it gets fixed." },
          { q: "Where do you see your corner of the industry heading?", a: "Retrieval quality becomes the actual moat, not the model. Everyone has access to roughly the same foundation models now; the products that win will be the ones with the cleanest, best-curated, best-retrieved data underneath them — unglamorous infrastructure work, decisive advantage." },
          { q: "One thing you'd tell a PM starting out today?", a: "Learn to read a confusion matrix before you learn to run a stakeholder workshop. The workshop skills transfer from any era of software. The measurement skills are what's actually new." }
        ]
      }
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
    foreword: "Mateus Albuquerque has spent the back half of his career in enterprise B2B, the part of product where the roadmap has to survive contact with a sales team's promises. Twelve years in, he's unusually blunt about what enterprise buyers actually want from AI right now, which is mostly not what the demo suggested.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "What was your route into product management?", a: "I was a sales engineer first, the person who got dragged into every deal the moment a prospect asked 'can it also do X.' I got good at saying no in a way that didn't kill the deal, and a VP eventually told me that was basically the product job. She wasn't wrong." },
          { q: "What do you do outside work that has nothing to do with software?", a: "I restore old mechanical watches, badly, as a hobby. There's something calming about a system where every part has exactly one job and the failure mode is always mechanical, never ambiguous — the opposite of most days at work." },
          { q: "Any career detour you're glad you took?", a: "Two years in implementation and customer success before I ever wrote a spec. Sitting in enough painful onboarding calls taught me more about what 'simple' actually means to a customer than any amount of design critique did later." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Fernwave sell, and to whom?", a: "We're workflow and approvals software for mid-market operations teams — the layer that sits between 'someone requested something' and 'it's actually approved, budgeted, and tracked.' Our ICP is an operations or finance lead at a 500–5,000 employee company drowning in email-based approval chains." },
          { q: "How big is the team behind it?", a: "Product and design together are about 25 people, inside a company of just over 300. I run the enterprise segment specifically — three pods, each aligned to a vertical rather than a feature area." },
          { q: "Where do you sit against the bigger workflow platforms?", a: "We lose on breadth against the largest workflow suites, on purpose — we win by being implementable in weeks, not quarters, for a company that will never need that full surface area. Being narrower is the pitch, not the limitation." },
          { q: "What's the hardest part of B2B roadmapping right now?", a: "Enterprise buyers are asking for AI features they saw in a demo somewhere, without a real workflow behind the ask. Half my job is translating 'we want AI too' into an actual job-to-be-done before it goes anywhere near the backlog." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "How do you protect the roadmap from sales-driven scope creep?", a: "I make the cost of a custom request visible immediately, in the same room as the ask. Not 'we'll look into it' — a real number, tied to what it displaces. It changes the conversation from a favor to a trade-off." },
          { q: "How has AI changed enterprise buyer expectations?", a: "Procurement teams now ask about model provenance and data handling before they ask about the feature itself. That question used to come from security three months into a pilot. Now it's slide two of the first call." },
          { q: "How is AI actually built into Fernwave's own product and internal process?", a: "In the product, it drafts the first version of an approval policy from a plain-language description, which a human still has to publish. Internally, it's changed how we write specs for enterprise clients specifically — procurement now asks for a model card before they'll even schedule a security review, so that document exists before the feature does." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's an underrated skill for enterprise PMs?", a: "Reading a contract redline. The features your legal and security teams are quietly negotiating away tell you more about what enterprise customers actually value than any interview does." },
          { q: "What do you think the industry is getting wrong about enterprise AI adoption right now?", a: "Vendors are still selling capability when buyers are actually asking about liability — who's accountable when the model's output causes a compliance problem. The vendors who start selling an answer to that question, not just a bigger model, are going to win the next wave of enterprise deals." }
        ]
      }
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
    foreword: "Elin Forsberg has spent fourteen years building design systems, which used to mean pixels and spacing tokens and now, in her words, means teaching a screen how to behave when it's wrong. She leads product design at Anchorpoint in Stockholm and was one of the first people in this series to make the case that generative interfaces need entirely new component patterns, not just new colors.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "How did you find your way into design, and then into product?", a: "I trained as an industrial designer, actually — physical objects, tolerances, manufacturing constraints. Screens felt looser and less honest to me at first, until I realized interaction design has its own physics; you just have to learn where the edges are." },
          { q: "What's a hobby that shapes how you think about design?", a: "Ceramics, on a wheel, most Sunday mornings. Nothing teaches you about constraint and material behavior like clay that collapses the moment you push it past what it can hold — it's the most direct feedback loop I have all week." },
          { q: "Was there a point you nearly left the field?", a: "A stretch doing pure visual design with zero research access, just executing someone else's decisions. I moved to a smaller company specifically to get research access back, even for less title. It was the right trade." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Anchorpoint build?", a: "Financial planning software for independent advisors — the interface an advisor uses in front of a client to model scenarios live, in the room, rather than presenting a static PDF after the fact." },
          { q: "How big is your design org, and where does design sit in the company?", a: "Nine designers inside a product and engineering org of about 90, at a company of 250. Design reports alongside product, not under it, which I fought for specifically because design-system decisions need equal weight with roadmap decisions, not just execution power." },
          { q: "Who's the actual user, and how does Anchorpoint compare to the bigger planning platforms?", a: "Our ICP is an independent advisor or small RIA, not a wirehouse — someone who chose independence and needs software that doesn't feel like it was designed for a 10,000-person firm. Against the big platforms, we're deliberately less powerful and much faster to actually use live with a client." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "What's the biggest gap in most design systems today?", a: "Almost none of them have patterns for partial confidence, streaming content, or graceful wrongness. We spent a decade perfecting empty states and loading states. Now we need 'plausible but unverified' states, and most component libraries have nothing for that." },
          { q: "How do you design trust into an AI feature?", a: "Show your work in the smallest possible unit — a source, a confidence signal, an easy undo — rather than a giant disclaimer banner. People calibrate trust from small, repeated cues, not from a paragraph they'll skip." },
          { q: "What's a mistake you see teams make with AI UI?", a: "Treating the chat box as the default interface for everything. Half the time a form, a slider, or a plain button gets the job done faster and with less ambiguity than a prompt ever will." },
          { q: "How has AI changed your own design process, day to day?", a: "Static comps stopped being the deliverable for anything generative — I now design ranges of acceptable output and the states around them, and I prototype directly against real model calls instead of faking data in Figma, because fake data hides exactly the failure modes that matter." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What hasn't changed about good design?", a: "Legibility of intent. Whether it's a dialog box or a generative agent, the user should be able to guess what happens next before they click. That principle predates computers and it'll outlast this AI cycle too." },
          { q: "What's a topic in your field you think is under-discussed right now?", a: "Design debt in AI features specifically — the confidence-signal patterns and fallback states we're shipping today are mostly one-offs, invented per team, with no shared language yet. I think the next real design-system work is standardizing that vocabulary before every product invents its own, incompatible version." },
          { q: "Advice for designers moving into AI product work?", a: "Sit in on the eval reviews, not just the design crits. Watching a hundred real model outputs teaches you more about the actual failure modes than any Figma prototype will." }
        ]
      }
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
    foreword: "Daniel Osei is the youngest person in this series so far — six years in, all of them in growth — and one of the most skeptical about AI as a shortcut. He runs growth at Rivergate in Accra and was refreshingly clear that AI gave his team more drafts, not more good ideas.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "How did you get into product, and growth specifically?", a: "I started as a self-taught marketer running Facebook ads for a friend's small e-commerce shop, obsessing over every number. A startup noticed the numbers before they noticed my job title, and growth PM was the closest official name for what I was already doing." },
          { q: "What do you do outside work?", a: "I coach a youth football team on weekends, which has taught me more about incentive design than any growth textbook — twelve-year-olds will find the loophole in any rule within one practice, exactly like users find the loophole in any growth mechanic." },
          { q: "What almost derailed your path into this career?", a: "A year at a big agency doing growth work for clients I had no real stake in, purely by the numbers, no product context. I left for an in-house role at half the agency's prestige, and it was the best trade I've made — context beats prestige." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Rivergate actually do?", a: "We're a savings and micro-investment app for first-time investors across West Africa — the product that gets someone from 'I have some money and no idea what to do with it' to their first small, safe investment." },
          { q: "How big is your team, and who's the ICP?", a: "Growth is four of us inside a product org of about 20, at a company of 60. ICP is someone in their twenties, employed, banked but not previously invested — the gap between having a bank account and actually building any wealth." },
          { q: "How does Rivergate compare to the bigger fintech players moving into the region?", a: "The big players are building for volume across the continent; we're building trust in specific communities first — in-person partnerships and local language — then letting the product scale after the trust exists. Slower, but it compounds instead of churning." },
          { q: "What does 'growth' mean on your team today?", a: "Fewer paid channels, more compounding loops — referrals, content that ranks, integrations that pull people in sideways. Paid got more expensive and less trustworthy at the same time, so we had to get more patient." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "How do you use AI in your day-to-day growth work?", a: "Mostly for volume at the top of the funnel — more headline variants, more onboarding copy drafts — with a human bar for what actually ships. It widens the funnel of ideas; it doesn't replace judgment about which one is honest and on-brand." },
          { q: "How has AI changed your team's processes, not just the output?", a: "Review cycles got shorter but stricter — we ship more variants because drafting is cheap now, but every one still needs a human sign-off against brand and honesty before it goes live, which is actually slower per-item than before, just wider in parallel." },
          { q: "How do you personally keep up with how fast this space moves?", a: "I don't try to track every tool. I pick one Friday a month to actually build something small with whatever's new, hands-on, and ignore the rest of the noise until it proves itself in that hour." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's a growth tactic you've stopped believing in?", a: "Gamified streaks bolted onto a product that isn't inherently habit-forming. They spike a vanity metric for two weeks and then everyone quietly turns them off in settings." },
          { q: "What's underrated in growth right now?", a: "Retention debugging. Everyone wants to talk acquisition, but going deep on why week-two users vanish is where the biggest, cheapest wins still hide." },
          { q: "What's a topic you think matters more than the industry currently treats it?", a: "Honesty in AI-assisted marketing copy, specifically in financial products. It's now trivially cheap to generate a hundred persuasive variants, and the industry hasn't caught up on what 'persuasive but not misleading' means at that scale. I think regulation gets here before self-discipline does." }
        ]
      }
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
    foreword: "Camille Durand has spent fifteen years in fintech product, most of it learning that 'move fast' was never actually the value her industry optimized for — 'fail loudly and cheaply' was. She's Director of Product at Ledgerline in Paris and one of the more measured voices in this series on where AI has and hasn't earned trust.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "What brought you into fintech product specifically?", a: "I trained as an actuary, oddly enough — risk modeling, insurance math. A former colleague moved into product at a fintech and pulled me in to help scope a risk feature. I never left; the math background turned out to be more useful in product than I expected." },
          { q: "What do you do away from work?", a: "I restore antique clocks. Fintech and horology have more in common than people assume — both are about systems where a small, invisible error compounds silently until it's suddenly very visible and very expensive." },
          { q: "Any point you nearly changed direction entirely?", a: "I considered leaving for pure risk consulting after a rough regulatory audit early in my career. I stayed in product because I realized I wanted to build the guardrail, not just diagnose that one was missing after the fact." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Ledgerline actually build?", a: "Embedded lending infrastructure — the underwriting and compliance layer other fintech and marketplace apps plug in so they can offer credit to their own users without building a lending stack from scratch." },
          { q: "How big is your product org, and what's the company size?", a: "Product is 18 people inside a company of about 220. I run the lending core specifically — three teams: underwriting, servicing, and compliance tooling." },
          { q: "Who's the customer, and how do you compare to the bigger players in embedded finance?", a: "Our ICP is a mid-sized fintech or marketplace that wants to offer credit but doesn't have the twelve months and the compliance headcount to build it themselves. Against the largest embedded-finance platforms, we're narrower — lending only, not a full banking-as-a-service suite — and that focus is what lets us move faster on the compliance side specifically." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "Why has fintech been slower to adopt generative AI than other sectors?", a: "Because a wrong answer about someone's money isn't a bad UX moment, it's a regulatory incident. Every AI feature we ship goes through the same scrutiny as a new lending model, and it should." },
          { q: "Where has AI actually earned its place in your product?", a: "Fraud pattern detection and support triage — places where the model flags something for a human rather than acting alone. Autonomy is the thing we're careful with, not intelligence." },
          { q: "How is AI changing your team's own processes, beyond the product itself?", a: "Every model-assisted decision in the product now has a documentation trail generated alongside it, automatically, because a regulator will eventually ask for it. That requirement shaped our engineering process more than any feature request has." },
          { q: "How do you keep up with how quickly this space is moving, given how cautious you have to be?", a: "I let smaller, less regulated companies be the early signal. I watch what consumer AI products ship successfully for a full year before I even scope a version for our regulatory environment — the caution is deliberate, not a lag I'm trying to close." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's a regulatory constraint that secretly makes the product better?", a: "Explainability requirements. Being forced to justify every automated decision in plain language has made our internal logic simpler and more defensible, model or no model." },
          { q: "What do younger PMs get wrong about fintech?", a: "They assume compliance is a blocker to route around. It's closer to a design constraint, like screen size — annoying at first, and it usually forces a better answer than the one you started with." },
          { q: "What's a topic you think deserves more attention right now?", a: "Model drift in credit decisions specifically — a model that was fair at launch can quietly become unfair as the applicant population shifts, and most fintechs don't re-audit fairness nearly often enough. I think this becomes a real regulatory flashpoint within a few years, not a hypothetical one." }
        ]
      }
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
    foreword: "Jonas Brandt runs platform product at Kestrel Systems in Berlin, which means his users are all engineers and his bug reports arrive as pull requests. Eleven years in, he's become one of the clearest voices I know on the specific ways AI has changed what a platform even is.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "How did you end up in platform product specifically?", a: "I was a backend engineer who kept getting pulled into 'how should this API actually work' conversations instead of just implementing the spec handed to me. Eventually a lead suggested I just own that conversation formally, and platform PM was the closest title." },
          { q: "What do you do outside of work?", a: "I build mechanical keyboards from individual switches up, which is a strange, deep rabbit hole of a hobby. It's the same instinct as platform work, honestly — caring intensely about an interface almost nobody else will consciously notice unless it's wrong." },
          { q: "Was there a moment you almost left engineering-adjacent work entirely?", a: "I did a year in a pure infrastructure ops role with no product input at all, just running what others designed. I moved back toward product because I missed shaping the 'why,' not just executing the 'how.'" }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Kestrel Systems' platform actually do?", a: "We're a workflow-orchestration platform — the infrastructure other engineering teams use to chain together long-running, multi-step processes across services without hand-rolling retry logic and state machines themselves." },
          { q: "How big is the team, and who's the customer?", a: "Platform product and engineering together are about 60 people, inside a company of 500. Our ICP is an engineering team at a mid-to-large company already running enough microservices that manual orchestration has become genuinely painful." },
          { q: "How does Kestrel compare to the bigger orchestration players?", a: "Against the bigger open-source and managed orchestration platforms, we're not trying to out-feature them — we win on operational simplicity for a team that doesn't want to run and tune the orchestration layer themselves. Managed and boring is the pitch." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "How do you do discovery for a platform with no UI?", a: "API usage logs are my interview transcripts. What people retry, what they wrap in a helper function, what they route around — that tells me more than a survey ever could." },
          { q: "How has AI changed platform work specifically?", a: "We now ship inference infrastructure the same way we used to ship storage — as a primitive, not a feature. Teams expect to compose it, not just consume a fixed endpoint." },
          { q: "What's the hardest trade-off in platform PM work?", a: "Flexibility versus opinionated defaults. Every escape hatch you add for one team becomes a compatibility promise you're keeping for years, often for a use case you never fully understood." },
          { q: "How has AI changed your own day-to-day process as a PM?", a: "Spec review now includes a section on model-call cost and latency budgets for any workflow step that calls an LLM, which didn't exist as a category eighteen months ago. It's become as standard a line item as error handling." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's a metric you track that most platform teams ignore?", a: "Time to first successful call for a brand-new integrator. It's a better proxy for documentation and API design quality than almost anything in a satisfaction survey." },
          { q: "What's a topic in platform work you think is under-discussed?", a: "Cost observability for AI-driven workflows specifically. Teams instrument latency and error rate obsessively and then get blindsided by a token-cost bill three times normal because nobody built a cost dashboard for the orchestration layer. I think that becomes standard platform tooling within two years, out of necessity." }
        ]
      }
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
    foreword: "Amara Chukwu works on marketplace trust at Harborlist in Lagos, which in practice means she's in a permanent arms race with the exact same kind of AI tooling her own team uses, just pointed at fraud instead of defense. Seven years in, she was one of the more clear-eyed people in this series about what that arms race actually looks like day to day.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "What was your path into product, and trust work specifically?", a: "I started in customer support at Harborlist, handling disputes between buyers and sellers directly. I got obsessed with the patterns in the disputes that recurred, and asked to move into the team that could actually fix the patterns instead of resolving them one at a time." },
          { q: "What do you do outside work?", a: "I play a lot of chess, mostly online, at a fairly serious amateur level. Trust and safety work is oddly similar — you're constantly trying to think two moves ahead of an opponent who's also adapting to your last move." },
          { q: "Any moment you almost left this line of work?", a: "A stretch that was purely reactive — firefighting fraud spikes with no time for structural fixes — nearly burned me out on trust work specifically. I pushed for a rebalanced mandate that included proactive detection, not just response, and staying became the right call." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Harborlist actually do?", a: "We're a peer-to-peer marketplace for buying and selling used equipment — construction tools, generators, that category — connecting individual sellers with buyers who'd otherwise be stuck with unreliable classifieds listings." },
          { q: "How big is the trust team, and the company overall?", a: "Trust and safety is 12 people across product, engineering, and operations, inside a company of about 180. I own the seller-side trust surface specifically — verification, listing quality, and payout risk." },
          { q: "Who's the ICP, and how does Harborlist compare to the bigger classifieds platforms?", a: "Our ICP is a small tradesperson or contractor buying or selling equipment they actually intend to use, not a reseller flipping inventory. Against generic classifieds, we win on trust infrastructure specifically — verified sellers and protected payments — which is also exactly what makes us a bigger fraud target." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "What's the newest threat model in marketplace trust work?", a: "Synthetic listings and reviews generated at a volume and quality that our old heuristics never anticipated. We're now in an arms race where both sides use similar tooling, which is a strange position to build product in." },
          { q: "How do you balance trust and friction?", a: "We push verification to the moment it matters — payout, high-value listings — instead of the moment someone signs up. Front-loading friction kills good sellers faster than it stops bad ones." },
          { q: "How is AI built into your own team's process, not just the product's defenses?", a: "Every new fraud pattern our models catch gets fed back into a shared internal playbook within days, not quarters — the model's false positives and false negatives are now a standing weekly review, not an annual audit." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What's a trust feature that quietly worked really well?", a: "Response-time badges for sellers. A simple, honest signal outperformed several more elaborate reputation scores we tried before it." },
          { q: "What do you want the next generation of trust tooling to do?", a: "Explain itself to the person it just penalized. A seller who gets suspended deserves a reason specific enough to act on, not a form-letter policy citation." },
          { q: "What's a topic you think matters more than the industry currently treats it?", a: "Appeals infrastructure. Everyone invests heavily in detection and almost nobody invests properly in the appeals path for the person the system got wrong. I think that imbalance becomes a real reputational and regulatory risk for marketplaces as automated enforcement scales." }
        ]
      }
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
    foreword: "Hana Kobayashi leads product for clinical tools at Meridian Health in Osaka, where the cost of an overconfident feature is measured in patient outcomes, not churn. Ten years in, she's become one of the most careful, precise voices in this series on what 'human in the loop' actually costs to design properly, versus what it costs to write on a slide.",
    sections: [
      {
        id: "into-product", title: "Into Product",
        questions: [
          { q: "How did you end up building software for clinicians specifically?", a: "I trained as a nurse before I moved into product — three years on a hospital floor before a health-tech startup hired me to help design a tool I'd actually complained about using. I brought the floor experience into every spec after that." },
          { q: "What do you do outside of work?", a: "I practice kyudo, Japanese archery, several times a week. It's entirely about form and repeatable precision under calm conditions, which is the exact opposite of a hospital floor, and I think that contrast is why it clears my head so effectively." },
          { q: "Was there a point you nearly left healthcare product work?", a: "After a feature I'd shipped contributed to a near-miss incident — nobody harmed, but close enough to shake me. I considered moving to a lower-stakes industry entirely. I stayed because that incident is exactly why I think careful people need to be in this specific room, not fewer of them." }
        ]
      },
      {
        id: "product-today", title: "The Product Today",
        questions: [
          { q: "What does Meridian Health's clinical tools team actually build?", a: "Decision-support software for hospital clinicians — tools that surface relevant patient history, flag potential drug interactions, and now increasingly summarize and highlight what a model thinks is most relevant, always with a clear, labeled fallback to the raw record." },
          { q: "How big is your team, and the company?", a: "Product for clinical tools is 14 people, inside a company of about 340. I lead the physician-facing surface specifically, as distinct from the separate team building patient-facing tools." },
          { q: "Who's the ICP, and how does Meridian compare to the big hospital-system incumbents?", a: "Our ICP is a mid-sized hospital system too small to get real attention from the giant EHR vendors' product roadmaps, but too complex to run on something generic. Against the incumbents, we win on actually shipping fast in response to a specific hospital's workflow complaints, not a five-year enterprise roadmap." }
        ]
      },
      {
        id: "ai-in-the-work", title: "AI in the Work",
        questions: [
          { q: "What's different about shipping AI in a clinical setting?", a: "The cost of overconfidence is measured in patient outcomes, not churn. Every AI-assisted feature we ship has to degrade to a safe, clearly labeled manual fallback, and we test that fallback path as hard as the happy path." },
          { q: "How do you design for an exhausted user making a high-stakes decision?", a: "Minimize what the interface asks the clinician to hold in their head. Surface the model's reasoning inline, in the same glance as the recommendation, not behind a link they're too tired to click at 2 a.m." },
          { q: "What's a hard lesson from a clinical AI feature that didn't work?", a: "We once auto-summarized patient histories in a way that was accurate on average and dangerously wrong on outliers. Average accuracy is close to meaningless in this domain; we now report confidence per-field, not per-document." },
          { q: "How do you personally keep up with how quickly this space moves, given the stakes involved?", a: "I let the far more aggressive consumer AI space be the early testing ground and specifically study its failure cases, not just its wins. By the time something's proven safe enough to seriously consider for a clinical setting, someone outside healthcare has usually already found its sharp edges for us." }
        ]
      },
      {
        id: "outlook", title: "Looking Ahead",
        questions: [
          { q: "What do you wish AI vendors understood about healthcare?", a: "That 'human in the loop' is a design constraint with real cost, not a checkbox. If reviewing the model's output takes as long as doing the task manually, you haven't actually saved the clinician anything." },
          { q: "What's a topic you think deserves more attention in health tech right now?", a: "Clinician trust decay, specifically — how quickly a clinician stops trusting a tool after just one bad recommendation, even if the tool is right the other ninety-nine times. Most teams measure model accuracy obsessively and barely measure trust recovery, which I think is the harder and more important problem." }
        ]
      }
    ]
  }
];

function findInterview(slug) {
  return INTERVIEWS.find(p => p.slug === slug);
}
