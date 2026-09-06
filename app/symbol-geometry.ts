import * as THREE from "three";

/**
 * Authored, illustrative symbolic forms — not scans of historical artifacts.
 * Phoenix: long plumage / separated flight feathers, informed by
 * https://www.metmuseum.org/art/collection/search/446207
 * Ouroboros: a serpent whose tapered tail enters its mouth, informed by
 * https://www.britishmuseum.org/collection/object/H_1986-0501-147
 * Gandiva: Arjuna's bow; the exact profile below is an artistic interpretation.
 * https://sacred-texts.com/hin/m04/m04043.htm (Ganguli translation, Virata 43).
 * Geometry and ornament are original. References accessed 2026-09-05.
 */
export const SYMBOL_FEATURE_PATH_COUNT = 160;
export const SYMBOL_FEATURE_SAMPLES = 64;
type V = THREE.Vector3;
type Path = V[];
export type SymbolName = "PHOENIX" | "OUROBOROS" | "GANDIVA";
export type SymbolForm = { name: SymbolName; paths: Path[]; positions: Float32Array };
const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const curve = (fn: (t: number) => V, n = SYMBOL_FEATURE_SAMPLES): Path =>
  Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
const smooth = (points: V[], closed = false): Path => {
  const spline = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  return curve((t) => spline.getPoint(t));
};
const straight = (a: V, b: V): Path => curve((t) => a.clone().lerp(b, t));
const ellipse = (c: V, a: V, b: V): Path => curve((t) =>
  c.clone().addScaledVector(a, Math.cos(TAU * t)).addScaledVector(b, Math.sin(TAU * t)),
);

function ellipsoid(paths: Path[], c: V, r: V, meridians: number, rings: number) {
  for (let i = 0; i < meridians; i += 1) {
    const a = TAU * i / meridians;
    paths.push(curve((t) => v(
      c.x + r.x * Math.sin(Math.PI * t) * Math.cos(a),
      c.y + r.y * Math.cos(Math.PI * t),
      c.z + r.z * Math.sin(Math.PI * t) * Math.sin(a),
    )));
  }
  for (let i = 1; i <= rings; i += 1) {
    const a = Math.PI * i / (rings + 1);
    paths.push(ellipse(v(c.x, c.y + r.y * Math.cos(a), c.z),
      v(r.x * Math.sin(a), 0), v(0, 0, r.z * Math.sin(a))));
  }
}

/** Separate convex feather vanes and a quill; no zigzag across unrelated feathers. */
function feather(paths: Path[], start: V, tip: V, width: number, arch: number) {
  const axis = tip.clone().sub(start);
  const normal = v(-axis.y, axis.x).normalize();
  const spine = (t: number) => start.clone().lerp(tip, t).add(v(0, 0, Math.sin(Math.PI * t) * arch));
  paths.push(curve((u) => {
    const t = u <= 0.5 ? u * 2 : 2 - u * 2;
    const side = u <= 0.5 ? 1 : -1;
    return spine(t).addScaledVector(normal, side * width * Math.pow(Math.sin(Math.PI * t), 0.8));
  }));
  paths.push(curve(spine));
}

function phoenix(): Path[] {
  const paths: Path[] = [];
  ellipsoid(paths, v(0, 0.1, 0.28), v(0.44, 1.24, 0.54), 8, 6);
  // A distinct neck and head break the old leaf-like symmetry.
  const neck = new THREE.CatmullRomCurve3([v(0, 1.02, 0.28), v(-0.12, 1.62, 0.2), v(0.12, 2.05, 0.18)]);
  for (let i = 0; i < 6; i += 1) {
    const a = i * TAU / 6;
    paths.push(curve((t) => neck.getPoint(t).add(v(Math.cos(a) * (0.22 - t * 0.04), 0, Math.sin(a) * 0.23))));
  }
  ellipsoid(paths, v(0.14, 2.22, 0.18), v(0.29, 0.37, 0.29), 6, 3);
  for (const z of [0, 0.35]) {
    paths.push(smooth([v(0.32, 2.38, z), v(0.81, 2.19, z), v(0.44, 2.08, z), v(0.32, 2.38, z)]));
    paths.push(ellipse(v(0.23, 2.33, z + 0.12), v(0.06, 0), v(0, 0.06)));
  }
  for (let i = 0; i < 3; i += 1) {
    feather(paths, v(-0.02 + i * 0.1, 2.45, 0.12), v(-0.48 + i * 0.3, 3.05 + 0.15 * (i === 1 ? 1 : 0), 0.02), 0.055, 0.06);
  }
  for (const side of [-1, 1]) {
    const p = (x: number, y: number, z: number) => v(x * side, y, z);
    // Bony leading edge and raised mantle give wings depth from an orbit view.
    paths.push(smooth([p(0.23, 1.0, 0.32), p(1.18, 1.47, 0.28), p(2.06, 2.15, -0.05), p(2.87, 2.71, -0.24)]));
    paths.push(smooth([p(0.26, 0.87, -0.08), p(1.14, 1.26, -0.16), p(2.07, 1.94, -0.3), p(2.87, 2.71, -0.24)]));
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      feather(paths, p(1.45 + t * 1.15, 1.34 + t * 0.92, -0.03 - t * 0.14),
        p(3.64 - 0.66 * t + 0.17 * Math.sin(t * Math.PI), 0.35 + 2.8 * t, -0.56 + 0.22 * t),
        0.14, 0.12);
    }
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      feather(paths, p(0.36 + 1.05 * t, 0.96 + t * 0.28, 0.14),
        p(0.94 + 1.65 * t, -0.52 + t * 0.57, -0.11 - t * 0.17), 0.19, 0.18);
    }
    for (let i = 0; i < 4; i += 1) {
      const t = i / 3;
      feather(paths, p(0.38 + t * 1.3, 1.01 + t * 0.72, 0.28),
        p(0.97 + t * 1.42, 0.65 + t * 0.73, 0.15), 0.12, 0.12);
    }
    // Legs and curved talons anchor the anatomy without broadening its silhouette.
    paths.push(smooth([p(0.21, -0.7, 0.25), p(0.38, -1.18, 0.32), p(0.57, -1.38, 0.46)]));
    for (let i = 0; i < 2; i += 1) paths.push(smooth([p(0.53, -1.35, 0.43), p(0.7 + i * 0.11, -1.46, 0.47), p(0.66 + i * 0.11, -1.6, 0.44)]));
  }
  for (let i = -3; i <= 3; i += 1) {
    feather(paths, v(i * 0.055, -0.86, 0.15),
      v(i * 0.48, -3.6 + Math.abs(i) * 0.36, -0.28 + Math.abs(i) * 0.04), 0.16, 0.34);
  }
  return paths;
}

function ouroboros(): Path[] {
  const paths: Path[] = [];
  // One tapered tube. Its tail travels into the open jaw at the top-right.
  const body = (t: number, phase: number) => {
    const a = 0.32 + t * (TAU - 0.18);
    const radius = 0.43 * (1 - 0.92 * Math.pow(t, 5));
    return v((2.72 + Math.cos(phase) * radius) * Math.cos(a),
      (2.72 + Math.cos(phase) * radius) * Math.sin(a),
      Math.sin(phase) * radius + 0.09 * Math.sin(a * 2));
  };
  for (let i = 0; i < 12; i += 1) paths.push(curve((t) => body(t, i * TAU / 12)));
  for (let i = 0; i < 44; i += 1) paths.push(curve((u) => body(i / 44, TAU * u)));
  // Short diamond scales run along the outside, rather than concentric rings.
  for (let i = 0; i < 32; i += 1) {
    const t = 0.03 + i * 0.9 / 32;
    for (const phase of [0.62, Math.PI - 0.62]) {
      paths.push(smooth([body(t, phase), body(t + 0.011, phase + 0.37), body(t + 0.022, phase), body(t + 0.011, phase - 0.37)], true));
    }
  }
  // A short, faceted serpent skull, continuous with the neck's radial frame.
  // Flatten and taper towards a blunt snout instead of capping an oval head
  // with rounded jaw loops. The returning tail ends inside the mouth volume.
  const neckAngle = 0.32;
  const origin = v(2.72 * Math.cos(neckAngle), 2.72 * Math.sin(neckAngle), 0.09 * Math.sin(neckAngle * 2));
  const outward = v(Math.cos(neckAngle), Math.sin(neckAngle));
  const forward = v(Math.sin(neckAngle), -Math.cos(neckAngle));
  const sections = [
    { s: 0, width: 0.43, depth: 0.43 },
    { s: 0.17, width: 0.49, depth: 0.32 },
    { s: 0.4, width: 0.35, depth: 0.22 },
    { s: 0.67, width: 0.21, depth: 0.12 },
    { s: 0.71, width: 0.2, depth: 0.1 },
  ];
  const headPoint = (s: number, phase: number) => {
    let i = 0;
    while (i < sections.length - 2 && sections[i + 1].s < s) i += 1;
    const a = sections[i], b = sections[i + 1];
    const t = THREE.MathUtils.clamp((s - a.s) / (b.s - a.s), 0, 1);
    const width = THREE.MathUtils.lerp(a.width, b.width, t);
    const depth = THREE.MathUtils.lerp(a.depth, b.depth, t);
    const sector = phase / (TAU / 8), corner = Math.floor(sector);
    const angleA = corner * TAU / 8, angleB = (corner + 1) * TAU / 8;
    return origin.clone().addScaledVector(forward, s)
      .addScaledVector(outward, width * THREE.MathUtils.lerp(Math.cos(angleA), Math.cos(angleB), sector - corner))
      .add(v(0, 0, depth * THREE.MathUtils.lerp(Math.sin(angleA), Math.sin(angleB), sector - corner)));
  };
  for (let i = 0; i < 8; i += 1) paths.push(sections.map(({ s }) => headPoint(s, i * TAU / 8)));
  for (const { s } of sections) paths.push(Array.from({ length: 9 }, (_, i) => headPoint(s, i * TAU / 8)));
  for (const side of [1, -1]) {
    const phase = (angle: number) => side === 1 ? angle : Math.PI - angle;
    // Almond eyes, narrow pupils and brows lie on the same faceted surface.
    paths.push(curve((t) => headPoint(0.23 + 0.08 * Math.cos(TAU * t), phase(0.86 + 0.2 * Math.sin(TAU * t)))));
    paths.push(curve((t) => headPoint(0.185 + t * 0.09, phase(0.86))));
    paths.push(curve((t) => headPoint(0.12 + t * 0.19, phase(1.13 - 0.08 * t))));
    // Recessed-looking lip seams replace the oversized, protruding jaw loops.
    paths.push(curve((t) => headPoint(0.22 + t * 0.49, phase(0.18))));
  }
  paths.push(straight(headPoint(0.71, 0.18), headPoint(0.71, Math.PI - 0.18)));
  paths.push(straight(headPoint(0.71, Math.PI / 2), headPoint(0.71, -Math.PI / 2)));
  return paths;
}

function gandiva(): Path[] {
  const paths: Path[] = [];
  // Recurved limbs, single tensioned string, and arrow nock share exact anchors.
  // Profile is authored; the textual tradition does not specify a measurable CAD shape.
  const limb = new THREE.CatmullRomCurve3([
    v(-0.17, -3.4), v(0.37, -2.93), v(0.6, -2.43), v(0.17, -1.63),
    v(-0.53, -0.62), v(-0.62, 0), v(-0.53, 0.62), v(0.17, 1.63),
    v(0.6, 2.43), v(0.37, 2.93), v(-0.17, 3.4),
  ], false, "centripetal");
  const bowPoint = (t: number, phase: number) => {
    const p = limb.getPoint(t);
    const tangent = limb.getTangent(t);
    const normal = v(-tangent.y, tangent.x).normalize();
    const thickness = 0.065 + 0.105 * Math.pow(Math.sin(Math.PI * t), 0.65);
    return p.addScaledVector(normal, Math.cos(phase) * thickness).add(v(0, 0, Math.sin(phase) * thickness * 0.85));
  };
  for (let i = 0; i < 8; i += 1) paths.push(curve((t) => bowPoint(t, i * TAU / 8)));
  for (let i = 0; i < 34; i += 1) paths.push(curve((u) => bowPoint(i / 33, u * TAU)));
  // Grip wrapping around the same limb; no disconnected casing.
  paths.push(curve((t) => bowPoint(0.425 + t * 0.15, t * TAU * 13)));
  const top = limb.getPoint(1), bottom = limb.getPoint(0), nock = v(-2.34, 0, 0);
  paths.push(straight(top, nock), straight(nock, bottom));
  // Shaft is a slim 3D cylinder, centered on the string nock and bow grip.
  for (let i = 0; i < 6; i += 1) {
    const a = i * TAU / 6;
    paths.push(straight(v(nock.x, Math.cos(a) * 0.045, Math.sin(a) * 0.045), v(3.02, Math.cos(a) * 0.045, Math.sin(a) * 0.045)));
  }
  const tip = v(3.65, 0), arrowBase = v(2.82, 0);
  for (let i = 0; i < 4; i += 1) {
    const a = i * Math.PI / 2;
    const corner = v(2.91, Math.cos(a) * 0.28, Math.sin(a) * 0.28);
    paths.push(straight(tip, corner), straight(corner, arrowBase));
  }
  for (let i = 0; i < 3; i += 1) {
    const a = i * TAU / 3;
    const radial = v(0, Math.cos(a), Math.sin(a));
    const points = [v(-2.21, 0), v(-2.36, 0).addScaledVector(radial, 0.32), v(-1.64, 0).addScaledVector(radial, 0.28), v(-1.35, 0)];
    paths.push(smooth(points, true));
    for (let j = 0; j < 7; j += 1) {
      const t = j / 6;
      paths.push(straight(v(-2.23 + t * 0.63, 0), v(-2.25 + t * 0.72, 0).addScaledVector(radial, 0.28)));
    }
  }
  // Symmetric ornamental incisions are attached to the bow surface.
  for (const side of [0.17, 0.65]) {
    for (let i = 0; i < 12; i += 1) {
      const t = side + i * 0.015;
      paths.push(curve((u) => bowPoint(t + Math.sin(TAU * u) * 0.006, Math.PI / 2 + Math.cos(TAU * u) * 0.48)));
    }
  }
  return paths;
}

function finish(name: SymbolName, input: Path[]): SymbolForm {
  // Split longest paths to equalize topology for morphing. Never pad with floating lines.
  const paths = input.map((path) => path.map((p) => p.clone()));
  const length = (path: Path) => path.reduce((sum, p, i) => sum + (i ? p.distanceTo(path[i - 1]) : 0), 0);
  if (paths.length > SYMBOL_FEATURE_PATH_COUNT) throw new Error(`${name} exceeds feature budget (${paths.length})`);
  while (paths.length < SYMBOL_FEATURE_PATH_COUNT) {
    let longest = 0;
    for (let i = 1; i < paths.length; i += 1) if (length(paths[i]) > length(paths[longest])) longest = i;
    const path = paths[longest], middle = Math.floor(path.length / 2);
    paths.splice(longest, 1, path.slice(0, middle + 1), path.slice(middle));
  }
  const sampled = paths.map((path) => {
    const cumulative = [0];
    for (let i = 1; i < path.length; i += 1) cumulative.push(cumulative[i - 1] + path[i].distanceTo(path[i - 1]));
    return curve((t) => {
      const d = t * cumulative[cumulative.length - 1];
      let index = 0;
      while (index < path.length - 2 && cumulative[index + 1] < d) index += 1;
      return path[index].clone().lerp(path[index + 1], (d - cumulative[index]) / Math.max(1e-8, cumulative[index + 1] - cumulative[index]));
    });
  });
  const positions = new Float32Array(SYMBOL_FEATURE_PATH_COUNT * SYMBOL_FEATURE_SAMPLES * 3);
  sampled.flat().forEach((p, i) => p.toArray(positions, i * 3));
  return { name, paths: sampled, positions };
}

export function buildSymbolForms(): SymbolForm[] {
  return [finish("PHOENIX", phoenix()), finish("OUROBOROS", ouroboros()), finish("GANDIVA", gandiva())];
}
