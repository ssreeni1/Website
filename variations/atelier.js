(() => {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;
  function AtelierConstellation() {
    const canvasRef = useRef(null);
    const stateRef = useRef(null);
    const dragRef = useRef({ idx: -1, moved: false, hover: -1 });
    const rotRef = useRef({ t: 0, last: performance.now() });
    const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
    const seedGraph = useCallback((seed2) => {
      let s = seed2 >>> 0;
      const rand = () => {
        s = s * 1664525 + 1013904223 >>> 0;
        return s / 4294967295;
      };
      const W = 100, H = 62;
      const cx = 50, cy = 31;
      const nNodes = 11 + Math.floor(rand() * 5);
      const nodes = [{ x: cx, y: cy, z: 0, r: 1.8, primary: true }];
      const shells = [
        { r: 14, count: 0 },
        { r: 22, count: 0 },
        { r: 28, count: 0 }
      ];
      for (let i = 1; i < nNodes; i++) {
        shells[i % shells.length].count++;
      }
      for (const shell of shells) {
        const baseAz = rand() * Math.PI * 2;
        for (let i = 0; i < shell.count; i++) {
          const az = baseAz + i / shell.count * Math.PI * 2 + (rand() - 0.5) * 0.7;
          const el = (rand() - 0.5) * 0.95;
          const rr = shell.r + (rand() - 0.5) * 4;
          const cosEl = Math.cos(el);
          const x = cx + Math.cos(az) * rr * cosEl;
          const y = cy + Math.sin(el) * rr * 0.78;
          const z = Math.sin(az) * rr * cosEl;
          nodes.push({
            x,
            y,
            z,
            r: 0.6 + rand() * 0.75,
            phase: rand() * Math.PI * 2,
            speed: 18e-5 + rand() * 35e-5,
            amp: 0.4 + rand() * 0.9,
            orbitA: rand() * Math.PI * 2,
            orbitSpeed: (rand() - 0.5) * 12e-5,
            orbitR: 0.6 + rand() * 1.2,
            // small z-axis wobble independent of orbit
            zPhase: rand() * Math.PI * 2,
            zSpeed: 15e-5 + rand() * 25e-5,
            zAmp: 0.5 + rand() * 1.1
          });
        }
      }
      const edges = [];
      for (let i = 1; i < nodes.length; i++) edges.push([0, i]);
      const rim = 3 + Math.floor(rand() * 4);
      for (let k = 0; k < rim; k++) {
        const a = 1 + Math.floor(rand() * (nodes.length - 1));
        let b = 1 + Math.floor(rand() * (nodes.length - 1));
        if (a === b) b = b % (nodes.length - 1) + 1;
        edges.push([a, b]);
      }
      const spirits = edges.filter(([a, b]) => a === 0 || b === 0).map((e, i) => ({
        edge: e,
        offset: rand(),
        speed: 6e-5 + rand() * 8e-5,
        size: 0.28 + rand() * 0.18
      }));
      return { nodes, edges, spirits, W, H, cx, cy };
    }, []);
    useEffect(() => {
      const id = setInterval(() => setSeed(Math.floor(Math.random() * 1e9)), 28e3);
      return () => clearInterval(id);
    }, []);
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      return {
        ink: cs.getPropertyValue("--ink").trim() || "#e6e6e6",
        ink2: cs.getPropertyValue("--ink-2").trim() || "#aaa",
        ink3: cs.getPropertyValue("--ink-3").trim() || "#666",
        ochre: cs.getPropertyValue("--ochre").trim() || "#caa269",
        rule: cs.getPropertyValue("--rule").trim() || "#333"
      };
    };
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      stateRef.current = seedGraph(seed);
      let raf;
      const FOCAL = 70;
      const draw = () => {
        const s = stateRef.current;
        if (!s) return;
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.clientWidth, H = canvas.clientHeight;
        if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
          canvas.width = W * dpr;
          canvas.height = H * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const c = readColors();
        const tNow = performance.now();
        const sx = W / s.W, sy = H / s.H;
        const sMin = Math.min(sx, sy);
        const dragIdx = dragRef.current.idx;
        const dt = tNow - rotRef.current.last;
        rotRef.current.last = tNow;
        if (dragIdx < 0) rotRef.current.t += dt;
        const rt = rotRef.current.t;
        const yaw = Math.sin(rt * 12e-5) * 0.55;
        const pitch = Math.sin(rt * 8e-5 + 1.2) * 0.22;
        const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
        const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
        s._yaw = yaw;
        s._pitch = pitch;
        s._cosY = cosY;
        s._cosP = cosP;
        const project = (x, y, z) => {
          const dx = x - s.cx, dy = y - s.cy, dz = z;
          const rx = cosY * dx + sinY * dz;
          const rzMid = -sinY * dx + cosY * dz;
          const ry = cosP * dy - sinP * rzMid;
          const rz = sinP * dy + cosP * rzMid;
          const scale = FOCAL / (FOCAL + rz);
          return {
            px: (s.cx + rx * scale) * sx,
            py: (s.cy + ry * scale) * sy,
            rz,
            scale
          };
        };
        const ringPeriod = 7200;
        for (let k = 0; k < 3; k++) {
          const phase = (tNow + k * (ringPeriod / 3)) % ringPeriod / ringPeriod;
          const rr = 2 + phase * 32;
          const alpha = (1 - phase) * 0.16;
          const a = rr * cosY;
          const b = rr * Math.abs(cosP) * 0.78;
          const ax = a * sx, by = b * sy;
          ctx.beginPath();
          ctx.ellipse(s.cx * sx, s.cy * sy, ax, by, 0, 0, Math.PI * 2);
          ctx.strokeStyle = c.ochre;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const live = s.nodes.map((n, i) => {
          if (i === dragIdx && n._drag) {
            return {
              ...n,
              wx: n.x,
              wy: n.y,
              wz: n.z,
              // not used while drag overrides
              px: n._drag.px,
              py: n._drag.py,
              rz: 0,
              scale: 1,
              _pinned: true
            };
          }
          if (n.primary) {
            const pr2 = project(n.x, n.y, n.z);
            return { ...n, wx: n.x, wy: n.y, wz: n.z, ...pr2 };
          }
          const drift = Math.sin(tNow * n.speed + n.phase) * n.amp;
          const drift2 = Math.cos(tNow * n.speed * 0.83 + n.phase) * n.amp * 0.7;
          const oA = n.orbitA + tNow * n.orbitSpeed;
          const ox = Math.cos(oA) * n.orbitR;
          const oy = Math.sin(oA) * n.orbitR * 0.78;
          const dz = Math.sin(tNow * n.zSpeed + n.zPhase) * n.zAmp;
          const wx = n.x + drift + ox;
          const wy = n.y + drift2 + oy;
          const wz = n.z + dz;
          const pr = project(wx, wy, wz);
          return { ...n, wx, wy, wz, ...pr };
        });
        s._live = live;
        s._scale = { sx, sy };
        const edgesWithDepth = s.edges.map(([a, b]) => {
          const A = live[a], B = live[b];
          const midRz = (A.rz + B.rz) * 0.5;
          return { a, b, midRz, A, B };
        }).sort((p, q) => q.midRz - p.midRz);
        ctx.lineCap = "round";
        for (const e of edgesWithDepth) {
          const { a, b, A, B, midRz } = e;
          const toPrimary = a === 0 || b === 0;
          const depthFactor = Math.max(0, Math.min(1, 1 - (midRz + 12) / 40));
          const baseAlpha = toPrimary ? 0.5 : 0.28;
          ctx.strokeStyle = c.ink3;
          ctx.globalAlpha = baseAlpha * (0.35 + 0.65 * depthFactor);
          ctx.lineWidth = (toPrimary ? 0.75 : 0.55) * (0.55 + 0.55 * depthFactor);
          ctx.beginPath();
          ctx.moveTo(A.px, B && A.px === void 0 ? 0 : A.py);
          ctx.moveTo(A.px, A.py);
          ctx.lineTo(B.px, B.py);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const sp of s.spirits) {
          const A = live[sp.edge[0]], B = live[sp.edge[1]];
          const p = (sp.offset + tNow * sp.speed) % 1;
          const wx = A.wx + (B.wx - A.wx) * p;
          const wy = A.wy + (B.wy - A.wy) * p;
          const wz = A.wz + (B.wz - A.wz) * p;
          const pr = project(wx, wy, wz);
          const alpha = Math.sin(p * Math.PI) * 0.8;
          ctx.beginPath();
          ctx.arc(pr.px, pr.py, sp.size * sMin * 1.4 * pr.scale, 0, Math.PI * 2);
          ctx.fillStyle = c.ochre;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const order = live.map((n, i) => ({ i, rz: n.rz })).sort((a, b) => b.rz - a.rz);
        const pulse = Math.sin(tNow / 2200) * 0.5 + 0.5;
        const hoverIdx = dragRef.current.hover;
        for (const { i } of order) {
          const n = live[i];
          const isHover = i === hoverIdx || i === dragIdx;
          const depthFactor = Math.max(0, Math.min(1, 1 - (n.rz + 12) / 40));
          const rPx = n.r * sMin * n.scale;
          if (n.primary) {
            ctx.beginPath();
            ctx.arc(n.px, n.py, (n.r + 0.9 + pulse * 0.5) * sMin * n.scale, 0, Math.PI * 2);
            ctx.strokeStyle = c.ochre;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            const glow = ctx.createRadialGradient(n.px, n.py, 0, n.px, n.py, rPx * 3.2);
            glow.addColorStop(0, c.ochre);
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = glow;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(n.px, n.py, rPx * 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(n.px, n.py, rPx, 0, Math.PI * 2);
            ctx.fillStyle = c.ochre;
            ctx.fill();
          } else {
            if (isHover) {
              ctx.beginPath();
              ctx.arc(n.px, n.py, (n.r + 1) * sMin * n.scale, 0, Math.PI * 2);
              ctx.strokeStyle = c.ochre;
              ctx.globalAlpha = 0.55;
              ctx.lineWidth = 0.7;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
            ctx.beginPath();
            ctx.arc(n.px, n.py, rPx, 0, Math.PI * 2);
            ctx.fillStyle = isHover ? c.ochre : c.ink2;
            ctx.globalAlpha = (isHover ? 0.98 : 0.78) * (0.35 + 0.65 * depthFactor);
            ctx.fill();
            if (!isHover && depthFactor > 0.5 && rPx > 1.3) {
              ctx.beginPath();
              ctx.arc(n.px - rPx * 0.35, n.py - rPx * 0.35, rPx * 0.35, 0, Math.PI * 2);
              ctx.fillStyle = c.ink;
              ctx.globalAlpha = 0.18 * depthFactor;
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
    }, [seed, seedGraph]);
    const pointerToLogical = useCallback((e) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const s = stateRef.current;
      if (!s || !s._scale) return null;
      return { x: px / s._scale.sx, y: py / s._scale.sy, px, py };
    }, []);
    const hitTest = useCallback((px, py) => {
      const s = stateRef.current;
      if (!s || !s._live || !s._scale) return -1;
      const sMin = Math.min(s._scale.sx, s._scale.sy);
      let best = -1, bestD = 18;
      for (let i = 0; i < s._live.length; i++) {
        const n = s._live[i];
        if (n.px === void 0) continue;
        const dx = n.px - px, dy = n.py - py;
        const d = Math.hypot(dx, dy);
        const hit = Math.max((n.r + 1.4) * sMin * (n.scale || 1), 14);
        if (d < hit && d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }, []);
    const _legacyHitTest = useCallback((lx, ly) => {
      const s = stateRef.current;
      if (!s || !s._live) return -1;
      let best = -1, bestD = 4;
      for (let i = 0; i < s._live.length; i++) {
        const n = s._live[i];
        const dx = n.lx - lx, dy = n.ly - ly;
        const d = Math.hypot(dx, dy);
        const hit = Math.max(n.r + 1.6, 2.2);
        if (d < hit && d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }, []);
    const onPointerDown = useCallback((e) => {
      const p = pointerToLogical(e);
      if (!p) return;
      const i = hitTest(p.px, p.py);
      if (i === -1) return;
      dragRef.current.idx = i;
      dragRef.current.moved = false;
      const s = stateRef.current;
      s.nodes[i]._drag = { px: p.px, py: p.py };
      canvasRef.current.setPointerCapture?.(e.pointerId);
    }, [pointerToLogical, hitTest]);
    const onPointerMove = useCallback((e) => {
      const p = pointerToLogical(e);
      if (!p) return;
      const s = stateRef.current;
      const i = dragRef.current.idx;
      if (i >= 0) {
        dragRef.current.moved = true;
        const sx = s._scale?.sx || 1, sy = s._scale?.sy || 1;
        const px = Math.max(2 * sx, Math.min((s.W - 2) * sx, p.px));
        const py = Math.max(2 * sy, Math.min((s.H - 2) * sy, p.py));
        s.nodes[i]._drag = { px, py };
      } else {
        const h = hitTest(p.px, p.py);
        dragRef.current.hover = h;
        canvasRef.current.style.cursor = h >= 0 ? "grab" : "default";
      }
    }, [pointerToLogical, hitTest]);
    const onPointerUp = useCallback((e) => {
      const i = dragRef.current.idx;
      const s = stateRef.current;
      if (i >= 0 && s) {
        const n = s.nodes[i];
        if (n._drag) {
          const sx = s._scale?.sx || 1, sy = s._scale?.sy || 1;
          const rxRel = n._drag.px / sx - s.cx;
          const ryRel = n._drag.py / sy - s.cy;
          const cy = Math.max(0.3, Math.abs(s._cosY || 1)) * Math.sign(s._cosY || 1);
          const cp = Math.max(0.3, Math.abs(s._cosP || 1)) * Math.sign(s._cosP || 1);
          n.x = s.cx + rxRel / cy;
          n.y = s.cy + ryRel / cp;
          n.phase = -performance.now() * n.speed;
          n.orbitA = -performance.now() * n.orbitSpeed;
          n.zPhase = -performance.now() * n.zSpeed;
          delete n._drag;
        }
      }
      dragRef.current.idx = -1;
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
    }, []);
    const onClickCanvas = useCallback(() => {
      if (dragRef.current.moved) {
        dragRef.current.moved = false;
        return;
      }
      setSeed(Math.floor(Math.random() * 1e9));
    }, []);
    return /* @__PURE__ */ React.createElement(
      "canvas",
      {
        ref: canvasRef,
        className: "ate-canvas",
        title: "drag any node \xB7 click empty space to reseed",
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onPointerLeave: (e) => {
          dragRef.current.hover = -1;
          onPointerUp(e);
        },
        onClick: onClickCanvas
      }
    );
  }
  function AtelierFootnote({ n, children, body }) {
    const [open, setOpen] = useState(false);
    return /* @__PURE__ */ React.createElement("span", { className: "ate-fn" }, /* @__PURE__ */ React.createElement("button", { className: "ate-fn-num", onClick: () => setOpen(!open), "aria-expanded": open }, children, /* @__PURE__ */ React.createElement("sup", null, n)), open && /* @__PURE__ */ React.createElement("span", { className: "ate-fn-body" }, " \u2014 ", body));
  }
  const QUOTES = (
    /*QUOTES-BEGIN*/
    [
      { q: "You have a right to your actions, but never to your actions\u2019 fruits.", c: "Bhagavad Gita \xB7 2.47" },
      { q: "The mind is restless, turbulent, obstinate, and strong \u2014 harder to master than the wind.", c: "Bhagavad Gita \xB7 6.34" },
      { q: "For one who has conquered the mind, the mind is the best of friends.", c: "Bhagavad Gita \xB7 6.6" },
      { q: "When meditation is mastered, the mind is unwavering \u2014 like the flame of a lamp in a windless place.", c: "Bhagavad Gita \xB7 6.19" },
      { q: "Set thy heart upon thy work, but never on its reward.", c: "Bhagavad Gita \xB7 2.47, Arnold" },
      { q: "Perform every action with thy heart fixed on the Supreme; abandon attachment to results.", c: "Bhagavad Gita \xB7 3.30" },
      { q: "The soul is neither born, nor does it die.", c: "Bhagavad Gita \xB7 2.20" },
      { q: "Whatever action a great man performs, common men follow.", c: "Bhagavad Gita \xB7 3.21" }
    ]
  );
  function dayOfYearNY(d = /* @__PURE__ */ new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d).split("-").map((n) => parseInt(n, 10));
    return parts[0] * 366 + parts[1] * 31 + parts[2];
  }
  function AtelierQuotes({ items = QUOTES, interval = 7e3 }) {
    if (!items.length) return null;
    const [idx, setIdx] = useState(() => dayOfYearNY() % items.length);
    useEffect(() => {
      const t = setInterval(() => setIdx((i) => (i + 1) % items.length), interval);
      return () => clearInterval(t);
    }, [items.length, interval]);
    const it = items[idx];
    return /* @__PURE__ */ React.createElement("figure", { className: "ate-quote" }, /* @__PURE__ */ React.createElement("blockquote", { key: idx, className: "ate-quote-item is-on" }, /* @__PURE__ */ React.createElement("div", { className: "ate-quote-mark" }, "\u201C"), /* @__PURE__ */ React.createElement("div", null, it.q), it.c && /* @__PURE__ */ React.createElement("figcaption", { className: "ate-quote-cite" }, "\u2014 ", it.c)));
  }
  function nycParts(d = /* @__PURE__ */ new Date()) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const [hh, mm] = fmt.format(d).split(":");
    return { h: parseInt(hh, 10), m: parseInt(mm, 10), s: `${hh}:${mm}` };
  }
  function nycGreeting() {
    const { h } = nycParts();
    if (h < 5) return "Still up?";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Late hours";
  }
  function LiveClock() {
    const [t, setT] = useState(() => nycParts().s);
    useEffect(() => {
      const i = setInterval(() => setT(nycParts().s), 1e3);
      return () => clearInterval(i);
    }, []);
    return /* @__PURE__ */ React.createElement("span", null, t, " EST");
  }
  function useReveal() {
    useEffect(() => {
      const els = document.querySelectorAll(".ate-reveal");
      if (!("IntersectionObserver" in window)) {
        els.forEach((el) => el.classList.add("is-in"));
        return;
      }
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      els.forEach((el) => io.observe(el));
      return () => io.disconnect();
    }, []);
  }
  function Atelier({ theme, setTheme }) {
    const [greeting] = useState(nycGreeting);
    useReveal();
    return /* @__PURE__ */ React.createElement("div", { className: "atelier", "data-theme": theme }, /* @__PURE__ */ React.createElement("header", { className: "ate-top" }, /* @__PURE__ */ React.createElement("span", { className: "ate-mono" }, "N 40\xB044\u2032 \xB7 W 73\xB059\u2032", /* @__PURE__ */ React.createElement("span", { className: "ate-loc-city" }, " \xB7 New York")), /* @__PURE__ */ React.createElement("span", { className: "ate-mono ate-clock" }, /* @__PURE__ */ React.createElement(LiveClock, null)), /* @__PURE__ */ React.createElement("button", { className: "ate-toggle", onClick: () => setTheme(theme === "dark" ? "light" : "dark"), "aria-label": "Toggle theme" }, theme === "dark" ? "\u263E" : "\u263C")), /* @__PURE__ */ React.createElement("main", { className: "ate-main" }, /* @__PURE__ */ React.createElement("div", { className: "ate-constellation ate-reveal" }, /* @__PURE__ */ React.createElement(AtelierConstellation, null)), /* @__PURE__ */ React.createElement("p", { className: "ate-greet ate-mono ate-reveal ate-reveal-1" }, "\u2014 ", greeting, " \u2014"), /* @__PURE__ */ React.createElement("h1", { className: "ate-name ate-reveal ate-reveal-2" }, "Saneel ", /* @__PURE__ */ React.createElement("span", { className: "ate-italic" }, "Sreeni")), /* @__PURE__ */ React.createElement("p", { className: "ate-tag ate-reveal ate-reveal-3" }, "I spend most of my time thinking about how to help legacy businesses apply", " ", /* @__PURE__ */ React.createElement("a", { className: "ate-inline-link", href: "https://www.paretocomputing.com/", target: "_blank", rel: "noopener" }, "frontier computing"), " via being an EIR @ ", /* @__PURE__ */ React.createElement("a", { className: "ate-inline-link", href: "https://www.accomplice.co/", target: "_blank", rel: "noopener" }, "Accomplice"), ". Occasionally, I write things down or publish random projects."), /* @__PURE__ */ React.createElement("div", { className: "ate-reveal ate-reveal-4" }, /* @__PURE__ */ React.createElement(AtelierQuotes, null)), /* @__PURE__ */ React.createElement("nav", { className: "ate-nav ate-reveal ate-reveal-5" }, /* @__PURE__ */ React.createElement("a", { href: "/work/", className: "ate-link" }, /* @__PURE__ */ React.createElement("span", null, "Work"), /* @__PURE__ */ React.createElement("span", { className: "ate-arrow" }, "\u2192")), /* @__PURE__ */ React.createElement("a", { href: "/writing/", className: "ate-link" }, /* @__PURE__ */ React.createElement("span", null, "Writing & Projects"), /* @__PURE__ */ React.createElement("span", { className: "ate-arrow" }, "\u2192")), /* @__PURE__ */ React.createElement("a", { href: "/fun/", className: "ate-link" }, /* @__PURE__ */ React.createElement("span", null, "Fun"), /* @__PURE__ */ React.createElement("span", { className: "ate-arrow" }, "\u2192")))), /* @__PURE__ */ React.createElement("footer", { className: "ate-foot ate-foot-centered" }, /* @__PURE__ */ React.createElement("div", { className: "ate-printer ate-reveal" }, /* @__PURE__ */ React.createElement("div", { className: "ate-printer-rule" }), /* @__PURE__ */ React.createElement("span", { className: "ate-printer-glyph" }, "\u2766"), /* @__PURE__ */ React.createElement("div", { className: "ate-printer-rule" })), /* @__PURE__ */ React.createElement("div", { className: "ate-colophon ate-colophon-centered ate-reveal" }, /* @__PURE__ */ React.createElement("span", { className: "ate-mono" }, "\xA9 Saneel Sreeni \xB7 MMXXVI"), /* @__PURE__ */ React.createElement("span", { className: "ate-mono ate-italic-mono" }, "est. New York"), /* @__PURE__ */ React.createElement("span", { className: "ate-mono" }, "Set in EB Garamond & Inter Tight"))));
  }
  window.Atelier = Atelier;
})();
