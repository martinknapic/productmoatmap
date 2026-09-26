/* ProductMoat — above-the-fold hero graphics.
 *
 * Five interchangeable concepts, all drawn from the site's own vocabulary: the open square frame
 * and orange → magenta → violet → blue gradient of the logo, hairline rules, square "pixels",
 * mono labels. Pick one with ?fx=spotlight|moat|globe|print|faces (?fx=off hides it); add ?lab to get a
 * small switcher for comparing them.
 *
 *   spotlight — the latest interview: portrait in a logo-style frame, frames radiating out, links to the article
 *   moat   — fly-through tunnel of open logo frames converging on the logo
 *   globe  — dot-matrix globe: every interviewee is a pin, linked by travelling arcs (drag, click)
 *   print  — WebGL riso/halftone field in the logo gradient, reacts to the cursor
 *   faces  — tilted 3D wall of interviewee portraits, duotoned in the logo gradient
 *
 * Everything pauses when the hero is off-screen or the tab is hidden, and holds a single still
 * frame under prefers-reduced-motion. Colours follow the light/dark theme.
 */
(function () {
  "use strict";

  const STOPS = ["#f95e25", "#ec0680", "#b329d7", "#4252ed", "#109df7"]; // sampled from logo-frame.png
  const TAU = Math.PI * 2;
  const DEFAULT_FX = "spotlight";
  const interviews = () => (typeof INTERVIEWS !== "undefined" && Array.isArray(INTERVIEWS) ? INTERVIEWS : []); // top-level const, not on window

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow = () => window.matchMedia("(max-width: 760px)").matches;

  // Small deterministic PRNG so the scene looks the same on every load.
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function readTheme() {
    const cs = getComputedStyle(document.body);
    const v = n => cs.getPropertyValue(n).trim();
    return { light: document.body.classList.contains("light"), ink: v("--ink"), paper: v("--paper"), soft: v("--line-soft"), dim: v("--ink-dim"), body: v("--ink-body"), accent: v("--accent") };
  }

  function gradient(c, x0, y0, x1, y1) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    STOPS.forEach((col, i) => g.addColorStop(i / (STOPS.length - 1), col));
    return g;
  }

  function stopColor(u) { // colour along the logo gradient, u in 0..1
    const f = clamp(u, 0, 1) * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(f));
    return mixHex(STOPS[i], STOPS[i + 1], f - i);
  }
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  /* ------------------------------------------------------------------------------------------
   * Shared canvas stage: sizing (DPR-capped), smoothed pointer, visibility-aware render loop.
   * render(c, st, dt) is called every frame; st = { w, h, dpr, t, th, ptr:{x,y,px,py,in} }.
   * ---------------------------------------------------------------------------------------- */
  function canvasStage(host, hero, render, hooks) {
    hooks = hooks || {};
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const c = canvas.getContext("2d");
    const st = { w: 0, h: 0, dpr: 1, t: 0, still: reduced(), th: readTheme(), ptr: { x: 0, y: 0, px: 0, py: 0, sx: 0, sy: 0, in: false } };
    const still = reduced();
    let raf = 0, last = 0, onScreen = true, dead = false;

    function resize() {
      const r = host.getBoundingClientRect();
      st.w = r.width; st.h = r.height;
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * st.dpr));
      canvas.height = Math.max(1, Math.round(r.height * st.dpr));
      c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      if (hooks.resize) hooks.resize(st);
      if (still || !raf) draw(0);
    }

    function draw(dt) {
      c.clearRect(0, 0, st.w, st.h);
      const p = st.ptr;
      p.sx = lerp(p.sx, p.x, 1 - Math.exp(-dt * 5));
      p.sy = lerp(p.sy, p.y, 1 - Math.exp(-dt * 5));
      render(c, st, dt);
    }

    function frame(now) {
      raf = 0;
      if (dead) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      st.t += dt;
      draw(dt);
      if (onScreen && !document.hidden && !still) raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && !dead && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function invalidate() { if (still && !dead) requestAnimationFrame(() => draw(0.016)); }

    function onMove(e) {
      const r = host.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      st.ptr.px = px; st.ptr.py = py;
      st.ptr.x = clamp((px / r.width - 0.5) * 2, -1, 1);
      st.ptr.y = clamp((py / r.height - 0.5) * 2, -1, 1);
      st.ptr.in = true;
      if (hooks.move) hooks.move(e, st);
      invalidate();
    }
    function onLeave() { st.ptr.in = false; st.ptr.x = 0; st.ptr.y = 0; if (hooks.leave) hooks.leave(st); }

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver(es => { onScreen = es[0].isIntersecting; onScreen ? start() : stop(); });
    io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    const mo = new MutationObserver(() => { st.th = readTheme(); invalidate(); });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    resize();
    start();

    return {
      canvas, st, invalidate,
      // advance the simulation by hand (used for deterministic screenshots and benchmarks)
      step(seconds) { const n = Math.max(1, Math.round(seconds * 60)); for (let i = 0; i < n; i++) { st.t += 1 / 60; draw(1 / 60); } },
      destroy() {
        dead = true; stop(); ro.disconnect(); io.disconnect(); mo.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        hero.removeEventListener("pointermove", onMove);
        hero.removeEventListener("pointerleave", onLeave);
        canvas.remove();
      }
    };
  }

  /* ------------------------------------------------------------------------------------------
   * 01  MOAT — fly through a tunnel of open logo frames
   * ---------------------------------------------------------------------------------------- */
  function moat(host, hero, opts) {
    opts = opts || {};
    const N = 15, RATE = 0.035;
    const rand = rng(7);
    const sparks = Array.from({ length: 34 }, () => ({ ph: rand(), u: rand(), sp: (rand() - 0.5) * 0.05, sz: 2 + rand() * 2 }));

    // Path of the open frame: a square with a gap in the left edge, exactly like the logo.
    function framePath(c, cx, cy, h, ang, ax) {
      ax = ax || 1;
      const co = Math.cos(ang), si = Math.sin(ang);
      const P = (x, y) => { x *= ax; return [cx + x * co - y * si, cy + x * si + y * co]; };
      const pts = [P(-h, 0.44 * h), P(-h, h), P(h, h), P(h, -h), P(-h, -h), P(-h, -0.17 * h)];
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    }
    let c; // set per-frame so framePath can use it
    const perim = (u, s, cx, cy, ang, ax) => {
      const side = Math.floor(u * 4) % 4, f = u * 4 - Math.floor(u * 4);
      const a = [[-s + 2 * s * f, -s], [s, -s + 2 * s * f], [s - 2 * s * f, s], [-s, s - 2 * s * f]][side];
      a[0] *= ax;
      const co = Math.cos(ang), si = Math.sin(ang);
      return [cx + a[0] * co - a[1] * si, cy + a[0] * si + a[1] * co];
    };

    return canvasStage(host, hero, (ctx, st) => {
      c = ctx;
      const { w, h, t, th, ptr } = st;
      const narrow = w < 760;
      const F = opts.focus ? opts.focus(st) : null; // {x, y, hw, hh}: the element the rings radiate from
      const V = F || { x: narrow ? w * 0.5 : w * 0.73, y: narrow ? h * 0.5 : h * 0.47 };
      const L = F ? F.hh : clamp(Math.min(w, h) * (narrow ? 0.17 : 0.13), 34, 70); // logo / focus half-height
      const ax = F ? F.hw / F.hh : 1;
      const smin = F ? L * 1.16 : L * 0.92, smax = Math.max(w, h) * (F ? 1.05 : 1.25);
      const cam = { x: ptr.sx * Math.min(w, h) * 0.16, y: ptr.sy * Math.min(w, h) * 0.12 };
      const twist = F ? 0.3 + ptr.sx * 0.25 : 0.85 + ptr.sx * 0.5;

      c.globalCompositeOperation = th.light ? "source-over" : "lighter";

      const ring = p => {
        const s = smin * Math.pow(smax / smin, p);
        const e = Math.pow(p, 1.6);
        return { s, cx: V.x + cam.x * e * 2.2, cy: V.y + cam.y * e * 2.2, ang: 0.1 * Math.sin(t * 0.18) + p * twist, a: smooth(0, 0.09, p) * (1 - smooth(0.62, 1, p)) };
      };

      // far → near so nearer frames overdraw
      for (let i = 0; i < N; i++) {
        const p = ((i / N + t * RATE) % 1 + 1) % 1;
        const r = ring(p);
        if (r.a < 0.01) continue;
        const band = i % 5 === 0;
        framePath(c, r.cx, r.cy, r.s, r.ang, ax);
        c.strokeStyle = gradient(c, r.cx - r.s * ax, r.cy - r.s, r.cx + r.s * ax, r.cy + r.s);
        c.globalAlpha = r.a * (F ? 0.7 : 1) * (band ? (th.light ? 0.85 : 0.75) : (th.light ? 0.55 : 0.5));
        c.lineWidth = band ? Math.max(1.5, r.s * (F ? 0.014 : 0.075)) : 1 + r.s * 0.006;
        c.lineJoin = "miter"; c.lineCap = "butt";
        c.stroke();
      }

      // signals riding the frames
      for (const s of sparks) {
        const p = ((s.ph + t * RATE) % 1 + 1) % 1;
        const r = ring(p);
        if (r.a < 0.05) continue;
        const [x, y] = perim(((s.u + t * s.sp) % 1 + 1) % 1, r.s, r.cx, r.cy, r.ang, ax);
        c.globalAlpha = Math.min(1, r.a * 1.4);
        c.fillStyle = stopColor((x - (V.x - r.s * ax)) / (2 * r.s * ax) * 0.5 + (y - (V.y - r.s)) / (2 * r.s) * 0.5);
        const z = s.sz * (0.6 + p * 1.6);
        c.fillRect(x - z / 2, y - z / 2, z, z);
      }

      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;

      if (F) return; // spotlight: the portrait takes the logo's place

      // the logo itself, at the vanishing point: gradient frame + ink square
      const ph = 0.5 + 0.5 * Math.sin(t * 0.9);
      const k = 1 + ph * 0.025;
      const LL = L * k, th2 = LL * 0.48;
      framePath(c, V.x, V.y, LL - th2 / 2, 0);
      c.lineWidth = th2; c.lineCap = "butt"; c.lineJoin = "miter";
      c.strokeStyle = gradient(c, V.x - LL, V.y - LL, V.x + LL, V.y + LL);
      c.stroke();
      c.fillStyle = th.ink;
      c.fillRect(V.x - LL * 0.528, V.y - LL * 0.528, LL * 1.056, LL * 1.056);

      // registration crosshair + ticks (technical-drawing flavour)
      c.strokeStyle = th.soft; c.lineWidth = 1; c.globalAlpha = 0.9;
      const ext = smax * 0.9;
      c.beginPath();
      c.moveTo(V.x - ext, V.y); c.lineTo(V.x - LL * 1.9, V.y);
      c.moveTo(V.x + LL * 1.9, V.y); c.lineTo(V.x + ext, V.y);
      c.moveTo(V.x, V.y - ext); c.lineTo(V.x, V.y - LL * 1.9);
      c.moveTo(V.x, V.y + LL * 1.9); c.lineTo(V.x, V.y + ext);
      c.stroke();
      c.globalAlpha = 1;
    });
  }

  /* ------------------------------------------------------------------------------------------
   * 02  GLOBE — dot-matrix Earth; interviewees are pins, linked by travelling arcs
   * ---------------------------------------------------------------------------------------- */
  function globe(host, hero) {
    const people = interviews().filter(p => isFinite(p.lat) && isFinite(p.lng));
    const llv = (lat, lng) => { const f = lat * Math.PI / 180, l = lng * Math.PI / 180; return [Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)]; };
    const pins = people.map(p => ({ p, v: llv(p.lat, p.lng), city: (p.location || "").split(",")[0].trim() }));

    // Arcs: link every pin to its two nearest neighbours (de-duplicated).
    const arcs = [];
    const seen = new Set();
    pins.forEach((a, i) => {
      pins.map((b, j) => ({ j, d: i === j ? 9 : Math.acos(clamp(a.v[0] * b.v[0] + a.v[1] * b.v[1] + a.v[2] * b.v[2], -1, 1)) }))
        .sort((x, y) => x.d - y.d).slice(0, 2).forEach(({ j, d }) => {
          const key = i < j ? i + "-" + j : j + "-" + i;
          if (!seen.has(key)) { seen.add(key); arcs.push({ a: i, b: j, ang: d, ph: (arcs.length * 0.37) % 1 }); }
        });
    });
    const slerp = (a, b, ang, u) => {
      const s = Math.sin(ang) || 1, k0 = Math.sin((1 - u) * ang) / s, k1 = Math.sin(u * ang) / s;
      return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
    };

    const glowCv = document.createElement("canvas"); let glowKey = "";
    // nearest visible pin within reach of a point (canvas px); sets `hover`
    function pick(px, py) {
      let best = -1, bd = 24;
      pins.forEach((p, i) => { if (p.z > 0.05) { const d = Math.hypot(px - p.sx, py - p.sy); if (d < bd) { bd = d; best = i; } } });
      hover = best;
    }
    let introT0 = -1, bits = null, dots = [], dotsFor = 0, R = 0, cx = 0, cy = 0;
    let yaw = 0.55, pitch = 0.5, yawOff = 0, pitchOff = 0, vel = 0, dragging = false, moved = 0, hover = -1, ctrl;

    function ensureMask(cb) {
      const decode = () => { const bin = atob(window.HERO_LAND_B64); bits = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i); cb(); };
      if (window.HERO_LAND_B64) return decode();
      const s = document.createElement("script");
      s.src = "assets/hero-land.js?v=1"; s.onload = decode; document.head.appendChild(s);
    }
    function land(lat, lng) {
      const col = clamp(Math.floor(lng + 180), 0, 359), row = clamp(Math.floor(90 - lat), 0, 179), i = row * 360 + col;
      return (bits[i >> 3] >> (i & 7)) & 1;
    }
    function buildDots() {
      if (!bits || !R) return;
      const spacing = clamp(R / 34, 5.5, 8.5);
      const n = Math.round(4 * Math.PI * R * R / (spacing * spacing));
      dots = []; dotsFor = R;
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * ga;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        const lat = Math.asin(y) * 180 / Math.PI, lng = Math.atan2(x, z) * 180 / Math.PI;
        if (land(lat, lng)) dots.push(x, y, z);
      }
    }

    // view transform: yaw about Y, then pitch about X
    const view = v => {
      const ya = yaw + yawOff, pa = pitch + pitchOff;
      const cyw = Math.cos(ya), syw = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
      const x1 = v[0] * cyw - v[2] * syw, z1 = v[0] * syw + v[2] * cyw;
      return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp];
    };
    const scr = (v, k) => [cx + R * k * v[0], cy - R * k * v[1]];

    const stage = canvasStage(host, hero, (c, st, dt) => {
      const { w, h, t, th } = st;
      if (!bits) return;
      const narrow = w < 760;
      R = narrow ? Math.min(w * 0.34, h * 0.36) : Math.min(h * 0.41, w * 0.225);
      cx = narrow ? w * 0.5 : w * 0.745; cy = h * 0.5;
      if (Math.abs(R - dotsFor) > 6) buildDots();

      if (introT0 < 0) introT0 = t;
      const intro = st.still ? 1 : 1 - Math.pow(1 - clamp((t - introT0) / 2.4, 0, 1), 2.2); // ease-out: lands fast, settles gently
      yawOff = -1.7 * Math.pow(1 - intro, 3);
      pitchOff = -st.ptr.sy * 0.06;
      const pk = smooth(0.55, 1, intro); // pins, arcs, labels fade up after the globe has landed

      if (!dragging) {
        yaw += vel * dt;
        vel += (0.05 * (hover >= 0 ? 0.15 : 1) - vel) * Math.min(1, dt * 1.5);
      }

      // orbit ring (back half), sphere, dots, orbit ring (front half)
      const orbit = (front) => {
        c.beginPath();
        let pen = false;
        for (let i = 0; i <= 120; i++) {
          const a = (i / 120) * TAU;
          let p = [1.2 * Math.cos(a), 0, 1.2 * Math.sin(a)];
          const tx = 1.15, tz = -0.32; // fixed tilt
          let y = p[1] * Math.cos(tx) - p[2] * Math.sin(tx), z = p[1] * Math.sin(tx) + p[2] * Math.cos(tx);
          let x = p[0];
          const x2 = x * Math.cos(tz) - y * Math.sin(tz), y2 = x * Math.sin(tz) + y * Math.cos(tz);
          if ((z > 0) === front) { const [sx, sy] = scr([x2, y2], 1); pen ? c.lineTo(sx, sy) : c.moveTo(sx, sy); pen = true; } else pen = false;
        }
        c.strokeStyle = gradient(c, cx - R * 1.4, cy - R * 0.6, cx + R * 1.4, cy + R * 0.6);
        c.globalAlpha = front ? 0.9 : 0.35; c.lineWidth = 1;
        c.stroke(); c.globalAlpha = 1;
      };
      const satellite = () => {
        const a = t * 0.35, tx = 1.15, tz = -0.32;
        const p = [1.2 * Math.cos(a), 0, 1.2 * Math.sin(a)];
        const y = p[1] * Math.cos(tx) - p[2] * Math.sin(tx), z = p[1] * Math.sin(tx) + p[2] * Math.cos(tx), x = p[0];
        const x2 = x * Math.cos(tz) - y * Math.sin(tz), y2 = x * Math.sin(tz) + y * Math.cos(tz);
        const [sx, sy] = scr([x2, y2], 1);
        if (z < 0 && Math.hypot(sx - cx, sy - cy) < R) return;
        c.fillStyle = th.ink; c.globalAlpha = z > 0 ? 1 : 0.45;
        c.fillRect(sx - 3, sy - 3, 6, 6); c.globalAlpha = 1;
      };

      orbit(false);

      // soft logo-gradient glow behind the sphere (static, so cached at half resolution)
      const gkey = [w | 0, h | 0, R | 0, cx | 0, th.light].join();
      if (gkey !== glowKey) {
        glowKey = gkey;
        glowCv.width = Math.ceil(w / 2); glowCv.height = Math.ceil(h / 2);
        const g = glowCv.getContext("2d");
        g.scale(0.5, 0.5);
        const glow = (x, y, rad, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col.replace("A", a)); gr.addColorStop(1, col.replace("A", 0)); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
        const ga = th.light ? 0.16 : 0.22;
        g.globalCompositeOperation = th.light ? "source-over" : "lighter";
        glow(cx - R * 0.55, cy - R * 0.5, R * 1.25, "rgba(249,94,37,A)", ga);
        glow(cx + R * 0.6, cy + R * 0.55, R * 1.35, "rgba(66,82,237,A)", ga);
        glow(cx + R * 0.7, cy - R * 0.4, R * 0.9, "rgba(236,6,128,A)", ga * 0.7);
      }
      c.globalAlpha = smooth(0, 0.8, intro);
      c.drawImage(glowCv, 0, 0, w, h);
      c.globalAlpha = 1;
      // faint graticule
      c.strokeStyle = th.soft; c.lineWidth = 1; c.globalAlpha = (th.light ? 0.9 : 0.7) * smooth(0, 0.6, intro);
      const line = (fn, n) => { c.beginPath(); let pen = false; for (let i = 0; i <= n; i++) { const v = view(fn(i / n)); if (v[2] > 0) { const [sx, sy] = scr(v, 1); pen ? c.lineTo(sx, sy) : c.moveTo(sx, sy); pen = true; } else pen = false; } c.stroke(); };
      for (let m = 0; m < 12; m++) { const l = m * Math.PI / 6; line(u => { const f = (u - 0.5) * Math.PI; return [Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)]; }, 40); }
      for (let q = -2; q <= 2; q++) { const f = q * Math.PI / 6; line(u => [Math.cos(f) * Math.sin(u * TAU), Math.sin(f), Math.cos(f) * Math.cos(u * TAU)], 72); }
      c.globalAlpha = 1;

      // land: near side solid, far side ghosted for depth
      const ds = clamp(R / 92, 1.8, 3);
      c.fillStyle = th.ink;
      for (let i = 0; i < dots.length; i += 3) {
        const v = view([dots[i], dots[i + 1], dots[i + 2]]);
        const [sx, sy] = scr(v, 1);
        const rev = intro >= 1 ? 1 : clamp((intro * 1.7 - Math.hypot(v[0], v[1]) * 0.95) / 0.3, 0, 1);
        if (rev <= 0) continue;
        if (v[2] > 0) { c.globalAlpha = (0.2 + 0.7 * Math.pow(v[2], 0.8)) * rev; const s = ds * (0.7 + 0.5 * v[2]) * (0.4 + 0.6 * rev); c.fillRect(sx - s / 2, sy - s / 2, s, s); }
        else { c.globalAlpha = (th.light ? 0.07 : 0.09) * rev; c.fillRect(sx - 0.75, sy - 0.75, 1.5, 1.5); }
      }
      c.globalAlpha = 1;

      // rim: conic gradient like the logo frame
      const conic = c.createConicGradient ? c.createConicGradient(-0.6 + t * 0.15, cx, cy) : gradient(c, cx - R, cy - R, cx + R, cy + R);
      if (c.createConicGradient) { [...STOPS, STOPS[0]].forEach((col, i) => conic.addColorStop(i / STOPS.length, col)); }
      c.strokeStyle = conic; c.lineWidth = 1.5; c.globalAlpha = smooth(0, 0.5, intro); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke(); c.globalAlpha = 1;

      // arcs
      const pv = pins.map(p => view(p.v));
      arcs.forEach(A => {
        const a = pins[A.a].v, b = pins[A.b].v, alt = 0.06 + 0.3 * (A.ang / Math.PI);
        const N = 36, P = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N, s = slerp(a, b, A.ang, u), k = 1 + alt * Math.sin(Math.PI * u), vv = view([s[0] * k, s[1] * k, s[2] * k]);
          P.push([...scr(vv, 1), vv[2]]);
        }
        const head = ((t * 0.16 + A.ph) % 1);
        c.lineWidth = 1;
        for (let i = 0; i < N; i++) {
          if (P[i][2] < 0.02 || P[i + 1][2] < 0.02) continue;
          const u = i / N, d = ((head - u) % 1 + 1) % 1, glow = Math.max(0, 1 - d * 4.5);
          c.strokeStyle = stopColor(u); c.globalAlpha = (0.45 + 0.55 * glow) * pk; c.lineWidth = 1.2 + glow * 1.8;
          c.beginPath(); c.moveTo(P[i][0], P[i][1]); c.lineTo(P[i + 1][0], P[i + 1][1]); c.stroke();
        }
        c.globalAlpha = 1;
      });

      // pins
      c.font = "600 10.5px 'Courier New', Courier, monospace";
      c.textBaseline = "middle";
      const labelled = [];
      pins.forEach((pin, i) => {
        const v = pv[i]; if (v[2] < 0.05) return;
        const [sx, sy] = scr(v, 1);
        pin.sx = sx; pin.sy = sy; pin.z = v[2];
        const pulse = (t * 0.5 + i * 0.29) % 1;
        c.strokeStyle = stopColor(i / Math.max(1, pins.length - 1)); c.lineWidth = 1;
        c.globalAlpha = (1 - pulse) * 0.7 * v[2] * pk; c.beginPath(); c.arc(sx, sy, 4 + pulse * 20, 0, TAU); c.stroke();
        c.globalAlpha = pk;
        const hot = hover === i, s = hot ? 9 : 6.5;
        c.fillStyle = th.paper; c.fillRect(sx - s / 2 - 2, sy - s / 2 - 2, s + 4, s + 4);
        c.fillStyle = stopColor(i / Math.max(1, pins.length - 1)); c.fillRect(sx - s / 2, sy - s / 2, s, s);
        const crowded = labelled.some(q => Math.abs(q[0] - sx) < 88 && Math.abs(q[1] - sy) < 15);
        if (!hot && !crowded) {
          labelled.push([sx, sy]);
          c.fillStyle = th.body; c.globalAlpha = 0.9 * smooth(0.25, 0.7, v[2]) * pk;
          c.textAlign = sx > cx ? "left" : "right";
          c.fillText(pin.city.toUpperCase(), sx + (sx > cx ? 12 : -12), sy);
          c.globalAlpha = 1;
        }
        c.globalAlpha = 1;
      });

      // hover card
      if (hover >= 0 && pins[hover].z > 0.05) {
        const pin = pins[hover], p = pin.p, sx = pin.sx, sy = pin.sy;
        const name = p.name.toUpperCase(), sub = `${p.role} · ${p.company}`.slice(0, 44);
        c.font = "700 11px 'Courier New', Courier, monospace"; const w1 = c.measureText(name).width;
        c.font = "500 10.5px 'Courier New', Courier, monospace"; const w2 = c.measureText(sub).width;
        const bw = Math.max(w1, w2) + 24, bh = 46, right = sx < cx + R * 0.3 ? 1 : -1;
        const bx = right > 0 ? sx + 16 : sx - 16 - bw, by = clamp(sy - bh - 10, 8, st.h - bh - 8);
        c.fillStyle = th.paper; c.strokeStyle = th.ink; c.lineWidth = 1;
        c.fillRect(bx, by, bw, bh); c.strokeRect(bx + 0.5, by + 0.5, bw, bh);
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(right > 0 ? bx : bx + bw, by + bh / 2); c.stroke();
        c.textAlign = "left"; c.fillStyle = th.ink; c.font = "700 11px 'Courier New', Courier, monospace";
        c.fillText(name, bx + 12, by + 17);
        c.fillStyle = th.dim; c.font = "500 10.5px 'Courier New', Courier, monospace";
        c.fillText(sub, bx + 12, by + 33);
      }

      satellite();
      orbit(true);
    }, {
      resize() { dotsFor = 0; },
      move(e, st) {
        if (dragging) {
          const dx = e.movementX || 0, dy = e.movementY || 0;
          moved += Math.abs(dx) + Math.abs(dy);
          yaw -= dx * 0.006; pitch = clamp(pitch + dy * 0.004, -0.2, 1.0); vel = -dx * 0.006 * 40;
          return;
        }
        pick(st.ptr.px, st.ptr.py);
        stage.canvas.style.cursor = hover >= 0 ? "pointer" : "grab";
      },
      leave() { hover = -1; }
    });
    ctrl = stage;

    const cv = stage.canvas;
    cv.style.pointerEvents = "auto";
    cv.style.cursor = "grab";
    cv.style.touchAction = "pan-y";
    cv.addEventListener("pointerdown", e => {
      const r = cv.getBoundingClientRect(); pick(e.clientX - r.left, e.clientY - r.top); // touch taps have no prior hover
      dragging = true; moved = 0; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    const up = e => {
      if (!dragging) return;
      dragging = false; cv.style.cursor = hover >= 0 ? "pointer" : "grab";
      vel = clamp(vel, -1.4, 1.4);
      if (moved < 5 && hover >= 0 && typeof interviewURL === "function") location.href = interviewURL(pins[hover].p);
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);

    let lastY = window.scrollY;
    const onScroll = () => { const y = window.scrollY; if (!dragging) yaw += (y - lastY) * 0.004; lastY = y; stage.invalidate(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    const destroy = stage.destroy;
    stage.destroy = () => { window.removeEventListener("scroll", onScroll); destroy(); };

    ensureMask(() => { buildDots(); stage.invalidate(); });
    return stage;
  }

  /* ------------------------------------------------------------------------------------------
   * 03  PRINT — WebGL halftone field in the logo gradient
   * ---------------------------------------------------------------------------------------- */
  const PRINT_VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const PRINT_FS = `
precision highp float;
uniform vec2 u_res; uniform float u_t; uniform vec2 u_ptr; uniform float u_cell; uniform float u_sq; uniform float u_fade0; uniform float u_fade1; uniform float u_light;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(17.1,3.7); a*=.5; } return v; }
vec3 pal(float x){
  x=clamp(x,0.,1.)*4.;
  vec3 a=vec3(.976,.369,.145), b=vec3(.925,.024,.502), c=vec3(.702,.161,.843), d=vec3(.259,.322,.929), e=vec3(.063,.616,.969);
  if(x<1.) return mix(a,b,x); if(x<2.) return mix(b,c,x-1.); if(x<3.) return mix(c,d,x-2.); return mix(d,e,x-3.);
}
float field(vec2 pos){
  vec2 p = pos / u_res.y * 2.4; float t = u_t*.07;
  vec2 q = vec2(fbm(p+vec2(0.,t)), fbm(p+vec2(5.2,1.3)-t));
  return smoothstep(.26,.66, fbm(p+2.7*q+vec2(t*.8,0.)));
}
void main(){
  vec2 frag = vec2(gl_FragCoord.x, u_res.y-gl_FragCoord.y);
  float ang=.7854, ca=cos(ang), sa=sin(ang); mat2 R=mat2(ca,-sa,sa,ca);
  vec2 g = R*frag/u_cell; vec2 id=floor(g)+.5; vec2 ctr=(id*u_cell)*R; vec2 f=fract(g)-.5;
  float v = field(ctr);
  float dd = distance(ctr,u_ptr)/(u_res.y*.2); v = clamp(v + .42*exp(-dd*dd), 0., 1.);
  float x = ctr.x/u_res.x, y = ctr.y/u_res.y;
  float m = smoothstep(u_fade0,u_fade1,x);
  float cov = pow(v,1.25)*m;
  float r = .68*sqrt(cov);
  float d = mix(length(f), max(abs(f.x),abs(f.y)), u_sq);
  float aa = 1.2/u_cell;
  float a = 1.-smoothstep(r-aa,r+aa,d);
  float sweep = clamp((x-.46)/.54*.5 + y*.5, 0., 1.);
  vec3 col = pal(clamp(sweep*.88 + v*.12, 0., 1.));
  gl_FragColor = vec4(col*a, a) * (u_light>.5 ? .92 : 1.);
}`;

  function print(host, hero) {
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) { canvas.remove(); return moat(host, hero); }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, PRINT_VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, PRINT_FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    const u = { res: U("u_res"), t: U("u_t"), ptr: U("u_ptr"), cell: U("u_cell"), sq: U("u_sq"), f0: U("u_fade0"), f1: U("u_fade1"), light: U("u_light") };
    const square = new URLSearchParams(location.search).get("shape") === "dot" ? 0 : 1;

    const still = reduced();
    let raf = 0, t = 0, last = 0, on = true, dead = false, dpr = 1, W = 0, H = 0, th = readTheme();
    const ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    function resize() {
      const r = host.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    }
    function draw() {
      const narrow = W < 760;
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.t, t);
      gl.uniform2f(u.ptr, ptr.x * dpr, ptr.y * dpr);
      gl.uniform1f(u.cell, (narrow ? 7 : 10) * dpr);
      gl.uniform1f(u.sq, square);
      gl.uniform1f(u.f0, narrow ? 0.0 : 0.46); gl.uniform1f(u.f1, narrow ? 0.05 : 0.78);
      gl.uniform1f(u.light, th.light ? 1 : 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function frame(now) {
      raf = 0; if (dead) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
      ptr.x = lerp(ptr.x, ptr.tx, 1 - Math.exp(-dt * 8)); ptr.y = lerp(ptr.y, ptr.ty, 1 - Math.exp(-dt * 8));
      draw();
      if (on && !document.hidden && !still) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (!raf && !dead && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const move = e => { const r = host.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; if (ptr.x < -999) { ptr.x = x; ptr.y = y; } ptr.tx = x; ptr.ty = y; if (still) { ptr.x = x; ptr.y = y; draw(); } };
    const leave = () => { ptr.tx = ptr.ty = -9999; if (ptr.x > -999) { ptr.x = ptr.y = -9999; } };

    t = still ? 6 : 0;
    const ro = new ResizeObserver(resize); ro.observe(host);
    const io = new IntersectionObserver(es => { on = es[0].isIntersecting; on ? start() : stop(); }); io.observe(host);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    hero.addEventListener("pointermove", move); hero.addEventListener("pointerleave", leave);
    const mo = new MutationObserver(() => { th = readTheme(); draw(); }); mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    resize(); start();

    return { destroy() { dead = true; stop(); ro.disconnect(); io.disconnect(); mo.disconnect(); document.removeEventListener("visibilitychange", onVis); hero.removeEventListener("pointermove", move); hero.removeEventListener("pointerleave", leave); canvas.remove(); } };
  }

  /* ------------------------------------------------------------------------------------------
   * 04  FACES — tilted 3D wall of interviewee portraits, duotoned in the logo gradient
   * ---------------------------------------------------------------------------------------- */
  function faces(host, hero) {
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const people = interviews().filter(p => p.photo);
    if (!people.length) return moat(host, hero);
    const card = (p, i) => `<a class="face" href="${typeof interviewURL === "function" ? interviewURL(p) : "#"}" tabindex="-1">
        <img src="${esc(p.photo)}" alt="" loading="lazy" draggable="false">
        <span class="face-cap"><b>${esc(p.name)}</b><i>${esc((p.location || "").split(",")[0])}</i></span></a>`;
    const COLS = 4, speeds = [64, 88, 72, 96];
    const cols = Array.from({ length: COLS }, (_, c) => {
      const order = people.map((_, k) => people[(k + c * 2) % people.length]);
      const list = order.map((p, k) => card(p, people.indexOf(p))).join("");
      return `<div class="faces-col" style="--dur:${speeds[c]}s;--dir:${c % 2 ? "reverse" : "normal"};--off:${c % 2 ? -34 : 0}px"><div class="faces-track">${list}${list}</div></div>`;
    }).join("");
    host.innerHTML = `<div class="faces-scene"><div class="faces-plane">${cols}</div></div>`;
    const scene = host.querySelector(".faces-scene");
    const move = e => {
      const r = host.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5), y = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
      scene.style.setProperty("--rx", (52 + y * -8).toFixed(2) + "deg");
      scene.style.setProperty("--rz", (-30 + x * 8).toFixed(2) + "deg");
    };
    if (!reduced()) hero.addEventListener("pointermove", move);
    return { destroy() { hero.removeEventListener("pointermove", move); host.innerHTML = ""; } };
  }


  /* ------------------------------------------------------------------------------------------
   * 05  SPOTLIGHT — the latest interview: portrait in a logo-style frame, frames radiating out
   * ---------------------------------------------------------------------------------------- */
  function spotlight(host, hero) {
    const slot = document.getElementById("hero-spot");
    const list = interviews().slice().sort((a, b) => String(b.publishedDate).localeCompare(String(a.publishedDate)));
    const p = list[0];
    if (!slot || !p) return moat(host, hero);
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
    const url = typeof interviewURL === "function" ? interviewURL(p) : "#";
    const initials = String(p.name || "").split(/\s+/).map(x => x[0]).slice(0, 2).join("");
    const photo = p.photo ? `<img src="${esc(p.photo)}" alt="Portrait of ${esc(p.name)}" draggable="false">` : `<span class="spot-initials">${esc(initials)}</span>`;
    const ring = "READ THE INTERVIEW \u2022 READ THE INTERVIEW \u2022 ";
    const month = p.publishedDate ? new Date(p.publishedDate + "T00:00").toLocaleDateString("en", { month: "short", year: "numeric" }).toUpperCase() : "";
    slot.innerHTML = `
      <div class="spot">
        <div class="spot-stage">
          <a class="spot-card" href="${url}" aria-label="Read the interview with ${esc(p.name)}">
            <span class="spot-photo">${photo}</span>
            <span class="spot-tone"></span>
            <span class="spot-glare"></span>
            <span class="spot-chip"><i></i>Latest conversation${month ? " \u00b7 " + month : ""}</span>
            <span class="spot-cap"><b>${esc(p.name)}</b><i>${esc(p.role)} \u00b7 ${esc(p.company)}</i><em>${esc(p.location)}</em></span>
            <span class="spot-frame" aria-hidden="true"></span>
          </a>
          <a class="spot-badge" href="${url}" tabindex="-1" aria-hidden="true">
            <svg viewBox="0 0 120 120"><defs><path id="spot-circ" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs>
              <text><textPath href="#spot-circ" textLength="286">${ring}</textPath></text></svg>
            <span class="spot-arrow">\u2192</span>
          </a>
        </div>
        ${p.pullQuote ? `<a class="spot-quote" href="${url}" tabindex="-1"><span>\u201c${esc(p.pullQuote)}\u201d</span><em>Read the interview \u2192</em></a>` : ""}
      </div>`;
    const stageEl = slot.querySelector(".spot-stage"), spot = slot.querySelector(".spot");

    const moved = e => {
      const r = stageEl.getBoundingClientRect();
      const x = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5), -1, 1);
      const y = clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5), -1, 1);
      const gx = clamp(((e.clientX - r.left) / r.width) * 100, -20, 120), gy = clamp(((e.clientY - r.top) / r.height) * 100, -20, 120);
      spot.style.setProperty("--ry", (x * 9).toFixed(2) + "deg");
      spot.style.setProperty("--rx", (y * -7).toFixed(2) + "deg");
      spot.style.setProperty("--px", x.toFixed(3));
      spot.style.setProperty("--py", y.toFixed(3));
      spot.style.setProperty("--gx", gx.toFixed(1) + "%");
      spot.style.setProperty("--gy", gy.toFixed(1) + "%");
    };
    const rest = () => ["--rx", "--ry", "--px", "--py"].forEach(k => spot.style.removeProperty(k));
    if (!reduced()) { hero.addEventListener("pointermove", moved); hero.addEventListener("pointerleave", rest); }

    const rings = moat(host, hero, {
      focus(st) {
        const r = stageEl.getBoundingClientRect(), hr = host.getBoundingClientRect();
        return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height / 2, hw: r.width / 2, hh: r.height / 2 };
      }
    });
    return {
      step: rings.step, canvas: rings.canvas, st: rings.st,
      destroy() { hero.removeEventListener("pointermove", moved); hero.removeEventListener("pointerleave", rest); rings.destroy(); slot.innerHTML = ""; }
    };
  }

  /* ------------------------------------------------------------------------------------------
   * Mount + lab switcher
   * ---------------------------------------------------------------------------------------- */
  const FX = { spotlight, moat, globe, print, faces };
  let current = null, currentName = "";

  function mount(name) {
    const host = document.getElementById("hero-fx");
    if (!host) return;
    const hero = host.closest(".hero-stage") || host.parentElement;
    if (current) { current.destroy(); current = null; }
    host.innerHTML = "";
    const slot = document.getElementById("hero-spot"); if (slot) slot.innerHTML = "";
    hero.classList.remove(...Object.keys(FX).map(k => "fx-" + k));
    currentName = name;
    if (!FX[name]) { host.hidden = true; return; }
    host.hidden = false;
    hero.classList.add("fx-" + name);
    try { current = FX[name](host, hero); } catch (err) { console.warn("hero-fx:", err); host.hidden = true; }
    document.querySelectorAll(".fx-lab button").forEach(b => b.setAttribute("aria-pressed", b.dataset.fx === name ? "true" : "false"));
  }

  function initHeroFx() {
    const q = new URLSearchParams(location.search);
    const name = q.has("fx") ? q.get("fx") : DEFAULT_FX;
    mount(name);
    if (q.has("lab")) {
      const bar = document.createElement("div");
      bar.className = "fx-lab";
      bar.innerHTML = `<span>Hero FX</span>` + ["spotlight", "moat", "globe", "print", "faces", "off"].map((k, i) => `<button type="button" data-fx="${k}" aria-pressed="${k === name}">${i + 1} ${k}</button>`).join("");
      bar.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        mount(b.dataset.fx);
        const u = new URL(location.href); u.searchParams.set("fx", b.dataset.fx); history.replaceState(null, "", u);
      });
      document.body.appendChild(bar);
    }
  }
  window.initHeroFx = initHeroFx;
  window.HeroFX = { mount, names: Object.keys(FX), get current() { return current; } };
})();
