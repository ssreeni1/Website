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
  update: (elapsed: number, delta: number) => void;
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

function buildRoadRibbon(sampleCount: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(sampleCount * 2 * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const indices: number[] = [];
  for (let i = 0; i < sampleCount - 1; i += 1) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  geometry.setIndex(indices);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xe9e9e4,
      transparent: true,
      opacity: 0.72,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const left = lineFromPoints(
    Array.from({ length: sampleCount }, () => new THREE.Vector3()),
    INK,
    0.32,
  );
  const right = lineFromPoints(
    Array.from({ length: sampleCount }, () => new THREE.Vector3()),
    INK,
    0.32,
  );
  const centerGeometry = new THREE.BufferGeometry();
  centerGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(sampleCount * 3), 3),
  );
  const center = new THREE.Points(
    centerGeometry,
    new THREE.PointsMaterial({
      color: RED,
      size: 0.035,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  return { mesh, left, right, center, sampleCount };
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

  const shellMaterials: Array<{
    material: THREE.MeshStandardMaterial;
    baseOpacity: number;
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
      ? 0.46
      : isInterior
        ? 0.065
        : isGlass
          ? 0.035
          : 0.1;
    const material = new THREE.MeshStandardMaterial({
      color: isWheel ? 0x282828 : isInterior ? 0x565652 : 0x3b3b39,
      roughness: isWheel ? 0.82 : 0.62,
      metalness: isInterior ? 0.28 : 0.08,
      transparent: true,
      opacity: baseOpacity,
      side: THREE.DoubleSide,
      depthWrite: isWheel,
    });
    mesh.material = material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shellMaterials.push({ material, baseOpacity });

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

  const road = buildRoadRibbon(83);
  road.mesh.position.y = -0.08;
  road.left.position.y = -0.068;
  road.right.position.y = -0.068;
  road.center.position.y = -0.06;
  root.add(road.mesh, road.left, road.right, road.center);
  carRig.scale.setScalar(1.12);

  const roadPoints = Array.from(
    { length: road.sampleCount },
    () => new THREE.Vector3(),
  );
  const roadHalfWidth = 1.92;
  const coordinateScale = 0.012;
  const updateRoad = (
    active: SampleWindow<LocationSample>,
    currentX: number,
    currentY: number,
  ) => {
    const locations = telemetry.location;
    const directionA = locations[Math.max(0, active.index - 2)];
    const directionB =
      locations[Math.min(locations.length - 1, active.index + 2)];
    const headingX = directionB.x - directionA.x;
    const headingZ = directionB.y - directionA.y;
    const rotation = -Math.atan2(headingX, headingZ);
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    const firstIndex = active.index - Math.floor(road.sampleCount / 2);

    for (let i = 0; i < road.sampleCount; i += 1) {
      const index = THREE.MathUtils.clamp(
        firstIndex + i,
        0,
        locations.length - 1,
      );
      const point = locations[index];
      const localX = (point.x - currentX) * coordinateScale;
      const localZ = (point.y - currentY) * coordinateScale;
      roadPoints[i].set(
        localX * cosine + localZ * sine,
        0,
        -localX * sine + localZ * cosine,
      );
    }

    const roadPosition = road.mesh.geometry.attributes
      .position as THREE.BufferAttribute;
    const leftPosition = road.left.geometry.attributes
      .position as THREE.BufferAttribute;
    const rightPosition = road.right.geometry.attributes
      .position as THREE.BufferAttribute;
    const centerPosition = road.center.geometry.attributes
      .position as THREE.BufferAttribute;

    roadPoints.forEach((point, index) => {
      const previous = roadPoints[Math.max(0, index - 1)];
      const next = roadPoints[Math.min(roadPoints.length - 1, index + 1)];
      const tangentX = next.x - previous.x;
      const tangentZ = next.z - previous.z;
      const length = Math.max(0.001, Math.hypot(tangentX, tangentZ));
      const normalX = -tangentZ / length;
      const normalZ = tangentX / length;
      const leftX = point.x + normalX * roadHalfWidth;
      const leftZ = point.z + normalZ * roadHalfWidth;
      const rightX = point.x - normalX * roadHalfWidth;
      const rightZ = point.z - normalZ * roadHalfWidth;

      roadPosition.setXYZ(index * 2, leftX, 0, leftZ);
      roadPosition.setXYZ(index * 2 + 1, rightX, 0, rightZ);
      leftPosition.setXYZ(index, leftX, 0, leftZ);
      rightPosition.setXYZ(index, rightX, 0, rightZ);
      centerPosition.setXYZ(index, point.x, 0, point.z);
    });

    roadPosition.needsUpdate = true;
    leftPosition.needsUpdate = true;
    rightPosition.needsUpdate = true;
    centerPosition.needsUpdate = true;
  };

  camera.position.set(6.25, 2.95, -8.25);
  camera.lookAt(0, 0.7, 0);
  setHud(hudRoot, "model-state", "MODEL / READY · 125K VTX");

  let smoothedBrakeTemperature = 320;
  let mapFrame = 0;
  return {
    root,
    update: (elapsed, delta) => {
      const lapDuration = telemetry.source.lapDurationMs;
      const replayTime =
        (elapsed * 1000 * telemetry.source.replayRate) % lapDuration;
      const car = sampleWindow(telemetry.car, replayTime);
      const location = sampleWindow(telemetry.location, replayTime);
      const speed = lerp(car.a.speed, car.b.speed, car.mix);
      const rpm = lerp(car.a.rpm, car.b.rpm, car.mix);
      const throttle = lerp(car.a.throttle, car.b.throttle, car.mix);
      const currentX = lerp(location.a.x, location.b.x, location.mix);
      const currentY = lerp(location.a.y, location.b.y, location.mix);
      updateRoad(location, currentX, currentY);

      const locations = telemetry.location;
      const before = locations[Math.max(0, location.index - 3)];
      const middle = locations[location.index];
      const after =
        locations[Math.min(locations.length - 1, location.index + 3)];
      const incoming = new THREE.Vector2(
        middle.x - before.x,
        middle.y - before.y,
      ).normalize();
      const outgoing = new THREE.Vector2(
        after.x - middle.x,
        after.y - middle.y,
      ).normalize();
      const signedTurn =
        Math.atan2(incoming.x * outgoing.y - incoming.y * outgoing.x,
          incoming.dot(outgoing));
      const incomingLengthMeters =
        Math.hypot(middle.x - before.x, middle.y - before.y) * 0.1;
      const outgoingLengthMeters =
        Math.hypot(after.x - middle.x, after.y - middle.y) * 0.1;
      const localArcLengthMeters = Math.max(
        1,
        (incomingLengthMeters + outgoingLengthMeters) / 2,
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
      shellMaterials.forEach(({ material, baseOpacity }) => {
        const target = scanActive ? baseOpacity * 0.48 : baseOpacity;
        material.opacity += (target - material.opacity) * 0.08;
      });
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
        `${((replayTime / lapDuration) * 100).toFixed(1)}%`,
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

      mapFrame += 1;
      if (mapFrame % 3 === 0) {
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
    material.opacity = 0.08;
    material.depthWrite = false;
  });
  root.add(grid);

  const board = technicalSolid(new THREE.BoxGeometry(8.55, 0.3, 5.4), {
    color: 0xededE8,
    edgeOpacity: 0.72,
  });
  root.add(board);
  const surface = technicalSolid(new THREE.BoxGeometry(8.1, 0.075, 4.95), {
    color: PAPER,
    edgeOpacity: 0.24,
  });
  surface.position.y = 0.19;
  root.add(surface);

  const bar = technicalSolid(new THREE.BoxGeometry(0.24, 0.16, 4.95), {
    color: 0xe6e6e0,
    edgeOpacity: 0.46,
  });
  bar.position.y = 0.28;
  root.add(bar);

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
          opacity: 0.58,
          edgeOpacity: index % 2 === 0 ? 0.46 : 0.24,
          threshold: 1,
        },
      );
      const top = technicalSolid(
        pointGeometry(center, center + slot, 2.42, 0.48),
        {
          color: index % 2 === 0 ? 0xebebe6 : 0xd8d8d1,
          opacity: 0.58,
          edgeOpacity: index % 2 === 0 ? 0.24 : 0.46,
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
      0.36 + stackIndex * 0.018,
      edgeZ + direction * stackIndex * 0.46,
    );
  };

  const initialPoints: Record<Player, number[]> = {
    WHITE: [24, 24, 13, 13, 13, 13, 13, 8, 8, 8, 6, 6, 6, 6, 6],
    BLACK: [1, 1, 12, 12, 12, 12, 12, 17, 17, 17, 19, 19, 19, 19, 19],
  };
  const pieces: BackgammonPiece[] = [];
  const checkerGeometry = new THREE.CylinderGeometry(0.275, 0.275, 0.14, 28, 2);

  (Object.keys(initialPoints) as Player[]).forEach((player) => {
    initialPoints[player].forEach((point, pieceIndex, allPoints) => {
      const fill = new THREE.MeshStandardMaterial({
        color: player === "BLACK" ? INK : 0xe8e8e2,
        roughness: player === "BLACK" ? 0.72 : 0.9,
        metalness: player === "BLACK" ? 0.08 : 0,
      });
      const checker = new THREE.Group();
      checker.add(
        new THREE.Mesh(checkerGeometry, fill),
        new THREE.LineSegments(
          new THREE.EdgesGeometry(checkerGeometry, 18),
          new THREE.LineBasicMaterial({
            color: player === "BLACK" ? 0x000000 : INK,
            transparent: true,
            opacity: 0.68,
          }),
        ),
      );
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
      dice: [4, 2],
      notation: "24/20 · 13/11",
      moves: [
        { from: 24, to: 20, die: 4 },
        { from: 13, to: 11, die: 2 },
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
      const startsAt = turnIndex * 4.35 + 0.78 + moveIndex * 1.38;
      timeline.push({
        turn: turnIndex,
        piece,
        from: move.from,
        to: move.to,
        start,
        end,
        curve: new THREE.CatmullRomCurve3([start, midpoint, end]),
        startsAt,
        endsAt: startsAt + 1.04,
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
  const dice = [-0.45, 0.45].map((x, index) => {
    const die = technicalSolid(new THREE.BoxGeometry(0.5, 0.5, 0.5), {
      color: PAPER,
      edgeColor: index === 0 ? RED : INK,
      edgeOpacity: 0.82,
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
    die.position.set(x, 0.59, 0);
    root.add(die);
    return die;
  });
  const setDieValue = (die: THREE.Group, value: number) => {
    const visible = pipIndexes[value];
    (die.userData.pips as THREE.Mesh[]).forEach((pip, index) => {
      pip.visible = visible.includes(index);
    });
  };

  const activeHalo = technicalSolid(
    new THREE.TorusGeometry(0.35, 0.022, 7, 32),
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
    0.45,
  );
  root.add(scanLine);

  const targetMarkers = [0, 1].map(() => {
    const marker = technicalSolid(
      new THREE.TorusGeometry(0.39, 0.018, 6, 30),
      {
        color: RED,
        edgeColor: RED,
        opacity: 0.02,
        edgeOpacity: 0.55,
      },
    );
    marker.rotation.x = Math.PI / 2;
    root.add(marker);
    return marker;
  });

  camera.position.set(7.4, 7.5, 8.6);
  camera.lookAt(0, 0.25, 0);

  let lastTurnIndex = -1;
  let lastMoveIndex = -1;
  const currentPoints = new Map<BackgammonPiece, number>();

  return {
    root,
    update: (elapsed) => {
      const cycleTime = elapsed % 22.8;
      const turnIndex = Math.min(4, Math.floor(cycleTime / 4.35));
      const turn = turnSequence[turnIndex];
      const turnTime = cycleTime - turnIndex * 4.35;
      scanLine.position.z = -2.35 + (turnTime / 4.35) * 4.7;

      pieces.forEach((piece) => {
        piece.object.position.copy(piece.initialPosition);
        piece.fill.color.set(piece.player === "BLACK" ? INK : 0xe8e8e2);
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

      if (lastTurnIndex !== turnIndex) {
        setDieValue(dice[0], turn.dice[0]);
        setDieValue(dice[1], turn.dice[1]);
        setHud(
          hudRoot,
          "probability",
          `P({${turn.dice[0]},${turn.dice[1]}}) = 2 / 36 = 5.56%`,
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

        turn.moves.forEach((move, index) => {
          targetMarkers[index].position.copy(pointPosition(move.to, 0));
          targetMarkers[index].position.y = 0.28;
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
      });

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

      setHud(hudRoot, "turn", `${turnIndex + 1} / 5`);
      setHud(hudRoot, "player", turn.player);
      setHud(hudRoot, "roll", `${turn.dice[0]}–${turn.dice[1]}`);
      setHud(
        hudRoot,
        "move",
        activeMoveIndex >= 0
          ? `MOVE ${activeMoveWithinTurn + 1}/2 · ${timeline[activeMoveIndex].from}/${timeline[activeMoveIndex].to}`
          : `PLAY · ${turn.notation}`,
      );
      setHud(hudRoot, "pip-white", String(whitePips));
      setHud(hudRoot, "pip-black", String(blackPips));
      setHud(
        hudRoot,
        "pip-diff",
        `${whitePips - blackPips >= 0 ? "+" : ""}${whitePips - blackPips}`,
      );
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
          PROGRESS <b data-hud="lap-progress">0.0%</b> · REPLAY 4.0×
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

      <section className="dice-analysis">
        <div className="dice-analysis-copy">
          <strong>DICE SPACE / 36 ORDERED OUTCOMES</strong>
          <span>SYMMETRIC CELLS HIGHLIGHTED</span>
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
        STANDARD START · FIVE LEGAL TURNS · PIPS RECALCULATED AFTER EACH MOVE
      </p>
    </>
  );
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hudRootRef = useRef<HTMLDivElement>(null);
  const trackCanvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "scene-webgl";
    mount.prepend(renderer.domElement);

    let disposed = false;
    let frame = 0;
    let controller: SceneController | null = null;
    let rootBaseRotation = new THREE.Euler();
    const clock = new THREE.Clock();
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
        rootBaseRotation = controller.root.rotation.clone();
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

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      elapsed += delta;
      if (controller) {
        const root = controller.root;
        const pointerYaw = pointerRef.current.x * (mode === 1 ? 0.055 : 0.045);
        const pointerPitch =
          pointerRef.current.y * (mode === 1 ? 0.025 : 0.018);
        root.rotation.y +=
          (rootBaseRotation.y + pointerYaw - root.rotation.y) * 0.045;
        root.rotation.x +=
          (rootBaseRotation.x + pointerPitch - root.rotation.x) * 0.045;
        controller.update(elapsed, delta);
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
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
          y: ((event.clientY - bounds.top) / bounds.height - 0.5) * 2,
        };
      }}
      onPointerLeave={() => {
        pointerRef.current = { x: 0, y: 0 };
      }}
      aria-label={
        mode === 1
          ? "Detailed Formula car replaying recorded Silverstone telemetry"
          : "Five-turn backgammon opening with exact dice and pip analysis"
      }
      role="img"
    >
      <div className="scene-overlay" ref={hudRootRef}>
        {mode === 1 ? (
          <FormulaHud trackCanvasRef={trackCanvasRef} />
        ) : (
          <BackgammonHud />
        )}
      </div>
    </div>
  );
}
