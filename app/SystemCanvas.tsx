"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type VisualMode = 1 | 2 | 3;

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

function buildSmoothTrackLocations(
  samples: LocationSample[],
  lapDuration: number,
) {
  const smoothingWindow = 520;
  const filtered = samples.map((sample) => {
    let totalWeight = 0;
    let x = 0;
    let y = 0;
    let z = 0;

    samples.forEach((candidate) => {
      const directDistance = Math.abs(candidate.t - sample.t);
      const timeDistance = Math.min(
        directDistance,
        lapDuration - directDistance,
      );
      if (timeDistance > smoothingWindow) return;
      const weight = Math.pow(1 - timeDistance / smoothingWindow, 2);
      totalWeight += weight;
      x += candidate.x * weight;
      y += candidate.y * weight;
      z += candidate.z * weight;
    });

    return {
      ...sample,
      x: x / Math.max(totalWeight, 1),
      y: y / Math.max(totalWeight, 1),
      z: z / Math.max(totalWeight, 1),
    };
  });
  const sampleCount = Math.max(
    samples.length * 4,
    Math.ceil(lapDuration / 55),
  );

  return Array.from({ length: sampleCount }, (_, index) => {
    const t = (index / sampleCount) * lapDuration;
    const position = smoothLocation(filtered, t, lapDuration);
    const rawWindow = sampleWindow(filtered, t);
    return {
      t,
      x: position.x,
      y: position.y,
      z: lerp(rawWindow.a.z, rawWindow.b.z, rawWindow.mix),
    };
  });
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
  const motionDuration = telemetry.source.lapDurationMs;
  const trackLocations = buildSmoothTrackLocations(
    telemetry.location,
    motionDuration,
  );

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
  const frontSteeringRigs: Array<{
    side: -1 | 1;
    yaw: THREE.Group;
    spin: THREE.Mesh;
  }> = [];

  if (frontWheels) {
    const sourceWheelMesh = frontWheels.children.find(
      (child) => (child as THREE.Mesh).isMesh,
    ) as THREE.Mesh | undefined;
    const sourceIndex = sourceWheelMesh?.geometry.index;
    const sourcePositions =
      sourceWheelMesh?.geometry.getAttribute("position");
    if (sourceWheelMesh && sourceIndex && sourcePositions) {
      sourceWheelMesh.updateMatrix();
      const axleGeometry = sourceWheelMesh.geometry.clone();
      axleGeometry.applyMatrix4(sourceWheelMesh.matrix);
      const axlePositions = axleGeometry.getAttribute("position");
      const axleIndex = axleGeometry.index;
      if (axleIndex) {
        ([-1, 1] as const).forEach((side) => {
          const sideIndices: number[] = [];
          for (let index = 0; index < axleIndex.count; index += 3) {
            const a = axleIndex.getX(index);
            const b = axleIndex.getX(index + 1);
            const c = axleIndex.getX(index + 2);
            const centerX =
              (axlePositions.getX(a) +
                axlePositions.getX(b) +
                axlePositions.getX(c)) /
              3;
            if ((side < 0 && centerX < 0) || (side > 0 && centerX >= 0)) {
              sideIndices.push(a, b, c);
            }
          }
          if (sideIndices.length === 0) return;

          const sideBounds = new THREE.Box3();
          const vertex = new THREE.Vector3();
          sideIndices.forEach((vertexIndex) => {
            vertex.fromBufferAttribute(axlePositions, vertexIndex);
            sideBounds.expandByPoint(vertex);
          });
          const sourceWheelCenter = sideBounds.getCenter(
            new THREE.Vector3(),
          );
          const steeringPivot = sourceWheelCenter.clone();
          steeringPivot.x = side * 1.441;
          const wheelGeometry = axleGeometry.clone();
          wheelGeometry.setIndex(sideIndices);
          wheelGeometry.translate(
            -sourceWheelCenter.x,
            -sourceWheelCenter.y,
            -sourceWheelCenter.z,
          );
          wheelGeometry.computeBoundingBox();

          const yaw = new THREE.Group();
          yaw.name = `front_${side < 0 ? "left" : "right"}_steering`;
          yaw.position.copy(steeringPivot);
          const spin = new THREE.Mesh(
            wheelGeometry,
            sourceWheelMesh.material,
          );
          spin.name = `front_${side < 0 ? "left" : "right"}_wheel`;
          yaw.add(spin);
          frontWheels.add(yaw);
          frontSteeringRigs.push({ side, yaw, spin });
        });
        sourceWheelMesh.removeFromParent();
      }
    }
  }

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

  const brakeMaterials: THREE.MeshBasicMaterial[] = [];
  const addWheelTelemetry = (wheelObject: THREE.Object3D | undefined) => {
    if (!wheelObject) return;
    const wheelMesh = wheelObject.children.find(
      (child) => (child as THREE.Mesh).isMesh,
    ) as THREE.Mesh | undefined;
    if (!wheelMesh) return;
    wheelMesh.geometry.computeBoundingBox();
    if (!wheelMesh.geometry.boundingBox) return;
    wheelMesh.updateMatrix();
    const bounds = wheelMesh.geometry.boundingBox
      .clone()
      .applyMatrix4(wheelMesh.matrix);
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.y, size.z) / 2;
    const outerX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));

    [-1, 1].forEach((side) => {
      const brakeMaterial = new THREE.MeshBasicMaterial({
        color: RED,
        transparent: true,
        opacity: 0.02,
        depthWrite: false,
      });
      const disc = new THREE.Mesh(
        new THREE.TorusGeometry(
          radius * 0.5,
          radius * 0.035,
          7,
          32,
        ),
        brakeMaterial,
      );
      disc.rotation.y = Math.PI / 2;
      disc.position.x = side * outerX * 0.79;
      wheelObject.add(disc);
      brakeMaterials.push(brakeMaterial);
    });
  };
  addWheelTelemetry(rearWheels);
  frontSteeringRigs.forEach(({ spin }) => {
    spin.geometry.computeBoundingBox();
    const wheelBounds = spin.geometry.boundingBox;
    if (!wheelBounds) return;
    const size = wheelBounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.y, size.z) / 2;
    const brakeMaterial = new THREE.MeshBasicMaterial({
      color: RED,
      transparent: true,
      opacity: 0.02,
      depthWrite: false,
    });
    const disc = new THREE.Mesh(
      new THREE.TorusGeometry(
        radius * 0.5,
        radius * 0.035,
        7,
        32,
      ),
      brakeMaterial,
    );
    disc.rotation.y = Math.PI / 2;
    spin.add(disc);
    brakeMaterials.push(brakeMaterial);
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

  const road = buildRoadRibbon(trackLocations);
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

  const firstLocation = trackLocations[0];
  const firstDirectionTarget = trackLocations[3] ?? firstLocation;
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
  let displayedSteering = 0;
  let wheelAngle = 0;
  let mapFrame = 0;
  let vectorFrame = 0;
  let hudFrame = 0;
  const playbackRate = 1.5;
  const lapDuration = telemetry.source.lapDurationMs;
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
        trackLocations,
        motionTime,
        motionDuration,
      );
      const speed = lerp(car.a.speed, car.b.speed, car.mix);
      const rpm = lerp(car.a.rpm, car.b.rpm, car.mix);
      const throttle = lerp(car.a.throttle, car.b.throttle, car.mix);
      const previousLocation = smoothLocation(
        trackLocations,
        (motionTime - 260 + motionDuration) % motionDuration,
        motionDuration,
      );
      const nextLocation = smoothLocation(
        trackLocations,
        (motionTime + 260) % motionDuration,
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
      const targetHeading = Math.atan2(
        nextLocation.x - previousLocation.x,
        nextLocation.y - previousLocation.y,
      );
      const positionDamping = 1 - Math.exp(-delta * 22);
      const headingDamping = 1 - Math.exp(-delta * 9);
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
      displayedSteering +=
        (steering - displayedSteering) * (1 - Math.exp(-delta * 10));
      if (frontSteeringRigs.length > 0) {
        const steeringYaw = -THREE.MathUtils.degToRad(displayedSteering);
        const insideSide = steeringYaw >= 0 ? 1 : -1;
        frontSteeringRigs.forEach(({ side, yaw, spin }) => {
          const ackermannFactor = side === insideSide ? 1.08 : 0.92;
          yaw.rotation.y = steeringYaw * ackermannFactor;
          spin.rotation.x = wheelAngle;
        });
      } else if (frontWheels) {
        frontWheels.rotation.x = frontWheelBaseRotation + wheelAngle;
        frontWheels.rotation.y = -THREE.MathUtils.degToRad(displayedSteering);
      }
      if (rearWheels) {
        rearWheels.rotation.x = rearWheelBaseRotation + wheelAngle;
      }
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
      const scanCycleDuration = 12.4;
      const replayPhase = (elapsed % scanCycleDuration) / scanCycleDuration;
      const scanActive = replayPhase > 0.5 && replayPhase < 0.8;
      const scanProgress = THREE.MathUtils.clamp(
        (replayPhase - 0.5) / 0.3,
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
      const chassisDamping = 1 - Math.exp(-delta * 4.2);
      carRig.rotation.z +=
        (THREE.MathUtils.clamp(-steering * 0.00075, -0.014, 0.014) -
          carRig.rotation.z) *
        chassisDamping;
      carRig.rotation.x +=
        (THREE.MathUtils.clamp(
          longitudinalAcceleration * -0.002,
          -0.016,
          0.016,
        ) -
          carRig.rotation.x) *
        chassisDamping;

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
        drawTrackMap(trackCanvas, trackLocations, location.index);
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
  ].forEach(([x, z]) => {
    const mast = lineFromPoints(
      [
        new THREE.Vector3(x, 0.22, z),
        new THREE.Vector3(x, 0.83, z),
      ],
      INK,
      0.26,
    );
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 9, 7),
      new THREE.MeshBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0.46,
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

  const slot = 0.63;
  const pointCenterX = (point: number) => {
    if (point <= 6) return 0.675 + (6 - point) * slot;
    if (point <= 12) return -3.505 + (12 - point) * slot;
    if (point <= 18) return -3.505 + (point - 13) * slot;
    return 0.675 + (point - 19) * slot;
  };
  for (let boardSide = 0; boardSide < 2; boardSide += 1) {
    for (let index = 0; index < 6; index += 1) {
      const bottomPoint = boardSide === 0 ? 12 - index : 6 - index;
      const pointStart = pointCenterX(bottomPoint) - slot / 2;
      const bottom = technicalSolid(
        pointGeometry(pointStart, pointStart + slot, -2.42, -0.48),
        {
          color: index % 2 === 0 ? 0xd8d8d1 : 0xebebe6,
          opacity: index % 2 === 0 ? 0.14 : 0.07,
          edgeOpacity: index % 2 === 0 ? 0.54 : 0.28,
          threshold: 1,
        },
      );
      const top = technicalSolid(
        pointGeometry(pointStart, pointStart + slot, 2.42, 0.48),
        {
          color: index % 2 === 0 ? 0xebebe6 : 0xd8d8d1,
          opacity: index % 2 === 0 ? 0.07 : 0.14,
          edgeOpacity: index % 2 === 0 ? 0.28 : 0.54,
          threshold: 1,
        },
      );
      root.add(bottom, top);
    }
  }

  const pointPosition = (point: number, stackIndex: number) => {
    const top = point >= 13;
    const edgeZ = top ? 2.1 : -2.1;
    const direction = top ? -1 : 1;
    return new THREE.Vector3(
      pointCenterX(point),
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

  const stackKey = (player: Player, point: number) => `${player}:${point}`;
  const simulatedStacks = new Map<string, BackgammonPiece[]>();
  pieces.forEach((piece) => {
    const key = stackKey(piece.player, piece.initialPoint);
    const stack = simulatedStacks.get(key) ?? [];
    stack.push(piece);
    simulatedStacks.set(key, stack);
  });
  const turnDuration = 5;
  const cycleDuration = turnDuration * turnSequence.length;
  const timeline: Array<{
    turn: number;
    piece: BackgammonPiece;
    from: number;
    to: number;
    start: THREE.Vector3;
    end: THREE.Vector3;
    curve: THREE.QuadraticBezierCurve3;
    startsAt: number;
    endsAt: number;
  }> = [];
  turnSequence.forEach((turn, turnIndex) => {
    turn.moves.forEach((move, moveIndex) => {
      const sourceKey = stackKey(turn.player, move.from);
      const targetKey = stackKey(turn.player, move.to);
      const sourceStack = simulatedStacks.get(sourceKey) ?? [];
      const targetStack = simulatedStacks.get(targetKey) ?? [];
      const piece = sourceStack[sourceStack.length - 1];
      if (!piece) {
        throw new Error(
          `Invalid backgammon move ${move.from}/${move.to}: empty source`,
        );
      }
      const start = pointPosition(move.from, sourceStack.length - 1);
      const end = pointPosition(move.to, targetStack.length);
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
        curve: new THREE.QuadraticBezierCurve3(start, midpoint, end),
        startsAt,
        endsAt: startsAt + (turn.moves.length === 4 ? 0.78 : 1.02),
      });
      sourceStack.pop();
      targetStack.push(piece);
      simulatedStacks.set(sourceKey, sourceStack);
      simulatedStacks.set(targetKey, targetStack);
    });
  });

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
  const boardTarget = new THREE.Vector3(0, 0.2, 0);
  const desiredBoardCamera = new THREE.Vector3();
  camera.lookAt(boardTarget);

  let lastTurnIndex = -1;
  let lastMoveIndex = -1;
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
        const progress = THREE.MathUtils.smootherstep(
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
        const orderedWays = turn.dice[0] === turn.dice[1] ? 1 : 2;
        const probability = ((orderedWays / 36) * 100).toFixed(2);
        setHud(
          hudRoot,
          "dice-caption",
          `${turn.dice[0]}—${turn.dice[1]}`,
        );
        hudRoot
          ?.querySelectorAll<HTMLElement>("[data-die-index]")
          .forEach((die, index) => {
            die.dataset.value = String(turn.dice[index] ?? 1);
            die.classList.remove("is-rolling");
            void die.offsetWidth;
            die.classList.add("is-rolling");
          });
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

const SYMBOL_GRID_SIZE = 40;
const SYMBOL_GRID_STEP = 0.21;
const SYMBOL_GRID_HALF =
  ((SYMBOL_GRID_SIZE - 1) * SYMBOL_GRID_STEP) / 2;
const SYMBOL_PATH_COUNT = 16;
const SYMBOL_VERTICES_PER_PATH = 128;
const SYMBOL_VERTEX_COUNT =
  SYMBOL_PATH_COUNT * SYMBOL_VERTICES_PER_PATH;
const SYMBOL_EDGE_COUNT =
  SYMBOL_PATH_COUNT * (SYMBOL_VERTICES_PER_PATH - 1);

type SymbolName = "PHOENIX" | "OUROBOROS" | "GANDIVA";

type SymbolShape = {
  name: SymbolName;
  paths: THREE.Vector3[][];
  positions: Float32Array;
};

function samplePolyline(
  controlPoints: THREE.Vector3[],
  count = SYMBOL_VERTICES_PER_PATH,
  closed = false,
) {
  const points = closed
    ? [...controlPoints, controlPoints[0]]
    : controlPoints;
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        points[index - 1].distanceTo(points[index]),
    );
  }
  const totalLength = cumulative[cumulative.length - 1];

  return Array.from({ length: count }, (_, index) => {
    const distance = (index / (count - 1)) * totalLength;
    let segment = 0;
    while (
      segment < cumulative.length - 2 &&
      cumulative[segment + 1] < distance
    ) {
      segment += 1;
    }
    const start = cumulative[segment];
    const end = cumulative[segment + 1];
    return points[segment]
      .clone()
      .lerp(
        points[segment + 1],
        (distance - start) / Math.max(0.0001, end - start),
      );
  });
}

function sampleCurve(
  curve: (amount: number) => THREE.Vector3,
  count = SYMBOL_VERTICES_PER_PATH,
) {
  return Array.from({ length: count }, (_, index) =>
    curve(index / (count - 1)),
  );
}

function sampleCatmull(
  controlPoints: THREE.Vector3[],
  closed = false,
  count = SYMBOL_VERTICES_PER_PATH,
) {
  const curve = new THREE.CatmullRomCurve3(
    controlPoints,
    closed,
    "centripetal",
    0.45,
  );
  return Array.from({ length: count }, (_, index) =>
    curve.getPoint(index / (count - 1)),
  );
}

function mirrorSymbolPath(path: THREE.Vector3[]) {
  return path.map(
    (point) => new THREE.Vector3(-point.x, point.y, point.z),
  );
}

function snapSymbolPoint(point: THREE.Vector3) {
  const snap = (value: number) =>
    THREE.MathUtils.clamp(
      Math.round(
        (value + SYMBOL_GRID_HALF) / SYMBOL_GRID_STEP,
      ) *
        SYMBOL_GRID_STEP -
        SYMBOL_GRID_HALF,
      -SYMBOL_GRID_HALF,
      SYMBOL_GRID_HALF,
    );
  return new THREE.Vector3(
    snap(point.x),
    snap(point.y),
    snap(point.z),
  );
}

function buildSymbolShape(
  name: SymbolName,
  sourcePaths: THREE.Vector3[][],
): SymbolShape {
  const paths = sourcePaths.map((path) =>
    path.map((point) =>
      snapSymbolPoint(
        new THREE.Vector3(point.x, point.y, point.z * 1.45),
      ),
    ),
  );
  const positions = new Float32Array(SYMBOL_VERTEX_COUNT * 3);
  paths.forEach((path, pathIndex) => {
    path.forEach((point, vertexIndex) => {
      const offset =
        (pathIndex * SYMBOL_VERTICES_PER_PATH + vertexIndex) * 3;
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
    });
  });
  return { name, paths, positions };
}

function buildPhoenixShape() {
  const outer = samplePolyline(
    [
      new THREE.Vector3(-0.15, -3.75, 0),
      new THREE.Vector3(-0.85, -2.55, 0.35),
      new THREE.Vector3(-2.05, -3.35, -0.5),
      new THREE.Vector3(-1.5, -2.0, 0.5),
      new THREE.Vector3(-3.15, -2.35, -0.55),
      new THREE.Vector3(-2.3, -1.25, 0.5),
      new THREE.Vector3(-3.75, -1.05, -0.72),
      new THREE.Vector3(-2.62, -0.25, 0.52),
      new THREE.Vector3(-4.05, 0.3, -0.78),
      new THREE.Vector3(-2.78, 0.65, 0.48),
      new THREE.Vector3(-3.82, 1.45, -0.62),
      new THREE.Vector3(-2.48, 1.35, 0.45),
      new THREE.Vector3(-3.08, 2.38, -0.42),
      new THREE.Vector3(-1.8, 1.95, 0.58),
      new THREE.Vector3(-1.5, 2.78, 0.18),
      new THREE.Vector3(-0.72, 2.25, 0.76),
      new THREE.Vector3(-0.5, 3.0, 0.5),
      new THREE.Vector3(-0.1, 3.62, 0.42),
      new THREE.Vector3(0.46, 3.35, 0.68),
      new THREE.Vector3(1.08, 3.02, 0.14),
      new THREE.Vector3(0.48, 2.82, 0.72),
      new THREE.Vector3(0.72, 2.25, 0.76),
      new THREE.Vector3(1.5, 2.78, 0.18),
      new THREE.Vector3(1.8, 1.95, 0.58),
      new THREE.Vector3(3.08, 2.38, -0.42),
      new THREE.Vector3(2.48, 1.35, 0.45),
      new THREE.Vector3(3.82, 1.45, -0.62),
      new THREE.Vector3(2.78, 0.65, 0.48),
      new THREE.Vector3(4.05, 0.3, -0.78),
      new THREE.Vector3(2.62, -0.25, 0.52),
      new THREE.Vector3(3.75, -1.05, -0.72),
      new THREE.Vector3(2.3, -1.25, 0.5),
      new THREE.Vector3(3.15, -2.35, -0.55),
      new THREE.Vector3(1.5, -2.0, 0.5),
      new THREE.Vector3(2.05, -3.35, -0.5),
      new THREE.Vector3(0.85, -2.55, 0.35),
      new THREE.Vector3(0.15, -3.75, 0),
    ],
    SYMBOL_VERTICES_PER_PATH,
    true,
  );
  const body = sampleCatmull(
    [
      new THREE.Vector3(-0.18, -2.55, 0.82),
      new THREE.Vector3(-0.72, -1.45, 0.92),
      new THREE.Vector3(-0.58, -0.1, 1.08),
      new THREE.Vector3(-0.72, 1.15, 0.9),
      new THREE.Vector3(-0.35, 2.3, 0.78),
      new THREE.Vector3(0.28, 2.65, 0.68),
      new THREE.Vector3(0.55, 1.35, 0.92),
      new THREE.Vector3(0.52, -0.15, 1.08),
      new THREE.Vector3(0.7, -1.42, 0.92),
      new THREE.Vector3(0.18, -2.55, 0.82),
    ],
    true,
  );
  const head = samplePolyline(
    [
      new THREE.Vector3(-0.38, 2.3, 0.95),
      new THREE.Vector3(-0.5, 3.05, 0.88),
      new THREE.Vector3(-0.08, 3.55, 0.72),
      new THREE.Vector3(0.42, 3.28, 0.92),
      new THREE.Vector3(1.05, 3.02, 0.35),
      new THREE.Vector3(0.46, 2.84, 0.98),
      new THREE.Vector3(0.38, 2.32, 1.04),
    ],
    SYMBOL_VERTICES_PER_PATH,
    true,
  );
  const spine = sampleCatmull([
    new THREE.Vector3(0.02, 3.3, 1.1),
    new THREE.Vector3(-0.08, 2.2, 1.3),
    new THREE.Vector3(0.1, 0.9, 1.42),
    new THREE.Vector3(-0.08, -0.45, 1.4),
    new THREE.Vector3(0.05, -1.75, 1.18),
    new THREE.Vector3(0, -3.6, 0.38),
  ]);
  const leftWing = sampleCatmull([
    new THREE.Vector3(-0.35, 1.55, 1.05),
    new THREE.Vector3(-1.35, 2.15, 0.95),
    new THREE.Vector3(-2.65, 2.3, 0.35),
    new THREE.Vector3(-3.78, 1.45, -0.38),
    new THREE.Vector3(-3.85, 0.28, -0.55),
    new THREE.Vector3(-2.8, -0.35, 0.25),
    new THREE.Vector3(-1.35, 0.05, 0.92),
    new THREE.Vector3(-0.42, 0.72, 1.1),
  ]);
  const rightWing = mirrorSymbolPath(leftWing);
  const leftPrimary = samplePolyline([
    new THREE.Vector3(-0.48, 1.42, 1.2),
    new THREE.Vector3(-1.45, 2.56, 0.72),
    new THREE.Vector3(-1.18, 1.45, 0.98),
    new THREE.Vector3(-2.45, 2.62, 0.28),
    new THREE.Vector3(-1.7, 1.22, 0.9),
    new THREE.Vector3(-3.35, 2.05, -0.22),
    new THREE.Vector3(-2.15, 0.85, 0.72),
    new THREE.Vector3(-3.88, 1.18, -0.5),
    new THREE.Vector3(-2.38, 0.42, 0.66),
    new THREE.Vector3(-3.82, 0.1, -0.48),
    new THREE.Vector3(-1.9, 0.08, 0.82),
    new THREE.Vector3(-0.48, 0.68, 1.18),
  ]);
  const rightPrimary = mirrorSymbolPath(leftPrimary);
  const leftSecondary = samplePolyline([
    new THREE.Vector3(-0.55, 1.28, 0.72),
    new THREE.Vector3(-1.28, 2.05, 0.32),
    new THREE.Vector3(-1.1, 1.18, 0.62),
    new THREE.Vector3(-2.12, 2.05, -0.05),
    new THREE.Vector3(-1.55, 0.9, 0.58),
    new THREE.Vector3(-2.92, 1.58, -0.3),
    new THREE.Vector3(-1.86, 0.55, 0.55),
    new THREE.Vector3(-3.15, 0.78, -0.38),
    new THREE.Vector3(-1.72, 0.25, 0.62),
    new THREE.Vector3(-0.55, 0.72, 0.8),
  ]);
  const rightSecondary = mirrorSymbolPath(leftSecondary);
  const leftTertiary = samplePolyline([
    new THREE.Vector3(-0.48, 1.05, 1.45),
    new THREE.Vector3(-1.08, 1.72, 1.26),
    new THREE.Vector3(-0.92, 0.95, 1.38),
    new THREE.Vector3(-1.72, 1.55, 1.05),
    new THREE.Vector3(-1.32, 0.72, 1.28),
    new THREE.Vector3(-2.18, 1.05, 0.86),
    new THREE.Vector3(-1.45, 0.42, 1.2),
    new THREE.Vector3(-2.18, 0.25, 0.78),
    new THREE.Vector3(-1.12, 0.18, 1.28),
    new THREE.Vector3(-0.42, 0.58, 1.45),
  ]);
  const rightTertiary = mirrorSymbolPath(leftTertiary);
  const leftTail = sampleCatmull([
    new THREE.Vector3(-0.18, -1.35, 1.02),
    new THREE.Vector3(-0.72, -1.92, 0.75),
    new THREE.Vector3(-1.55, -2.55, 0.15),
    new THREE.Vector3(-1.9, -3.58, -0.42),
    new THREE.Vector3(-0.78, -2.78, 0.48),
    new THREE.Vector3(-0.2, -2.25, 0.82),
  ]);
  const rightTail = mirrorSymbolPath(leftTail);
  const centerTail = sampleCatmull([
    new THREE.Vector3(0, -1.3, 1.22),
    new THREE.Vector3(-0.25, -2.05, 0.9),
    new THREE.Vector3(0.12, -2.72, 0.45),
    new THREE.Vector3(0, -4.0, -0.12),
    new THREE.Vector3(0.42, -2.85, 0.5),
    new THREE.Vector3(0.18, -1.82, 0.96),
  ]);
  const crest = samplePolyline([
    new THREE.Vector3(-0.42, 3.02, 0.82),
    new THREE.Vector3(-0.72, 3.55, 0.25),
    new THREE.Vector3(-0.15, 3.28, 1.05),
    new THREE.Vector3(0.02, 3.92, 0.3),
    new THREE.Vector3(0.25, 3.3, 1.08),
    new THREE.Vector3(0.72, 3.58, 0.28),
    new THREE.Vector3(0.45, 3.02, 0.88),
  ]);

  return buildSymbolShape("PHOENIX", [
    outer,
    body,
    head,
    spine,
    leftWing,
    rightWing,
    leftPrimary,
    rightPrimary,
    leftSecondary,
    rightSecondary,
    leftTertiary,
    rightTertiary,
    leftTail,
    rightTail,
    centerTail,
    crest,
  ]);
}

function buildOuroborosShape() {
  const ring = (
    radius: number,
    zOffset: number,
    depth: number,
    phase = 0,
    radialWave = 0,
    waveFrequency = 1,
  ) =>
    sampleCurve((amount) => {
      const angle = amount * Math.PI * 2 + phase;
      const liveRadius =
        radius + Math.sin(angle * waveFrequency) * radialWave;
      return new THREE.Vector3(
        Math.cos(angle) * liveRadius,
        Math.sin(angle) * liveRadius,
        zOffset + Math.sin(angle * 2) * depth,
      );
    });
  const headOuter = sampleCatmull(
    [
      new THREE.Vector3(2.58, 0.05, 0.24),
      new THREE.Vector3(2.78, 0.92, 0.46),
      new THREE.Vector3(3.48, 1.2, 0.72),
      new THREE.Vector3(4.02, 0.58, 0.78),
      new THREE.Vector3(3.83, -0.18, 0.46),
      new THREE.Vector3(3.18, -0.48, 0.28),
    ],
    true,
  );
  const headInner = sampleCatmull(
    [
      new THREE.Vector3(2.82, 0.18, -0.28),
      new THREE.Vector3(2.98, 0.78, -0.1),
      new THREE.Vector3(3.46, 0.98, 0.05),
      new THREE.Vector3(3.8, 0.52, 0.12),
      new THREE.Vector3(3.62, 0.02, -0.08),
      new THREE.Vector3(3.16, -0.18, -0.24),
    ],
    true,
  );
  const jaw = samplePolyline([
    new THREE.Vector3(2.72, 0.36, 0.68),
    new THREE.Vector3(3.18, 0.12, 0.92),
    new THREE.Vector3(3.78, 0.0, 0.72),
    new THREE.Vector3(3.4, -0.23, 0.52),
    new THREE.Vector3(2.85, -0.04, 0.38),
  ]);
  const bite = samplePolyline([
    new THREE.Vector3(3.92, 0.52, 0.7),
    new THREE.Vector3(3.52, 0.3, 0.48),
    new THREE.Vector3(3.02, 0.12, 0.18),
    new THREE.Vector3(2.64, -0.05, -0.12),
    new THREE.Vector3(3.08, -0.28, 0.04),
    new THREE.Vector3(3.64, -0.08, 0.34),
  ]);
  const eye = sampleCurve((amount) => {
    const angle = amount * Math.PI * 2;
    return new THREE.Vector3(
      3.48 + Math.cos(angle) * 0.22,
      0.67 + Math.sin(angle) * 0.17,
      1.02,
    );
  });
  const pupil = sampleCurve((amount) => {
    const angle = amount * Math.PI * 2;
    return new THREE.Vector3(
      3.48 + Math.cos(angle) * 0.07,
      0.67 + Math.sin(angle) * 0.13,
      1.18,
    );
  });

  return buildSymbolShape("OUROBOROS", [
    ring(3.28, 0.58, 0.18),
    ring(3.28, -0.58, 0.18),
    ring(2.55, 0.5, 0.15),
    ring(2.55, -0.5, 0.15),
    ring(2.94, 0.9, 0.12, 0.04, 0.05, 12),
    ring(2.94, -0.9, 0.12, -0.04, 0.05, 12),
    ring(2.73, 0.2, 0.32, 0.1, 0.13, 18),
    ring(3.08, 0.14, 0.3, 0.36, 0.11, 18),
    ring(2.72, -0.2, 0.32, 0.62, 0.13, 18),
    ring(3.08, -0.14, 0.3, 0.88, 0.11, 18),
    headOuter,
    headInner,
    jaw,
    bite,
    eye,
    pupil,
  ]);
}

function buildGandivaShape() {
  const limb = (depth: number, inset: number) =>
    sampleCurve((amount) => {
      const y = 3.42 - amount * 6.84;
      const normalizedY = y / 3.42;
      const centerBow =
        1.72 -
        3.52 * Math.pow(1 - Math.abs(normalizedY), 0.7) +
        Math.sign(normalizedY || 1) *
          Math.sin(Math.abs(normalizedY) * Math.PI) *
          0.2;
      return new THREE.Vector3(
        centerBow + Math.sin(amount * Math.PI) * inset,
        y,
        depth + Math.sin(amount * Math.PI) * 0.18,
      );
    });
  const frontOuter = limb(0.62, 0);
  const frontInner = limb(0.98, 0.32);
  const backOuter = limb(-0.72, 0);
  const backInner = limb(-0.34, 0.32);
  const stringFront = samplePolyline([
    new THREE.Vector3(1.72, 3.42, 0.72),
    new THREE.Vector3(1.05, 2.05, 0.72),
    new THREE.Vector3(-1.72, 0, 0.72),
    new THREE.Vector3(1.05, -2.05, 0.72),
    new THREE.Vector3(1.72, -3.42, 0.72),
  ]);
  const stringBack = samplePolyline([
    new THREE.Vector3(1.72, 3.42, -0.55),
    new THREE.Vector3(1.05, 2.05, -0.55),
    new THREE.Vector3(-1.72, 0, -0.55),
    new THREE.Vector3(1.05, -2.05, -0.55),
    new THREE.Vector3(1.72, -3.42, -0.55),
  ]);
  const arrowFront = samplePolyline([
    new THREE.Vector3(-3.72, 0.08, 1.02),
    new THREE.Vector3(3.18, 0.08, 1.02),
  ]);
  const arrowBack = samplePolyline([
    new THREE.Vector3(-3.72, -0.08, 0.42),
    new THREE.Vector3(3.18, -0.08, 0.42),
  ]);
  const arrowheadOuter = samplePolyline(
    [
      new THREE.Vector3(4.02, 0.08, 0.75),
      new THREE.Vector3(3.08, 0.62, 0.92),
      new THREE.Vector3(3.28, 0.08, 0.98),
      new THREE.Vector3(3.08, -0.48, 0.92),
    ],
    SYMBOL_VERTICES_PER_PATH,
    true,
  );
  const arrowheadInner = samplePolyline(
    [
      new THREE.Vector3(3.82, 0.08, 0.34),
      new THREE.Vector3(3.18, 0.42, 0.42),
      new THREE.Vector3(3.34, 0.08, 0.48),
      new THREE.Vector3(3.18, -0.28, 0.42),
    ],
    SYMBOL_VERTICES_PER_PATH,
    true,
  );
  const gripOuter = sampleCatmull(
    [
      new THREE.Vector3(-1.92, 0.68, 0.72),
      new THREE.Vector3(-1.32, 0.42, 1.08),
      new THREE.Vector3(-1.24, -0.42, 1.08),
      new THREE.Vector3(-1.92, -0.68, 0.72),
      new THREE.Vector3(-2.24, -0.3, 0.18),
      new THREE.Vector3(-2.24, 0.3, 0.18),
    ],
    true,
  );
  const gripInner = sampleCatmull(
    [
      new THREE.Vector3(-1.82, 0.48, -0.36),
      new THREE.Vector3(-1.45, 0.3, 0),
      new THREE.Vector3(-1.4, -0.3, 0),
      new THREE.Vector3(-1.82, -0.48, -0.36),
      new THREE.Vector3(-2.05, -0.22, -0.62),
      new THREE.Vector3(-2.05, 0.22, -0.62),
    ],
    true,
  );
  const topScrollFront = sampleCatmull([
    new THREE.Vector3(1.72, 3.42, 0.62),
    new THREE.Vector3(2.18, 3.78, 0.72),
    new THREE.Vector3(2.75, 3.55, 0.84),
    new THREE.Vector3(2.82, 3.05, 0.9),
    new THREE.Vector3(2.38, 2.8, 0.92),
    new THREE.Vector3(1.88, 3.0, 0.82),
    new THREE.Vector3(1.45, 3.18, 0.72),
  ]);
  const topScrollBack = sampleCatmull([
    new THREE.Vector3(1.72, 3.42, -0.72),
    new THREE.Vector3(2.18, 3.78, -0.62),
    new THREE.Vector3(2.75, 3.55, -0.5),
    new THREE.Vector3(2.82, 3.05, -0.44),
    new THREE.Vector3(2.38, 2.8, -0.42),
    new THREE.Vector3(1.88, 3.0, -0.52),
    new THREE.Vector3(1.45, 3.18, -0.62),
  ]);
  const bottomScrollFront = topScrollFront.map(
    (point) => new THREE.Vector3(point.x, -point.y, point.z),
  );
  const bottomScrollBack = topScrollBack.map(
    (point) => new THREE.Vector3(point.x, -point.y, point.z),
  );

  return buildSymbolShape("GANDIVA", [
    frontOuter,
    frontInner,
    backOuter,
    backInner,
    stringFront,
    stringBack,
    arrowFront,
    arrowBack,
    arrowheadOuter,
    arrowheadInner,
    gripOuter,
    gripInner,
    topScrollFront,
    topScrollBack,
    bottomScrollFront,
    bottomScrollBack,
  ]);
}

function roundPointMaterial(
  color: number,
  opacity: number,
  pointSize: number,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPointSize: { value: pointSize },
    },
    vertexShader: `
      uniform float uPointSize;
      varying float vDepth;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(10.0 / max(1.0, -viewPosition.z), 0.65, 1.65);
        gl_PointSize = uPointSize * perspective;
        gl_Position = projectionMatrix * viewPosition;
        vDepth = perspective;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vDepth;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float edge = 1.0 - smoothstep(0.32, 0.5, radius);
        gl_FragColor = vec4(uColor, edge * uOpacity * mix(0.68, 1.0, vDepth));
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}

function formatSigned(value: number) {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized >= 0 ? "+" : "−"}${Math.abs(normalized).toFixed(2)}`;
}

function buildSymbolScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  hudRoot: HTMLDivElement | null,
): SceneController {
  const root = new THREE.Group();
  scene.add(root);

  const latticePositions = new Float32Array(
    SYMBOL_GRID_SIZE ** 3 * 3,
  );
  let latticeOffset = 0;
  for (let x = 0; x < SYMBOL_GRID_SIZE; x += 1) {
    for (let y = 0; y < SYMBOL_GRID_SIZE; y += 1) {
      for (let z = 0; z < SYMBOL_GRID_SIZE; z += 1) {
        latticePositions[latticeOffset] =
          -SYMBOL_GRID_HALF + x * SYMBOL_GRID_STEP;
        latticePositions[latticeOffset + 1] =
          -SYMBOL_GRID_HALF + y * SYMBOL_GRID_STEP;
        latticePositions[latticeOffset + 2] =
          -SYMBOL_GRID_HALF + z * SYMBOL_GRID_STEP;
        latticeOffset += 3;
      }
    }
  }
  const latticeGeometry = new THREE.BufferGeometry();
  latticeGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(latticePositions, 3),
  );
  const latticeMaterial = roundPointMaterial(INK, 0.095, 1.38);
  const lattice = new THREE.Points(latticeGeometry, latticeMaterial);
  lattice.frustumCulled = false;
  root.add(lattice);

  const boundary = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        SYMBOL_GRID_HALF * 2 + SYMBOL_GRID_STEP,
        SYMBOL_GRID_HALF * 2 + SYMBOL_GRID_STEP,
        SYMBOL_GRID_HALF * 2 + SYMBOL_GRID_STEP,
      ),
    ),
    new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    }),
  );
  root.add(boundary);

  const shapes = [
    buildPhoenixShape(),
    buildOuroborosShape(),
    buildGandivaShape(),
  ];
  const activePositions = new Float32Array(shapes[0].positions);
  const pointGeometry = new THREE.BufferGeometry();
  const pointAttribute = new THREE.BufferAttribute(activePositions, 3);
  pointAttribute.setUsage(THREE.DynamicDrawUsage);
  pointGeometry.setAttribute("position", pointAttribute);
  const activePointMaterial = roundPointMaterial(RED, 0.94, 3.15);
  const activePoints = new THREE.Points(
    pointGeometry,
    activePointMaterial,
  );
  activePoints.frustumCulled = false;
  root.add(activePoints);

  const linePositions = new Float32Array(
    SYMBOL_EDGE_COUNT * 2 * 3,
  );
  const lineGeometry = new THREE.BufferGeometry();
  const lineAttribute = new THREE.BufferAttribute(linePositions, 3);
  lineAttribute.setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute("position", lineAttribute);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: RED,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const activeLines = new THREE.LineSegments(
    lineGeometry,
    lineMaterial,
  );
  activeLines.frustumCulled = false;
  root.add(activeLines);

  const arcFields = shapes.map((shape, shapeIndex) => {
    const nextShape = shapes[(shapeIndex + 1) % shapes.length];
    return Array.from({ length: SYMBOL_VERTEX_COUNT }, (_, index) => {
      const offset = index * 3;
      const from = new THREE.Vector3(
        shape.positions[offset],
        shape.positions[offset + 1],
        shape.positions[offset + 2],
      );
      const to = new THREE.Vector3(
        nextShape.positions[offset],
        nextShape.positions[offset + 1],
        nextShape.positions[offset + 2],
      );
      const direction = to.clone().sub(from);
      const distance = direction.length();
      if (distance < 0.001) return new THREE.Vector3();
      const pathIndex = Math.floor(index / SYMBOL_VERTICES_PER_PATH);
      const pathAmount =
        (index % SYMBOL_VERTICES_PER_PATH) /
        (SYMBOL_VERTICES_PER_PATH - 1);
      const candidate = new THREE.Vector3(
        Math.sin(pathIndex * 1.31 + pathAmount * Math.PI) * 0.4,
        Math.cos(pathIndex * 0.83 + pathAmount * Math.PI * 0.75) *
          0.28,
        Math.sin(
          shapeIndex * 1.4 +
            pathIndex * 0.57 +
            pathAmount * Math.PI,
        ),
      );
      return candidate
        .normalize()
        .multiplyScalar(Math.min(0.58, distance * 0.12));
    });
  });

  const desiredCamera = new THREE.Vector3();
  const cameraLook = new THREE.Vector3(0, 0, 0);
  const targetLook = new THREE.Vector3(0, 0.05, 0);
  const startColor = new THREE.Color(INK);
  const resolvedColor = new THREE.Color(RED);
  const workingColor = new THREE.Color();
  const previous = new THREE.Vector3();
  const current = new THREE.Vector3();
  const next = new THREE.Vector3();
  const segmentA = new THREE.Vector3();
  const segmentB = new THREE.Vector3();
  const morphDuration = 3.15;
  const holdDuration = 2.35;
  const cycleDuration = morphDuration + holdDuration;
  let hudFrame = 0;
  camera.position.set(6.1, 3.45, 13.45);
  camera.lookAt(targetLook);

  const writeLinePositions = () => {
    let writeOffset = 0;
    for (let path = 0; path < SYMBOL_PATH_COUNT; path += 1) {
      const startVertex = path * SYMBOL_VERTICES_PER_PATH;
      for (
        let vertex = 0;
        vertex < SYMBOL_VERTICES_PER_PATH - 1;
        vertex += 1
      ) {
        const a = (startVertex + vertex) * 3;
        const b = (startVertex + vertex + 1) * 3;
        linePositions[writeOffset] = activePositions[a];
        linePositions[writeOffset + 1] = activePositions[a + 1];
        linePositions[writeOffset + 2] = activePositions[a + 2];
        linePositions[writeOffset + 3] = activePositions[b];
        linePositions[writeOffset + 4] = activePositions[b + 1];
        linePositions[writeOffset + 5] = activePositions[b + 2];
        writeOffset += 6;
      }
    }
    lineAttribute.needsUpdate = true;
  };
  writeLinePositions();

  return {
    root,
    update(elapsed, delta, view) {
      const cycleIndex = Math.floor(elapsed / cycleDuration);
      const shapeIndex = cycleIndex % shapes.length;
      const nextShapeIndex = (shapeIndex + 1) % shapes.length;
      const localTime = elapsed % cycleDuration;
      const isMorphing = localTime >= holdDuration;
      const rawMorph = THREE.MathUtils.clamp(
        (localTime - holdDuration) / morphDuration,
        0,
        1,
      );
      const fromShape = shapes[shapeIndex];
      const toShape = shapes[nextShapeIndex];
      const arcs = arcFields[shapeIndex];
      let squaredDistance = 0;
      let squaredRange = 0;

      for (let index = 0; index < SYMBOL_VERTEX_COUNT; index += 1) {
        const offset = index * 3;
        const stagger =
          ((index % SYMBOL_VERTICES_PER_PATH) /
            (SYMBOL_VERTICES_PER_PATH - 1)) *
            0.16 +
          Math.floor(index / SYMBOL_VERTICES_PER_PATH) * 0.006;
        const progress = isMorphing
          ? THREE.MathUtils.smootherstep(
              (rawMorph - stagger) / Math.max(0.001, 1 - stagger),
              0,
              1,
            )
          : 0;
        const arcAmount = Math.sin(progress * Math.PI);
        const fromX = fromShape.positions[offset];
        const fromY = fromShape.positions[offset + 1];
        const fromZ = fromShape.positions[offset + 2];
        const toX = toShape.positions[offset];
        const toY = toShape.positions[offset + 1];
        const toZ = toShape.positions[offset + 2];
        activePositions[offset] =
          lerp(fromX, toX, progress) + arcs[index].x * arcAmount;
        activePositions[offset + 1] =
          lerp(fromY, toY, progress) + arcs[index].y * arcAmount;
        activePositions[offset + 2] =
          lerp(fromZ, toZ, progress) + arcs[index].z * arcAmount;
        const metricX = isMorphing ? toX : fromX;
        const metricY = isMorphing ? toY : fromY;
        const metricZ = isMorphing ? toZ : fromZ;
        const dx = activePositions[offset] - metricX;
        const dy = activePositions[offset + 1] - metricY;
        const dz = activePositions[offset + 2] - metricZ;
        squaredDistance += dx * dx + dy * dy + dz * dz;
        const rangeX = fromX - toX;
        const rangeY = fromY - toY;
        const rangeZ = fromZ - toZ;
        squaredRange +=
          rangeX * rangeX + rangeY * rangeY + rangeZ * rangeZ;
      }
      pointAttribute.needsUpdate = true;
      writeLinePositions();

      const convergence = isMorphing
        ? THREE.MathUtils.clamp(
            1 -
              Math.sqrt(
                squaredDistance / Math.max(0.0001, squaredRange),
              ),
            0,
            1,
          )
        : 1;
      const redResolve = isMorphing
        ? THREE.MathUtils.smootherstep(convergence, 0.72, 0.99)
        : 1;
      workingColor.lerpColors(startColor, resolvedColor, redResolve);
      lineMaterial.color.copy(workingColor);
      lineMaterial.opacity = 0.46 + redResolve * 0.42;
      (
        activePointMaterial.uniforms.uColor.value as THREE.Color
      ).copy(workingColor);
      activePointMaterial.uniforms.uOpacity.value =
        0.72 + redResolve * 0.24;

      const horizontalDistance =
        view.distance * Math.cos(view.pitch);
      desiredCamera.set(
        Math.sin(view.yaw) * horizontalDistance,
        Math.sin(view.pitch) * view.distance,
        Math.cos(view.yaw) * horizontalDistance,
      );
      const damping = 1 - Math.exp(-delta * 10);
      camera.position.lerp(desiredCamera, damping);
      cameraLook.lerp(targetLook, damping);
      camera.lookAt(cameraLook);

      hudFrame += 1;
      if (hudFrame % 3 !== 0) return;

      const minimum = new THREE.Vector3(Infinity, Infinity, Infinity);
      const maximum = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      const centroid = new THREE.Vector3();
      for (let index = 0; index < SYMBOL_VERTEX_COUNT; index += 1) {
        const offset = index * 3;
        current.set(
          activePositions[offset],
          activePositions[offset + 1],
          activePositions[offset + 2],
        );
        minimum.min(current);
        maximum.max(current);
        centroid.add(current);
      }
      centroid.multiplyScalar(1 / SYMBOL_VERTEX_COUNT);

      let totalEdgeLength = 0;
      let totalBend = 0;
      let bendSamples = 0;
      let closedPaths = 0;
      for (let path = 0; path < SYMBOL_PATH_COUNT; path += 1) {
        const start = path * SYMBOL_VERTICES_PER_PATH;
        const firstOffset = start * 3;
        const lastOffset =
          (start + SYMBOL_VERTICES_PER_PATH - 1) * 3;
        previous.set(
          activePositions[firstOffset],
          activePositions[firstOffset + 1],
          activePositions[firstOffset + 2],
        );
        next.set(
          activePositions[lastOffset],
          activePositions[lastOffset + 1],
          activePositions[lastOffset + 2],
        );
        if (previous.distanceTo(next) < SYMBOL_GRID_STEP * 0.8) {
          closedPaths += 1;
        }
        for (
          let vertex = 0;
          vertex < SYMBOL_VERTICES_PER_PATH - 1;
          vertex += 1
        ) {
          const a = (start + vertex) * 3;
          const b = (start + vertex + 1) * 3;
          segmentA.set(
            activePositions[a],
            activePositions[a + 1],
            activePositions[a + 2],
          );
          segmentB.set(
            activePositions[b],
            activePositions[b + 1],
            activePositions[b + 2],
          );
          totalEdgeLength += segmentA.distanceTo(segmentB);
        }
        for (
          let vertex = 1;
          vertex < SYMBOL_VERTICES_PER_PATH - 1;
          vertex += 1
        ) {
          const a = (start + vertex - 1) * 3;
          const b = (start + vertex) * 3;
          const c = (start + vertex + 1) * 3;
          previous.set(
            activePositions[a],
            activePositions[a + 1],
            activePositions[a + 2],
          );
          current.set(
            activePositions[b],
            activePositions[b + 1],
            activePositions[b + 2],
          );
          next.set(
            activePositions[c],
            activePositions[c + 1],
            activePositions[c + 2],
          );
          segmentA.copy(previous).sub(current);
          segmentB.copy(next).sub(current);
          if (
            segmentA.lengthSq() > 0.00001 &&
            segmentB.lengthSq() > 0.00001
          ) {
            totalBend += Math.PI - segmentA.angleTo(segmentB);
            bendSamples += 1;
          }
        }
      }
      const bounds = maximum.clone().sub(minimum);
      const rmsDisplacement = Math.sqrt(
        squaredDistance / SYMBOL_VERTEX_COUNT,
      );
      const shownName = isMorphing
        ? `${fromShape.name} → ${toShape.name}`
        : fromShape.name;
      setHud(hudRoot, "symbol", shownName);
      setHud(
        hudRoot,
        "symbol-state",
        isMorphing ? "RECONFIGURING" : "RESOLVED",
      );
      setHud(
        hudRoot,
        "symbol-phase",
        isMorphing
          ? `TARGET / ${toShape.name}`
          : `NEXT / ${toShape.name}`,
      );
      setHud(
        hudRoot,
        "symbol-convergence",
        `${(convergence * 100).toFixed(1)}%`,
      );
      setHudWidth(hudRoot, "symbol-convergence-bar", convergence * 100);
      setHud(hudRoot, "symbol-closed", String(closedPaths));
      setHud(
        hudRoot,
        "symbol-bounds",
        `${bounds.x.toFixed(2)} × ${bounds.y.toFixed(2)} × ${bounds.z.toFixed(2)}`,
      );
      setHud(
        hudRoot,
        "symbol-centroid",
        `${formatSigned(centroid.x)} / ${formatSigned(centroid.y)} / ${formatSigned(centroid.z)}`,
      );
      setHud(
        hudRoot,
        "symbol-length",
        totalEdgeLength.toFixed(2),
      );
      setHud(
        hudRoot,
        "symbol-bend",
        `${THREE.MathUtils.radToDeg(
          totalBend / Math.max(1, bendSamples),
        ).toFixed(2)}°`,
      );
      setHud(
        hudRoot,
        "symbol-rms",
        rmsDisplacement.toFixed(3),
      );
    },
  };
}

function FormulaRail({
  side,
  trackCanvasRef,
}: {
  side: "left" | "right";
  trackCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  if (side === "left") {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      <section className="track-inset" aria-label="Recorded lap position">
        <canvas ref={trackCanvasRef} />
        <span>SILVERSTONE / RECORDED XY</span>
      </section>

      <section className="formula-derived">
        <strong>VEHICLE STATE / DERIVED</strong>
        <span data-hud="derived">+0.0° STEER · 0.0G LAT</span>
        <span data-hud="temperature">320°C / SIM</span>
        <span data-hud="model-state">LOADING / GEOMETRY + LAP</span>
      </section>

      <div className="scene-credits">
        <a href="https://openf1.org/" target="_blank" rel="noreferrer">
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

function BackgammonRail({ side }: { side: "left" | "right" }) {
  if (side === "left") {
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

        <DiceVignette />
      </>
    );
  }

  return (
    <>
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
    </>
  );
}

function SymbolRail({ side }: { side: "left" | "right" }) {
  if (side === "left") {
    return (
      <>
        <section className="symbol-primary">
          <span>CURRENT FIGURE</span>
          <strong className="signal-copy" data-hud="symbol">
            PHOENIX
          </strong>
          <div>
            <span>STATE</span>
            <b data-hud="symbol-state">RESOLVED</b>
          </div>
          <div>
            <span data-hud="symbol-phase">NEXT / OUROBOROS</span>
            <b data-hud="symbol-convergence">100.0%</b>
          </div>
          <i className="symbol-convergence">
            <em data-hud="symbol-convergence-bar" />
          </i>
        </section>

        <section className="symbol-lattice">
          <strong>COORDINATE FIELD</strong>
          <span>
            LATTICE{" "}
            <b>
              {SYMBOL_GRID_SIZE} × {SYMBOL_GRID_SIZE} ×{" "}
              {SYMBOL_GRID_SIZE}
            </b>
          </span>
          <span>
            POINTS{" "}
            <b>{(SYMBOL_GRID_SIZE ** 3).toLocaleString("en-US")}</b>
          </span>
          <span>
            PITCH <b>{SYMBOL_GRID_STEP.toFixed(2)} U</b>
          </span>
          <span>
            ACTIVE <b>{SYMBOL_VERTEX_COUNT.toLocaleString("en-US")}</b>
          </span>
        </section>

        <p className="symbol-proof">
          ONE VERTEX SET · THREE TARGET GEOMETRIES · CONTINUOUS
          CORRESPONDENCE
        </p>
      </>
    );
  }

  return (
    <>
      <section className="symbol-topology">
        <strong>LIVE GRAPH / CURRENT FRAME</strong>
        <p>
          <span>VERTICES</span>
          <b>{SYMBOL_VERTEX_COUNT.toLocaleString("en-US")}</b>
        </p>
        <p>
          <span>EDGES</span>
          <b>{SYMBOL_EDGE_COUNT.toLocaleString("en-US")}</b>
        </p>
        <p>
          <span>PATHS</span>
          <b>{SYMBOL_PATH_COUNT}</b>
        </p>
        <p>
          <span>CLOSED PATHS</span>
          <b data-hud="symbol-closed">3</b>
        </p>
      </section>

      <section className="symbol-measures">
        <strong>GEOMETRIC MEASURES / LIVE</strong>
        <span>BOUNDS / X × Y × Z</span>
        <b data-hud="symbol-bounds">8.00 × 6.72 × 1.60</b>
        <span>CENTROID / X · Y · Z</span>
        <b data-hud="symbol-centroid">+0.00 / +0.00 / +0.00</b>
        <span>TOTAL EDGE LENGTH</span>
        <b data-hud="symbol-length">–––</b>
        <span>MEAN VERTEX BEND</span>
        <b data-hud="symbol-bend">––°</b>
        <span>RMS Δ TO TARGET</span>
        <b data-hud="symbol-rms">0.000</b>
      </section>

      <p className="symbol-invariant">
        ALL VALUES DERIVED FROM THE RENDERED POSITION BUFFER
      </p>
    </>
  );
}

const DIE_PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

function DieFace({ value }: { value: number }) {
  return (
    <div className={`die-face die-face-${value}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i
          className={DIE_PIPS[value].includes(index + 1) ? "is-pip" : ""}
          key={index}
        />
      ))}
    </div>
  );
}

function DiceVignette() {
  return (
    <section className="dice-roll-vignette" aria-label="Live dice roll">
      <div className="dice-vignette-heading">
        <span>ROLL / LIVE</span>
        <strong data-hud="dice-caption">6—1</strong>
      </div>
      <div className="dice-vignette-stage">
        {[6, 1].map((initialValue, dieIndex) => (
          <div
            className="die-flight is-rolling"
            data-die-index={dieIndex}
            data-value={initialValue}
            key={dieIndex}
          >
            <div className="die-cube">
              {Array.from({ length: 6 }, (_, face) => (
                <DieFace value={face + 1} key={face} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SceneOverlay() {
  return (
    <div className="scene-overlay">
      <p className="view-hint">
        DRAG / ORBIT · SCROLL / ZOOM · DOUBLE-CLICK / RESET
      </p>
    </div>
  );
}

const VIEW_CONFIG: Record<
  VisualMode,
  SceneView & { minimumPitch: number; minimumDistance: number; maximumDistance: number }
> = {
  1: {
    yaw: 0.04,
    pitch: 0.45,
    distance: 9.15,
    minimumPitch: 0.12,
    minimumDistance: 6.4,
    maximumDistance: 17,
  },
  2: {
    yaw: 0.676,
    pitch: 0.79,
    distance: 13.95,
    minimumPitch: 0.28,
    minimumDistance: 8.5,
    maximumDistance: 21,
  },
  3: {
    yaw: 0.06,
    pitch: 0.15,
    distance: 15.2,
    minimumPitch: -0.18,
    minimumDistance: 9.2,
    maximumDistance: 23,
  },
};

function defaultView(mode: VisualMode): SceneView {
  const config = VIEW_CONFIG[mode];
  return {
    yaw: config.yaw,
    pitch: config.pitch,
    distance: config.distance,
  };
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hudRootRef = useRef<HTMLDivElement>(null);
  const trackCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<SceneView>(defaultView(mode));
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    x: 0,
    y: 0,
  });
  const resetView = () => {
    viewRef.current = defaultView(mode);
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
        if (mode === 1) {
          controller = await buildFormulaScene(
            scene,
            camera,
            hudRootRef.current,
            trackCanvasRef.current,
          );
        } else if (mode === 2) {
          controller = buildBackgammonScene(
            scene,
            camera,
            hudRootRef.current,
          );
        } else {
          controller = buildSymbolScene(
            scene,
            camera,
            hudRootRef.current,
          );
        }
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
            : mode === 2
              ? 49
              : 46
          : mode === 1
            ? 35
            : mode === 2
              ? 37
              : 34;
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
    <div className={`system-frame mode-${mode}`} ref={hudRootRef}>
      <aside className="telemetry-rail telemetry-rail-left">
        {mode === 1 ? (
          <FormulaRail side="left" trackCanvasRef={trackCanvasRef} />
        ) : mode === 2 ? (
          <BackgammonRail side="left" />
        ) : (
          <SymbolRail side="left" />
        )}
      </aside>

      <div
        className="system-scene"
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
            VIEW_CONFIG[mode].minimumPitch,
            1.3,
          );
          drag.x = event.clientX;
          drag.y = event.clientY;
        }}
        onPointerUp={(event) => {
          if (dragRef.current.pointerId !== event.pointerId) return;
          dragRef.current.active = false;
          dragRef.current.pointerId = -1;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          event.currentTarget.style.cursor = "grab";
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
            VIEW_CONFIG[mode].minimumDistance,
            VIEW_CONFIG[mode].maximumDistance,
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
              VIEW_CONFIG[mode].minimumPitch,
              viewRef.current.pitch - 0.08,
            );
          }
          if (event.key === "+" || event.key === "=") {
            viewRef.current.distance = Math.max(
              VIEW_CONFIG[mode].minimumDistance,
              viewRef.current.distance - 0.8,
            );
          }
          if (event.key === "-") {
            viewRef.current.distance = Math.min(
              VIEW_CONFIG[mode].maximumDistance,
              viewRef.current.distance + 0.8,
            );
          }
          if (event.key === "0") resetView();
        }}
        aria-label={
          mode === 1
            ? "Interactive Formula car replaying recorded Silverstone telemetry. Drag to orbit and scroll to zoom."
            : mode === 2
              ? "Interactive five-turn backgammon simulation with exact state analysis. Drag to orbit and scroll to zoom."
              : "Interactive high-resolution lattice reconfiguring between a phoenix, ouroboros, and Gandiva bow. Drag to orbit and scroll to zoom."
        }
        role="application"
      >
        <SceneOverlay />
      </div>

      <aside className="telemetry-rail telemetry-rail-right">
        {mode === 1 ? (
          <FormulaRail side="right" trackCanvasRef={trackCanvasRef} />
        ) : mode === 2 ? (
          <BackgammonRail side="right" />
        ) : (
          <SymbolRail side="right" />
        )}
      </aside>
    </div>
  );
}
