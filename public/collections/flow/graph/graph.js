/* Kings Don't Buy Flow, graph edition.
   One fixed stage: a persistent force layout (d3), edges and money particles on canvas, nodes and labels in SVG.
   Steps from scenes.js add, remove and restyle the same marks. Requires d3 v7, ../data/bundle.js, model2.js, scenes.js. */
(function () {
  "use strict";

  var D = window.KDBF_DATA, S = window.KDBF_SCENES, M2 = window.KDBF_MODEL2;
  if (!D || !S || !M2 || !window.d3) { console.error("graph: missing data or libraries"); return; }

  var SVGNS = "http://www.w3.org/2000/svg";
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var reduce = mqReduce.matches;
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  /* ------------------------------------------------------------------ config */
  var LAYOUT_SX = 0.44, LAYOUT_SY = 0.56;           // scales scenes.js home coordinates into world units
  var MOBILE_BP = 760;

  // colour per relationship type; money = direction money moves relative to the arrow (fwd / rev / null)
  var ET = {
    owns:               { label: "owns",               color: "#d6cfbf", money: null },
    manages_assets_for: { label: "invests for",        color: "#6f9fd8", money: "rev" },
    originates_for:     { label: "makes loans for",    color: "#e39a4f", money: "rev" },
    buys_flow_from:     { label: "buys loans from",    color: "#e07aa9", money: "fwd" },
    reinsures_to:       { label: "passes policies to", color: "#a48af0", money: "fwd" },
    regulated_by:       { label: "regulated by",       color: "#6a707a", money: null },
    losses_flow_to:     { label: "passes losses to",   color: "#c8584b", money: null },
    pays_premium:       { label: "pays premiums to",   color: "#2f9d70", money: "fwd", generic: true },
    lends_to:           { label: "lends to",           color: "#2f9d70", money: "fwd", generic: true },
    shock:              { label: "loss spreads to",    color: "#ff4a33", money: null, generic: true }
  };
  var LEGEND_ORDER = ["owns", "manages_assets_for", "originates_for", "buys_flow_from", "reinsures_to", "regulated_by", "losses_flow_to", "pays_premium", "shock"];
  var ROLE_WORD = { manager: "Asset manager", insurer: "Insurer", reinsurer: "Reinsurer", platform: "Lender owned by a manager",
    flow_partner: "Bank that sells loans", jurisdiction: "Regulator", backstop: "Safety net", source: "Not a firm",
    sink: "Not a firm", event: "What-if event, not a firm" };
  var CLUSTER_WORD = { integrated: "owns its lenders", open_architecture: "runs money for insurers", mid: "mid-sized group",
    small_distressed: "small or troubled group", public: "public sector" };
  var RED = [255, 74, 51], GREEN = [61, 220, 151], GRAY = [92, 97, 106];
  var TIER_COL = ["#2c3037", "#4d3c38", "#7a3d34", "#c3301d", "#ff3b24"];
  var PROV = { author: "Red Deer's figure", reported: "Reported", model: "This page's model or arithmetic" };

  /* ------------------------------------------------------------------ helpers */
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lcg(seed) { var x = seed >>> 0; return function () { x = (1664525 * x + 1013904223) >>> 0; return x / 4294967296; }; }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a.toFixed(3) + ")"; }
  function sEl(tag, attrs) { var e = document.createElementNS(SVGNS, tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function short(n) { return n.short || n.label; }
  function isMobile() { return window.innerWidth <= MOBILE_BP; }
  Object.keys(ET).forEach(function (k) { ET[k].rgb = hexRgb(ET[k].color); });

  /* ------------------------------------------------------------------ data */
  var srcById = {};
  (D.sources || []).forEach(function (s) { srcById[s.id] = s; });

  var nodes = (D.nodes || []).concat(S.extraNodes || []).map(function (n, i) {
    return Object.assign({}, n, { idx: i, generic: !!n.generic });
  });
  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });
  var dataNodeIds = {};
  (D.nodes || []).forEach(function (n) { dataNodeIds[n.id] = true; });

  var edges = (D.edges || []).concat(S.extraEdges || []).filter(function (e) { return byId[e.source] && byId[e.target]; }).map(function (e, i) {
    return Object.assign({}, e, { idx: i, s: byId[e.source], t: byId[e.target], alpha: 0, ta: 0, grow: 0, red: 0, tred: 0, gray: 0, tgray: 0, wmul: 1, twmul: 1, parts: [] });
  });
  var edgeById = {};
  edges.forEach(function (e) { edgeById[e.id] = e; });
  var adj = {};
  nodes.forEach(function (n) { adj[n.id] = []; });
  edges.forEach(function (e) { adj[e.source].push(e); adj[e.target].push(e); });

  // node size: number of links on this map (sourced edges only); generic nodes get a fixed size
  var degree = {};
  (D.edges || []).forEach(function (e) { degree[e.source] = (degree[e.source] || 0) + 1; degree[e.target] = (degree[e.target] || 0) + 1; });
  nodes.forEach(function (n) {
    n.deg = degree[n.id] || 0;
    n.r = n.generic ? (n.role === "event" ? 10 : 9) : 6.5 + 3.5 * Math.sqrt(Math.max(1, n.deg));
    n.mapLabel = short(n).replace(/\s*\(archetype\)$/, "");
    n.sub = n.archetype ? "archetype" : n.role === "event" ? "what-if" : "";
    n.mono = (S.monograms && S.monograms[n.id] != null) ? S.monograms[n.id] : short(n).slice(0, 2).toUpperCase();
  });
  // a manager that owns a platform with a documented originates_for link: "owns its origination"
  nodes.forEach(function (n) {
    n.badge = n.role === "manager" && adj[n.id].some(function (e) {
      return e.type === "owns" && e.source === n.id && e.t.role === "platform" && adj[e.target].some(function (f) { return f.type === "originates_for" && f.source === e.target && f.status === "documented"; });
    });
  });

  // edge bends: parallel edges between the same pair fan out
  (function () {
    var groups = {};
    edges.forEach(function (e) { var k = [e.source, e.target].sort().join("|"); (groups[k] = groups[k] || []).push(e); });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], n = g.length;
      g.forEach(function (e, i) {
        e.canonFlip = e.source > e.target;   // so the normal is computed from a canonical direction
        e.bend = n === 1 ? 0.13 : (i - (n - 1) / 2) * 0.3 + 0.06;
      });
    });
  })();

  /* ------------------------------------------------------------------ steps */
  var STEPS = S.steps;
  var visSets = [], stepOf = {};
  (function () {
    var cur = {};
    STEPS.forEach(function (st, i) {
      (st.add || []).forEach(function (id) { if (byId[id]) { cur[id] = true; if (stepOf[id] == null) stepOf[id] = i; } });
      (st.remove || []).forEach(function (id) { delete cur[id]; });
      visSets.push(Object.assign({}, cur));
    });
  })();
  function edgeInStep(e, i) {
    var v = visSets[i], st = STEPS[i];
    if (!v[e.source] || !v[e.target]) return false;
    if (st.edgeTypes === "all") return true;
    return (st.edgeTypes || []).indexOf(e.type) >= 0;
  }
  var edgeStepOf = {};
  edges.forEach(function (e) { for (var i = 0; i < STEPS.length; i++) if (edgeInStep(e, i)) { edgeStepOf[e.id] = i; break; } });

  /* ------------------------------------------------------------------ layout (deterministic, computed once) */
  function computeHomes() {
    var L = S.layout || {};
    nodes.forEach(function (n, i) {
      var a = L[n.id] || [0, 0];
      n.ax = a[0] * LAYOUT_SX; n.ay = a[1] * LAYOUT_SY;
      n.x = n.ax; n.y = n.ay; n.vx = n.vy = 0;
    });
    var links = edges.filter(function (e) { return e.type !== "regulated_by" && e.type !== "shock"; })
      .map(function (e) { return { source: e.s, target: e.t }; });
    var sim = d3.forceSimulation(nodes)
      .randomSource(lcg(20261119))
      .force("x", d3.forceX(function (n) { return n.ax; }).strength(0.55))
      .force("y", d3.forceY(function (n) { return n.ay; }).strength(0.55))
      .force("link", d3.forceLink(links).distance(70).strength(0.06))
      .force("charge", d3.forceManyBody().strength(-160).distanceMax(220))
      .force("collide", d3.forceCollide(function (n) { return n.r + 22; }).strength(1).iterations(2))
      .stop();
    for (var k = 0; k < 360; k++) sim.tick();
    // bx/by: computed home; ux/uy: home after any drag; hx/hy: where the node is pulled in the current step
    nodes.forEach(function (n) { n.bx = n.ux = n.hx = n.x; n.by = n.uy = n.hy = n.y; });
  }
  computeHomes();
  // a step may pose some nodes elsewhere (step 1 lays its chain out as one line); everything else uses its home
  // (on a phone the pose is stretched vertically: the screen is tall, and the verbs need room)
  function applyPose(st) {
    var P = st.pose || {}, ys = isMobile() ? 1.9 : 1, y0 = null;
    Object.keys(P).forEach(function (id) { y0 = y0 == null ? P[id][1] : Math.max(y0, P[id][1]); });
    nodes.forEach(function (n) {
      var p = P[n.id];
      if (p) { n.hx = p[0]; n.hy = y0 + (p[1] - y0) * ys; } else { n.hx = n.ux; n.hy = n.uy; }
    });
  }

  /* ------------------------------------------------------------------ DOM */
  var stage = $("stage"), canvas = $("gl-canvas"), svg = $("gl-svg");
  var gNodes = svg.querySelector(".g-nodes"), gLabels = svg.querySelector(".g-labels");
  var ctx = canvas.getContext("2d");
  var panel = $("panel"), panelInner = $("panel-inner"), dotsEl = $("dots"), card = $("card"), hint = $("hint");
  var shockEl = $("shock"), shockSliders = $("shock-sliders"), qjEl = $("qj");
  var toolsEl = $("tools"), appEl = $("app");
  // on phones the shock controls live inside the bottom sheet so the map keeps its height
  // (below the step text: nav, headline, number, body, then sliders)
  function placeShock() {
    if (isMobile()) { if (shockEl.parentNode !== panel) panel.appendChild(shockEl); }
    else if (shockEl.parentNode !== appEl) appEl.insertBefore(shockEl, dotsEl);
  }
  var measureCtx = document.createElement("canvas").getContext("2d");

  function shapePath(n, r) {
    var i, a, pts = [];
    switch (n.role) {
      case "reinsurer": r *= 1.22; return "M0," + (-r) + "L" + r + ",0L0," + r + "L" + (-r) + ",0Z";
      case "platform": r *= 0.9; return "M" + (-r) + "," + (-r) + "h" + 2 * r + "v" + 2 * r + "h" + (-2 * r) + "Z";
      case "flow_partner": r *= 1.25; return "M0," + (-r) + "L" + (r * 0.95) + "," + (r * 0.72) + "L" + (-r * 0.95) + "," + (r * 0.72) + "Z";
      case "jurisdiction":
        for (i = 0; i < 6; i++) { a = Math.PI / 3 * i + Math.PI / 6; pts.push((r * Math.cos(a)).toFixed(2) + "," + (r * Math.sin(a)).toFixed(2)); }
        return "M" + pts.join("L") + "Z";
      case "backstop":
        var w = r * 1.3, hh = r * 0.82, c = r * 0.3;
        return "M" + (-w + c) + "," + (-hh) + "H" + (w - c) + "L" + w + "," + (-hh + c) + "V" + (hh - c) + "L" + (w - c) + "," + hh +
          "H" + (-w + c) + "L" + (-w) + "," + (hh - c) + "V" + (-hh + c) + "Z";
      case "event":
        for (i = 0; i < 16; i++) { a = Math.PI / 8 * i - Math.PI / 2; var rr = i % 2 ? r * 0.55 : r * 1.15; pts.push((rr * Math.cos(a)).toFixed(2) + "," + (rr * Math.sin(a)).toFixed(2)); }
        return "M" + pts.join("L") + "Z";
      default:
        return "M" + r + ",0A" + r + "," + r + " 0 1,1 " + (-r) + ",0A" + r + "," + r + " 0 1,1 " + r + ",0Z";
    }
  }

  nodes.forEach(function (n) {
    var g = sEl("g", { class: "nd nd--" + n.role + (n.archetype ? " nd--arch" : "") + (n.generic ? " nd--generic" : ""), tabindex: "-1", role: "button",
      "aria-label": n.label + (n.archetype ? " (archetype, not a real firm)" : n.generic ? " (generic, not a firm)" : "") });
    var body = sEl("g", { class: "nd__body" });
    var hit = sEl("circle", { class: "nd__hit", r: n.r + 8 });
    var ring = n.role === "manager" && !n.archetype ? sEl("path", { class: "nd__ring" }) : null;
    var halo = sEl("path", { class: "nd__halo" });
    var shape = sEl("path", { class: "nd__shape" });
    var mono = sEl("text", { class: "nd__mono", "text-anchor": "middle", dy: "0.35em" });
    mono.textContent = n.mono || "";
    var badge = n.badge ? sEl("circle", { class: "nd__badge" }) : null;
    body.appendChild(hit); body.appendChild(halo); if (ring) body.appendChild(ring); body.appendChild(shape); body.appendChild(mono); if (badge) body.appendChild(badge);
    g.appendChild(body);
    gNodes.appendChild(g);
    var lab = sEl("text", { class: "lbl" });
    var l1 = sEl("tspan", {}); l1.textContent = n.mapLabel; lab.appendChild(l1);
    if (n.sub) { var l2 = sEl("tspan", { class: "lbl__sub", dy: "1.15em" }); l2.textContent = n.sub; lab.appendChild(l2); n.subEl = l2; }
    n.l1 = l1;
    var tl = sEl("text", { class: "tierlbl" });
    gLabels.appendChild(lab); gLabels.appendChild(tl);
    n.el = g; n.bodyEl = body; n.shapeEl = shape; n.ringEl = ring; n.haloEl = halo; n.monoEl = mono; n.badgeEl = badge; n.hitEl = hit; n.labEl = lab; n.tierEl = tl;
    n.on = false; n.op = 0; n.lastSr = -1;
    g.style.display = "none"; lab.style.display = "none"; tl.style.display = "none";

    g.addEventListener("click", function (ev) { ev.stopPropagation(); if (n.dragMoved) { n.dragMoved = false; return; } select(n.id); });
    g.addEventListener("mouseenter", function () { if (!coarse) { state.hover = n.id; applyStyle(); } });
    g.addEventListener("mouseleave", function () { if (state.hover === n.id) { state.hover = null; applyStyle(); } });
    g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); select(n.id); } });
  });

  /* ------------------------------------------------------------------ state */
  var state = {
    step: -1, T: d3.zoomIdentity, hover: null, hoverEdge: null, a: null, b: null, path: null,
    sev: Object.assign({}, S.defaultSeverity || {}), qj: !!S.defaultQJ, results: null,
    dirty: true, camAnim: false, boost: 1, tboost: 1
  };

  /* ------------------------------------------------------------------ simulation (persistent) */
  var sim = d3.forceSimulation([])
    .randomSource(lcg(7))
    .alphaDecay(0.035).velocityDecay(0.42)
    .force("x", d3.forceX(function (n) { return n.hx; }).strength(0.16))
    .force("y", d3.forceY(function (n) { return n.hy; }).strength(0.16))
    .force("collide", d3.forceCollide(function (n) { return n.r + 9; }).strength(0.6))
    .stop();

  /* ------------------------------------------------------------------ camera */
  var svgSel = d3.select(svg);
  var zoom = d3.zoom()
    .scaleExtent([0.2, 5])
    .filter(function (ev) {
      if (ev.type === "wheel") return ev.ctrlKey || ev.metaKey;
      if (ev.type === "touchstart" || ev.type === "touchmove") return ev.touches && ev.touches.length >= 2;
      if (ev.type === "dblclick") return false;
      return !ev.button && !(ev.target && ev.target.closest && ev.target.closest(".nd"));
    })
    .on("zoom", function (ev) { state.T = ev.transform; state.dirty = true; if (ev.sourceEvent) state.userCam = true; kick(); });
  svgSel.call(zoom).on("dblclick.zoom", null);

  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }
  function graphRect() {
    var w = vw(), h = vh();
    if (isMobile()) {
      var top = toolsEl.getBoundingClientRect().bottom + 8;
      var bottom = panel.getBoundingClientRect().top - 6;
      if (!shockEl.hidden) bottom = Math.min(bottom, shockEl.getBoundingClientRect().top - 6);
      return { x0: 10, x1: w - 10, y0: top, y1: Math.max(top + 120, bottom) };
    }
    var pr = panel.getBoundingClientRect();
    return { x0: pr.right + 8, x1: w - 118, y0: 96, y1: h - 44 };
  }
  // nodes grow a little with zoom, and more when only a handful are on the map (eased in frame())
  function nodeScale(k) { return clamp(Math.pow(k == null ? state.T.k : k, 0.55), 0.62, 1.45) * state.boost; }
  function fitTransform(ids, pad) {
    var R = graphRect();
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach(function (id) {
      var n = byId[id]; if (!n) return;
      var x = n.hx, y = n.hy;   // homes: where nodes settle, so the frame is right before entering nodes arrive
      x0 = Math.min(x0, x - n.r); x1 = Math.max(x1, x + n.r); y0 = Math.min(y0, y - n.r); y1 = Math.max(y1, y + n.r + 14);
    });
    if (!isFinite(x0)) return d3.zoomIdentity;
    pad = pad == null ? (isMobile() ? 26 : 56) : pad;
    var bw = Math.max(60, x1 - x0), bh = Math.max(60, y1 - y0);
    var maxK = isMobile() ? 1.3 : 1.8;
    var k = clamp(Math.min((R.x1 - R.x0 - 2 * pad) / bw, (R.y1 - R.y0 - 2 * pad) / bh), 0.22, maxK);
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return d3.zoomIdentity.translate((R.x0 + R.x1) / 2 - cx * k, (R.y0 + R.y1) / 2 - cy * k).scale(k);
  }
  function setCamera(t, animate, dur) {
    state.userCam = false;
    if (!animate || reduce) { svgSel.interrupt(); svgSel.call(zoom.transform, t); return; }
    svgSel.interrupt().transition().duration(dur || 950).ease(d3.easeCubicInOut).call(zoom.transform, t);
  }
  function visibleIds() { return Object.keys(visSets[state.step] || {}); }
  function fit(animate) {
    var st = STEPS[state.step];
    var ids = st.focusThread && st.thread ? st.thread.nodes : visibleIds();
    setCamera(fitTransform(ids), animate);
  }

  /* ------------------------------------------------------------------ model */
  function runModel() {
    state.results = M2.run(state.sev, state.qj);
    state.flowByEdge = {};
    state.results.flows.forEach(function (f) { state.flowByEdge[f.edge_id] = f; });
  }

  /* ------------------------------------------------------------------ styling */
  function curMode() { return (STEPS[state.step] || {}).mode || "neutral"; }
  function tierOf(id) {
    var r = state.results && state.results.byId[id];
    if (r) return r.scored ? r.tier : 0;
    return byId[id] && byId[id].role === "event" ? 4 : 0;
  }
  function focusSets() {
    // returns { nodes, edges, dim } or null
    var st = STEPS[state.step];
    var vis = visSets[state.step];
    if (state.a) {
      var N = {}, E = {};
      N[state.a] = true;
      if (state.b) {
        N[state.b] = true;
        if (state.path && state.path.direct) state.path.edges.forEach(function (e) { E[e.id] = true; });
        else if (state.path && state.path.hops) state.path.hops.forEach(function (h) { E[h.edge.id] = true; N[h.from] = N[h.to] = true; });
      } else {
        adj[state.a].forEach(function (e) { if (e.on) { E[e.id] = true; N[e.source] = N[e.target] = true; } });
      }
      return { nodes: N, edges: E, dim: 0.16 };
    }
    if (state.hoverEdge && edgeById[state.hoverEdge] && edgeById[state.hoverEdge].on) {
      var he = edgeById[state.hoverEdge], xN = {}, xE = {};
      xN[he.source] = xN[he.target] = true; xE[he.id] = true;
      return { nodes: xN, edges: xE, dim: 0.3 };
    }
    if (state.hover && vis[state.hover]) {
      var hN = {}, hE = {};
      hN[state.hover] = true;
      adj[state.hover].forEach(function (e) { if (e.on) { hE[e.id] = true; hN[e.source] = hN[e.target] = true; } });
      return { nodes: hN, edges: hE, dim: 0.22 };
    }
    if (st.thread) {
      var tN = {}, tE = {};
      st.thread.nodes.forEach(function (id) { tN[id] = true; });
      st.thread.edges.forEach(function (id) { tE[id] = true; });
      return { nodes: tN, edges: tE, dim: 0.1, thread: true };
    }
    if (st.emphNew) {
      var prev = visSets[state.step - 1] || {};
      var nN = {}, nE = {};
      Object.keys(vis).forEach(function (id) { if (!prev[id]) nN[id] = true; });
      edges.forEach(function (e) { if (e.on && (nN[e.source] || nN[e.target])) nE[e.id] = true; });
      return { nodes: nN, edges: nE, dim: st.emphDim || 0.45 };
    }
    if (st.emph) {
      var eN = {}, eE = {};
      st.emph.nodes.forEach(function (id) { eN[id] = true; });
      edges.forEach(function (e) {
        if (!e.on) return;
        if (st.emph.edgeTypes ? st.emph.edgeTypes.indexOf(e.type) >= 0 && (eN[e.source] || eN[e.target]) : (eN[e.source] && eN[e.target])) eE[e.id] = true;
      });
      return { nodes: eN, edges: eE, dim: st.emph.dim || 0.3 };
    }
    return null;
  }

  function applyStyle() {
    var st = STEPS[state.step];
    var mode = curMode();
    var F = focusSets();
    var R = state.results;
    state.focus = F;
    nodes.forEach(function (n) {
      if (!n.on) return;
      var target = F && !F.nodes[n.id] ? F.dim : 1;
      n.op = target;
      n.el.style.opacity = target;
      var cls = "nd nd--" + n.role + (n.archetype ? " nd--arch" : "") + (n.generic ? " nd--generic" : "");
      var tier = 0;
      if (mode === "stress" && R && R.byId[n.id] && R.byId[n.id].scored) { tier = R.byId[n.id].tier; cls += " t" + tier; }
      if (mode === "stress" && R && R.byId[n.id] && R.byId[n.id].channel) cls += " is-channel";
      if (mode === "stress" && n.role === "event") cls += " is-hot";
      if (mode === "status" && n.status_note && st.emph && st.emph.nodes.indexOf(n.id) >= 0) cls += " is-status";
      var pointed = state.a || state.hover || state.hoverEdge;
      if (F && F.nodes[n.id] && pointed) cls += " is-hl";
      if (n.id === state.a || n.id === state.b) cls += " is-sel";
      n.el.setAttribute("class", cls);
      n.tier = tier;
      var strong = F && F.nodes[n.id] && pointed;
      n.bigLabel = !!strong;
      n.labEl.setAttribute("class", "lbl" + (F && F.nodes[n.id] ? (strong ? " lbl--hl" : " lbl--em") : "") + (n.id === state.a || n.id === state.b ? " lbl--sel" : "") + (n.archetype || n.generic ? " lbl--arch" : ""));
      n.labEl.style.opacity = target < 1 ? Math.max(0.12, target * 0.9) : 1;
      n.tierEl.style.opacity = target < 1 ? Math.max(0.1, target) : 1;
      var showTier = mode === "stress" && tier >= 3;
      n.tierEl.textContent = showTier ? M2.tierLabel(tier) : "";
      n.tierEl.setAttribute("class", "tierlbl tierlbl--t" + tier);
    });
    // edges
    edges.forEach(function (e) {
      if (!e.on) { e.ta = 0; e.parts = []; return; }
      var t = ET[e.type] || ET.owns;
      var base = e.type === "regulated_by" ? 0.4 : t.generic ? 0.7 : 0.62;
      if (e.phase === "ended" || e.phase === "pending") base *= 0.6;
      var inF = F ? !!F.edges[e.id] : true;
      e.ta = F ? (inF ? (F.thread ? 1 : 0.95) : Math.min(base, F.dim * 0.7)) : base;
      e.twmul = F && inF && (state.a || state.hoverEdge || F.thread) ? 1.9 : (F && inF ? 1.35 : 1);
      // stress colouring: only stress moving between two firms at moderate or worse turns red; the rest goes quiet
      var flow = mode === "stress" && state.flowByEdge ? state.flowByEdge[e.id] : null;
      var hot = !!(flow && tierOf(e.source) >= 2 && tierOf(e.target) >= 2);
      var red = 0;
      if (mode === "stress") {
        if (hot) red = clamp(0.6 + flow.amount * 2, 0.6, 1);
        if (e.type === "shock") red = 1;
        if (F && F.thread && F.edges[e.id]) red = 1;
      } else if (e.type === "shock") red = 1;
      e.tred = red;
      e.tgray = mode === "stress" && !red ? 1 : 0;
      if (mode === "stress" && !red && !(F && F.edges[e.id] && !F.thread && (state.a || state.hover || state.hoverEdge))) e.ta *= 0.6;
      // verbs written on the edge: the step's own (step 1), or the plain relationship word on hover / selection
      e.verb = st.edgeVerbs && st.edgeVerbs[e.id] ? st.edgeVerbs[e.id]
        : (F && !F.thread && F.edges[e.id] && (state.a || state.hover || state.hoverEdge)) ? t.label : null;
      // particles
      var parts = [];
      if (!reduce) {
        if (mode === "stress") {
          if (F && F.thread) {
            if (F.edges[e.id]) {
              var fwd = !(e.id === "arch-writer-reinsures-to-arch-biii");
              parts.push({ kind: "red", fwd: fwd, n: 3, dur: 2100 });
            }
          } else if (hot) {
            var amt = flow.amount;
            parts.push({ kind: "red", fwd: flow.from === e.source, n: clamp(Math.round(1 + amt * 7), 1, 4), dur: clamp(2600 - amt * 2400, 1300, 2600) });
          }
        } else if (t.money) {
          var emph = !F || F.edges[e.id];
          if (emph && e.phase !== "ended" && e.phase !== "pending") parts.push({ kind: "green", fwd: t.money === "fwd", n: st.big ? 3 : F && F.edges[e.id] && !state.a ? 2 : 1, dur: st.big ? 3400 : 3000, big: !!st.big });
        }
      }
      e.parts = parts;
    });
    state.dirty = true;
    updateLegendHighlight();
    kick();
  }

  /* ------------------------------------------------------------------ step changes */
  function go(i, opts) {
    opts = opts || {};
    i = clamp(i, 0, STEPS.length - 1);
    if (i === state.step && !opts.force) return;
    var prevStep = state.step;
    var prevVis = visSets[prevStep] || {};
    state.step = i;
    var st = STEPS[i];
    var vis = visSets[i];
    var instant = opts.instant || reduce;

    // keep the selection only if it is still on the map
    if ((state.a && !vis[state.a]) || (state.b && !vis[state.b])) { state.a = state.b = null; state.path = null; }
    if (state.b) state.path = findPath(state.a, state.b);
    state.hover = null; state.hoverEdge = null;
    hidePop(); hideKey();
    var posed = !!(st.pose || (STEPS[prevStep] || {}).pose);
    applyPose(st);

    // nodes in / out
    var entering = [];
    nodes.forEach(function (n) {
      var on = !!vis[n.id];
      if (on && !n.on) {
        entering.push(n);
        n.on = true;
        n.el.style.display = ""; n.labEl.style.display = ""; n.tierEl.style.display = "";
        clearTimeout(n.hideTimer);
        n.el.classList.remove("is-out");
      } else if (!on && n.on) {
        n.on = false;
        n.el.style.opacity = 0; n.labEl.style.opacity = 0; n.tierEl.style.opacity = 0;
        n.bodyEl.classList.add("is-out");
        (function (nn) { nn.hideTimer = setTimeout(function () { if (!nn.on) { nn.el.style.display = "none"; nn.labEl.style.display = "none"; nn.tierEl.style.display = "none"; } }, instant ? 0 : 520); })(n);
      }
    });
    // edges in / out
    edges.forEach(function (e) {
      var on = edgeInStep(e, i);
      if (on && !e.on) { e.on = true; e.grow = instant ? 1 : 0; if (instant) e.alpha = 0; }
      else if (!on && e.on) { e.on = false; }
    });
    // entering nodes start at an already-placed neighbour and fly out to their homes
    entering.forEach(function (n, k) {
      var from = null;
      adj[n.id].forEach(function (e) {
        if (from || !e.on) return;
        var o = e.source === n.id ? e.t : e.s;
        if (o.on && prevVis[o.id]) from = o;
      });
      if (from && !instant && prevStep >= 0) {
        var ang = (k * 2.39996) % (Math.PI * 2);
        n.x = from.x + Math.cos(ang) * 6; n.y = from.y + Math.sin(ang) * 6;
      } else { n.x = n.hx; n.y = n.hy; }
      n.vx = n.vy = 0;
      n.op = 0; n.el.style.opacity = 0;
      n.bodyEl.classList.add("is-out");
      if (instant) { n.bodyEl.classList.remove("is-out"); }
    });
    if (!instant) {
      // next frame: let CSS grow + fade them in
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        entering.forEach(function (n, k) { setTimeout(function () { if (n.on) n.bodyEl.classList.remove("is-out"); }, Math.min(500, k * 14)); });
      }); });
    }
    sim.nodes(nodes.filter(function (n) { return n.on; }));
    state.tboost = st.big ? (isMobile() ? 1.15 : 1.9) : sim.nodes().length < 10 ? 1.4 : 1;
    if (instant) state.boost = state.tboost;
    if (instant) { sim.alpha(1); for (var t = 0; t < 240; t++) sim.tick(); sim.alpha(0); }
    else sim.alpha(entering.length || posed ? 0.6 : 0.12);

    if (st.mode === "stress" && !state.results) runModel();
    shockEl.hidden = !st.shockPanel;
    document.body.classList.toggle("has-shock", !!st.shockPanel);
    document.body.classList.toggle("is-first", i === 0);
    renderPanel(prevStep < 0 || instant);
    renderDots();
    applyStyle();
    if (state.a) renderCard(); else hideCard();
    // camera: fit after layout of the panel is known
    var doFit = function () { fit(!instant && prevStep >= 0); };
    if (opts.noFit) {} else if (instant) doFit(); else requestAnimationFrame(doFit);
    if (!opts.fromHash) {
      try { history.replaceState(null, "", "#" + st.id); } catch (err) { /* file:// in some browsers */ }
    }
    state.lastStepAt = performance.now();
    kick();
  }
  function next() { go(state.step + 1); }
  function prev() { go(state.step - 1); }

  /* ------------------------------------------------------------------ panel text */
  // links used in node / relationship cards
  function srcLink(id) {
    var s = srcById[id];
    if (!s) return "<span class='src src--missing'>source pending</span>";
    var lbl = /^rd-pt(\d)$/.test(id) ? "Red Deer Pt. " + id.slice(-1) : String(s.publisher || "source").replace(/\s*\(.*$/, "").replace(/ via .*$/, "").replace(/\s*\/.*$/, "");
    var title = [s.publisher, s.date].filter(Boolean).join(" · ");
    return "<a class='src' href='" + esc(s.url) + "' target='_blank' rel='noopener' title='" + esc(title) + "'>" + esc(lbl) + "</a>" +
      (s.verified === false ? "<span class='unv' title='Seen only in search results; not independently confirmed'>unverified</span>" : "");
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  function fmtDate(s) {
    var p = String(s).split("-");
    if (p.length === 1) return p[0];
    if (p.length === 2) return MON[+p[1] - 1] + " " + p[0];
    return MON[+p[1] - 1] + " " + (+p[2]) + ", " + p[0];
  }
  function srcShort(id) {
    if (S.sourceShort && S.sourceShort[id]) return S.sourceShort[id];
    var s = srcById[id] || {};
    var pub = String(s.publisher || id).replace(/\s*\(.*$/, "").replace(/\s*\/.*$/, "");
    var p = String(s.date || "").split("-");
    return pub + (p.length >= 2 ? ", " + MON[+p[1] - 1] + " " + p[0] : "");
  }
  function srcKind(id) { return /^rd-/.test(id) ? "author" : "reported"; }

  // per-render context: citation numbers in reading order, glossary terms already underlined
  var RC = null;
  function newRC() { return { order: [], num: {}, terms: {}, missing: [] }; }
  function cite(id, kind) {
    var s = srcById[id];
    if (!s || !s.url) { RC.missing.push(id); return ""; }
    if (!RC.num[id]) { RC.order.push(id); RC.num[id] = RC.order.length; }
    kind = kind === "model" ? "model" : srcKind(id);
    return "<sup class='cite cite--" + kind + "'><a href='" + esc(s.url) + "' target='_blank' rel='noopener' data-src='" + esc(id) + "' data-kind='" + kind +
      "' aria-label='Source " + RC.num[id] + ": " + esc(srcShort(id)) + "'>" + RC.num[id] + "</a></sup>";
  }
  function term(key, shown) {
    shown = shown || key;
    if (!S.glossary || !S.glossary[key]) return shown;
    if (RC.terms[key]) return shown;            // underline only the first use in a step
    RC.terms[key] = true;
    return "<button type='button' class='term' data-term='" + esc(key) + "'>" + shown + "</button>";
  }
  function sourceLine() {
    if (!RC.order.length) return "";
    return "<p class='srcs'>" + RC.order.map(function (id) {
      var s = srcById[id];
      return "<span class='srcs__i'><b class='c-" + srcKind(id) + "'>" + RC.num[id] + "</b> <a href='" + esc(s.url) + "' target='_blank' rel='noopener' data-src='" + esc(id) + "'>" + esc(srcShort(id)) + "</a>" +
        (s.verified === false ? " <span class='srcs__unv'>unverified</span>" : "") + "</span>";
    }).join(" · ") + "</p>";
  }
  function events() {
    var tl = (D.scorecard && D.scorecard.timeline) || [];
    var find = function (label) { return tl.filter(function (x) { return x.label === label; })[0]; };
    var list = (S.events || []).map(function (ev) {
      var t = find(ev.label);
      if (!t) return "";
      var ids = (t.source_ids || []).slice();
      var t2 = ev.also && find(ev.also);
      if (t2) (t2.source_ids || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
      var btn = "<button type='button' class='ev__n' data-node='" + esc(ev.node) + "'>" + esc(ev.head) + "</button>";
      var text = fill(ev.text).replace("{node}", btn);
      return "<li class='ev' data-node='" + esc(ev.node) + "'><span class='ev__d'>" + esc(fmtDate(t.date)) + "</span><span class='ev__t'>" + text +
        ids.map(function (id) { return cite(id); }).join("") + "</span></li>";
    }).join("");
    return "<ol class='events'>" + list + "</ol>";
  }
  function threadList(st) {
    return "<ol class='thread'>" + st.thread.items.map(function (it, k) {
      return "<li data-node='" + esc(it.node) + "'><span class='thread__k'>" + (k + 1) + "</span><span><b>" + fill(it.head) + "</b> " + fill(it.text) + "</span></li>";
    }).join("") + "</ol>";
  }
  function mitText() {
    var m = (D.model && D.model.mitigation) || {};
    return "<code class='formula'>stress = (own exposure + stress passed on) × (1 − " + m.workout_capability + " × workout) × (1 − " + m.capital_buffer + " × buffer)</code>";
  }
  function fill(html, st) {
    return String(html)
      .replace(/\{cite:([\w-]+)(?::(\w+))?\}/g, function (_, id, k) { return cite(id, k); })
      .replace(/\{term:([^}|]+)(?:\|([^}]+))?\}/g, function (_, k, shown) { return term(k, shown); })
      .replace(/\{node:([\w-]+)\|([^}]+)\}/g, function (_, id, shown) { return "<button type='button' class='ev__n' data-node='" + id + "'>" + shown + "</button>"; })
      .replace(/\{parts\}/g, function () { return partsHtml(); })
      .replace(/\{live:integrated\}/g, "<ul class='live-int' id='live-int'></ul>")
      .replace(/\{mit\}/g, mitText())
      .replace(/\{events\}/g, function () { return events(); })
      .replace(/\{thread\}/g, function () { return st && st.thread ? threadList(st) : ""; })
      .replace(/<\/sup><sup class='cite /g, "</sup><sup class='cite cite--next ");
  }
  function heroHtml(st) {
    var h = st.hero;
    if (!h) return "";
    if (h === "live") return "<div class='hero hero--shock' id='live-count'></div>";
    var c = h.cite ? h.cite.split(":") : null;
    return "<div class='hero hero--" + h.kind + "'><p class='hero__v'>" + esc(h.v) + "</p><p class='hero__l'>" + fill(h.label) + (c ? cite(c[0], c[1]) : "") + "</p></div>";
  }

  /* legend: up to three keys per step in one row; the Key button opens everything */
  function lgLine(t) { return "<i class='lg__line" + (ET[t].generic ? " lg__line--dash" : "") + "' style='--c:" + ET[t].color + "'></i>"; }
  var LG = {
    money: "<i class='lg__flow'></i>money moving",
    stress: "<i class='lg__flow lg__flow--red'></i>stress moving",
    badge: "<i class='lg__badge'></i>gold dot = owns its lenders",
    dashed: "<i class='lg__dash'></i>dashed = inferred",
    example: "<i class='lg__dash'></i>dashed = example, not sourced",
    dotted: "<i class='lg__dot'></i>dotted = ended or pending",
    arch: "<i class='lg__arch'></i>archetype, not a firm",
    archShort: "<i class='lg__arch'></i>archetype",
    status: "<i class='lg__status'></i>dated legal event",
    size: "<i class='lg__size'></i>size = links on this map",
    elevated: "<i class='lg__node lg__node--t3'></i>elevated",
    severe: "<i class='lg__node lg__node--t4'></i>severe"
  };
  // shorter words for the one-row legend; the full key and the cards use the full verbs
  var LG_SHORT = { originates_for: "makes loans", buys_flow_from: "buys loans", reinsures_to: "passes policies", losses_flow_to: "passes losses",
    shock: "loss spreads", pays_premium: "money in and out" };
  function lgItem(k) {
    var inner = LG[k] || (ET[k] ? lgLine(k) + esc(LG_SHORT[k] || ET[k].label) : "");
    return inner ? "<li class='lg'>" + inner + "</li>" : "";
  }
  function legendHtml(st) {
    // the Key button rides on the hand-off row; on the last step (no hand-off) it ends the legend row
    return "<div class='legend'><ul class='lg-list'>" + (st.legend || []).slice(0, 3).map(lgItem).join("") + "</ul>" + KEY_BTN + "</div>";
  }
  var KEY_BTN = "<button type='button' class='lg-key' aria-expanded='false' aria-controls='keypop'>Full key</button>";
  function fullKeyHtml() {
    var lines = LEGEND_ORDER.map(function (t) {
      return "<li class='lg'>" + lgLine(t) + esc(t === "pays_premium" ? "money in and out (example)" : ET[t].label) + "</li>";
    }).join("");
    var tiers = [0, 1, 2, 3, 4].map(function (t) { return "<li class='lg'><i class='lg__node lg__node--t" + t + "'></i>" + esc(M2.tierLabel(t)) + "</li>"; }).join("");
    return "<button type='button' class='keypop__x' aria-label='Close key'>×</button>" +
      "<p class='keypop__h'>Lines</p><ul class='lg-list lg-list--wrap'>" + lines + "</ul>" +
      "<ul class='lg-list lg-list--wrap'><li class='lg'><i class='lg__solid'></i>solid = documented</li><li class='lg'>" + LG.dashed + "</li><li class='lg'>" + LG.dotted + "</li>" +
      "<li class='lg'>" + LG.money + "</li><li class='lg'>" + LG.stress + "</li></ul>" +
      "<p class='keypop__h'>Shapes</p><ul class='lg-list lg-list--wrap lg-shapes'>" +
      "<li class='lg'><i class='sh sh--c'></i>insurer</li><li class='lg'><i class='sh sh--c sh--ring'></i>manager</li><li class='lg'><i class='sh sh--d'></i>reinsurer</li>" +
      "<li class='lg'><i class='sh sh--s'></i>lender owned by a manager</li><li class='lg'><i class='sh sh--t'></i>bank that sells loans</li>" +
      "<li class='lg'><i class='sh sh--h'></i>regulator</li><li class='lg'><i class='sh sh--r'></i>safety net</li><li class='lg'>" + LG.arch + "</li></ul>" +
      "<ul class='lg-list lg-list--wrap'><li class='lg'>" + LG.badge + "</li><li class='lg'>" + LG.status + "</li><li class='lg'>" + LG.size + "</li></ul>" +
      "<p class='keypop__h'>Stress, in this page's model</p><ul class='lg-list lg-list--wrap'>" + tiers + "</ul>" +
      "<p class='keypop__tip'>Click a firm for its links and sources. Click a second firm to see how the two connect.</p>";
  }

  function partsHtml() {
    return ["rd-pt1", "rd-pt2", "rd-pt3"].map(function (id) {
      var s = srcById[id]; if (!s) return "";
      return "<a class='part' href='" + esc(s.url) + "' target='_blank' rel='noopener'>" + id.slice(-1) + "</a>";
    }).filter(Boolean).join(", ");
  }
  function buildPanel(i) {
    var st = STEPS[i];
    RC = newRC();
    var nx = STEPS[i + 1];
    var html =
      "<h1 class='title" + (st.big ? " title--hero" : "") + "'>" + esc(st.title) + "</h1>" +
      heroHtml(st) +
      "<div class='body'>" + st.body.map(function (b) { return fill(b, st); }).join("") + "</div>" +
      (nx ? "<button type='button' class='handoff'><span class='handoff__k'>Next</span>" + esc(nx.name) + " <span class='handoff__a' aria-hidden='true'>↓</span></button>" : "") +
      "<div class='panel__foot'>" + legendHtml(st) + "</div>";
    var out = { html: html, cites: RC.order.slice(), missing: RC.missing.slice() };
    RC = null;
    return out;
  }
  var panelSwapTimer = null;
  function renderPanel(instant) {
    var st = STEPS[state.step], i = state.step;
    var html = buildPanel(i).html;
    $("sheet-pos").textContent = st.name;
    panel.setAttribute("data-step", st.id);
    $("prev").disabled = i === 0; $("next").disabled = i === STEPS.length - 1;
    clearTimeout(panelSwapTimer);
    hint.innerHTML = legendHtml(st);
    wireKey(hint);
    var swap = function () {
      panelInner.innerHTML = html;
      panelInner.scrollTop = 0;
      wirePanel();
      updateLive();
      panelInner.classList.remove("is-out");
    };
    if (instant) swap();
    else { panelInner.classList.add("is-out"); panelSwapTimer = setTimeout(swap, 230); }
  }
  function wirePanel() {
    Array.prototype.forEach.call(panelInner.querySelectorAll("[data-node]"), function (el) {
      if (el.wired) return; el.wired = true;
      var id = el.getAttribute("data-node");
      el.addEventListener("mouseenter", function () { if (byId[id] && byId[id].on) { state.hover = id; applyStyle(); } });
      el.addEventListener("mouseleave", function () { if (state.hover === id) { state.hover = null; applyStyle(); } });
      if (el.tagName === "BUTTON") el.addEventListener("click", function () { if (byId[id] && byId[id].on) { select(id, true); focusNode(id); } });
    });
    var ho = panelInner.querySelector(".handoff");
    if (ho) ho.addEventListener("click", next);
    wireKey(panelInner);
  }
  function wireKey(root) {
    var kb = root.querySelector(".lg-key");
    if (kb) kb.addEventListener("click", function (ev) { ev.stopPropagation(); if (keyEl.hidden) showKey(kb); else hideKey(); });
  }
  function updateLegendHighlight() { /* reserved: legend rows are static per step */ }

  function updateLive() {
    var R = state.results;
    var lc = $("live-count");
    if (lc && R) {
      var firms = R.list.filter(function (r) { return r.scored && !r.archetype && r.role !== "backstop"; });
      var hi = firms.filter(function (r) { return r.tier >= 3; }).length;
      var arch = R.list.filter(function (r) { return r.archetype; });
      var archHi = arch.filter(function (r) { return r.tier >= 3; }).length;
      var counts = [0, 0, 0, 0, 0];
      firms.forEach(function (r) { counts[r.tier]++; });
      var bar = counts.map(function (c, t) { return c ? "<i style='flex:" + c + ";background:" + TIER_COL[t] + "' title='" + M2.tierLabel(t) + ": " + c + "'></i>" : ""; }).join("");
      lc.innerHTML = "<p class='hero__v'>" + hi + " <span class='hero__of'>of " + firms.length + "</span></p>" +
        "<p class='hero__l'>real firms under elevated or severe stress at the slider settings below.</p>" +
        "<div class='live__bar' aria-hidden='true'>" + bar + "</div>";
    }
    var li = $("live-int");
    if (li && R) {
      var st = STEPS[state.step];
      li.innerHTML = st.emph.nodes.filter(function (id) { var r = R.byId[id]; return r && r.scored && byId[id].role !== "platform"; }).map(function (id) {
        var r = R.byId[id];
        return "<li data-node='" + id + "'><i style='background:" + TIER_COL[r.tier] + "'></i>" + esc(short(byId[id])) + " <span>" + M2.tierLabel(r.tier) + "</span></li>";
      }).join("");
      wirePanel();
    }
  }

  /* ------------------------------------------------------------------ popovers: glossary, citations, key */
  var popEl = document.createElement("div");
  popEl.className = "pop"; popEl.id = "pop"; popEl.setAttribute("role", "tooltip"); popEl.hidden = true;
  appEl.appendChild(popEl);
  var keyEl = document.createElement("div");
  keyEl.className = "keypop"; keyEl.id = "keypop"; keyEl.setAttribute("role", "dialog"); keyEl.setAttribute("aria-label", "Map key"); keyEl.hidden = true;
  appEl.appendChild(keyEl);
  var pop = { el: null, pinned: false };
  function popContent(el) {
    if (el.classList.contains("term")) {
      var k = el.getAttribute("data-term");
      return "<b>" + esc(k) + "</b>" + esc(S.glossary[k]);
    }
    var id = el.getAttribute("data-src"), s = srcById[id] || {};
    var kind = el.getAttribute("data-kind") || srcKind(id);
    return "<b class='c-" + kind + "'>" + esc(PROV[kind] || "") + "</b>" + esc(s.title || id) +
      "<span class='pop__meta'>" + esc([s.publisher, s.date ? fmtDate(s.date) : ""].filter(Boolean).join(" · ")) + (s.verified === false ? " · unverified" : "") + "</span>";
  }
  function showPop(el, pinned) {
    popEl.innerHTML = popContent(el);
    popEl.hidden = false;
    if (pop.el && pop.el !== el) pop.el.removeAttribute("aria-describedby");
    pop.el = el; pop.pinned = !!pinned;
    el.setAttribute("aria-describedby", "pop");
    if (el.classList.contains("term")) el.setAttribute("aria-expanded", "true");
    var r = el.getBoundingClientRect(), pw = popEl.offsetWidth, ph = popEl.offsetHeight;
    var x = clamp(r.left + r.width / 2 - pw / 2, 8, vw() - pw - 8);
    var y = r.top - ph - 8;
    if (y < 8) y = r.bottom + 8;
    popEl.style.left = x + "px"; popEl.style.top = y + "px";
  }
  function hidePop() {
    if (pop.el) { pop.el.removeAttribute("aria-describedby"); if (pop.el.classList.contains("term")) pop.el.setAttribute("aria-expanded", "false"); }
    popEl.hidden = true; pop.el = null; pop.pinned = false;
  }
  function popTarget(t) { return t && t.closest ? t.closest(".term, .cite a, .srcs a") : null; }
  document.addEventListener("mouseover", function (ev) {
    if (coarse) return;
    var el = popTarget(ev.target);
    if (el && el !== pop.el) showPop(el, false);
  });
  document.addEventListener("mouseout", function (ev) {
    var el = popTarget(ev.target);
    if (el && el === pop.el && !pop.pinned && !(ev.relatedTarget && el.contains(ev.relatedTarget))) hidePop();
  });
  document.addEventListener("focusin", function (ev) { var el = popTarget(ev.target); if (el) showPop(el, false); });
  document.addEventListener("focusout", function (ev) { var el = popTarget(ev.target); if (el && el === pop.el && !pop.pinned) hidePop(); });
  document.addEventListener("click", function (ev) {
    var el = popTarget(ev.target);
    if (el && el.classList.contains("term")) {
      ev.preventDefault();
      if (pop.el === el && pop.pinned) hidePop(); else showPop(el, true);
      return;
    }
    if (!el && !(ev.target.closest && ev.target.closest(".pop"))) hidePop();
    if (!keyEl.hidden && !(ev.target.closest && ev.target.closest(".keypop, .lg-key"))) hideKey();
  });
  panelInner.addEventListener("scroll", function () { hidePop(); }, { passive: true });

  function showKey(btn) {
    if (!keyEl.innerHTML) {
      keyEl.innerHTML = fullKeyHtml();
      keyEl.querySelector(".keypop__x").addEventListener("click", function () { hideKey(); });
    }
    keyEl.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    var r = btn.getBoundingClientRect();
    if (isMobile()) {
      keyEl.style.left = "8px"; keyEl.style.right = "8px"; keyEl.style.top = "auto";
      keyEl.style.bottom = (vh() - panel.getBoundingClientRect().top + 8) + "px";
      keyEl.style.maxHeight = Math.max(160, panel.getBoundingClientRect().top - 16) + "px";
    } else {
      keyEl.style.right = "auto";
      keyEl.style.left = Math.max(16, Math.min(r.right - keyEl.offsetWidth, vw() - keyEl.offsetWidth - 16)) + "px";
      var top = r.top - keyEl.offsetHeight - 10;
      if (top < 12) top = Math.min(vh() - keyEl.offsetHeight - 12, r.bottom + 10);
      keyEl.style.top = Math.max(12, top) + "px"; keyEl.style.bottom = "auto";
    }
    keyEl.querySelector(".keypop__x").focus({ preventScroll: true });
  }
  function hideKey() {
    if (keyEl.hidden) return;
    keyEl.hidden = true;
    var had = keyEl.contains(document.activeElement);
    Array.prototype.forEach.call(document.querySelectorAll(".lg-key"), function (b) {
      b.setAttribute("aria-expanded", "false");
      if (had && b.offsetParent !== null) { b.focus({ preventScroll: true }); had = false; }
    });
  }

  /* ------------------------------------------------------------------ dots */
  function renderDots() {
    if (!dotsEl.childNodes.length) {
      STEPS.forEach(function (st, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "dot"; b.setAttribute("aria-label", (i + 1) + ". " + st.name);
        b.innerHTML = "<span class='dot__lbl'>" + esc(st.name) + "</span><span class='dot__c'></span>";
        b.addEventListener("click", function () { go(i); });
        dotsEl.appendChild(b);
      });
    }
    Array.prototype.forEach.call(dotsEl.childNodes, function (b, i) {
      b.classList.toggle("is-current", i === state.step);
      if (i === state.step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
  }

  /* ------------------------------------------------------------------ shock panel */
  var sliderEls = {};
  function buildShock() {
    M2.stressScenarios().forEach(function (sc) {
      var row = document.createElement("label");
      row.className = "sl";
      row.title = sc.description;
      var name = (S.sliderLabel && S.sliderLabel[sc.id]) || sc.label;
      row.innerHTML = "<span class='sl__name'>" + esc(name) + "</span><span class='sl__val'></span>" +
        "<input type='range' min='0' max='100' step='5' aria-label='" + esc(name) + ", how hard'>";
      var input = row.querySelector("input"), val = row.querySelector(".sl__val");
      input.value = Math.round((state.sev[sc.id] || 0) * 100);
      var paint = function () {
        val.textContent = input.value + "%";
        input.style.setProperty("--p", input.value + "%");
      };
      paint();
      input.addEventListener("input", function () { state.sev[sc.id] = input.value / 100; paint(); scheduleModel(); });
      sliderEls[sc.id] = { input: input, paint: paint };
      shockSliders.appendChild(row);
    });
    qjEl.checked = state.qj;
    qjEl.addEventListener("change", function () { state.qj = qjEl.checked; scheduleModel(); });
    var rel = M2.reliefScenario();
    if (rel) qjEl.parentNode.title = rel.description;
    $("shock-reset").addEventListener("click", function () {
      state.sev = Object.assign({}, S.defaultSeverity || {});
      state.qj = !!S.defaultQJ; qjEl.checked = state.qj;
      Object.keys(sliderEls).forEach(function (id) { sliderEls[id].input.value = Math.round((state.sev[id] || 0) * 100); sliderEls[id].paint(); });
      scheduleModel();
    });
  }
  var modelRaf = null;
  function scheduleModel() {
    if (modelRaf) return;
    modelRaf = requestAnimationFrame(function () {
      modelRaf = null;
      runModel();
      applyStyle();
      updateLive();
      if (state.a) renderCard();
    });
  }

  /* ------------------------------------------------------------------ render loop */
  var rafId = null;
  function kick() { if (rafId == null && !document.hidden) rafId = requestAnimationFrame(frame); }
  var lastFrame = 0;
  function frame(now) {
    rafId = null;
    var dt = Math.min(64, now - (lastFrame || now)); lastFrame = now;
    var active = false;
    if (sim.alpha() > sim.alphaMin() || sim.alphaTarget() > 0) { sim.tick(); active = true; }
    // ease edges
    var ease = reduce ? 1 : 1 - Math.pow(0.0025, dt / 1000);
    var growRate = reduce ? 1 : dt / 650;
    var anyParts = false;
    if (Math.abs(state.boost - state.tboost) > 0.002) { state.boost += (state.tboost - state.boost) * ease; active = true; } else state.boost = state.tboost;
    edges.forEach(function (e) {
      if (Math.abs(e.alpha - e.ta) > 0.004) { e.alpha += (e.ta - e.alpha) * ease; active = true; } else e.alpha = e.ta;
      if (Math.abs(e.red - e.tred) > 0.004) { e.red += (e.tred - e.red) * ease; active = true; } else e.red = e.tred;
      if (Math.abs(e.gray - e.tgray) > 0.004) { e.gray += (e.tgray - e.gray) * ease; active = true; } else e.gray = e.tgray;
      if (Math.abs(e.wmul - e.twmul) > 0.004) { e.wmul += (e.twmul - e.wmul) * ease; active = true; } else e.wmul = e.twmul;
      if (e.on && e.grow < 1) {
        // grow only once both ends have appeared
        e.grow = Math.min(1, e.grow + growRate); active = true;
      }
      if (e.on && e.parts.length && e.alpha > 0.05) anyParts = true;
    });
    draw(now);
    if (active || anyParts || state.dirty) { state.dirty = false; if (active || anyParts) rafId = requestAnimationFrame(frame); }
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { lastFrame = 0; kick(); } });

  var dpr = 1, W = 0, H = 0;
  function resizeCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    svg.setAttribute("width", W); svg.setAttribute("height", H);
  }

  function geom(e) {
    var a = e.s, b = e.t;
    var x1 = a.sx, y1 = a.sy, x2 = b.sx, y2 = b.sy;
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    if (e.canonFlip) { nx = -nx; ny = -ny; }
    var cx = (x1 + x2) / 2 + nx * len * e.bend, cy = (y1 + y2) / 2 + ny * len * e.bend;
    var ra = a.sr * (a.role === "reinsurer" ? 1.2 : 1) + 2, rb = b.sr * (b.role === "reinsurer" ? 1.2 : b.role === "backstop" ? 1.15 : 1) + 3;
    var t0 = clamp(ra / len, 0, 0.45), t1 = clamp(1 - rb / len, 0.55, 1);
    return { x1: x1, y1: y1, cx: cx, cy: cy, x2: x2, y2: y2, t0: t0, t1: t1, len: len };
  }
  function qpt(g, t) {
    var q = 1 - t;
    return [q * q * g.x1 + 2 * q * t * g.cx + t * t * g.x2, q * q * g.y1 + 2 * q * t * g.cy + t * t * g.y2];
  }
  function qtan(g, t) {
    return [2 * (1 - t) * (g.cx - g.x1) + 2 * t * (g.x2 - g.cx), 2 * (1 - t) * (g.cy - g.y1) + 2 * t * (g.y2 - g.cy)];
  }

  function draw(now) {
    var T = state.T, ns = nodeScale();
    // screen positions
    nodes.forEach(function (n) {
      if (n.el.style.display === "none") return;
      n.sx = T.applyX(n.x); n.sy = T.applyY(n.y); n.sr = n.r * ns;
      n.el.setAttribute("transform", "translate(" + n.sx.toFixed(1) + "," + n.sy.toFixed(1) + ")");
      if (Math.abs(n.sr - n.lastSr) > 0.05) {
        n.lastSr = n.sr;
        n.shapeEl.setAttribute("d", shapePath(n, n.sr));
        n.haloEl.setAttribute("d", shapePath(n, n.sr + 4));
        if (n.ringEl) n.ringEl.setAttribute("d", shapePath(n, n.sr + 3));
        n.hitEl.setAttribute("r", Math.max(12, n.sr + 6));
        var fs = clamp(n.sr * 0.62, 6, 11);
        n.monoEl.setAttribute("font-size", fs.toFixed(1));
        n.monoEl.style.display = n.sr >= 9.5 && n.mono ? "" : "none";
        if (n.mono && n.mono.length >= 3) n.monoEl.setAttribute("font-size", (fs * 0.86).toFixed(1));
        if (n.badgeEl) { n.badgeEl.setAttribute("cx", (n.sr * 0.74).toFixed(1)); n.badgeEl.setAttribute("cy", (-n.sr * 0.74).toFixed(1)); n.badgeEl.setAttribute("r", Math.max(3, n.sr * 0.26).toFixed(1)); }
      }
    });
    placeLabels();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    var lw = clamp(0.9 * Math.pow(T.k, 0.35), 0.75, 1.5);
    if ((STEPS[state.step] || {}).big) lw *= 1.6;
    edges.forEach(function (e) {
      if (e.alpha < 0.01 || !e.s.sx && e.s.sx !== 0) return;
      if (e.s.el.style.display === "none" || e.t.el.style.display === "none") return;
      var g = geom(e); e.g = g;
      var t = ET[e.type] || ET.owns;
      var col = mix(mix(t.rgb, GRAY, e.gray * 0.7), RED, e.red);
      e.col = col;
      var a = e.alpha * Math.min(1, Math.min(e.s.op == null ? 1 : 1, 1));
      var tEnd = g.t0 + (g.t1 - g.t0) * e.grow;
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = lw * e.wmul * (1 + e.red * 0.9);
      var dashed = e.illustrative || e.status === "inferred";
      if (e.phase === "ended" || e.phase === "pending") ctx.setLineDash([1.2, 4]);
      else if (dashed) ctx.setLineDash([5, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      var steps = 18, p;
      for (var k = 0; k <= steps; k++) {
        p = qpt(g, g.t0 + (tEnd - g.t0) * (k / steps));
        if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (e.grow > 0.97 && e.type !== "regulated_by") {
        var tip = qpt(g, g.t1), tg = qtan(g, g.t1), tl = Math.sqrt(tg[0] * tg[0] + tg[1] * tg[1]) || 1;
        var ux = tg[0] / tl, uy = tg[1] / tl, s = clamp(4.2 * Math.pow(T.k, 0.3), 3.5, 6.5) * (e.wmul > 1.2 ? 1.25 : 1);
        ctx.fillStyle = rgba(col, Math.min(1, a * 1.15));
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        ctx.lineTo(tip[0] - ux * s * 1.6 - uy * s * 0.75, tip[1] - uy * s * 1.6 + ux * s * 0.75);
        ctx.lineTo(tip[0] - ux * s * 1.6 + uy * s * 0.75, tip[1] - uy * s * 1.6 - ux * s * 0.75);
        ctx.closePath(); ctx.fill();
      }
    });
    // particles
    if (!reduce) {
      edges.forEach(function (e) {
        if (!e.on || !e.parts.length || e.alpha < 0.05 || e.grow < 0.97 || !e.g) return;
        var g = e.g;
        e.parts.forEach(function (pt) {
          var len = Math.max(40, g.len);
          var dur = pt.dur * clamp(len / 160, 0.7, 1.8);
          for (var k = 0; k < pt.n; k++) {
            var ph = ((now / dur) + (e.idx * 0.137) + k / pt.n) % 1;
            var tt = g.t0 + (g.t1 - g.t0) * (pt.fwd ? ph : 1 - ph);
            var p = qpt(g, tt);
            var fade = ph < 0.1 ? ph / 0.1 : ph > 0.9 ? (1 - ph) / 0.1 : 1;
            var c = pt.kind === "red" ? RED : GREEN;
            var aa = fade * clamp(e.alpha * 1.25, 0.15, 1);
            var rr = pt.big ? 3 : pt.kind === "red" ? 2.3 : 1.9;
            ctx.fillStyle = rgba(c, 0.18 * aa);
            ctx.beginPath(); ctx.arc(p[0], p[1], rr * 2.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = rgba(c, aa);
            ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, Math.PI * 2); ctx.fill();
          }
        });
      });
    }
    drawVerbs();
  }

  // the relationship verb at the middle of an edge (step 1 always; elsewhere on hover / selection)
  function drawVerbs() {
    var big = !!(STEPS[state.step] || {}).big;
    var fs = isMobile() ? 10 : big ? 13 : 11.5;
    ctx.font = "500 " + fs + "px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var boxes = [];
    nodes.forEach(function (n) { var r = n.sr * 0.85; if (n.on && n.sx != null) boxes.push({ x0: n.sx - r, x1: n.sx + r, y0: n.sy - r, y1: n.sy + r }); });
    labelBoxes.forEach(function (b) { boxes.push({ x0: b.x0 + 2, x1: b.x1 - 2, y0: b.y0 + 1, y1: b.y1 - 1 }); });
    var list = edges.filter(function (e) { return e.verb && e.on && e.g && e.grow > 0.97 && e.alpha > 0.15; });
    list.forEach(function (e) {
      var g = e.g, p = null, box = null;
      var w = ctx.measureText(e.verb).width, h = fs + 4;
      // on the line at its middle, else nudged along it, else just beside it
      var tg = qtan(g, (g.t0 + g.t1) / 2), tl = Math.hypot(tg[0], tg[1]) || 1, nx = -tg[1] / tl, ny = tg[0] / tl;
      var side = Math.abs(nx) * (w / 2 + 3) + Math.abs(ny) * (h / 2) + 2;
      [[0.5, 0], [0.4, 0], [0.6, 0], [0.32, 0], [0.68, 0], [0.5, -side], [0.5, side], [0.42, -side], [0.58, -side], [0.42, side], [0.58, side]].some(function (c) {
        var q = qpt(g, g.t0 + (g.t1 - g.t0) * c[0]);
        q = [q[0] + nx * c[1], q[1] + ny * c[1]];
        var bb = { x0: q[0] - w / 2 - 3, x1: q[0] + w / 2 + 3, y0: q[1] - h / 2, y1: q[1] + h / 2 };
        if (boxes.some(function (b) { return overlaps(b, bb); })) return false;
        p = q; box = bb; return true;
      });
      if (!box) return;
      boxes.push(box);
      var a = clamp(e.alpha * 1.3, 0, 1);
      ctx.fillStyle = "rgba(10,11,13," + (0.88 * a).toFixed(3) + ")";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, 4); else ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.fill();
      ctx.fillStyle = rgba(mix(e.col || [200, 200, 200], [240, 236, 228], 0.45), a);
      ctx.fillText(e.verb, p[0], p[1] + 0.5);
    });
  }

  /* ------------------------------------------------------------------ labels */
  var labelW = {};
  function textWidth(n, big) {
    var fs = labelFont();
    var key = n.id + (big ? "b" : "") + fs;
    if (labelW[key]) return labelW[key];
    measureCtx.font = (big ? "500 " : "400 ") + (big ? fs + 1 : fs) + "px 'IBM Plex Sans', sans-serif";
    var w = measureCtx.measureText(n.mapLabel).width + 2;
    if (n.sub) { measureCtx.font = "400 " + (fs - 2) + "px 'IBM Plex Mono', monospace"; w = Math.max(w, measureCtx.measureText(n.sub.toUpperCase()).width + 6); }
    return (labelW[key] = w);
  }
  function labelFont() {
    var big = !!(STEPS[state.step] || {}).big;
    return isMobile() ? (big ? 11.5 : 10) : (big ? 14 : 11);
  }
  function uiObstacles() {
    var out = [];
    [toolsEl, hint, card, shockEl, dotsEl.querySelector(".is-current")].forEach(function (el) {
      if (!el || el.hidden || el.offsetParent === null) return;
      var r = el.getBoundingClientRect();
      if (r.width && r.height) out.push({ x0: r.left - 4, x1: r.right + 4, y0: r.top - 4, y1: r.bottom + 4 });
    });
    var pr = panel.getBoundingClientRect();
    if (isMobile()) out.push({ x0: 0, x1: vw(), y0: pr.top, y1: vh() });
    else {
      out.push({ x0: 0, x1: pr.right - 30, y0: 0, y1: vh() });
      var dr = dotsEl.getBoundingClientRect();
      out.push({ x0: dr.right - 24, x1: vw(), y0: dr.top - 6, y1: dr.bottom + 6 });   // the dot column
    }
    return out;
  }
  var labelBoxes = [];
  function overlaps(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
  function placeLabels() {
    var F = state.focus;
    var placed = uiObstacles();
    labelBoxes = [];
    var vis = nodes.filter(function (n) { return n.on && n.el.style.display !== "none"; });
    // dimmed nodes do not block labels of the nodes in focus
    vis.forEach(function (n) { if (F && !F.nodes[n.id]) return; placed.push({ x0: n.sx - n.sr - 1, x1: n.sx + n.sr + 1, y0: n.sy - n.sr - 1, y1: n.sy + n.sr + 1, node: n.id }); });
    var prio = function (n) {
      var p = n.r;
      if (n.id === state.a || n.id === state.b) p += 1000;
      if (n.id === state.hover) p += 900;
      if (F && F.nodes[n.id]) p += 200;
      if (F && !F.nodes[n.id]) p -= 100;
      if (n.tier >= 2 && curMode() === "stress") p += 30 + n.tier * 5;
      return p;
    };
    vis.sort(function (a, b) { return prio(b) - prio(a) || a.idx - b.idx; });
    var mobile = isMobile();
    vis.forEach(function (n) {
      var big = !!n.bigLabel;
      var fs = labelFont();
      var w = textWidth(n, big), h = (big ? fs + 2 : fs + 1) + (n.sub ? fs : 0);
      var l1h = big ? fs + 2 : fs + 1;
      var gap = 3;
      var cands = [
        { x: n.sx, y: n.sy + n.sr + gap + l1h - 2, anchor: "middle", box: { x0: n.sx - w / 2, x1: n.sx + w / 2, y0: n.sy + n.sr + gap, y1: n.sy + n.sr + gap + h } },
        { x: n.sx + n.sr + 5, y: n.sy + l1h / 2 - 2 - (n.sub ? fs / 2 : 0), anchor: "start", box: { x0: n.sx + n.sr + 4, x1: n.sx + n.sr + 5 + w, y0: n.sy - h / 2, y1: n.sy + h / 2 } },
        { x: n.sx - n.sr - 5, y: n.sy + l1h / 2 - 2 - (n.sub ? fs / 2 : 0), anchor: "end", box: { x0: n.sx - n.sr - 5 - w, x1: n.sx - n.sr - 4, y0: n.sy - h / 2, y1: n.sy + h / 2 } },
        { x: n.sx, y: n.sy - n.sr - gap - 2 - (n.sub ? fs : 0), anchor: "middle", box: { x0: n.sx - w / 2, x1: n.sx + w / 2, y0: n.sy - n.sr - gap - h, y1: n.sy - n.sr - gap } }
      ];
      var BX = { x0: 4, x1: W - 4, y0: 4, y1: H - 4 };
      var must = n.id === state.a || n.id === state.b || n.id === state.hover;
      var dimmed = F && !F.nodes[n.id];
      var chosen = null;
      if (!(dimmed && (F.thread || mobile))) {
        for (var c = 0; c < cands.length; c++) {
          var bx = cands[c].box, hit = bx.x0 < BX.x0 || bx.x1 > BX.x1 || bx.y0 < BX.y0 || bx.y1 > BX.y1;
          for (var j = 0; j < placed.length; j++) { if (placed[j].node === n.id) continue; if (overlaps(bx, placed[j])) { hit = true; break; } }
          if (!hit) { chosen = cands[c]; break; }
        }
        if (!chosen && must) chosen = cands[0];
      }
      var L = n.labEl;
      if (chosen) {
        L.setAttribute("x", chosen.x.toFixed(1)); L.setAttribute("y", chosen.y.toFixed(1)); L.setAttribute("text-anchor", chosen.anchor);
        if (n.subEl) n.subEl.setAttribute("x", chosen.x.toFixed(1));
        L.style.fontSize = (big ? fs + 1 : fs) + "px";
        L.style.visibility = "visible";
        placed.push(chosen.box);
        labelBoxes.push(chosen.box);
      } else L.style.visibility = "hidden";
      // tier word near the upper right of the node
      var T2 = n.tierEl;
      if (T2.textContent) {
        var tw = T2.textContent.length * 5.9 + 2;
        var tb = { x0: n.sx + n.sr * 0.7, x1: n.sx + n.sr * 0.7 + tw, y0: n.sy - n.sr - 10, y1: n.sy - n.sr + 1 };
        var free = !placed.some(function (p) { return p.node !== n.id && overlaps(tb, p); });
        if (free && !(dimmed && F.dim < 0.2)) {
          T2.setAttribute("x", tb.x0.toFixed(1)); T2.setAttribute("y", (tb.y1 - 2).toFixed(1));
          T2.style.visibility = "visible"; placed.push(tb);
        } else T2.style.visibility = "hidden";
      } else T2.style.visibility = "hidden";
    });
  }

  /* ------------------------------------------------------------------ selection, cards, paths */
  function directEdges(a, b) {
    return adj[a].filter(function (e) { return (e.source === a && e.target === b) || (e.source === b && e.target === a); });
  }
  function findPath(a, b) {
    var d = directEdges(a, b);
    if (d.length) return { direct: true, edges: d };
    var prevMap = {}; prevMap[a] = null;
    var q = [a];
    var allowReg = byId[a].role === "jurisdiction" || byId[b].role === "jurisdiction";
    while (q.length) {
      var cur = q.shift();
      if (cur === b) break;
      adj[cur].forEach(function (e) {
        if (!e.on) return;
        if (e.type === "regulated_by" && !allowReg) return;
        var nx = e.source === cur ? e.target : e.source;
        if (byId[nx].role === "jurisdiction" && nx !== b) return;
        if (!(nx in prevMap)) { prevMap[nx] = { from: cur, edge: e }; q.push(nx); }
      });
    }
    if (!(b in prevMap)) return { direct: false, hops: null };
    var hops = [], c = b;
    while (prevMap[c]) { hops.unshift({ from: prevMap[c].from, to: c, edge: prevMap[c].edge }); c = prevMap[c].from; }
    return { direct: false, hops: hops };
  }
  function select(id, fresh) {
    if (!byId[id] || !byId[id].on) return;
    if (fresh) { state.a = id; state.b = null; }
    else if (state.a === id && !state.b) { clearSel(); return; }
    else if (!state.a || state.b) { state.a = id; state.b = null; }
    else if (id !== state.a) state.b = id;
    state.path = state.b ? findPath(state.a, state.b) : null;
    state.hover = null;
    applyStyle();
    renderCard();
    keepClear();
  }
  function clearSel() {
    state.a = state.b = null; state.path = null;
    hideCard();
    applyStyle();
  }
  function hideCard() { card.hidden = true; card.innerHTML = ""; hint.hidden = false; document.body.classList.remove("has-card"); }

  function srcList(ids, e) {
    if (!ids || !ids.length) return "<span class='card__nosrc'>" + (e && e.illustrative ? "An example or what-if link. No source." : "Inferred. No direct source found.") + "</span>";
    return "<span class='card__src'>" + (e && e.status === "inferred" ? "Background: " : "Sources: ") + ids.map(srcLink).join(" ") + "</span>";
  }
  function statusChip(e) {
    var st = e.illustrative ? "illustrative" : e.status;
    var out = "<span class='chip chip--" + st + "'>" + (st === "illustrative" ? "example" : st) + "</span>";
    if (e.phase === "ended" || e.phase === "pending") out += "<span class='chip chip--" + e.phase + "'>" + e.phase + "</span>";
    if (!e.on) out += "<span class='chip chip--off'>not shown in this step</span>";
    return out;
  }
  function edgeBlock(e) {
    var t = ET[e.type] || { label: e.type, color: "#888" };
    return "<li class='rel'><div class='rel__head'><span class='rel__type' style='--c:" + t.color + "'>" + esc(t.label) + "</span>" + statusChip(e) + "</div>" +
      "<p class='rel__what'><b>" + esc(short(e.s)) + "</b> " + esc(e.label) + " <b>" + esc(short(e.t)) + "</b></p>" +
      (e.detail ? "<p class='rel__detail'>" + esc(e.detail) + "</p>" : "") + srcList(e.source_ids, e) + "</li>";
  }
  function renderCard() {
    var A = byId[state.a];
    if (!A) { hideCard(); return; }
    var html = "<button type='button' class='card__x' aria-label='Close'>×</button>";
    var mode = curMode();
    if (!state.b) {
      var roleW = ROLE_WORD[A.role] || A.role;
      html += "<p class='card__role'>" + esc(roleW) + (A.cluster && !A.generic ? " · " + esc(CLUSTER_WORD[A.cluster] || A.cluster) : "") + "</p>";
      html += "<h2 class='card__title'>" + esc(A.label) + "</h2>";
      if (A.archetype) html += "<p class='card__arch'>An archetype, not a real firm.</p>";
      if (A.status_note) html += "<div class='card__status'><span class='card__k'>Status</span> " + esc(A.status_note) + " " + srcList(A.status_source_ids) + "</div>";
      if (A.note) html += "<p class='card__note'>" + esc(A.note) + "</p>";
      if (!A.generic && dataNodeIds[A.id]) {
        var R = state.results;
        var role = M2.nodeRole(A);
        if (mode === "stress" && R && R.byId[A.id]) {
          var r = R.byId[A.id];
          html += "<div class='card__stress'><p class='card__tier'>" + (r.scored ? "<i style='background:" + TIER_COL[r.tier] + "'></i>Stress in this page's model: <b>" + M2.tierLabel(r.tier) + "</b>" : "Not scored by this page's model") + "</p>" +
            "<ul class='card__drivers'>" + r.drivers.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></div>";
        }
        if (role.scored && A.role !== "backstop") {
          var at = M2.resolveAttrs(A), own = A.attrs || {};
          html += "<div class='card__attrs'><p class='card__k'>Model inputs <span class='est'>est.</span></p>" +
            ((D.model && D.model.attributes) || []).map(function (m) {
              var v = at[m.id] || 0;
              return "<div class='attr' title='" + esc(m.description) + "'><span>" + esc(m.label) + (own[m.id] != null ? " *" : "") + "</span><i><b style='width:" + Math.round(v * 100) + "%'></b></i><em>" + (v >= 0.6 ? "high" : v >= 0.35 ? "mid" : v > 0 ? "low" : "none") + "</em></div>";
            }).join("") +
            "<p class='card__foot'>" + (Object.keys(own).length ? "* set for this firm. " + esc(A.attrs_note || "") : (A.archetype ? "An archetype gets the defaults for its type and group." : "All five are estimates for its type and group, not its own figures.")) + "</p></div>";
        }
      }
      var conns = adj[A.id].filter(function (e) { return e.on; });
      if (conns.length) {
        html += "<p class='card__k'>On the map now</p><ul class='card__conns'>" + conns.map(function (e) {
          var other = e.source === A.id ? e.t : e.s;
          var w = (ET[e.type] || {}).label || e.type;
          var dir = e.source === A.id ? w : "← " + w;
          var q = e.phase === "ended" ? " (ended)" : e.phase === "pending" ? " (pending)" : e.illustrative ? " (illustrative)" : e.status === "inferred" ? " (inferred)" : "";
          return "<li><span class='card__dir' style='--c:" + (ET[e.type] || {}).color + "'>" + esc(dir) + "</span> <button type='button' class='card__node' data-id='" + other.id + "'>" + esc(short(other)) + "</button><span class='card__q'>" + q + "</span></li>";
        }).join("") + "</ul>";
      }
      html += "<p class='card__hint'>" + (coarse ? "Tap" : "Click") + " a second firm to see how the two connect.</p>";
    } else {
      var B = byId[state.b];
      html += "<p class='card__role'>Relationship</p><h2 class='card__title'>" + esc(short(A)) + " <span class='card__x2'>↔</span> " + esc(short(B)) + "</h2>";
      var p = state.path || {};
      if (p.direct) {
        html += "<p class='card__k'>Direct link" + (p.edges.length > 1 ? "s" : "") + "</p><ul class='rels'>" + p.edges.map(edgeBlock).join("") + "</ul>";
      } else if (p.hops && p.hops.length) {
        html += "<p class='card__k'>No direct link. Shortest route on the map: " + p.hops.length + " steps</p><ol class='rels rels--hops'>" + p.hops.map(function (h) { return edgeBlock(h.edge); }).join("") + "</ol>";
      } else {
        html += "<p class='card__note'>These two do not connect through the lines shown in this step.</p>";
      }
      html += "<p class='card__hint'>" + (coarse ? "Tap" : "Click") + " another firm to start again. Esc closes.</p>";
    }
    card.innerHTML = html;
    card.hidden = false; hint.hidden = true;
    document.body.classList.add("has-card");
    card.scrollTop = 0;
    card.querySelector(".card__x").addEventListener("click", clearSel);
    Array.prototype.forEach.call(card.querySelectorAll(".card__node"), function (b) {
      b.addEventListener("click", function () { select(b.getAttribute("data-id")); });
    });
  }
  // pan so that selected nodes are not hidden under the card
  function keepClear() {
    if (card.hidden) return;
    requestAnimationFrame(function () {
      var cr = card.getBoundingClientRect();
      var dx = 0, dy = 0;
      [state.a, state.b].forEach(function (id) {
        var n = byId[id]; if (!n) return;
        var m = n.sr + 18;
        if (n.sx + m < cr.left || n.sx - m > cr.right || n.sy + m < cr.top || n.sy - m > cr.bottom) return;
        if (isMobile()) dy = Math.min(dy, cr.top - m - n.sy);
        else dx = Math.min(dx, cr.left - m - n.sx);
      });
      if (dx || dy) setCamera(state.T.translate(dx / state.T.k, dy / state.T.k), true, 400);
    });
  }
  function focusNode(id) {
    var n = byId[id]; if (!n || !n.on) return;
    var R = graphRect();
    var k = Math.max(state.T.k, isMobile() ? 0.8 : 1.15);
    var cx = isMobile() ? (R.x0 + R.x1) / 2 : (R.x0 + Math.min(R.x1, card.hidden ? R.x1 : card.getBoundingClientRect().left - 10)) / 2;
    var cy = (R.y0 + R.y1) / 2;
    setCamera(d3.zoomIdentity.translate(cx - n.x * k, cy - n.y * k).scale(k), true, 700);
  }

  /* ------------------------------------------------------------------ drag */
  var drag = d3.drag()
    .clickDistance(4)
    .on("start", function (ev, n) { sim.alphaTarget(0.15); if (sim.alpha() < 0.15) sim.alpha(0.15); n.fx = n.x; n.fy = n.y; n.dragMoved = false; kick(); })
    .on("drag", function (ev, n) {
      var T = state.T;
      n.fx = T.invertX(ev.sourceEvent.clientX - stage.getBoundingClientRect().left);
      n.fy = T.invertY(ev.sourceEvent.clientY - stage.getBoundingClientRect().top);
      n.dragMoved = true; kick();
    })
    .on("end", function (ev, n) {
      sim.alphaTarget(0);
      if (n.dragMoved) { n.hx = n.fx; n.hy = n.fy; if (!(STEPS[state.step].pose || {})[n.id]) { n.ux = n.fx; n.uy = n.fy; } }
      n.fx = n.fy = null; kick();
    });
  d3.selectAll(nodes.map(function (n) { return n.el; })).data(nodes).call(drag);

  function resetLayout() {
    nodes.forEach(function (n) { n.ux = n.bx; n.uy = n.by; n.fx = n.fy = null; });
    applyPose(STEPS[state.step]);
    sim.alpha(0.6);
    if (reduce) { for (var t = 0; t < 240; t++) sim.tick(); sim.alpha(0); }
    var ids = visibleIds();
    var st = STEPS[state.step];
    setCamera(fitTransform(st.focusThread && st.thread ? st.thread.nodes : ids.map(function (id) { return id; })), true);
    kick();
  }

  /* ------------------------------------------------------------------ search */
  var searchEl = $("search"), listEl = $("search-list"), msgEl = $("search-msg");
  var sIdx = -1, sItems = [];
  function searchMatches(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var res = [];
    nodes.forEach(function (n) {
      if (n.role === "event") return;
      var hay = (n.label + " " + (n.short || "") + " " + n.id.replace(/-/g, " ")).toLowerCase();
      var i = hay.indexOf(q);
      if (i < 0) return;
      res.push({ n: n, score: (i === 0 ? 0 : hay.indexOf(" " + q) >= 0 ? 1 : 2) + (n.generic ? 3 : 0) });
    });
    res.sort(function (a, b) { return a.score - b.score || a.n.label.localeCompare(b.n.label); });
    return res.slice(0, 8).map(function (r) { return r.n; });
  }
  function renderSearch() {
    sItems = searchMatches(searchEl.value);
    msgEl.hidden = true;
    if (!sItems.length) { listEl.hidden = true; searchEl.setAttribute("aria-expanded", "false"); if (searchEl.value.trim()) { msgEl.hidden = false; msgEl.textContent = "No firm by that name on this map."; } return; }
    sIdx = clamp(sIdx, 0, sItems.length - 1);
    listEl.innerHTML = sItems.map(function (n, i) {
      var where = n.on ? "on the map" : "step " + (stepOf[n.id] + 1);
      return "<li role='option' id='so-" + i + "' class='so" + (i === sIdx ? " is-act" : "") + "' data-id='" + n.id + "' aria-selected='" + (i === sIdx) + "'><span>" + esc(n.label) + "</span><small>" + esc(where) + "</small></li>";
    }).join("");
    listEl.hidden = false; searchEl.setAttribute("aria-expanded", "true");
    searchEl.setAttribute("aria-activedescendant", "so-" + sIdx);
    Array.prototype.forEach.call(listEl.querySelectorAll(".so"), function (li) {
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); pick(li.getAttribute("data-id")); });
    });
  }
  function pick(id) {
    var n = byId[id];
    listEl.hidden = true; searchEl.setAttribute("aria-expanded", "false");
    searchEl.value = n.label;
    if (n.on) { msgEl.hidden = true; select(id, true); focusNode(id); return; }
    var si = stepOf[id];
    msgEl.hidden = false;
    msgEl.innerHTML = "<b>" + esc(n.label) + "</b> is not on the map yet. It appears at step " + (si + 1) + ", " + esc(STEPS[si].name) + ". <button type='button' class='msg__go'>Show me</button>";
    msgEl.querySelector(".msg__go").addEventListener("click", function () {
      msgEl.hidden = true;
      go(si);
      setTimeout(function () { select(id, true); focusNode(id); }, reduce ? 0 : 1000);
    });
  }
  searchEl.addEventListener("input", function () { sIdx = 0; renderSearch(); });
  searchEl.addEventListener("focus", function () { if (searchEl.value) renderSearch(); });
  searchEl.addEventListener("blur", function () { setTimeout(function () { listEl.hidden = true; searchEl.setAttribute("aria-expanded", "false"); }, 150); });
  searchEl.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); sIdx = Math.min(sItems.length - 1, sIdx + 1); renderSearch(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); sIdx = Math.max(0, sIdx - 1); renderSearch(); }
    else if (ev.key === "Enter") { ev.preventDefault(); if (sItems[sIdx]) pick(sItems[sIdx].id); }
    else if (ev.key === "Escape") { searchEl.value = ""; listEl.hidden = true; msgEl.hidden = true; searchEl.blur(); }
  });

  /* ------------------------------------------------------------------ input: wheel, keys, touch */
  var wheel = { last: 0, acc: 0, used: false };
  function scrollableAncestor(el, dir) {
    while (el && el !== document.body) {
      if (el.nodeType === 1) {
        var cs = getComputedStyle(el);
        if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 2) {
          if (dir > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return el;
          if (dir < 0 && el.scrollTop > 0) return el;
        }
      }
      el = el.parentNode;
    }
    return null;
  }
  window.addEventListener("wheel", function (ev) {
    if (ev.ctrlKey || ev.metaKey) {
      // zoom gesture: d3 handles it on the stage; stop the browser zooming the page elsewhere
      if (!svg.contains(ev.target)) ev.preventDefault();
      return;
    }
    var dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1);
    var dx = ev.deltaX * (ev.deltaMode === 1 ? 16 : 1);
    if (Math.abs(dx) > Math.abs(dy)) return;
    if (scrollableAncestor(ev.target, dy > 0 ? 1 : -1)) return;   // let the text panel or card scroll first
    ev.preventDefault();
    var now = performance.now();
    if (now - wheel.last > 200) { wheel.used = false; wheel.acc = 0; }
    wheel.last = now;
    if (wheel.used) return;
    wheel.acc += dy;
    if (Math.abs(wheel.acc) >= 30) {
      wheel.used = true;
      if (wheel.acc > 0) next(); else prev();
    }
  }, { passive: false });

  document.addEventListener("keydown", function (ev) {
    var t = ev.target, tagN = t && t.tagName;
    if (ev.key === "Escape") {
      if (!keyEl.hidden) { hideKey(); ev.preventDefault(); return; }
      if (pop.el) { hidePop(); ev.preventDefault(); return; }
      if (state.a) { clearSel(); ev.preventDefault(); }
      return;
    }
    if (tagN === "INPUT" || tagN === "TEXTAREA" || tagN === "SELECT" || (t && t.isContentEditable)) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var k = ev.key;
    if (k === "ArrowDown" || k === "PageDown" || (k === " " && !ev.shiftKey)) {
      if (tagN === "BUTTON" && k === " ") return;
      ev.preventDefault(); next();
    } else if (k === "ArrowUp" || k === "PageUp" || (k === " " && ev.shiftKey)) {
      ev.preventDefault(); prev();
    } else if (k === "Home") { ev.preventDefault(); go(0); }
    else if (k === "End") { ev.preventDefault(); go(STEPS.length - 1); }
    else if (k === "ArrowRight" && isMobile()) { next(); }
    else if (k === "ArrowLeft" && isMobile()) { prev(); }
  });

  // click a line to see that relationship; click empty space to clear the selection
  function edgeAt(x, y) {
    var best = null, bd = coarse ? 12 : 7;
    edges.forEach(function (e) {
      if (!e.on || !e.g || e.alpha < 0.12 || e.grow < 0.97) return;
      for (var k = 0; k <= 16; k++) {
        var p = qpt(e.g, e.g.t0 + (e.g.t1 - e.g.t0) * k / 16);
        var d = Math.hypot(p[0] - x, p[1] - y);
        if (d < bd) { bd = d; best = e; }
      }
    });
    return best;
  }
  function setHoverEdge(id) {
    if (state.hoverEdge === id) return;
    state.hoverEdge = id;
    svg.style.cursor = id ? "pointer" : "";
    applyStyle();
  }
  svg.addEventListener("mousemove", function (ev) {
    if (coarse || ev.buttons) return;
    if (ev.target.closest && ev.target.closest(".nd")) { setHoverEdge(null); return; }
    var r = stage.getBoundingClientRect(), e = edgeAt(ev.clientX - r.left, ev.clientY - r.top);
    setHoverEdge(e ? e.id : null);
  });
  svg.addEventListener("mouseleave", function () { setHoverEdge(null); });
  svg.addEventListener("click", function (ev) {
    if (ev.target.closest && ev.target.closest(".nd")) return;
    var r = stage.getBoundingClientRect(), e = edgeAt(ev.clientX - r.left, ev.clientY - r.top);
    if (e) { selectPair(e.source, e.target); return; }
    if (state.a) clearSel();
  });
  function selectPair(a, b) {
    state.a = a; state.b = b; state.path = findPath(a, b);
    state.hover = null; state.hoverEdge = null; svg.style.cursor = "";
    applyStyle(); renderCard(); keepClear();
  }

  // touch: one-finger vertical swipe on the map changes step; horizontal swipe on the sheet changes step
  (function () {
    var t0 = null;
    stage.addEventListener("touchstart", function (ev) {
      if (ev.touches.length !== 1 || (ev.target.closest && ev.target.closest(".nd"))) { t0 = null; return; }
      t0 = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: performance.now() };
    }, { passive: true });
    stage.addEventListener("touchmove", function (ev) { if (t0 && ev.touches.length === 1) ev.preventDefault(); }, { passive: false });
    stage.addEventListener("touchend", function (ev) {
      if (!t0) return;
      var c = ev.changedTouches[0], dx = c.clientX - t0.x, dy = c.clientY - t0.y, dt = performance.now() - t0.t;
      t0 = null;
      if (dt < 900 && Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 1.2) { if (dy < 0) next(); else prev(); }
      else if (dt < 900 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) next(); else prev(); }
    });
    var p0 = null;
    panel.addEventListener("touchstart", function (ev) { if (ev.touches.length === 1) p0 = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: performance.now() }; }, { passive: true });
    panel.addEventListener("touchend", function (ev) {
      if (!p0) return;
      var c = ev.changedTouches[0], dx = c.clientX - p0.x, dy = c.clientY - p0.y, dt = performance.now() - p0.t;
      p0 = null;
      if (ev.target.closest && ev.target.closest("input")) return;
      if (dt < 800 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0) next(); else prev(); }
    });
  })();

  $("prev").addEventListener("click", prev);
  $("next").addEventListener("click", next);
  $("zoom-in").addEventListener("click", function () { zoomAround(1.35); });
  $("zoom-out").addEventListener("click", function () { zoomAround(1 / 1.35); });
  $("fit").addEventListener("click", function () { fit(true); });
  function zoomAround(f) {
    var R = graphRect();
    var c = [(R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2];
    if (reduce) svgSel.call(zoom.scaleBy, f, c);
    else svgSel.transition().duration(300).call(zoom.scaleBy, f, c);
  }

  window.addEventListener("hashchange", function () {
    var i = stepIndex(location.hash.slice(1));
    if (i >= 0 && i !== state.step) go(i, { fromHash: true });
  });
  function stepIndex(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i; return -1; }

  var resizeTimer = null;
  var wasMobile = isMobile();
  window.addEventListener("resize", function () {
    placeShock();
    if (isMobile() !== wasMobile) {
      wasMobile = isMobile();
      applyPose(STEPS[state.step]);
      state.tboost = STEPS[state.step].big ? (wasMobile ? 1.15 : 1.9) : state.tboost;
      sim.alpha(0.5);
    }
    resizeCanvas();
    labelW = {};
    state.dirty = true; kick();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { fit(false); }, 120);
  });
  if (mqReduce.addEventListener) mqReduce.addEventListener("change", function (e) { reduce = e.matches; applyStyle(); });

  /* ------------------------------------------------------------------ boot */
  placeShock();
  resizeCanvas();
  if (isMobile()) $("search").setAttribute("placeholder", "Find a firm");
  buildShock();
  runModel();
  var start = stepIndex(location.hash.slice(1));
  go(start >= 0 ? start : 0, { instant: true, fromHash: start >= 0 });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { labelW = {}; state.dirty = true; kick(); });

  // test hook (read-only)
  window.KDBF_GRAPH = {
    go: go, get step() { return state.step; }, get stepId() { return STEPS[state.step].id; }, steps: STEPS.map(function (s) { return s.id; }),
    get results() { return state.results; }, select: select, clear: clearSel, fit: fit, resetLayout: resetLayout,
    audit: function () { return STEPS.map(function (s, i) { var b = buildPanel(i); return { id: s.id, cites: b.cites, missing: b.missing }; }); },
    edge: function (id) { var e = edgeById[id]; return e && { id: e.id, on: e.on, red: e.tred, gray: e.tgray, verb: e.verb, parts: e.parts.length, mid: e.g ? qpt(e.g, (e.g.t0 + e.g.t1) / 2) : null }; },
    get transform() { return state.T; }, get selection() { return { a: state.a, b: state.b, path: state.path }; },
    node: function (id) { var n = byId[id]; return n && { id: n.id, on: n.on, x: n.x, y: n.y, sx: n.sx, sy: n.sy, sr: n.sr, tier: n.tier, op: n.op }; },
    counts: function () {
      return { nodes: nodes.filter(function (n) { return n.on; }).length, edges: edges.filter(function (e) { return e.on; }).length,
        particles: edges.reduce(function (s, e) { return s + (e.on ? e.parts.reduce(function (a, p) { return a + p.n; }, 0) : 0); }, 0) };
    },
    setSeverity: function (sev, qj) {
      Object.keys(sev).forEach(function (k) { state.sev[k] = sev[k]; if (sliderEls[k]) { sliderEls[k].input.value = Math.round(sev[k] * 100); sliderEls[k].paint(); } });
      if (qj != null) { state.qj = qj; qjEl.checked = qj; }
      runModel(); applyStyle(); updateLive();
    }
  };
})();
