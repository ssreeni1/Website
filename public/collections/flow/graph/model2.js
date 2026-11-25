/* Kings Don't Buy Flow, graph edition: combined-severity stress model.
   A generalisation of ../js/model.js. Every parameter is read from KDBF_DATA.model;
   nothing here hard-codes an outcome.

   combined exposure(n) = Σ_s severity_s × exposure_s(n)          s ∈ stress scenarios in model.json
     exposure_s(n)      = role scale × ( Σ weight × attribute + Σ weight × attribute A × attribute B )
   Cayman QJ relief (toggle): for nodes with a live reinsures_to / regulated_by link to the scenario's
     requires_link_to jurisdiction, the collateral-call term becomes
     severity_ag55 × max(0, exposure_ag55(n) − relief(n)), relief(n) = role scale × Σ relief weight × attribute.
     It can only lower an exposure, and propagation is monotone, so relief never raises stress.
   Then exactly the rules of model.json: mitigation, damped propagation (iterations), backstops take the
   largest single inbound path, tiers by threshold. */
(function () {
  "use strict";
  var ATTR_IDS = ["liquidity_mismatch", "packaged_credit_share", "offshore_affiliated_cession", "workout_capability", "capital_buffer"];

  function M() { return (window.KDBF_DATA || {}).model; }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function edgeLive(e) { return !e.phase || e.phase === "current"; }

  function attrMeta(id) {
    var list = (M() && M().attributes) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, label: id, phrase: id.replace(/_/g, " ") };
  }
  function scenario(id) {
    var list = (M() && M().scenarios) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* the stress scenarios that get a slider (mode stress, with at least one weight) */
  function stressScenarios() {
    return ((M() && M().scenarios) || []).filter(function (s) { return s.mode === "stress" && Object.keys(s.weights || {}).length; });
  }
  function reliefScenario() {
    return ((M() && M().scenarios) || []).filter(function (s) { return s.mode === "relief"; })[0] || null;
  }
  function roleInfo(role) { var m = M(); return (m && m.roles && m.roles[role]) || { label: role, exposure_scale: 0, scored: false }; }
  function nodeRole(n) {
    var r = roleInfo(n.role);
    if (n.scored === false) return Object.assign({}, r, { scored: false, exposure_scale: 0, unscored_reason: n.unscored_reason });
    return r;
  }
  function resolveAttrs(node) {
    var m = M() || {};
    var base = (m.role_defaults && m.role_defaults[node.role]) || {};
    var adjRoles = m.cluster_adjust_roles || [];
    var adj = (adjRoles.indexOf(node.role) >= 0 && m.clusters && m.clusters[node.cluster] && m.clusters[node.cluster].adjust) || {};
    var own = node.attrs || {};
    var out = {};
    ATTR_IDS.forEach(function (a) {
      var v = own[a] != null ? own[a] : (base[a] || 0) + (adj[a] || 0);
      out[a] = Math.round(clamp01(v) * 100) / 100;
    });
    return out;
  }
  function tierFor(v) {
    var tiers = (M() && M().tiers) || [];
    var t = 0;
    tiers.forEach(function (x) { if (x.min > 0 && v >= x.min) t = Math.max(t, x.tier); });
    return t;
  }
  function tierLabel(t) {
    var tiers = (M() && M().tiers) || [];
    for (var i = 0; i < tiers.length; i++) if (tiers[i].tier === t) return tiers[i].label;
    return String(t);
  }
  function level(v) { return v >= 0.6 ? "high" : v >= 0.35 ? "moderate" : "low"; }

  /* exposure terms of one scenario for one node (before severity) */
  function terms(sc, a, scale) {
    var out = [];
    Object.keys(sc.weights || {}).forEach(function (k) {
      var c = scale * sc.weights[k] * (a[k] || 0);
      if (c > 0) out.push({ kind: "attr", attr: k, value: a[k], c: c });
    });
    (sc.interactions || []).forEach(function (it) {
      var c = scale * it.weight * (a[it.attrs[0]] || 0) * (a[it.attrs[1]] || 0);
      if (c > 0) out.push({ kind: "pair", attrs: it.attrs, phrase: it.phrase, c: c });
    });
    return out;
  }

  /* sev: { scenarioId: 0..1 }, qj: boolean */
  function run(sev, qj) {
    var D = window.KDBF_DATA || {};
    var m = M();
    var ns = D.nodes || [], es = D.edges || [];
    if (!m) return { byId: {}, list: [], flows: [] };
    sev = sev || {};
    var mit = m.mitigation;
    var rules = (m.propagation && m.propagation.rules) || {};
    var iters = (m.propagation && m.propagation.iterations) || 3;
    var byId = {};
    ns.forEach(function (n) { byId[n.id] = n; });

    var stress = stressScenarios();
    var relief = qj ? reliefScenario() : null;
    var collateral = relief ? stress.filter(function (s) { return (s.channels || []).indexOf(relief.requires_link_to) >= 0; })[0] : null;
    var linked = {};
    if (relief && relief.requires_link_to) {
      es.forEach(function (e) {
        if ((e.type === "regulated_by" || e.type === "reinsures_to") && e.target === relief.requires_link_to && edgeLive(e)) linked[e.source] = true;
      });
    }

    var incoming = {};
    ns.forEach(function (n) { incoming[n.id] = []; });
    es.forEach(function (e) {
      if (!e.propagates || !edgeLive(e)) return;
      var r = rules[e.type];
      if (!r || !byId[e.source] || !byId[e.target]) return;
      var from = r.direction === "target_to_source" ? e.target : e.source;
      var to = r.direction === "target_to_source" ? e.source : e.target;
      incoming[to].push({ from: from, edge: e, damping: r.damping, phrase: r.phrase });
    });

    var info = {};
    ns.forEach(function (n) {
      var a = resolveAttrs(n);
      var role = nodeRole(n);
      var scale = role.exposure_scale || 0;
      var parts = [];
      var exposure = 0;
      if (scale > 0) {
        stress.forEach(function (sc) {
          var w = clamp01(+sev[sc.id] || 0);
          if (!w) return;
          var ts = terms(sc, a, scale);
          var raw = ts.reduce(function (s, t) { return s + t.c; }, 0);
          var eff = raw, cut = 0;
          if (collateral && sc.id === collateral.id && linked[n.id]) {
            var rel = terms(relief, a, scale).reduce(function (s, t) { return s + t.c; }, 0);
            eff = Math.max(0, raw - rel);
            cut = raw - eff;
          }
          var scaleBack = raw > 0 ? eff / raw : 0;
          ts.forEach(function (t) { parts.push({ sc: sc, t: t, c: w * t.c * scaleBack }); });
          if (cut > 0) parts.push({ sc: relief, relief: true, c: -w * cut });
          exposure += w * eff;
        });
      }
      var mitigation = (1 - mit.workout_capability * a.workout_capability) * (1 - mit.capital_buffer * a.capital_buffer);
      if (!role.scored) mitigation = 0;
      info[n.id] = { node: n, role: role, attrs: a, parts: parts, exposure: exposure, mitigation: mitigation,
        value: clamp01(exposure * mitigation), inc: [], inboundMax: role.inbound === "max" };
    });

    for (var k = 0; k < iters; k++) {
      var next = {};
      ns.forEach(function (n) {
        var I = info[n.id];
        var inc = incoming[n.id].map(function (ch) {
          return { from: ch.from, edge: ch.edge, phrase: ch.phrase, c: ch.damping * info[ch.from].value };
        });
        var sum = I.inboundMax
          ? inc.reduce(function (s, x) { return Math.max(s, x.c); }, 0)
          : inc.reduce(function (s, x) { return s + x.c; }, 0);
        if (I.inboundMax) inc.forEach(function (x) { x.top = x.c > 0 && x.c === sum; });
        next[n.id] = { value: clamp01((I.exposure + sum) * I.mitigation), inc: inc };
      });
      ns.forEach(function (n) { info[n.id].value = next[n.id].value; info[n.id].inc = next[n.id].inc; });
    }

    var channels = {};
    stress.forEach(function (sc) { if (+sev[sc.id] > 0) (sc.channels || []).forEach(function (c) { channels[c] = true; }); });

    var out = {}, list = [], flows = [];
    ns.forEach(function (n) {
      var I = info[n.id];
      var v = Math.round(I.value * 1000) / 1000;
      var tier = I.role.scored ? tierFor(v) : 0;
      I.inc.forEach(function (x) {
        var amt = x.c * I.mitigation;
        if (amt >= 0.02 && (!I.inboundMax || x.top)) flows.push({ from: x.from, to: n.id, edge_id: x.edge.id, amount: Math.round(amt * 1000) / 1000 });
      });
      var r = {
        id: n.id, scored: !!I.role.scored, archetype: !!n.archetype, role: n.role,
        stress: v, tier: tier, channel: !!channels[n.id], relieved: !!(relief && linked[n.id] && I.parts.some(function (p) { return p.relief; })),
        drivers: drivers(n, I, tier, byId, channels), attrs: I.attrs
      };
      out[n.id] = r; list.push(r);
    });
    return { byId: out, list: list, flows: flows };
  }

  function drivers(n, I, tier, byId, channels) {
    var out = [];
    var role = I.role;
    if (!role.scored) {
      if (role.unscored_reason) return [role.unscored_reason];
      if (channels[n.id]) return [n.role === "jurisdiction" ? "channel: the collateral call runs through its rules" : "channel for this shock"];
      return [n.role === "jurisdiction" ? "not scored: a rule-setter, not a holder of risk" : "not scored: sells loans, does not hold the risk here"];
    }
    var own = n.attrs || {};
    var est = (!n.archetype && !Object.keys(own).length) ? " (role default, est.)" : " (est.)";
    if (n.role === "backstop") {
      var top = I.inc.filter(function (x) { return x.top && x.c >= 0.02; })[0];
      if (!top) return ["no losses passed on at these settings"];
      var tl = (byId[top.from] && (byId[top.from].short || byId[top.from].label)) || top.from;
      var hyp = I.inc.some(function (x) { return x.c >= 0.02 && x.edge.illustrative; });
      out.push("largest single path: " + (top.phrase || "from {label}").replace("{label}", tl));
      out.push(hyp ? "exposed only if insurers are liquidated; most paths here are hypothetical" : "exposed only if insurers are liquidated");
      out.push("takes the largest path, not the sum (model rule)");
      return out;
    }
    var items = [];
    // collapse the parts of each scenario into one line naming its biggest term
    var bySc = {};
    I.parts.forEach(function (p) {
      if (p.relief) { items.push({ c: 0.001, s: "Cayman trusted status lowers its collateral call (it is linked to Cayman)" }); return; }
      var k = p.sc.id;
      bySc[k] = bySc[k] || { sc: p.sc, c: 0, top: null };
      bySc[k].c += p.c;
      if (!bySc[k].top || p.c > bySc[k].top.c) bySc[k].top = p;
    });
    Object.keys(bySc).forEach(function (k) {
      var g = bySc[k], c = g.c * I.mitigation;
      if (c < 0.03 || !g.top) return;
      var t = g.top.t;
      var what = t.kind === "attr"
        ? level(t.value) + " " + attrMeta(t.attr).phrase + (own[t.attr] != null && !n.archetype ? " (set for this node, est.)" : est)
        : t.phrase + est;
      items.push({ c: c, s: g.sc.short + ": " + what });
    });
    I.inc.forEach(function (x) {
      var c = x.c * I.mitigation;
      if (c < 0.02 || (I.inboundMax && !x.top)) return;
      var label = (byId[x.from] && (byId[x.from].short || byId[x.from].label)) || x.from;
      items.push({ c: c, s: (x.phrase || "passed from {label}").replace("{label}", label) });
    });
    items.sort(function (p, q) { return q.c - p.c; });
    items.slice(0, 3).forEach(function (x) { out.push(x.s); });
    var a = I.attrs;
    if (I.exposure > 0.04 || I.inc.some(function (x) { return x.c > 0; })) {
      if (a.workout_capability >= 0.6) out.push("dampened by " + attrMeta("workout_capability").phrase + est);
      if (a.capital_buffer >= 0.6) out.push("dampened by capital buffer" + est);
      else if (a.capital_buffer <= 0.2 && tier >= 2) out.push("thin capital buffer" + (own.capital_buffer != null && !n.archetype ? " (set for this node, est.)" : est));
    }
    if (!out.length) out.push("little exposure at these settings (est.)");
    return out.slice(0, 4);
  }

  window.KDBF_MODEL2 = {
    run: run,
    resolveAttrs: resolveAttrs,
    tierLabel: tierLabel,
    nodeRole: nodeRole,
    roleInfo: roleInfo,
    attrMeta: attrMeta,
    scenario: scenario,
    stressScenarios: stressScenarios,
    reliefScenario: reliefScenario,
    edgeLive: edgeLive
  };
})();
