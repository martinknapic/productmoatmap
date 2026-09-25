// ProductMoat — the default interview questions.
//
// This is the built-in starting point for the question bank. The live, admin-editable copy
// is stored by api/question-bank.js (backoffice → Questions); this file is what it falls
// back to, and what new candidates' questionnaires start from until the bank is changed.
// Loaded as a plain <script> in the browser (globals) and via require() in the API.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== "undefined" ? self : this, function () {
// The default PM interview: 7 sections, 24 questions. Question ids are stable (q1..q24).
//   required: true  -> must be answered to be featured; everything else is optional.
//   fromProfile     -> q1–q5 are taken from the application/profile fields, not stored in
//                      interview.answers (so the profile page skips them).
//   hint            -> one line of guidance shown on questions.html.
  const INTERVIEW_SECTIONS = [
  { id: "identity", title: "Identity & Background", blurb: "The basics, plus your own story. Most of this you already gave us in your application.", questions: [
    { id: "q1", text: "Full name", required: true, fromProfile: true, hint: "As you'd like it shown on your profile." },
    { id: "q2", text: "Current role", required: true, fromProfile: true, hint: "Your title today." },
    { id: "q3", text: "Company name", required: true, fromProfile: true, hint: "Where you work — or your own venture." },
    { id: "q4", text: "Location", required: true, fromProfile: true, hint: "City and country. This is what puts you on the map." },
    { id: "q5", text: "Years in product / design", required: true, fromProfile: true, hint: "A rough number is fine." },
    { id: "q6", text: "Your story: how did you end up in product?", required: true, hint: "The detour, the trigger, the first product you touched. A few sentences to a short paragraph." }
  ] },
  { id: "philosophy", title: "Core PM Philosophy", blurb: "How you think about the job, beyond the job title.", questions: [
    { id: "q7", text: "How do you define product success?", required: true, hint: "The metric or signal you'd trust most, and why." },
    { id: "q8", text: "What's your decision-making philosophy?", hint: "How you decide with incomplete information — what you write down, who you ask." },
    { id: "q9", text: "What's your biggest PM lesson or mistake?", required: true, hint: "A real one, and what it changed about how you work." },
    { id: "q10", text: "How do you manage stakeholders?", hint: "How you keep people aligned, especially when they disagree." }
  ] },
  { id: "product-decision", title: "Product & Decision-Making", blurb: "The craft: how you choose what to build and how you know it's right.", questions: [
    { id: "q11", text: "How do you prioritize?", hint: "The framework or instinct you actually use, not the textbook one." },
    { id: "q12", text: "How do you do customer discovery and validation?", hint: "How you learn what people need, and when you trust what you learned." },
    { id: "q13", text: "What's your favorite product you've shipped?", hint: "Something you're proud of, and what made it work." },
    { id: "q14", text: "What product inspires you?", hint: "Any product at all, and what it gets right." }
  ] },
  { id: "ai", title: "AI & the Future", blurb: "The thread running through the whole series.", questions: [
    { id: "q15", text: "How is AI changing product management?", required: true, hint: "What's different in your day-to-day, and what hasn't changed." },
    { id: "q16", text: "Which AI product do you use and respect?", hint: "Something you rely on, and why it earns your respect." },
    { id: "q17", text: "What's one thing about AI everyone gets wrong?", hint: "One misconception you'd happily correct." }
  ] },
  { id: "beliefs", title: "Beliefs & Opinions", blurb: "Where you're willing to take a side.", questions: [
    { id: "q18", text: "What's your unpopular product opinion?", hint: "A view you hold that others in product would push back on." },
    { id: "q19", text: "Which author, thinker, or influence shapes you?", hint: "A book, a person, or an idea that changed how you work." },
    { id: "q20", text: "What makes a great product?", hint: "Your test for whether something is truly great." }
  ] },
  { id: "company", title: "Company & Product", blurb: "Optional space to talk about what you're building — and why others should care.", questions: [
    { id: "q21", text: "What does your product solve?", hint: "Who it's for and the problem, in plain language." },
    { id: "q22", text: "What's the biggest misconception about it?", hint: "What people get wrong when they first hear about it." },
    { id: "q23", text: "What's the market opportunity?", hint: "Where it's headed, and why now." },
    { id: "q24", text: "Why would you recommend it to a peer?", hint: "Who should take a look, and what they'd get out of it." }
  ] }
];
  const CUSTOM_SECTION_TITLE = "More from the conversation";
  const CUSTOM_QUESTION_LIMIT = 3;
  const CUSTOM_QUESTION_IDEAS = [
  "What do you do outside work that shapes how you think?",
  "Was there a moment you almost left product?",
  "What's a tool or habit you couldn't work without?",
  "What would you tell a PM just starting out?",
  "Which decision would you make differently today?",
  "What's a topic you think is under-discussed right now?"
];


  const INTERVIEW_TOTAL_QUESTIONS = INTERVIEW_SECTIONS.reduce((n, s) => n + s.questions.length, 0);
  return { INTERVIEW_SECTIONS, INTERVIEW_TOTAL_QUESTIONS, CUSTOM_SECTION_TITLE, CUSTOM_QUESTION_LIMIT, CUSTOM_QUESTION_IDEAS };
});
