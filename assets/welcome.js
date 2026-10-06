// Welcome page (/newsletter-subscription-confirmed): confetti, rotating headline word, "are you a product person?" filter, share.
(function () {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Rotating word in the headline
  const rotor = document.getElementById("wl-rotor");
  const words = ["in the loop", "in the circle", "on the list", "part of it"];
  if (rotor && !reduce) {
    let i = 0;
    setInterval(() => {
      rotor.classList.add("is-out");
      setTimeout(() => { i = (i + 1) % words.length; rotor.textContent = words[i]; rotor.classList.remove("is-out"); }, 260);
    }, 2600);
  }

  // Product person? filter
  const cards = [...document.querySelectorAll(".wl-card")];
  const reply = document.getElementById("wl-reply");
  const lines = {
    yes: "Great - here is how to put yourself on the map.",
    curious: "Welcome. Start with a story, we'll be here when you're ready to join in."
  };
  function show(who, announce) {
    cards.forEach(c => { c.hidden = !c.dataset.for.split(" ").includes(who); });
    cards.filter(c => !c.hidden).forEach((c, i) => { c.querySelector(".wl-num").textContent = "0" + (i + 1); });
    document.querySelectorAll(".wl-opt").forEach(b => {
      const on = b.dataset.who === who;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (reply) reply.textContent = announce ? lines[who] : "";
    // replay the entrance animation
    cards.forEach(c => { c.style.animation = "none"; void c.offsetWidth; c.style.animation = ""; });
  }
  document.querySelectorAll(".wl-opt").forEach(b => b.addEventListener("click", () => {
    show(b.dataset.who, true);
    if (b.dataset.who === "yes") burst(0.5, 0.45, 40);
  }));
  show("yes", false);

  // Share
  const share = document.getElementById("wl-share");
  if (share) share.addEventListener("click", async () => {
    const data = { title: "Product Moat", text: "Interviews with product leaders, and a map of the people building what comes next.", url: "https://www.productmoat.com/" };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.url);
      share.textContent = "Link copied - thank you!";
      burst(0.5, 0.8, 30);
      setTimeout(() => { share.textContent = "Share Product Moat"; }, 2500);
    } catch (e) { /* share dismissed */ }
  });

  // Confetti (small canvas particle system, in the site's palette)
  const canvas = document.getElementById("wl-confetti");
  const ctx = canvas && !reduce ? canvas.getContext("2d") : null;
  if (!ctx) return;
  let W = 0, H = 0, parts = [], raf = 0;
  const colors = () => {
    const s = getComputedStyle(document.body);
    return [s.getPropertyValue("--accent"), s.getPropertyValue("--ink"), s.getPropertyValue("--positive"), "#f5b83d"].map(c => c.trim());
  };
  function resize() {
    const r = window.devicePixelRatio || 1;
    W = canvas.width = innerWidth * r; H = canvas.height = innerHeight * r;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  addEventListener("resize", resize); resize();
  function burst(x, y, n) {
    if (!ctx) return;
    const cs = colors(), r = window.devicePixelRatio || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (6 + Math.random() * 9) * r;
      parts.push({ x: x * W, y: y * H, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6 * r, w: (6 + Math.random() * 6) * r, h: (3 + Math.random() * 4) * r,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cs[i % cs.length], life: 1 });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    const r = window.devicePixelRatio || 1;
    parts = parts.filter(p => p.life > 0 && p.y < H + 40);
    for (const p of parts) {
      p.vy += 0.35 * r; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.006;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) ctx.clearRect(0, 0, W, H);
  }
  window.burst = burst;
  setTimeout(() => { burst(0.2, 0.3, 50); burst(0.8, 0.3, 50); }, 250);
})();
