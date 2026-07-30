"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type VisualMode = 1 | 2;

type CarSample = {
  t: number;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: number | null;
};

type LocationSample = {
  t: number;
  x: number;
  y: number;
  z: number;
};

type TelemetryData = {
  source: {
    name: string;
    sessionKey: number;
    driver: string;
    driverNumber: number;
    lap: number;
    lapDurationMs: number;
    replayRate: number;
  };
  car: CarSample[];
  location: LocationSample[];
};

type SampleWindow<T> = {
  a: T;
  b: T;
  mix: number;
  index: number;
};

type SceneController = {
  root: THREE.Group;
  update: (
    elapsed: number,
    delta: number,
    view: SceneView,
  ) => void;
};

type SceneView = {
  yaw: number;
  pitch: number;
  distance: number;
};

type SmoothLocation = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  index: number;
};

const INK = 0x171717;
const PAPER = 0xf6f6f3;
const RED = 0xf02b1d;
const MUTED = 0xa6a69f;

function setHud(
  root: HTMLDivElement | null,
  key: string,
  value: string,
) {
  const node = root?.querySelector<HTMLElement>(`[data-hud="${key}"]`);
  if (node && node.textContent !== value) node.textContent = value;
}

function setHudWidth(
  root: HTMLDivElement | null,
  key: string,
  value: number,
) {
  const node = root?.querySelector<HTMLElement>(`[data-hud="${key}"]`);
  if (node) node.style.width = `${THREE.MathUtils.clamp(value, 0, 100)}%`;
}

function sampleWindow<T extends { t: number }>(
  samples: T[],
  time: number,
): SampleWindow<T> {
  let low = 0;
  let high = samples.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (samples[middle].t <= time) low = middle;
    else high = middle - 1;
  }

  const index = Math.min(low, samples.length - 2);
  const a = samples[index];
  const b = samples[index + 1] ?? a;
  const duration = Math.max(1, b.t - a.t);
  return {
    a,
    b,
    mix: THREE.MathUtils.clamp((time - a.t) / duration, 0, 1),
    index,
  };
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * amount;
}

function smoothLocation(
  samples: LocationSample[],
  time: number,
  lapDuration: number,
): SmoothLocation {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (time <= first.t) {
    const next = samples[1] ?? first;
    return {
      x: first.x,
      y: first.y,
      dx: next.x - first.x,
      dy: next.y - first.y,
      index: 0,
    };
  }

  let index: number;
  let p0: LocationSample;
  let p1: LocationSample;
  let p2: LocationSample;
  let p3: LocationSample;
  let segmentStart: number;
  let segmentEnd: number;

  if (time >= last.t) {
    index = samples.length - 1;
    p0 = samples[Math.max(0, samples.length - 2)];
    p1 = last;
    p2 = { ...first, t: lapDuration };
    const second = samples[1] ?? first;
    p3 = {
      ...second,
      t: lapDuration + Math.max(1, second.t - first.t),
    };
    segmentStart = last.t;
    segmentEnd = lapDuration;
  } else {
    const window = sampleWindow(samples, time);
    index = window.index;
    p0 = samples[Math.max(0, index - 1)];
    p1 = samples[index];
    p2 = samples[index + 1];
    p3 =
      index + 2 < samples.length
        ? samples[index + 2]
        : { ...first, t: lapDuration };
    segmentStart = p1.t;
    segmentEnd = p2.t;
  }

  const duration = Math.max(1, segmentEnd - segmentStart);
  const amount = THREE.MathUtils.clamp(
    (time - segmentStart) / duration,
    0,
    1,
  );
  const amount2 = amount * amount;
  const amount3 = amount2 * amount;
  const h00 = 2 * amount3 - 3 * amount2 + 1;
  const h10 = amount3 - 2 * amount2 + amount;
  const h01 = -2 * amount3 + 3 * amount2;
  const h11 = amount3 - amount2;
  const dh00 = 6 * amount2 - 6 * amount;
  const dh10 = 3 * amount2 - 4 * amount + 1;
  const dh01 = -6 * amount2 + 6 * amount;
  const dh11 = 3 * amount2 - 2 * amount;
  const p0Time = p0.t > p1.t ? p0.t - lapDuration : p0.t;
  const p3Time = p3.t < p2.t ? p3.t + lapDuration : p3.t;
  const tangent1Scale = Math.max(1, p2.t - p0Time);
  const tangent2Scale = Math.max(1, p3Time - p1.t);
  const tangent1X = (p2.x - p0.x) / tangent1Scale;
  const tangent1Y = (p2.y - p0.y) / tangent1Scale;
  const tangent2X = (p3.x - p1.x) / tangent2Scale;
  const tangent2Y = (p3.y - p1.y) / tangent2Scale;

  return {
    x:
      h00 * p1.x +
      h10 * duration * tangent1X +
      h01 * p2.x +
      h11 * duration * tangent2X,
    y:
      h00 * p1.y +
      h10 * duration * tangent1Y +
      h01 * p2.y +
      h11 * duration * tangent2Y,
    dx:
      dh00 * p1.x +
      dh10 * duration * tangent1X +
      dh01 * p2.x +
      dh11 * duration * tangent2X,
    dy:
      dh00 * p1.y +
      dh10 * duration * tangent1Y +
      dh01 * p2.y +
      dh11 * duration * tangent2Y,
    index,
  };
}

function lineFromPoints(
  points: THREE.Vector3[],
  color = INK,
  opacity = 0.5,
) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
}

function technicalSolid(
  geometry: THREE.BufferGeometry,
  {
    color = PAPER,
    edgeColor = INK,
    opacity = 0.95,
    edgeOpacity = 0.62,
    threshold = 24,
  }: {
    color?: number;
    edgeColor?: number;
    opacity?: number;
    edgeOpacity?: number;
    threshold?: number;
  } = {},
) {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.93,
      metalness: 0.02,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: opacity > 0.5,
    }),
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, threshold),
    new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: edgeOpacity,
      depthWrite: false,
    }),
  );
  group.add(fill, edges);
  return group;
}

function addFormulaLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(PAPER, 0xb5b5af, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(-4, 8, -6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(RED, 0.9);
  rim.position.set(7, 3, 5);
  scene.add(rim);
}

function buildRoadRibbon(locations: LocationSample[]) {
  const sampleCount = locations.length;
  const xs = locations.map((point) => point.x);
  const ys = locations.map((point) => point.y);
  const originX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const originY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const coordinateScale = 0.1;
  const roadHalfWidth = 7.5;
  const centerPoints = locations.map(
    (point) =>
      new THREE.Vector3(
        (point.x - originX) * coordinateScale,
        0,
        (point.y - originY) * coordinateScale,
      ),
  );
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(sampleCount * 2 * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const indices: number[] = [];

  const leftPoints: THREE.Vector3[] = [];
  const rightPoints: THREE.Vector3[] = [];
  centerPoints.forEach((point, index) => {
    const previous =
      centerPoints[(index - 1 + centerPoints.length) % centerPoints.length];
    const next = centerPoints[(index + 1) % centerPoints.length];
    const tangentX = next.x - previous.x;
    const tangentZ = next.z - previous.z;
    const length = Math.max(0.001, Math.hypot(tangentX, tangentZ));
    const normalX = -tangentZ / length;
    const normalZ = tangentX / length;
    const left = new THREE.Vector3(
      point.x + normalX * roadHalfWidth,
      -0.04,
      point.z + normalZ * roadHalfWidth,
    );
    const right = new THREE.Vector3(
      point.x - normalX * roadHalfWidth,
      -0.04,
      point.z - normalZ * roadHalfWidth,
    );
    leftPoints.push(left);
    rightPoints.push(right);
    positions.set([left.x, left.y, left.z], index * 6);
    positions.set([right.x, right.y, right.z], index * 6 + 3);
  });

  for (let i = 0; i < sampleCount - 1; i += 1) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const finalBase = (sampleCount - 1) * 2;
  indices.push(finalBase, finalBase + 1, 0, finalBase + 1, 1, 0);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xe4e4de,
      transparent: true,
      opacity: 0.52,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const left = lineFromPoints([...leftPoints, leftPoints[0]], INK, 0.34);
  const right = lineFromPoints([...rightPoints, rightPoints[0]], INK, 0.34);
  const minorTickPoints: THREE.Vector3[] = [];
  const sectorTickPoints: THREE.Vector3[] = [];
  for (let index = 0; index < centerPoints.length; index += 4) {
    const target =
      index % 20 === 0 ? sectorTickPoints : minorTickPoints;
    const leftInner = leftPoints[index].clone().lerp(rightPoints[index], 0.07);
    const rightInner = rightPoints[index].clone().lerp(leftPoints[index], 0.07);
    target.push(
      leftPoints[index].clone().setY(-0.018),
      leftInner.setY(-0.018),
      rightPoints[index].clone().setY(-0.018),
      rightInner.setY(-0.018),
    );
  }
  const minorTicks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(minorTickPoints),
    new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  const sectorTicks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(sectorTickPoints),
    new THREE.LineBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    }),
  );
  const center = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      ...centerPoints,
      centerPoints[0],
    ]),
    new THREE.LineDashedMaterial({
      color: RED,
      dashSize: 3.2,
      gapSize: 5.2,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  center.computeLineDistances();
  center.position.y = -0.025;
  return {
    mesh,
    left,
    right,
    center,
    minorTicks,
    sectorTicks,
    originX,
    originY,
  };
}

function drawTrackMap(
  canvas: HTMLCanvasElement | null,
  locations: LocationSample[],
  activeIndex: number,
) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);

  const xs = locations.map((point) => point.x);
  const ys = locations.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 9 * dpr;
  const scale = Math.min(
    (width - padding * 2) / Math.max(1, maxX - minX),
    (height - padding * 2) / Math.max(1, maxY - minY),
  );
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const project = (point: LocationSample) => ({
    x: offsetX + (point.x - minX) * scale,
    y: height - (offsetY + (point.y - minY) * scale),
  });

  context.beginPath();
  locations.forEach((point, index) => {
    const projected = project(point);
    if (index === 0) context.moveTo(projected.x, projected.y);
    else context.lineTo(projected.x, projected.y);
  });
  context.closePath();
  context.lineWidth = Math.max(1, dpr * 0.8);
  context.strokeStyle = "rgba(23,23,23,.42)";
  context.stroke();

  const active = project(locations[Math.min(activeIndex, locations.length - 1)]);
  context.beginPath();
  context.arc(active.x, active.y, 2.5 * dpr, 0, Math.PI * 2);
  context.fillStyle = "#f02b1d";
  context.fill();
}

async function buildFormulaScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  hudRoot: HTMLDivElement | null,
  trackCanvas: HTMLCanvasElement | null,
): Promise<SceneController> {
  setHud(hudRoot, "model-state", "LOADING / GEOMETRY + LAP");
  addFormulaLights(scene);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [gltf, telemetry] = await Promise.all([
    loader.loadAsync("/models/formula1.glb"),
    fetch("/data/silverstone-antonelli-l18.json").then(
      (response) => response.json() as Promise<TelemetryData>,
    ),
  ]);

  const root = new THREE.Group();
  const carRig = new THREE.Group();
  root.add(carRig);
  scene.add(root);

  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  carRig.add(model);
  const frontWheels = model.getObjectByName("front_wheels_7");
  const rearWheels = model.getObjectByName("back_wheels_1");
  const frontWheelBaseRotation = frontWheels?.rotation.x ?? 0;
  const rearWheelBaseRotation = rearWheels?.rotation.x ?? 0;

  const shellMaterials: Array<{
    material: THREE.MeshStandardMaterial;
    baseOpacity: number;
    baseDepthWrite: boolean;
  }> = [];
  const edgeMaterials: Array<{
    material: THREE.LineBasicMaterial;
    baseOpacity: number;
    scanOpacity: number;
  }> = [];
  const sourceMeshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) sourceMeshes.push(object as THREE.Mesh);
  });

  sourceMeshes.forEach((mesh) => {
    const existing = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    const role = existing?.name ?? "body";
    const isWheel = role.includes("wheel");
    const isGlass = role.includes("glass");
    const isInterior = role.includes("interior") || role.includes("bottom");
    const baseOpacity = isWheel
      ? 0.74
      : isInterior
        ? 0.12
        : isGlass
          ? 0.08
          : 0.24;
    const baseDepthWrite = !isGlass;
    const material = new THREE.MeshStandardMaterial({
      color: isWheel ? 0x282828 : isInterior ? 0x565652 : 0x3b3b39,
      roughness: isWheel ? 0.82 : 0.62,
      metalness: isInterior ? 0.28 : 0.08,
      transparent: true,
      opacity: baseOpacity,
      side: THREE.DoubleSide,
      depthWrite: baseDepthWrite,
    });
    mesh.material = material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shellMaterials.push({ material, baseOpacity, baseDepthWrite });

    const edgeOpacity = isWheel
      ? 0.64
      : isInterior
        ? 0.08
        : isGlass
          ? 0.07
          : 0.52;
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: isWheel ? 0x101010 : INK,
      transparent: true,
      opacity: edgeOpacity,
      depthWrite: false,
    });
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry, isWheel ? 34 : 27),
      edgeMaterial,
    );
    mesh.add(edges);
    edgeMaterials.push({
      material: edgeMaterial,
      baseOpacity: edgeOpacity,
      scanOpacity: isWheel
        ? 0.68
        : isInterior
          ? 0.32
          : isGlass
            ? 0.12
            : 0.36,
    });
  });

  const internals = new THREE.Group();
  const component = (
    size: [number, number, number],
    position: [number, number, number],
    color = INK,
  ) => {
    const object = technicalSolid(new THREE.BoxGeometry(...size), {
      color,
      edgeColor: color === RED ? RED : INK,
      opacity: color === RED ? 0.08 : 0.045,
      edgeOpacity: color === RED ? 0.62 : 0.28,
    });
    object.position.set(...position);
    internals.add(object);
    return object;
  };
  component([0.98, 0.58, 1.35], [0, 0.55, 1.35]);
  component([0.74, 0.34, 1.05], [0, 0.3, 2.33], RED);
  component([0.42, 0.25, 2.15], [-0.76, 0.29, 0.32]);
  component([0.42, 0.25, 2.15], [0.76, 0.29, 0.32]);
  component([0.5, 0.31, 1.25], [0, 0.28, 0.1], RED);
  carRig.add(internals);

  const energyCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.18, -2.75),
    new THREE.Vector3(0, 0.36, -0.75),
    new THREE.Vector3(0, 0.55, 1.05),
    new THREE.Vector3(0, 0.35, 2.5),
  ]);
  const energyMaterial = new THREE.MeshBasicMaterial({
    color: RED,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const energyLine = new THREE.Mesh(
    new THREE.TubeGeometry(energyCurve, 80, 0.014, 6, false),
    energyMaterial,
  );
  carRig.add(energyLine);

  const brakeMaterials: THREE.MeshBasicMaterial[] = [];
  const wheelRegisters: THREE.Group[] = [];
  [
    [-1.42, 0.46, -2.25],
    [1.42, 0.46, -2.25],
    [-1.46, 0.5, 2.15],
    [1.46, 0.5, 2.15],
  ].forEach(([x, y, z]) => {
    const material = new THREE.MeshBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.032, 7, 28),
      material,
    );
    disc.rotation.y = Math.PI / 2;
    disc.position.set(x, y, z);
    carRig.add(disc);
    brakeMaterials.push(material);

    const register = new THREE.Group();
    register.position.set(x, y, z);
    const spoke = lineFromPoints(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.24, 0.13),
      ],
      RED,
      0.88,
    );
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({
        color: RED,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    register.add(spoke, hub);
    carRig.add(register);
    wheelRegisters.push(register);
  });

  const sensorPositions = [
    new THREE.Vector3(0, 0.34, -3.28),
    new THREE.Vector3(-1.43, 0.92, -2.2),
    new THREE.Vector3(1.43, 0.92, -2.2),
    new THREE.Vector3(0, 1.22, -0.25),
    new THREE.Vector3(0, 0.68, 1.62),
  ];
  const sensorMaterials: THREE.MeshBasicMaterial[] = [];
  sensorPositions.forEach((position) => {
    const material = new THREE.MeshBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const sensor = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      material,
    );
    sensor.position.copy(position);
    carRig.add(sensor);
    sensorMaterials.push(material);
  });

  const scanPlaneMaterial = new THREE.MeshBasicMaterial({
    color: RED,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.7, 1.8),
    scanPlaneMaterial,
  );
  scanPlane.position.y = 0.85;
  carRig.add(scanPlane);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 7.7),
    new THREE.MeshBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.025;
  carRig.add(contact);

  const road = buildRoadRibbon(telemetry.location);
  root.add(
    road.mesh,
    road.left,
    road.right,
    road.center,
    road.minorTicks,
    road.sectorTicks,
  );

  const trailSampleCount = 64;
  const trailPositions = new Float32Array(trailSampleCount * 3);
  const trailColors = new Float32Array(trailSampleCount * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPositions, 3),
  );
  const trailMuted = new THREE.Color(0xbdbdb6);
  const trailRed = new THREE.Color(RED);
  for (let index = 0; index < trailSampleCount; index += 1) {
    const mix = index / (trailSampleCount - 1);
    const color = trailMuted.clone().lerp(trailRed, Math.pow(mix, 1.8));
    trailColors.set([color.r, color.g, color.b], index * 3);
  }
  trailGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(trailColors, 3),
  );
  const trajectoryTrail = new THREE.Line(
    trailGeometry,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  const trajectorySamples = new THREE.Points(
    trailGeometry,
    new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  root.add(trajectoryTrail, trajectorySamples);

  const predictionSampleCount = 28;
  const predictionGeometry = new THREE.BufferGeometry().setFromPoints(
    Array.from(
      { length: predictionSampleCount },
      () => new THREE.Vector3(),
    ),
  );
  const trajectoryPrediction = new THREE.Line(
    predictionGeometry,
    new THREE.LineDashedMaterial({
      color: RED,
      dashSize: 0.42,
      gapSize: 0.34,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );
  const predictionSamples = new THREE.Points(
    predictionGeometry,
    new THREE.PointsMaterial({
      color: RED,
      size: 0.035,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  root.add(trajectoryPrediction, predictionSamples);

  const velocityGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.02, 0),
    new THREE.Vector3(0, 1.02, 2.7),
  ]);
  const velocityVector = new THREE.Line(
    velocityGeometry,
    new THREE.LineBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  carRig.add(velocityVector);

  const lateralGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.88, 0),
    new THREE.Vector3(0, 0.88, 0),
  ]);
  const lateralVector = new THREE.Line(
    lateralGeometry,
    new THREE.LineDashedMaterial({
      color: INK,
      dashSize: 0.14,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  carRig.add(lateralVector);

  const vectorOrigin = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.012, 6, 28),
    new THREE.MeshBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
  );
  vectorOrigin.rotation.x = Math.PI / 2;
  vectorOrigin.position.set(0, 1.01, 0);
  carRig.add(vectorOrigin);

  carRig.scale.setScalar(0.78);

  const firstLocation = telemetry.location[0];
  const firstDirectionTarget = telemetry.location[3] ?? firstLocation;
  const carPosition = new THREE.Vector3(
    (firstLocation.x - road.originX) * 0.1,
    0.03,
    (firstLocation.y - road.originY) * 0.1,
  );
  const forward = new THREE.Vector3(
    firstDirectionTarget.x - firstLocation.x,
    0,
    firstDirectionTarget.y - firstLocation.y,
  ).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const desiredCamera = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const displayCarPosition = carPosition.clone();
  let displayHeading = Math.atan2(forward.x, forward.z);
  const cameraLook = carPosition
    .clone()
    .add(new THREE.Vector3(0, 0.62, 0));
  carRig.position.copy(displayCarPosition);
  carRig.rotation.y = displayHeading;
  camera.position
    .copy(carPosition)
    .addScaledVector(forward, -7.5)
    .addScaledVector(right, 4.15)
    .add(new THREE.Vector3(0, 2.75, 0));
  camera.lookAt(cameraLook);
  setHud(hudRoot, "model-state", "MODEL / READY · 125K VTX");

  let smoothedBrakeTemperature = 320;
  let wheelAngle = 0;
  let mapFrame = 0;
  let vectorFrame = 0;
  let hudFrame = 0;
  const playbackRate = 1.5;
  const lapDuration = telemetry.source.lapDurationMs;
  const motionDuration = Math.max(
    lapDuration,
    telemetry.location[telemetry.location.length - 1].t + 360,
  );
  const lastCarPosition = displayCarPosition.clone();
  const carTranslation = new THREE.Vector3();
  return {
    root,
    update: (elapsed, delta, view) => {
      const motionTime =
        (elapsed * 1000 * playbackRate) % motionDuration;
      const replayTime = Math.min(motionTime, lapDuration);
      const car = sampleWindow(telemetry.car, replayTime);
      const location = smoothLocation(
        telemetry.location,
        motionTime,
        motionDuration,
      );
      const speed = lerp(car.a.speed, car.b.speed, car.mix);
      const rpm = lerp(car.a.rpm, car.b.rpm, car.mix);
      const throttle = lerp(car.a.throttle, car.b.throttle, car.mix);
      const previousLocation = smoothLocation(
        telemetry.location,
        (motionTime - 140 + motionDuration) % motionDuration,
        motionDuration,
      );
      const nextLocation = smoothLocation(
        telemetry.location,
        (motionTime + 140) % motionDuration,
        motionDuration,
      );
      const incomingLength = Math.max(
        0.001,
        Math.hypot(
          location.x - previousLocation.x,
          location.y - previousLocation.y,
        ),
      );
      const outgoingLength = Math.max(
        0.001,
        Math.hypot(
          nextLocation.x - location.x,
          nextLocation.y - location.y,
        ),
      );
      const incomingX = (location.x - previousLocation.x) / incomingLength;
      const incomingY = (location.y - previousLocation.y) / incomingLength;
      const outgoingX = (nextLocation.x - location.x) / outgoingLength;
      const outgoingY = (nextLocation.y - location.y) / outgoingLength;
      const signedTurn = Math.atan2(
        incomingX * outgoingY - incomingY * outgoingX,
        incomingX * outgoingX + incomingY * outgoingY,
      );
      const localArcLengthMeters = Math.max(
        1,
        ((incomingLength + outgoingLength) * 0.1) / 2,
      );
      const curvature = signedTurn / localArcLengthMeters;
      const steering = THREE.MathUtils.clamp(
        THREE.MathUtils.radToDeg(Math.atan(3.6 * curvature)),
        -18,
        18,
      );
      const lateralG = THREE.MathUtils.clamp(
        (Math.pow(speed / 3.6, 2) * Math.abs(curvature)) / 9.80665,
        0,
        6.2,
      );

      carPosition.set(
        (location.x - road.originX) * 0.1,
        0.03,
        (location.y - road.originY) * 0.1,
      );
      const targetHeading = Math.atan2(location.dx, location.dy);
      const positionDamping = 1 - Math.exp(-delta * 22);
      const headingDamping = 1 - Math.exp(-delta * 12);
      displayCarPosition.lerp(carPosition, positionDamping);
      const headingDelta = Math.atan2(
        Math.sin(targetHeading - displayHeading),
        Math.cos(targetHeading - displayHeading),
      );
      displayHeading += headingDelta * headingDamping;
      forward.set(Math.sin(displayHeading), 0, Math.cos(displayHeading));
      right.set(forward.z, 0, -forward.x);
      carRig.position.copy(displayCarPosition);
      carRig.rotation.y = displayHeading;
      carTranslation.copy(displayCarPosition).sub(lastCarPosition);
      camera.position.add(carTranslation);
      cameraLook.add(carTranslation);
      lastCarPosition.copy(displayCarPosition);
      wheelAngle -=
        ((speed / 3.6) / 0.36) * delta * playbackRate;
      if (frontWheels) {
        frontWheels.rotation.x = frontWheelBaseRotation + wheelAngle;
      }
      if (rearWheels) {
        rearWheels.rotation.x = rearWheelBaseRotation + wheelAngle;
      }
      wheelRegisters.forEach((register) => {
        register.rotation.x = wheelAngle;
      });

      vectorFrame += 1;
      if (vectorFrame % 3 === 0) {
        const trailPositionAttribute = trailGeometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        for (let index = 0; index < trailSampleCount; index += 1) {
          const sampleTime =
            (motionTime -
              (trailSampleCount - 1 - index) * 52 +
              motionDuration) %
            motionDuration;
          const sample = smoothLocation(
            telemetry.location,
            sampleTime,
            motionDuration,
          );
          trailPositionAttribute.setXYZ(
            index,
            (sample.x - road.originX) * 0.1,
            0.055,
            (sample.y - road.originY) * 0.1,
          );
        }
        trailPositionAttribute.needsUpdate = true;

        const predictionPoints = Array.from(
          { length: predictionSampleCount },
          (_, index) => {
            const sampleTime =
              (motionTime + index * 58) % motionDuration;
            const sample = smoothLocation(
              telemetry.location,
              sampleTime,
              motionDuration,
            );
            return new THREE.Vector3(
              (sample.x - road.originX) * 0.1,
              0.06,
              (sample.y - road.originY) * 0.1,
            );
          },
        );
        predictionGeometry.setFromPoints(predictionPoints);
        trajectoryPrediction.computeLineDistances();
      }

      const velocityPositions = velocityGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      velocityPositions.setXYZ(1, 0, 1.02, 1.55 + speed / 92);
      velocityPositions.needsUpdate = true;
      const lateralPositions = lateralGeometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const lateralLength =
        Math.sign(steering || 1) * Math.min(1.55, 0.18 + lateralG * 0.22);
      lateralPositions.setXYZ(1, lateralLength, 0.88, 0);
      lateralPositions.needsUpdate = true;
      lateralVector.computeLineDistances();

      const horizontalDistance =
        view.distance * Math.cos(view.pitch);
      desiredCamera
        .copy(displayCarPosition)
        .addScaledVector(
          forward,
          -Math.cos(view.yaw) * horizontalDistance,
        )
        .addScaledVector(
          right,
          Math.sin(view.yaw) * horizontalDistance,
        );
      desiredCamera.y += Math.sin(view.pitch) * view.distance;
      desiredLook.copy(displayCarPosition);
      desiredLook.y += 0.62;
      const cameraDamping = 1 - Math.exp(-delta * 12);
      camera.position.lerp(desiredCamera, cameraDamping);
      cameraLook.lerp(desiredLook, cameraDamping);
      camera.lookAt(cameraLook);

      const braking = car.a.brake > 0;
      const temperatureTarget = braking ? 820 + speed * 1.4 : 310;
      smoothedBrakeTemperature +=
        (temperatureTarget - smoothedBrakeTemperature) *
        Math.min(1, delta * (braking ? 4 : 0.7));
      brakeMaterials.forEach((material) => {
        material.opacity +=
          ((braking ? 0.82 : 0.015) - material.opacity) * 0.14;
      });
      energyMaterial.opacity = 0.16 + (throttle / 100) * 0.62;
      sensorMaterials.forEach((material, index) => {
        const active =
          Math.floor(replayTime / 850) % sensorMaterials.length === index;
        material.opacity += ((active ? 0.96 : 0.22) - material.opacity) * 0.12;
      });

      const replayPhase = (elapsed % 22.1) / 22.1;
      const scanActive = replayPhase > 0.62 && replayPhase < 0.86;
      const scanProgress = THREE.MathUtils.clamp(
        (replayPhase - 0.62) / 0.24,
        0,
        1,
      );
      scanPlane.position.z = -3.6 + scanProgress * 7.2;
      scanPlaneMaterial.opacity +=
        ((scanActive ? 0.095 : 0) - scanPlaneMaterial.opacity) * 0.12;
      shellMaterials.forEach(
        ({ material, baseOpacity, baseDepthWrite }) => {
        const target = scanActive ? baseOpacity * 0.22 : baseOpacity;
        material.depthWrite = scanActive ? false : baseDepthWrite;
        material.opacity += (target - material.opacity) * 0.08;
        },
      );
      edgeMaterials.forEach(({ material, baseOpacity, scanOpacity }) => {
        material.opacity +=
          ((scanActive ? scanOpacity : baseOpacity) - material.opacity) * 0.08;
      });
      internals.visible = scanActive;

      const previousCar =
        telemetry.car[Math.max(0, car.index - 2)] ?? car.a;
      const longitudinalAcceleration =
        ((speed - previousCar.speed) / 3.6) /
        Math.max(0.08, (car.a.t - previousCar.t) / 1000);
      carRig.rotation.z +=
        (THREE.MathUtils.clamp(-steering * 0.00075, -0.014, 0.014) -
          carRig.rotation.z) *
        0.06;
      carRig.rotation.x +=
        (THREE.MathUtils.clamp(longitudinalAcceleration * -0.002, -0.016, 0.016) -
          carRig.rotation.x) *
        0.06;

      hudFrame += 1;
      if (hudFrame % 3 === 0) {
        setHud(hudRoot, "gear", String(car.a.gear));
        setHud(hudRoot, "speed", `${Math.round(speed)}`);
        setHud(hudRoot, "rpm", `${Math.round(rpm / 10) * 10}`);
        setHudWidth(hudRoot, "rpm-bar", ((rpm - 5000) / 10000) * 100);
        setHud(hudRoot, "throttle", `${Math.round(throttle)}%`);
        setHudWidth(hudRoot, "throttle-bar", throttle);
        setHud(hudRoot, "brake", braking ? "ON" : "OFF");
        setHud(
          hudRoot,
          "lap-time",
          `${Math.floor(replayTime / 60000)
            .toString()
            .padStart(2, "0")}:${((replayTime % 60000) / 1000)
            .toFixed(3)
            .padStart(6, "0")}`,
        );
        setHud(
          hudRoot,
          "lap-progress",
          `${((motionTime / motionDuration) * 100).toFixed(1)}%`,
        );
        setHud(
          hudRoot,
          "derived",
          `${steering >= 0 ? "+" : ""}${steering.toFixed(1)}° STEER · ${lateralG.toFixed(1)}G LAT`,
        );
        setHud(
          hudRoot,
          "temperature",
          `${Math.round(smoothedBrakeTemperature)}°C / SIM`,
        );
        setHud(
          hudRoot,
          "phase",
          scanActive
            ? scanProgress < 0.33
              ? "SCAN / FRONT SUSPENSION"
              : scanProgress < 0.67
                ? "SCAN / ENERGY STORE"
                : "SCAN / GEARBOX CASING"
            : braking
              ? "BRAKING EVENT"
              : "REAL-LAP REPLAY",
        );
      }

      mapFrame += 1;
      if (mapFrame % 6 === 0) {
        drawTrackMap(trackCanvas, telemetry.location, location.index);
      }
    },
  };
}

type Player = "WHITE" | "BLACK";

type BackgammonPiece = {
  object: THREE.Group;
  fill: THREE.MeshStandardMaterial;
  player: Player;
  initialPoint: number;
  initialPosition: THREE.Vector3;
};

type BackgammonTurn = {
  player: Player;
  dice: readonly [number, number];
  notation: string;
  moves: Array<{ from: number; to: number; die: number }>;
};

function getBoardMetrics(
  player: Player,
  pieces: BackgammonPiece[],
  currentPoints: Map<BackgammonPiece, number>,
) {
  const counts = new Map<number, number>();
  pieces
    .filter((piece) => piece.player === player)
    .forEach((piece) => {
      const point = currentPoints.get(piece) ?? piece.initialPoint;
      counts.set(point, (counts.get(point) ?? 0) + 1);
    });
  const made = [...counts.values()].filter((count) => count >= 2).length;
  const blots = [...counts.values()].filter((count) => count === 1).length;
  const stacks = [...counts.values()].filter((count) => count >= 3).length;
  const home = [...counts.entries()].reduce(
    (total, [point, count]) =>
      total +
      (player === "WHITE"
        ? point <= 6
          ? count
          : 0
        : point >= 19
          ? count
          : 0),
    0,
  );
  let prime = 0;
  let run = 0;
  for (let point = 1; point <= 24; point += 1) {
    if ((counts.get(point) ?? 0) >= 2) {
      run += 1;
      prime = Math.max(prime, run);
    } else {
      run = 0;
    }
  }
  return { made, blots, stacks, home, prime };
}

function buildBackgammonScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  hudRoot: HTMLDivElement | null,
): SceneController {
  scene.add(new THREE.HemisphereLight(PAPER, 0xa7a79f, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(-3, 9, -5);
  scene.add(key);

  const root = new THREE.Group();
  scene.add(root);

  const grid = new THREE.GridHelper(12, 24, INK, MUTED);
  grid.position.y = -0.25;
  const gridMaterials = Array.isArray(grid.material)
    ? grid.material
    : [grid.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.022;
    material.depthWrite = false;
  });
  root.add(grid);

  const board = technicalSolid(new THREE.BoxGeometry(8.55, 0.3, 5.4), {
    color: 0xededE8,
    opacity: 0.18,
    edgeOpacity: 0.68,
  });
  root.add(board);
  const surface = technicalSolid(new THREE.BoxGeometry(8.1, 0.075, 4.95), {
    color: PAPER,
    opacity: 0.16,
    edgeOpacity: 0.3,
  });
  surface.position.y = 0.19;
  root.add(surface);

  const bar = technicalSolid(new THREE.BoxGeometry(0.24, 0.16, 4.95), {
    color: 0xe6e6e0,
    opacity: 0.14,
    edgeOpacity: 0.52,
  });
  bar.position.y = 0.28;
  root.add(bar);

  const surfaceGrid = new THREE.GridHelper(8.1, 12, RED, INK);
  surfaceGrid.position.y = 0.242;
  surfaceGrid.scale.z = 0.61;
  const surfaceGridMaterials = Array.isArray(surfaceGrid.material)
    ? surfaceGrid.material
    : [surfaceGrid.material];
  surfaceGridMaterials.forEach((material, index) => {
    material.transparent = true;
    material.opacity = index === 0 ? 0.075 : 0.016;
    material.depthWrite = false;
  });
  root.add(surfaceGrid);

  const instrumentFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(9.15, 0.9, 5.95)),
    new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
    }),
  );
  instrumentFrame.position.y = 0.28;
  root.add(instrumentFrame);

  [
    [-4.28, -2.67],
    [-4.28, 2.67],
    [4.28, -2.67],
    [4.28, 2.67],
  ].forEach(([x, z], index) => {
    const mast = lineFromPoints(
      [
        new THREE.Vector3(x, 0.22, z),
        new THREE.Vector3(x, 0.83, z),
      ],
      index === 3 ? RED : INK,
      index === 3 ? 0.64 : 0.22,
    );
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 9, 7),
      new THREE.MeshBasicMaterial({
        color: index === 3 ? RED : INK,
        transparent: true,
        opacity: index === 3 ? 0.92 : 0.42,
        depthWrite: false,
      }),
    );
    node.position.set(x, 0.83, z);
    root.add(mast, node);
  });

  const pointGeometry = (
    x0: number,
    x1: number,
    zBase: number,
    zTip: number,
  ) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          x0, 0.235, zBase,
          x1, 0.235, zBase,
          (x0 + x1) / 2, 0.235, zTip,
        ],
        3,
      ),
    );
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    return geometry;
  };

  const pointObjects = new Map<number, THREE.Group>();
  const slot = 0.63;
  for (let boardSide = 0; boardSide < 2; boardSide += 1) {
    for (let index = 0; index < 6; index += 1) {
      const center = (boardSide === 0 ? -3.82 : 0.36) + index * slot;
      const bottomPoint = boardSide === 0 ? 12 - index : 6 - index;
      const topPoint = boardSide === 0 ? 13 + index : 19 + index;
      const bottom = technicalSolid(
        pointGeometry(center, center + slot, -2.42, -0.48),
        {
          color: index % 2 === 0 ? 0xd8d8d1 : 0xebebe6,
          opacity: index % 2 === 0 ? 0.14 : 0.07,
          edgeOpacity: index % 2 === 0 ? 0.54 : 0.28,
          threshold: 1,
        },
      );
      const top = technicalSolid(
        pointGeometry(center, center + slot, 2.42, 0.48),
        {
          color: index % 2 === 0 ? 0xebebe6 : 0xd8d8d1,
          opacity: index % 2 === 0 ? 0.07 : 0.14,
          edgeOpacity: index % 2 === 0 ? 0.28 : 0.54,
          threshold: 1,
        },
      );
      pointObjects.set(bottomPoint, bottom);
      pointObjects.set(topPoint, top);
      root.add(bottom, top);
    }
  }

  const pointPosition = (point: number, stackIndex: number) => {
    const top = point >= 13;
    let x: number;
    if (point <= 6) x = 3.82 - (point - 1) * 0.63;
    else if (point <= 12) x = -0.67 - (point - 7) * 0.63;
    else if (point <= 18) x = -3.82 + (point - 13) * 0.63;
    else x = 0.67 + (point - 19) * 0.63;
    const edgeZ = top ? 2.1 : -2.1;
    const direction = top ? -1 : 1;
    return new THREE.Vector3(
      x,
      0.35 + stackIndex * 0.008,
      edgeZ + direction * stackIndex * 0.43,
    );
  };

  for (let point = 1; point <= 24; point += 1) {
    const position = pointPosition(point, 0);
    const outerZ = point >= 13 ? 2.54 : -2.54;
    const inwardZ = outerZ + (point >= 13 ? -0.16 : 0.16);
    const tick = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(position.x - 0.1, 0.29, outerZ),
        new THREE.Vector3(position.x + 0.1, 0.29, outerZ),
        new THREE.Vector3(position.x, 0.29, outerZ),
        new THREE.Vector3(position.x, 0.29, inwardZ),
      ]),
      new THREE.LineBasicMaterial({
        color: point % 6 === 0 ? RED : INK,
        transparent: true,
        opacity: point % 6 === 0 ? 0.62 : 0.3,
        depthWrite: false,
      }),
    );
    root.add(tick);
  }

  const initialPoints: Record<Player, number[]> = {
    WHITE: [24, 24, 13, 13, 13, 13, 13, 8, 8, 8, 6, 6, 6, 6, 6],
    BLACK: [1, 1, 12, 12, 12, 12, 12, 17, 17, 17, 19, 19, 19, 19, 19],
  };
  const pieces: BackgammonPiece[] = [];
  const checkerGeometry = new THREE.CylinderGeometry(0.21, 0.21, 0.13, 32, 2);

  (Object.keys(initialPoints) as Player[]).forEach((player) => {
    initialPoints[player].forEach((point, pieceIndex, allPoints) => {
      const fill = new THREE.MeshStandardMaterial({
        color: player === "BLACK" ? INK : 0xe4e4de,
        roughness: player === "BLACK" ? 0.72 : 0.9,
        metalness: player === "BLACK" ? 0.08 : 0,
        transparent: true,
        opacity: player === "BLACK" ? 0.76 : 0.68,
        depthWrite: true,
      });
      const checker = new THREE.Group();
      checker.add(
        new THREE.Mesh(checkerGeometry, fill),
        new THREE.LineSegments(
          new THREE.EdgesGeometry(checkerGeometry, 18),
          new THREE.LineBasicMaterial({
            color: player === "BLACK" ? 0x000000 : INK,
            transparent: true,
            opacity: player === "BLACK" ? 0.68 : 0.58,
          }),
        ),
      );
      const registerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.008, 5, 28),
        new THREE.MeshBasicMaterial({
          color: player === "BLACK" ? RED : INK,
          transparent: true,
          opacity: player === "BLACK" ? 0.24 : 0.18,
          depthWrite: false,
        }),
      );
      registerRing.rotation.x = Math.PI / 2;
      registerRing.position.y = 0.068;
      checker.add(registerRing);
      const stackIndex = allPoints
        .slice(0, pieceIndex)
        .filter((value) => value === point).length;
      checker.position.copy(pointPosition(point, stackIndex));
      root.add(checker);
      pieces.push({
        object: checker,
        fill,
        player,
        initialPoint: point,
        initialPosition: checker.position.clone(),
      });
    });
  });

  const turnSequence: BackgammonTurn[] = [
    {
      player: "WHITE",
      dice: [6, 1],
      notation: "13/7 · 8/7",
      moves: [
        { from: 13, to: 7, die: 6 },
        { from: 8, to: 7, die: 1 },
      ],
    },
    {
      player: "BLACK",
      dice: [5, 3],
      notation: "12/17 · 1/4",
      moves: [
        { from: 12, to: 17, die: 5 },
        { from: 1, to: 4, die: 3 },
      ],
    },
    {
      player: "WHITE",
      dice: [4, 4],
      notation: "24/20(2) · 13/9(2)",
      moves: [
        { from: 24, to: 20, die: 4 },
        { from: 24, to: 20, die: 4 },
        { from: 13, to: 9, die: 4 },
        { from: 13, to: 9, die: 4 },
      ],
    },
    {
      player: "BLACK",
      dice: [6, 4],
      notation: "12/18 · 17/21",
      moves: [
        { from: 12, to: 18, die: 6 },
        { from: 17, to: 21, die: 4 },
      ],
    },
    {
      player: "WHITE",
      dice: [5, 3],
      notation: "8/3 · 6/3",
      moves: [
        { from: 8, to: 3, die: 5 },
        { from: 6, to: 3, die: 3 },
      ],
    },
  ];

  const simulatedPoints = new Map<BackgammonPiece, number>(
    pieces.map((piece) => [piece, piece.initialPoint]),
  );
  const turnDuration = 5;
  const cycleDuration = turnDuration * turnSequence.length;
  const timeline: Array<{
    turn: number;
    piece: BackgammonPiece;
    from: number;
    to: number;
    start: THREE.Vector3;
    end: THREE.Vector3;
    curve: THREE.CatmullRomCurve3;
    startsAt: number;
    endsAt: number;
  }> = [];
  turnSequence.forEach((turn, turnIndex) => {
    turn.moves.forEach((move, moveIndex) => {
      const source = pieces.filter(
        (piece) =>
          piece.player === turn.player &&
          simulatedPoints.get(piece) === move.from,
      );
      const piece = source[source.length - 1];
      const targetCount = pieces.filter(
        (candidate) =>
          candidate.player === turn.player &&
          simulatedPoints.get(candidate) === move.to,
      ).length;
      const start = pointPosition(move.from, source.length - 1);
      const end = pointPosition(move.to, targetCount);
      const midpoint = start.clone().lerp(end, 0.5);
      midpoint.y = 1.25 + Math.min(0.68, start.distanceTo(end) * 0.075);
      const startsAt =
        turnIndex * turnDuration +
        0.62 +
        moveIndex * (turn.moves.length === 4 ? 0.96 : 1.32);
      timeline.push({
        turn: turnIndex,
        piece,
        from: move.from,
        to: move.to,
        start,
        end,
        curve: new THREE.CatmullRomCurve3([start, midpoint, end]),
        startsAt,
        endsAt: startsAt + (turn.moves.length === 4 ? 0.78 : 1.02),
      });
      simulatedPoints.set(piece, move.to);
    });
  });

  const pipPositions = [
    [0, 0],
    [-0.16, -0.18],
    [0.16, 0.18],
    [-0.16, 0.18],
    [0.16, -0.18],
    [-0.16, 0],
    [0.16, 0],
  ] as const;
  const pipIndexes: Record<number, number[]> = {
    1: [0],
    2: [1, 2],
    3: [1, 0, 2],
    4: [1, 2, 3, 4],
    5: [1, 2, 3, 4, 0],
    6: [1, 2, 3, 4, 5, 6],
  };
  const diceTray = technicalSolid(
    new THREE.BoxGeometry(1.55, 0.08, 1.04),
    {
      color: 0xe8e8e2,
      opacity: 0.14,
      edgeOpacity: 0.42,
    },
  );
  diceTray.position.set(4.85, 0.2, 0.18);
  root.add(diceTray);

  const dice = [4.5, 5.18].map((x, index) => {
    const die = technicalSolid(new THREE.BoxGeometry(0.5, 0.5, 0.5), {
      color: PAPER,
      edgeColor: index === 0 ? RED : INK,
      opacity: 0.58,
      edgeOpacity: 0.7,
    });
    const pips = pipPositions.map(([px, pz]) => {
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(0.046, 10, 8),
        new THREE.MeshBasicMaterial({ color: index === 0 ? RED : INK }),
      );
      pip.scale.setScalar(0.84);
      pip.position.set(px * 0.82, 0.257, pz * 0.82);
      die.add(pip);
      return pip;
    });
    die.userData.pips = pips;
    die.position.set(x, 0.64, 0.18);
    root.add(die);
    return die;
  });
  const setDieValue = (die: THREE.Group, value: number) => {
    const visible = pipIndexes[value];
    (die.userData.pips as THREE.Mesh[]).forEach((pip, index) => {
      pip.visible = visible.includes(index);
    });
  };

  const outcomeNodes: Array<{
    object: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
  }> = [];
  const outcomeField = new THREE.Group();
  outcomeField.position.set(5.5, 0.72, -0.42);
  outcomeField.rotation.y = -0.89;
  root.add(outcomeField);
  const outcomeNodeGeometry = new THREE.SphereGeometry(0.037, 9, 7);
  const fieldMinY = 0;
  const fieldMinZ = -0.62;
  const fieldStep = 0.24;
  for (let first = 0; first < 6; first += 1) {
    for (let second = 0; second < 6; second += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
      const node = new THREE.Mesh(outcomeNodeGeometry, material);
      node.position.set(
        0,
        fieldMinY + first * fieldStep,
        fieldMinZ + second * fieldStep,
      );
      outcomeField.add(node);
      outcomeNodes.push({ object: node, material });
    }
  }

  const fieldGridPoints: THREE.Vector3[] = [];
  for (let index = 0; index < 6; index += 1) {
    const offset = index * fieldStep;
    fieldGridPoints.push(
      new THREE.Vector3(0, fieldMinY + offset, fieldMinZ),
      new THREE.Vector3(
        0,
        fieldMinY + offset,
        fieldMinZ + fieldStep * 5,
      ),
      new THREE.Vector3(0, fieldMinY, fieldMinZ + offset),
      new THREE.Vector3(
        0,
        fieldMinY + fieldStep * 5,
        fieldMinZ + offset,
      ),
    );
  }
  const outcomeFieldGrid = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(fieldGridPoints),
    new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
    }),
  );
  outcomeField.add(outcomeFieldGrid);

  const outcomeProjectionGeometry = new THREE.BufferGeometry();
  const outcomeProjection = new THREE.LineSegments(
    outcomeProjectionGeometry,
    new THREE.LineDashedMaterial({
      color: RED,
      dashSize: 0.08,
      gapSize: 0.06,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );
  root.add(outcomeProjection);

  const activeHalo = technicalSolid(
    new THREE.TorusGeometry(0.27, 0.018, 7, 32),
    {
      color: RED,
      edgeColor: RED,
      opacity: 0.08,
      edgeOpacity: 0.9,
    },
  );
  activeHalo.rotation.x = Math.PI / 2;
  activeHalo.visible = false;
  root.add(activeHalo);

  const activePath = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 40 }, () => new THREE.Vector3()),
    ),
    new THREE.LineDashedMaterial({
      color: RED,
      dashSize: 0.12,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    }),
  );
  activePath.visible = false;
  root.add(activePath);

  const scanLine = lineFromPoints(
    [
      new THREE.Vector3(-4.05, 0.27, 0),
      new THREE.Vector3(4.05, 0.27, 0),
    ],
    RED,
    0.22,
  );
  root.add(scanLine);

  const targetMarkers = [0, 1, 2, 3].map(() => {
    const marker = technicalSolid(
      new THREE.TorusGeometry(0.29, 0.014, 6, 30),
      {
        color: RED,
        edgeColor: RED,
        opacity: 0.02,
        edgeOpacity: 0.38,
      },
    );
    marker.rotation.x = Math.PI / 2;
    root.add(marker);
    return marker;
  });

  camera.position.set(5.9, 9.35, 7.35);
  const boardTarget = new THREE.Vector3(0.35, 0.2, 0);
  const desiredBoardCamera = new THREE.Vector3();
  camera.lookAt(boardTarget);

  let lastTurnIndex = -1;
  let lastMoveIndex = -1;
  let activeOutcomeIndexes = [5];
  let targetMarkerCount = 0;
  const currentPoints = new Map<BackgammonPiece, number>();

  return {
    root,
    update: (elapsed, delta, view) => {
      const horizontalDistance =
        view.distance * Math.cos(view.pitch);
      desiredBoardCamera.set(
        Math.sin(view.yaw) * horizontalDistance + boardTarget.x,
        Math.sin(view.pitch) * view.distance + boardTarget.y,
        Math.cos(view.yaw) * horizontalDistance + boardTarget.z,
      );
      const orbitDamping = 1 - Math.exp(-delta * 18);
      camera.position.lerp(desiredBoardCamera, orbitDamping);
      camera.lookAt(boardTarget);

      const cycleTime = elapsed % cycleDuration;
      const turnIndex = Math.min(
        turnSequence.length - 1,
        Math.floor(cycleTime / turnDuration),
      );
      const turn = turnSequence[turnIndex];
      const turnTime = cycleTime - turnIndex * turnDuration;
      scanLine.position.z =
        -2.35 + (turnTime / turnDuration) * 4.7;

      pieces.forEach((piece) => {
        piece.object.position.copy(piece.initialPosition);
        piece.fill.color.set(piece.player === "BLACK" ? INK : 0xe4e4de);
        currentPoints.set(piece, piece.initialPoint);
      });
      timeline.forEach((move) => {
        if (cycleTime >= move.endsAt) {
          move.piece.object.position.copy(move.end);
          currentPoints.set(move.piece, move.to);
        }
      });

      const activeMoveIndex = timeline.findIndex(
        (move) => cycleTime >= move.startsAt && cycleTime < move.endsAt,
      );
      let activeMoveWithinTurn = -1;
      if (activeMoveIndex >= 0) {
        const move = timeline[activeMoveIndex];
        activeMoveWithinTurn = timeline
          .filter((candidate) => candidate.turn === turnIndex)
          .findIndex((candidate) => candidate === move);
        const progress = THREE.MathUtils.smoothstep(
          (cycleTime - move.startsAt) / (move.endsAt - move.startsAt),
          0,
          1,
        );
        const position = move.curve.getPoint(progress);
        move.piece.object.position.copy(position);
        move.piece.fill.color.set(RED);
        activeHalo.visible = true;
        activeHalo.position.copy(position);
        activeHalo.position.y += 0.09;

        if (lastMoveIndex !== activeMoveIndex) {
          activePath.geometry.setFromPoints(move.curve.getPoints(39));
          activePath.computeLineDistances();
          activePath.visible = true;
          lastMoveIndex = activeMoveIndex;
        }
      } else {
        activeHalo.visible = false;
        activePath.visible = false;
        lastMoveIndex = -1;
      }
      targetMarkers.forEach((marker, index) => {
        marker.visible =
          activeMoveIndex < 0 && index < targetMarkerCount;
      });

      if (lastTurnIndex !== turnIndex) {
        setDieValue(dice[0], turn.dice[0]);
        setDieValue(dice[1], turn.dice[1]);
        activeOutcomeIndexes =
          turn.dice[0] === turn.dice[1]
            ? [(turn.dice[0] - 1) * 6 + (turn.dice[1] - 1)]
            : [
                (turn.dice[0] - 1) * 6 + (turn.dice[1] - 1),
                (turn.dice[1] - 1) * 6 + (turn.dice[0] - 1),
              ];
        const orderedWays = turn.dice[0] === turn.dice[1] ? 1 : 2;
        const probability = ((orderedWays / 36) * 100).toFixed(2);
        setHud(
          hudRoot,
          "probability",
          `P({${turn.dice[0]},${turn.dice[1]}}) = ${orderedWays} / 36 = ${probability}%`,
        );
        setHud(
          hudRoot,
          "roll-ways",
          `${orderedWays} ORDERED ${orderedWays === 1 ? "WAY" : "WAYS"} · ${
            orderedWays === 1 ? "DOUBLE" : "ASYMMETRIC"
          }`,
        );
        hudRoot
          ?.querySelectorAll<HTMLElement>("[data-roll]")
          .forEach((node) => node.classList.remove("is-active"));
        [
          `${turn.dice[0]}-${turn.dice[1]}`,
          `${turn.dice[1]}-${turn.dice[0]}`,
        ].forEach((roll) => {
          hudRoot
            ?.querySelector<HTMLElement>(`[data-roll="${roll}"]`)
            ?.classList.add("is-active");
        });

        targetMarkers.forEach((marker) => {
          marker.visible = false;
        });
        const uniqueTargets = timeline
          .filter((move) => move.turn === turnIndex)
          .filter(
            (move, index, moves) =>
              moves.findIndex((candidate) => candidate.to === move.to) ===
              index,
          );
        targetMarkerCount = uniqueTargets.length;
        uniqueTargets.forEach((move, index) => {
          targetMarkers[index].position.copy(move.end);
          targetMarkers[index].position.y = 0.275;
        });
        lastTurnIndex = turnIndex;
      }

      const rollEnergy =
        1 - THREE.MathUtils.smoothstep(turnTime / 0.68, 0, 1);
      dice.forEach((die, index) => {
        die.rotation.x =
          0.08 + Math.sin(turnTime * 17 + index) * rollEnergy * 0.72;
        die.rotation.y =
          (index === 0 ? 0.24 : -0.24) +
          Math.cos(turnTime * 14 + index) * rollEnergy * 0.76;
        die.rotation.z =
          0.04 + Math.sin(turnTime * 12) * rollEnergy * 0.28;
        die.position.y =
          0.64 +
          rollEnergy *
            (0.5 + Math.abs(Math.sin(turnTime * 14 + index)) * 0.16);
      });

      outcomeNodes.forEach(({ object, material }, index) => {
        const active = activeOutcomeIndexes.includes(index);
        const pulse = 1 + Math.sin(elapsed * 4.2 + index * 0.15) * 0.08;
        object.scale.setScalar(active ? 1.55 * pulse : 1);
        object.position.x = active ? 0.07 * pulse : 0;
        material.opacity = active ? 0.9 : 0.1;
        material.color.set(active ? RED : INK);
      });
      const projectionPoints: THREE.Vector3[] = [];
      dice.forEach((die, dieIndex) => {
        const node =
          outcomeNodes[
            activeOutcomeIndexes[
              Math.min(dieIndex, activeOutcomeIndexes.length - 1)
            ]
          ].object;
        projectionPoints.push(
          node.getWorldPosition(new THREE.Vector3()),
          die.position.clone().add(new THREE.Vector3(0, 0.34, 0)),
        );
      });
      outcomeProjectionGeometry.setFromPoints(projectionPoints);
      outcomeProjection.computeLineDistances();

      const whitePips = pieces
        .filter((piece) => piece.player === "WHITE")
        .reduce((total, piece) => total + (currentPoints.get(piece) ?? 0), 0);
      const blackPips = pieces
        .filter((piece) => piece.player === "BLACK")
        .reduce(
          (total, piece) =>
            total + (25 - (currentPoints.get(piece) ?? 25)),
          0,
        );
      const whiteMetrics = getBoardMetrics(
        "WHITE",
        pieces,
        currentPoints,
      );
      const blackMetrics = getBoardMetrics(
        "BLACK",
        pieces,
        currentPoints,
      );

      setHud(hudRoot, "turn", `${turnIndex + 1} / 5`);
      setHud(hudRoot, "player", turn.player);
      setHud(hudRoot, "roll", `${turn.dice[0]}–${turn.dice[1]}`);
      setHud(
        hudRoot,
        "move",
        activeMoveIndex >= 0
          ? `MOVE ${activeMoveWithinTurn + 1}/${turn.moves.length} · ${timeline[activeMoveIndex].from}/${timeline[activeMoveIndex].to}`
          : `PLAY · ${turn.notation}`,
      );
      setHud(hudRoot, "pip-white", String(whitePips));
      setHud(hudRoot, "pip-black", String(blackPips));
      setHud(
        hudRoot,
        "pip-diff",
        `${whitePips - blackPips >= 0 ? "+" : ""}${whitePips - blackPips}`,
      );
      setHud(hudRoot, "made-white", String(whiteMetrics.made));
      setHud(hudRoot, "made-black", String(blackMetrics.made));
      setHud(hudRoot, "blots-white", String(whiteMetrics.blots));
      setHud(hudRoot, "blots-black", String(blackMetrics.blots));
      setHud(hudRoot, "home-white", String(whiteMetrics.home));
      setHud(hudRoot, "home-black", String(blackMetrics.home));
      setHud(hudRoot, "prime-white", String(whiteMetrics.prime));
      setHud(hudRoot, "prime-black", String(blackMetrics.prime));
      setHud(hudRoot, "stacks-white", String(whiteMetrics.stacks));
      setHud(hudRoot, "stacks-black", String(blackMetrics.stacks));
      setHud(
        hudRoot,
        "move-state",
        activeMoveIndex >= 0
          ? `EXECUTING / DIE ${turn.moves[activeMoveWithinTurn].die}`
          : turnTime < 0.72
            ? "ROLL RESOLVED"
            : "POSITION VERIFIED",
      );
    },
  };
}

function FormulaHud({
  trackCanvasRef,
}: {
  trackCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  return (
    <>
      <section className="formula-primary" aria-label="Recorded telemetry">
        <div className="gear-stack">
          <strong data-hud="gear">–</strong>
          <span>GEAR</span>
        </div>
        <div className="speed-stack">
          <strong data-hud="speed">–––</strong>
          <span>KM/H · RECORDED</span>
        </div>
        <div className="channel-stack">
          <span>
            RPM <b data-hud="rpm">–––––</b>
          </span>
          <i className="rpm-trace">
            <em data-hud="rpm-bar" />
          </i>
          <span>
            BRAKE <b data-hud="brake">OFF</b>
          </span>
          <span>
            THROTTLE <b data-hud="throttle">––%</b>
          </span>
          <i className="throttle-trace">
            <em data-hud="throttle-bar" />
          </i>
        </div>
      </section>

      <section className="formula-source">
        <strong>ANTONELLI #12 / SILVERSTONE</strong>
        <span>SESSION 11322 · LAP 18 · 04 JUL 2026</span>
        <span>
          LAP TIME <b data-hud="lap-time">00:00.000</b>
        </span>
        <span>
          PROGRESS <b data-hud="lap-progress">0.0%</b> · REPLAY 1.5×
        </span>
        <span className="signal-copy" data-hud="phase">
          REAL-LAP REPLAY
        </span>
      </section>

      <section className="formula-derived">
        <strong>VEHICLE STATE / DERIVED</strong>
        <span data-hud="derived">+0.0° STEER · 0.0G LAT</span>
        <span data-hud="temperature">320°C / SIM</span>
        <span data-hud="model-state">LOADING / GEOMETRY + LAP</span>
      </section>

      <section className="track-inset" aria-label="Recorded lap position">
        <canvas ref={trackCanvasRef} />
        <span>SILVERSTONE / RECORDED XY</span>
      </section>

      <div className="scene-credits">
        <a
          href="https://openf1.org/"
          target="_blank"
          rel="noreferrer"
        >
          DATA / OPENF1
        </a>
        <a
          href="https://www.get3dmodels.com/vehicles/formula-1-car/"
          target="_blank"
          rel="noreferrer"
        >
          MODEL / DARK_IGOREK · CC BY
        </a>
      </div>
    </>
  );
}

function BackgammonHud() {
  return (
    <>
      <section className="board-primary">
        <div>
          <span>TURN</span>
          <strong data-hud="turn">1 / 5</strong>
        </div>
        <div>
          <span>ON ROLL</span>
          <strong data-hud="player">WHITE</strong>
        </div>
        <div>
          <span>ROLL</span>
          <strong className="signal-copy" data-hud="roll">
            6–1
          </strong>
        </div>
        <p data-hud="move">13/7 · 8/7</p>
        <small data-hud="move-state">ROLL RESOLVED</small>
      </section>

      <section className="pip-panel">
        <strong>PIP COUNT / EXACT BOARD STATE</strong>
        <span>
          WHITE <b data-hud="pip-white">167</b>
        </span>
        <span>
          BLACK <b data-hud="pip-black">167</b>
        </span>
        <span>
          Δ <b data-hud="pip-diff">+0</b>
        </span>
        <small>30 CHECKERS · 0 BAR · 0 HIT</small>
      </section>

      <section className="board-topology">
        <strong>POSITION TOPOLOGY / LIVE</strong>
        <i>
          <span>CHANNEL</span>
          <span>W / B</span>
        </i>
        <p>
          <span>MADE POINTS</span>
          <b>
            <em data-hud="made-white">4</em> /{" "}
            <em data-hud="made-black">4</em>
          </b>
        </p>
        <p>
          <span>BLOTS / EXPOSURE</span>
          <b>
            <em data-hud="blots-white">0</em> /{" "}
            <em data-hud="blots-black">0</em>
          </b>
        </p>
        <p>
          <span>HOME LOAD</span>
          <b>
            <em data-hud="home-white">5</em> /{" "}
            <em data-hud="home-black">5</em>
          </b>
        </p>
        <p>
          <span>MAX PRIME</span>
          <b>
            <em data-hud="prime-white">1</em> /{" "}
            <em data-hud="prime-black">1</em>
          </b>
        </p>
        <p>
          <span>HEAVY STACKS</span>
          <b>
            <em data-hud="stacks-white">3</em> /{" "}
            <em data-hud="stacks-black">3</em>
          </b>
        </p>
      </section>

      <section className="dice-analysis">
        <div className="dice-analysis-copy">
          <strong>DICE SPACE / 36 ORDERED OUTCOMES</strong>
          <span data-hud="roll-ways">2 ORDERED WAYS · ASYMMETRIC</span>
          <span className="signal-copy" data-hud="probability">
            P({"{"}6,1{"}"}) = 2 / 36 = 5.56%
          </span>
        </div>
        <div className="dice-lattice" aria-label="Thirty-six dice outcomes">
          {Array.from({ length: 6 }, (_, first) =>
            Array.from({ length: 6 }, (__, second) => (
              <i
                key={`${first + 1}-${second + 1}`}
                data-roll={`${first + 1}-${second + 1}`}
                title={`${first + 1}, ${second + 1}`}
              />
            )),
          )}
        </div>
      </section>

      <p className="board-proof">
        FIVE LEGAL TURNS · ONE DOUBLE · STATE RECALCULATED AFTER EVERY MOVE
      </p>
    </>
  );
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hudRootRef = useRef<HTMLDivElement>(null);
  const trackCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<SceneView>(
    mode === 1
      ? { yaw: 0.92, pitch: 0.45, distance: 8.35 }
      : { yaw: 0.676, pitch: 0.79, distance: 13.25 },
  );
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    x: 0,
    y: 0,
  });
  const resetView = () => {
    viewRef.current =
      mode === 1
        ? { yaw: 0.92, pitch: 0.45, distance: 8.35 }
        : { yaw: 0.676, pitch: 0.79, distance: 13.25 };
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 120);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "scene-webgl";
    mount.prepend(renderer.domElement);

    let disposed = false;
    let frame = 0;
    let controller: SceneController | null = null;
    let lastFrameTime = performance.now();
    let elapsed = 0;

    const setup = async () => {
      try {
        controller =
          mode === 1
            ? await buildFormulaScene(
                scene,
                camera,
                hudRootRef.current,
                trackCanvasRef.current,
              )
            : buildBackgammonScene(scene, camera, hudRootRef.current);
        if (disposed) {
          scene.remove(controller.root);
          controller = null;
        }
      } catch (error) {
        console.error(error);
        setHud(hudRootRef.current, "model-state", "LOAD ERROR / RETRY");
      }
    };
    void setup();

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.fov =
        width < 720
          ? mode === 1
            ? 48
            : 49
          : mode === 1
            ? 35
            : 37;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const animate = (frameTime: number) => {
      const delta = Math.min(
        Math.max(0, (frameTime - lastFrameTime) / 1000),
        0.033,
      );
      lastFrameTime = frameTime;
      elapsed += delta;
      if (controller) {
        controller.update(elapsed, delta, viewRef.current);
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      scene.traverse((object) => {
        const geometry = (object as THREE.Mesh).geometry;
        if (geometry) geometry.dispose();
        const material = (object as THREE.Mesh).material;
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else if (material) {
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mode]);

  return (
    <div
      className={`system-scene mode-${mode}`}
      ref={mountRef}
      tabIndex={0}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        dragRef.current = {
          active: true,
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.style.cursor = "grabbing";
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - drag.x;
        const deltaY = event.clientY - drag.y;
        viewRef.current.yaw -= deltaX * 0.0065;
        viewRef.current.pitch = THREE.MathUtils.clamp(
          viewRef.current.pitch - deltaY * 0.0055,
          mode === 1 ? 0.12 : 0.28,
          1.3,
        );
        drag.x = event.clientX;
        drag.y = event.clientY;
      }}
      onPointerUp={(event) => {
        if (dragRef.current.pointerId === event.pointerId) {
          dragRef.current.active = false;
          dragRef.current.pointerId = -1;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          event.currentTarget.style.cursor = "grab";
        }
      }}
      onPointerCancel={(event) => {
        dragRef.current.active = false;
        dragRef.current.pointerId = -1;
        event.currentTarget.style.cursor = "grab";
      }}
      onWheel={(event) => {
        event.preventDefault();
        const next =
          viewRef.current.distance * Math.exp(event.deltaY * 0.001);
        viewRef.current.distance = THREE.MathUtils.clamp(
          next,
          mode === 1 ? 6.4 : 8.5,
          mode === 1 ? 17 : 21,
        );
      }}
      onDoubleClick={resetView}
      onKeyDown={(event) => {
        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "+",
            "=",
            "-",
            "0",
          ].includes(event.key)
        ) {
          event.preventDefault();
        }
        if (event.key === "ArrowLeft") viewRef.current.yaw += 0.12;
        if (event.key === "ArrowRight") viewRef.current.yaw -= 0.12;
        if (event.key === "ArrowUp") {
          viewRef.current.pitch = Math.min(
            1.3,
            viewRef.current.pitch + 0.08,
          );
        }
        if (event.key === "ArrowDown") {
          viewRef.current.pitch = Math.max(
            mode === 1 ? 0.12 : 0.28,
            viewRef.current.pitch - 0.08,
          );
        }
        if (event.key === "+" || event.key === "=") {
          viewRef.current.distance = Math.max(
            mode === 1 ? 6.4 : 8.5,
            viewRef.current.distance - 0.8,
          );
        }
        if (event.key === "-") {
          viewRef.current.distance = Math.min(
            mode === 1 ? 17 : 21,
            viewRef.current.distance + 0.8,
          );
        }
        if (event.key === "0") resetView();
      }}
      aria-label={
        mode === 1
          ? "Interactive Formula car replaying recorded Silverstone telemetry. Drag to orbit and scroll to zoom."
          : "Interactive five-turn backgammon simulation with exact state analysis. Drag to orbit and scroll to zoom."
      }
      role="application"
    >
      <div className="scene-overlay" ref={hudRootRef}>
        {mode === 1 ? (
          <FormulaHud trackCanvasRef={trackCanvasRef} />
        ) : (
          <BackgammonHud />
        )}
        <p className="view-hint">
          DRAG / ORBIT · SCROLL / ZOOM · DOUBLE-CLICK / RESET
        </p>
      </div>
    </div>
  );
}
