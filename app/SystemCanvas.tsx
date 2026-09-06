"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { loadFormulaAsset, instantiateFormulaAsset } from "./formula-assets";
import { generateGame, barPoint, offPoint, opponent, validateGame } from "./backgammon-engine";
import { buildSymbolForms, SYMBOL_FEATURE_PATH_COUNT, SYMBOL_FEATURE_SAMPLES } from "./symbol-geometry";
import { buildRacingPath } from "./racing-path";
import { formulaWheelYaw, wheelDetailVisibility } from "./formula-model";

type VisualMode = 1 | 2 | 3;
type SceneTheme = "light" | "dark";

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

let SCENE_IS_DARK = false;
let INK = 0x171717;
let PAPER = 0xf6f6f3;
let RED = 0xf02b1d;
let MUTED = 0xa6a69f;
let BOARD_BODY = 0xededE8;
let BOARD_BAR = 0xe6e6e0;
let BOARD_POINT_A = 0xd8d8d1;
let BOARD_POINT_B = 0xebebe6;
let CHECKER_DARK = 0x171717;
let CHECKER_DARK_EDGE = 0x000000;
let CHECKER_LIGHT = 0xe4e4de;
let TRAIL_MUTED = 0xbdbdb6;

function applySceneTheme(theme: SceneTheme) {
  SCENE_IS_DARK = theme === "dark";
  INK = SCENE_IS_DARK ? 0xe8e8e2 : 0x171717;
  PAPER = SCENE_IS_DARK ? 0x0d0f10 : 0xf6f6f3;
  // Fine strokes need a deeper red on paper than large CSS labels do.
  RED = SCENE_IS_DARK ? 0xff4938 : 0xc92b20;
  MUTED = SCENE_IS_DARK ? 0x8a8d88 : 0x686b65;
  BOARD_BODY = SCENE_IS_DARK ? 0x26292b : 0xededE8;
  BOARD_BAR = SCENE_IS_DARK ? 0x313436 : 0xe6e6e0;
  BOARD_POINT_A = SCENE_IS_DARK ? 0x3a3d40 : 0xd8d8d1;
  BOARD_POINT_B = SCENE_IS_DARK ? 0x181a1c : 0xebebe6;
  CHECKER_DARK = SCENE_IS_DARK ? 0x202326 : 0x171717;
  CHECKER_DARK_EDGE = SCENE_IS_DARK ? 0xbec3bb : 0x000000;
  CHECKER_LIGHT = SCENE_IS_DARK ? 0xd8d9d3 : 0xb7bcb3;
  TRAIL_MUTED = SCENE_IS_DARK ? 0x7b7e7a : 0xbdbdb6;
}

function currentSceneTheme(): SceneTheme {
  const explicitTheme = document.documentElement.dataset.theme;
  if (explicitTheme === "light" || explicitTheme === "dark") {
    return explicitTheme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

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
      toneMapped: false,
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
      toneMapped: false,
    }),
  );
  group.add(fill, edges);
  return group;
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

  // A barely-there surface and longitudinal contours retain the road's
  // continuous geometry without introducing an asphalt slab behind the diagram.
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: INK,
      transparent: true,
      opacity: SCENE_IS_DARK ? 0.035 : 0.065,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const furniture = new THREE.Group();
  for (const fraction of [0.25, 0.75]) {
    const contour = leftPoints.map((point, i) =>
      point.clone().lerp(rightPoints[i], fraction).setY(-0.03),
    );
    furniture.add(lineFromPoints([...contour, contour[0]], INK, SCENE_IS_DARK ? 0.24 : 0.28));
  }
  // Outlined kerb rails, not filled paint or verge panels. Their width is
  // illustrative; the reconstructed road and simulated racing line are unchanged.
  for (const edge of [leftPoints, rightPoints]) {
    const outer = edge.map((point, i) => point.clone().addScaledVector(
      point.clone().sub(centerPoints[i]).setY(0).normalize(), 0.72,
    ));
    furniture.add(lineFromPoints([...outer, outer[0]], INK, SCENE_IS_DARK ? 0.30 : 0.38));
  }
  const roadEdgeOpacity = SCENE_IS_DARK ? 0.70 : 0.82;
  const left = lineFromPoints([...leftPoints, leftPoints[0]], INK, roadEdgeOpacity);
  const right = lineFromPoints([...rightPoints, rightPoints[0]], INK, roadEdgeOpacity);
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
      opacity: SCENE_IS_DARK ? 0.20 : 0.30,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const sectorTicks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(sectorTickPoints),
    new THREE.LineBasicMaterial({
      color: RED,
      transparent: true,
      opacity: SCENE_IS_DARK ? 0.56 : 0.68,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const center = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      ...centerPoints,
      centerPoints[0],
    ]),
    new THREE.LineDashedMaterial({
      color: INK,
      dashSize: 3.2,
      gapSize: 5.2,
      transparent: true,
      opacity: SCENE_IS_DARK ? 0.16 : 0.22,
      depthWrite: false,
      toneMapped: false,
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
    furniture,
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
  context.strokeStyle = SCENE_IS_DARK
    ? "rgba(232,232,226,.48)"
    : "rgba(23,23,23,.42)";
  context.stroke();

  const active = project(locations[Math.min(activeIndex, locations.length - 1)]);
  context.beginPath();
  context.arc(active.x, active.y, 2.5 * dpr, 0, Math.PI * 2);
  context.fillStyle = SCENE_IS_DARK ? "#ff4938" : "#f02b1d";
  context.fill();
}

function fetchFormulaResources() {
  return Promise.all([
    loadFormulaAsset(),
    fetch("/data/silverstone-antonelli-l18.json").then(response => {
      if (!response.ok) throw new Error("Formula telemetry could not be loaded");
      return response.json() as Promise<TelemetryData>;
    }),
  ]).then(([template, telemetry]) => ({
    template, telemetry,
    racingPath: buildRacingPath(telemetry.location, telemetry.car, telemetry.source.lapDurationMs, template.metadata.racingOffsets),
  }));
}

let formulaResources: ReturnType<typeof fetchFormulaResources> | undefined;
function loadFormulaResources() {
  return formulaResources ??= fetchFormulaResources().catch(error => {
    formulaResources = undefined;
    throw error;
  });
}

function buildFormulaScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  hudRoot: HTMLDivElement | null,
  trackCanvas: HTMLCanvasElement | null,
  resources: Awaited<ReturnType<typeof fetchFormulaResources>>,
): SceneController {
  setHud(hudRoot, "model-state", "LOADING / GEOMETRY + LAP");
  scene.fog = new THREE.Fog(PAPER, 34, 110);

  const { template, racingPath } = resources;
  const motionDuration = racingPath.duration;
  const trackLocations = racingPath.roadSamples;

  const root = new THREE.Group();
  const carRig = new THREE.Group();
  root.add(carRig);
  scene.add(root);

  // Broad, quiet lighting gives the opaque rubber a readable rounded volume.
  root.add(new THREE.HemisphereLight(0xffffff, 0x687079, 2.0));
  const wheelKey = new THREE.DirectionalLight(0xffffff, 2.4);
  wheelKey.position.set(-3, 6, -2);
  carRig.add(wheelKey);
  carRig.add(wheelKey.target);

  const { prepared, edges: preparedEdges } = instantiateFormulaAsset(template);
  const model = prepared.root;
  carRig.add(model);
  const chassis = prepared.chassis;
  const chassisRest = chassis.position.y;
  const cockpitWheel = prepared.cockpit;
  const cockpitWheelRest = cockpitWheel.quaternion.clone();
  const frontSteeringRigs = prepared.wheels.filter(wheel => wheel.front);


  const shellMaterials: Array<{
    material: THREE.MeshBasicMaterial;
    baseOpacity: number;
    baseDepthWrite: boolean;
  }> = [];
  const edgeMaterials: Array<{
    material: THREE.LineBasicMaterial;
    baseOpacity: number;
    scanOpacity: number;
    rotatingDetail: boolean;
  }> = [];
  const scanUniforms = {
    uScanOrigin: { value: new THREE.Vector3() },
    uScanForward: { value: new THREE.Vector3(0, 0, 1) },
    uScanPosition: { value: 0 },
    uScanEnabled: { value: 0 },
    uScanColor: { value: new THREE.Color(RED) },
  };
  const sourceMeshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) sourceMeshes.push(object as THREE.Mesh);
  });

  sourceMeshes.forEach((mesh) => {
    const existing = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    const role = existing?.name ?? "body";
    const isWheel = mesh.userData.formulaRole === "wheel";
    const isTire = isWheel && mesh.userData.sourceMaterial === "Material.001";
    const isRim = mesh.userData.formulaPart === "rim";
    const isGlass = role.includes("glass");
    const isInterior = role.includes("interior") || role.includes("bottom");
    const baseOpacity = isWheel
      ? 1
      : isInterior
        ? 0.90
        : isGlass
          ? 0.012
          : 0.97;
    const baseDepthWrite = !isGlass;
    const material = new THREE.MeshBasicMaterial({
      // Explicit theme tones: the chassis must remain readable at the default
      // zoom without relying on specular lighting or hairline edges alone.
      color: isInterior
          ? (SCENE_IS_DARK ? 0x343e42 : 0x929b9b)
          : (SCENE_IS_DARK ? 0x515e63 : 0xb6bfbd),
      transparent: true,
      opacity: baseOpacity,
      side: THREE.DoubleSide,
      depthWrite: baseDepthWrite,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      toneMapped: false,
    });
    if (isWheel) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: isRim ? (SCENE_IS_DARK ? 0x788589 : 0x626e73) : (SCENE_IS_DARK ? 0x465157 : 0x3f494d),
        roughness: isRim ? 0.68 : 0.95,
        metalness: 0,
        transparent: false,
        depthWrite: true,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      material.dispose();
    } else {
      mesh.material = material;
      shellMaterials.push({ material, baseOpacity, baseDepthWrite });
    }
    existing.dispose();
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const edgeOpacity = isWheel
      ? (isTire ? (SCENE_IS_DARK ? 0.48 : 0.58) : 0.28)
      : isInterior
        ? 0.38
        : isGlass
          ? 0.30
          : (SCENE_IS_DARK ? 0.90 : 0.82);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: INK,
      transparent: true,
      opacity: edgeOpacity,
      depthWrite: false,
      toneMapped: false,
    });
    // The sweep is evaluated on actual transformed edges: it cannot detach
    // from the steering hubs, spinning wheels, or articulated chassis.
    edgeMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, scanUniforms);
      shader.vertexShader = "varying vec3 vScanWorld;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvScanWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
      shader.fragmentShader = `
        varying vec3 vScanWorld;
        uniform vec3 uScanOrigin, uScanForward, uScanColor;
        uniform float uScanPosition, uScanEnabled;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float scanDistance = abs(dot(vScanWorld - uScanOrigin, uScanForward) - uScanPosition);
        float scanBand = (1.0 - smoothstep(0.10, 0.65, scanDistance)) * uScanEnabled;
        diffuseColor.rgb = mix(diffuseColor.rgb, uScanColor, scanBand);
        outgoingLight = diffuseColor.rgb;
        diffuseColor.a = max(diffuseColor.a, scanBand * 0.95);
        #include <opaque_fragment>`,
      );
    };
    edgeMaterial.customProgramCacheKey = () => "schematic-scan-v1";
    const edges = new THREE.LineSegments(
      preparedEdges.get(mesh.geometry)!,
      edgeMaterial,
    );
    if (isTire) {
      // Geometry is already hub-local. Follow steering without rotating the
      // sampled circular silhouette through subpixels on each frame.
      mesh.parent!.parent!.add(edges);
    } else mesh.add(edges);
    edgeMaterials.push({
      material: edgeMaterial,
      baseOpacity: edgeOpacity,
      rotatingDetail: isWheel && !isTire,
      scanOpacity: isWheel
        ? edgeOpacity
        : isInterior
          ? 0.44
          : isGlass
            ? 0.30
            : 0.82,
    });
  });

  const brakeMaterials: THREE.MeshBasicMaterial[] = [];
  prepared.wheels.forEach(({ spin, radius }) => {
    const material = new THREE.MeshBasicMaterial({color: RED, transparent: true, opacity: 0.02, depthWrite: false});
    const disc = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.5, radius * 0.025, 8, 48), material);
    disc.rotation.y = Math.PI / 2;
    spin.add(disc);
    brakeMaterials.push(material);
  });


  const road = buildRoadRibbon(trackLocations);
  root.add(
    road.mesh,
    road.left,
    road.right,
    road.center,
    road.minorTicks,
    road.sectorTicks,
    road.furniture,
  );

  const trailSampleCount = 64;
  const trailPositions = new Float32Array(trailSampleCount * 3);
  const trailColors = new Float32Array(trailSampleCount * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPositions, 3),
  );
  const trailMuted = new THREE.Color(TRAIL_MUTED);
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

  const predictionSampleCount = 384;
  const guideStepMs = 16;
  const predictionPoints = Array.from({ length: predictionSampleCount }, () => new THREE.Vector3());
  const predictedBraking = new Uint8Array(predictionSampleCount);
  const guideColor = new THREE.Color();
  const coastingColor = new THREE.Color(SCENE_IS_DARK ? 0xc2c5bf : 0x646862);
  const brakingColor = new THREE.Color(RED);
  // A thin, continuous ribbon remains legible at oblique viewing angles.
  // Its color shows modelled braking demand on the optimized curve.
  const guideGeometry = new THREE.BufferGeometry();
  const guidePositions = new Float32Array(predictionSampleCount * 6);
  const guideColors = new Float32Array(predictionSampleCount * 6);
  guideGeometry.setAttribute("position", new THREE.BufferAttribute(guidePositions, 3));
  guideGeometry.setAttribute("color", new THREE.BufferAttribute(guideColors, 3));
  const guideIndices: number[] = [];
  for (let i = 0; i < predictionSampleCount - 1; i++) {
    const k = i * 2;
    guideIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  guideGeometry.setIndex(guideIndices);
  const racingGuide = new THREE.Mesh(guideGeometry, new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0.65,side:THREE.DoubleSide,depthWrite:false}));
  racingGuide.frustumCulled = false;
  root.add(racingGuide);

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

  carRig.scale.setScalar(1);

  const firstLocation = racingPath.atTime(0);
  const firstDirectionTarget = racingPath.atTime(30);
  const carPosition = new THREE.Vector3(
    (firstLocation.x - road.originX) * 0.1,
    -0.035,
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
  let cameraHeading = displayHeading;
  const cameraForward = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();
  let bodyRoll = 0;
  let bodyPitch = 0;
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
  setHud(hudRoot, "model-state", "W14 INTERPRETATION / 3D");

  let smoothedBrakeTemperature = 320;
  let mapFrame = 0;
  let hudFrame = 0;
  const playbackRate = 1;
  const lastCarPosition = displayCarPosition.clone();
  const carTranslation = new THREE.Vector3();
  const ratios = [12, 9.5, 7.8, 6.6, 5.8, 5.15, 4.65, 4.25];
  return {
    root,
    update: (elapsed, delta, view) => {
      const motionTime =
        (elapsed * 1000 * playbackRate) % motionDuration;
      const replayTime = motionTime;
      const location = racingPath.atTime(motionTime);
      const speed = location.modeledSpeed;
      const throttle = location.modeledThrottle;
      // Illustrative eight-speed drivetrain; explicitly marked SIM in the HUD.
      const wheelRpm = speed / 3.6 / (2 * Math.PI * prepared.wheels[2].radius) * 60;
      const gear = Math.min(8, Math.max(1, ratios.findIndex(ratio => wheelRpm * ratio < 11500) + 1 || 8));
      const rpm = Math.max(4000, wheelRpm * ratios[gear - 1]);
      const curvature = location.curvature;
      const steering = THREE.MathUtils.clamp(
        THREE.MathUtils.radToDeg(Math.atan(prepared.wheelbase * curvature)),
        -18,
        18,
      );
      const lateralG = (Math.pow(speed / 3.6, 2) * Math.abs(curvature)) / 9.80665;

      carPosition.set(
        (location.x - road.originX) * 0.1,
        -0.035,
        (location.y - road.originY) * 0.1,
      );
      const targetHeading = Math.atan2(
        location.dx,
        location.dy,
      );
      // The spline is already continuous. Filter the camera, not the physical
      // pose: independently lagging position and heading creates sideways slip.
      displayCarPosition.copy(carPosition);
      displayHeading = targetHeading;
      forward.set(Math.sin(displayHeading), 0, Math.cos(displayHeading));
      right.set(forward.z, 0, -forward.x);
      carRig.position.copy(displayCarPosition);
      carRig.rotation.y = displayHeading;
      carTranslation.copy(displayCarPosition).sub(lastCarPosition);
      camera.position.add(carTranslation);
      cameraLook.add(carTranslation);
      lastCarPosition.copy(displayCarPosition);
      // Exact arc length from the same lap clock; no frame-dependent chord
      // approximation or angular reset at the lap seam.
      const wheelTravel = Math.floor(elapsed * 1000 * playbackRate / motionDuration) * racingPath.length
        + racingPath.distanceAt(motionTime);
      const displayedSteering = steering;
      if (frontSteeringRigs.length > 0) {
        frontSteeringRigs.forEach(({ side, yaw }) => {
          // Curvature is already continuous: no separate steering lag.
          yaw.rotation.y = formulaWheelYaw(curvature, prepared.wheelbase, prepared.frontTrack, side);
        });
      }
      prepared.wheels.forEach(wheel => {wheel.spin.rotation.x = wheelTravel / wheel.radius;});
      if (cockpitWheel && cockpitWheelRest) {
        cockpitWheel.quaternion.copy(cockpitWheelRest).multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(displayedSteering * 7)),
        );
      }
      // Restrained suspension response, illustrative rather than a vehicle
      // dynamics solver. Wheel contact and steering pivots stay on the road.
      const acceleration = location.modeledAcceleration;
      bodyRoll += (THREE.MathUtils.clamp(-Math.sign(steering) * lateralG * 0.003, -0.0085, 0.0085) - bodyRoll) * (1 - Math.exp(-delta * 7));
      bodyPitch += (THREE.MathUtils.clamp(-acceleration * 0.001, -0.004, 0.006) - bodyPitch) * (1 - Math.exp(-delta * 7));
      if (chassis) {
        chassis.rotation.z = bodyRoll;
        chassis.rotation.x = bodyPitch;
        chassis.position.y = chassisRest - Math.abs(bodyRoll) * 0.2;
      }
      {
        const trailPositionAttribute = trailGeometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        for (let index = 0; index < trailSampleCount; index += 1) {
          const sampleTime =
            (motionTime -
              (trailSampleCount - 1 - index) * 52 +
              motionDuration) %
            motionDuration;
          const sample = racingPath.atTime(sampleTime);
          trailPositionAttribute.setXYZ(
            index,
            (sample.x - road.originX) * 0.1,
            0.055,
            (sample.y - road.originY) * 0.1,
          );
        }
        trailPositionAttribute.needsUpdate = true;

        // Start the visible guide beyond the nose, including during X-ray
        // scans. Both guide geometry and braking color use this same lookahead.
        const guideLeadMs = (prepared.bounds.max.z + 0.6) / Math.max(1, speed / 3.6) * 1000;
        for (let index = 0; index < predictionSampleCount; index++) {
          const sample = racingPath.atTime((motionTime + guideLeadMs + index * guideStepMs) % motionDuration);
          predictionPoints[index].set((sample.x - road.originX) * 0.1, 0.06, (sample.y - road.originY) * 0.1);
          predictedBraking[index] = sample.modeledBrake > 1 ? 1 : 0;
        }
        predictionPoints.forEach((point, i) => {
          const before = predictionPoints[Math.max(0, i - 1)];
          const after = predictionPoints[Math.min(predictionSampleCount - 1, i + 1)];
          const dx = after.x - before.x, dz = after.z - before.z;
          const length = Math.max(0.001, Math.hypot(dx, dz));
          const halfWidth = 0.065;
          guidePositions.set([point.x - dz / length * halfWidth, 0.012, point.z + dx / length * halfWidth, point.x + dz / length * halfWidth, 0.012, point.z - dx / length * halfWidth], i * 6);
          guideColor.copy(predictedBraking[i] ? brakingColor : coastingColor);
          guideColor.multiplyScalar(1 - Math.pow(i / predictionSampleCount, 2) * 0.7);
          guideColors.set([guideColor.r,guideColor.g,guideColor.b,guideColor.r,guideColor.g,guideColor.b], i * 6);
        });
        guideGeometry.attributes.position.needsUpdate = true;
        guideGeometry.attributes.color.needsUpdate = true;
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
      // A trailing camera must not erase the car's yaw. Its bearing follows
      // turns more slowly than its translation, revealing corner entry/exit.
      const cameraHeadingDelta = Math.atan2(Math.sin(displayHeading - cameraHeading), Math.cos(displayHeading - cameraHeading));
      cameraHeading += cameraHeadingDelta * (1 - Math.exp(-delta * 2.2));
      cameraForward.set(Math.sin(cameraHeading), 0, Math.cos(cameraHeading));
      cameraRight.set(cameraForward.z, 0, -cameraForward.x);
      desiredCamera
        .copy(displayCarPosition)
        .addScaledVector(
          cameraForward,
          -Math.cos(view.yaw) * horizontalDistance,
        )
        .addScaledVector(
          cameraRight,
          Math.sin(view.yaw) * horizontalDistance,
        );
      desiredCamera.y += Math.sin(view.pitch) * view.distance;
      desiredLook.copy(displayCarPosition);
      desiredLook.y += 0.62;
      const cameraDamping = 1 - Math.exp(-delta * 12);
      camera.position.lerp(desiredCamera, cameraDamping);
      cameraLook.lerp(desiredLook, cameraDamping);
      camera.lookAt(cameraLook);

      const braking = location.modeledBrake > 1;
      const temperatureTarget = braking ? 820 + speed * 1.4 : 310;
      smoothedBrakeTemperature +=
        (temperatureTarget - smoothedBrakeTemperature) *
        Math.min(1, delta * (braking ? 4 : 0.7));
      brakeMaterials.forEach((material) => {
        material.opacity +=
          ((braking ? 0.82 : 0.015) - material.opacity) * (1 - Math.exp(-delta * 9));
      });
      const scanCycleDuration = 9;
      const replayPhase = (elapsed % scanCycleDuration) / scanCycleDuration;
      const scanActive = replayPhase > 0.66 && replayPhase < 0.88;
      const scanProgress = THREE.MathUtils.clamp(
        (replayPhase - 0.66) / 0.22,
        0,
        1,
      );
      carRig.getWorldPosition(scanUniforms.uScanOrigin.value);
      carRig.getWorldDirection(scanUniforms.uScanForward.value);
      scanUniforms.uScanPosition.value = THREE.MathUtils.lerp(
        prepared.bounds.min.z - 0.65, prepared.bounds.max.z + 0.65, scanProgress,
      );
      scanUniforms.uScanEnabled.value +=
        ((scanActive ? 1 : 0) - scanUniforms.uScanEnabled.value) * (1 - Math.exp(-delta * 18));
      shellMaterials.forEach(
        ({ material, baseOpacity, baseDepthWrite }) => {
        const target = scanActive ? baseOpacity * 0.22 : baseOpacity;
        material.depthWrite = scanActive ? false : baseDepthWrite;
        material.opacity += (target - material.opacity) * (1 - Math.exp(-delta * 9));
        },
      );
      edgeMaterials.forEach(({ material, baseOpacity, scanOpacity, rotatingDetail }) => {
        const detail = rotatingDetail ? wheelDetailVisibility(speed) : 1;
        material.opacity +=
          (((scanActive ? scanOpacity : baseOpacity) * detail) - material.opacity) * (1 - Math.exp(-delta * 5));
      });

      hudFrame += 1;
      if (hudFrame % 3 === 0) {
        setHud(hudRoot, "gear", String(gear));
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
          `${displayedSteering >= 0 ? "+" : ""}${displayedSteering.toFixed(1)}° STEER · ${lateralG.toFixed(1)}G LAT`,
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
              ? "SCAN / REAR ASSEMBLY"
              : scanProgress < 0.67
                ? "SCAN / CHASSIS GEOMETRY"
                : "SCAN / FRONT ASSEMBLY"
            : braking
              ? "BRAKING EVENT"
              : "RACING LINE / SIMULATION",
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

type Playback = {
  pace: number;
  paused: boolean;
  restart: number;
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
      if (point === 0 || point === 25) return;
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
  playback: RefObject<Playback>,
): SceneController {
  scene.add(
    new THREE.HemisphereLight(
      SCENE_IS_DARK ? 0xb3b7b2 : PAPER,
      SCENE_IS_DARK ? 0x17191b : 0xa7a79f,
      SCENE_IS_DARK ? 1.85 : 2.5,
    ),
  );
  const key = new THREE.DirectionalLight(
    SCENE_IS_DARK ? 0xe9eae5 : 0xffffff,
    SCENE_IS_DARK ? 2 : 2.5,
  );
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
    color: BOARD_BODY,
    opacity: 0.18,
    edgeOpacity: 0.90,
  });
  root.add(board);
  const surface = technicalSolid(new THREE.BoxGeometry(8.1, 0.075, 4.95), {
    color: PAPER,
    opacity: 0.16,
    edgeOpacity: 0.52,
  });
  surface.position.y = 0.19;
  root.add(surface);

  const bar = technicalSolid(new THREE.BoxGeometry(0.24, 0.16, 4.95), {
    color: BOARD_BAR,
    opacity: 0.14,
    edgeOpacity: 0.76,
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
      0.48,
    );
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 9, 7),
      new THREE.MeshBasicMaterial({
        color: INK,
        transparent: true,
        opacity: 0.75,
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
          color: index % 2 === 0 ? BOARD_POINT_A : BOARD_POINT_B,
          opacity: index % 2 === 0 ? 0.14 : 0.07,
          edgeOpacity: index % 2 === 0 ? 0.78 : 0.48,
          threshold: 1,
        },
      );
      const top = technicalSolid(
        pointGeometry(pointStart, pointStart + slot, 2.42, 0.48),
        {
          color: index % 2 === 0 ? BOARD_POINT_B : BOARD_POINT_A,
          opacity: index % 2 === 0 ? 0.07 : 0.14,
          edgeOpacity: index % 2 === 0 ? 0.48 : 0.78,
          threshold: 1,
        },
      );
      root.add(bottom, top);
    }
  }

  const pointPosition = (point: number, stackIndex: number, player: Player = "WHITE") => {
    if (point === offPoint(player)) {
      return new THREE.Vector3(4.48, 0.35 + Math.floor(stackIndex / 5) * 0.145, (player === "WHITE" ? -2.1 : 2.1) + (player === "WHITE" ? 1 : -1) * (stackIndex % 5) * 0.43);
    }
    if (point === barPoint(player)) {
      return new THREE.Vector3(0, 0.46 + Math.floor(stackIndex / 3) * 0.145, (player === "WHITE" ? -1 : 1) * (0.45 + (stackIndex % 3) * 0.44));
    }
    const top = point >= 13;
    const edgeZ = top ? 2.1 : -2.1;
    const direction = top ? -1 : 1;
    return new THREE.Vector3(
      pointCenterX(point),
      0.35 + Math.floor(stackIndex / 5) * 0.145,
      edgeZ + direction * (stackIndex % 5) * 0.43,
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
        color: player === "BLACK" ? CHECKER_DARK : CHECKER_LIGHT,
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
            color: player === "BLACK" ? CHECKER_DARK_EDGE : INK,
            transparent: true,
            opacity: player === "BLACK" ? 0.90 : 0.78,
            toneMapped: false,
          }),
        ),
      );
      const registerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.008, 5, 28),
        new THREE.MeshBasicMaterial({
          color: player === "BLACK" ? RED : CHECKER_DARK,
          transparent: true,
          opacity: player === "BLACK" ? 0.62 : 0.56,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      registerRing.rotation.x = Math.PI / 2;
      registerRing.position.y = 0.068;
      checker.add(registerRing);
      const stackIndex = allPoints
        .slice(0, pieceIndex)
        .filter((value) => value === point).length;
      checker.position.copy(pointPosition(point, stackIndex, player));
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

  const game = generateGame(5);
  validateGame(game);
  const turnSequence = game.turns;

  const stackKey = (player: Player, point: number) => `${player}:${point}`;
  const simulatedStacks = new Map<string, BackgammonPiece[]>();
  pieces.forEach((piece) => {
    const key = stackKey(piece.player, piece.initialPoint);
    const stack = simulatedStacks.get(key) ?? [];
    stack.push(piece);
    simulatedStacks.set(key, stack);
  });
  // 12 seconds per turn is an illustrative human-paced replay, not recorded timing.
  const turnDuration = 12;
  const gameDuration = turnDuration * turnSequence.length;
  const cycleDuration = gameDuration + 12;
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
    die: number;
    hit?: boolean;
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
      const stepDuration = 8.5 / Math.max(1, turn.moves.length);
      const startsAt = turnIndex * turnDuration + 2.4 + moveIndex * stepDuration;
      const other = opponent(turn.player);
      const opposingStack = simulatedStacks.get(stackKey(other, move.to)) ?? [];
      const hit = move.to > 0 && move.to < 25 && opposingStack.length === 1;
      if (hit) {
        const captured = opposingStack.pop()!;
        const barKey = stackKey(other, barPoint(other));
        const barStack = simulatedStacks.get(barKey) ?? [];
        const start = pointPosition(move.to, 0, other);
        const end = pointPosition(barPoint(other), barStack.length, other);
        const midpoint = start.clone().lerp(end, 0.5);
        midpoint.y = 1.65;
        timeline.push({ turn: turnIndex, piece: captured, from: move.to, to: barPoint(other), start, end,
          curve: new THREE.QuadraticBezierCurve3(start, midpoint, end),
          startsAt, endsAt: startsAt + stepDuration * 0.3, die: move.die, hit: true });
        barStack.push(captured);
        simulatedStacks.set(barKey, barStack);
      }
      const start = pointPosition(move.from, sourceStack.length - 1, turn.player);
      const end = pointPosition(move.to, targetStack.length, turn.player);
      const midpoint = start.clone().lerp(end, 0.5);
      midpoint.y = 1.25 + Math.min(0.68, start.distanceTo(end) * 0.075);
      timeline.push({
        turn: turnIndex,
        piece,
        from: move.from,
        to: move.to,
        start,
        end,
        curve: new THREE.QuadraticBezierCurve3(start, midpoint, end),
        startsAt: startsAt + (hit ? stepDuration * 0.3 : 0),
        endsAt: startsAt + stepDuration * 0.88,
        die: move.die,
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
  const diceElements = Array.from(hudRoot?.querySelectorAll<HTMLElement>("[data-die-index]") ?? []);
  const cubeElements = diceElements.map(die => die.querySelector<HTMLElement>(".die-cube"));
  const faceAngles: Record<number, [number, number]> = {1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
  let playhead = 0;
  let restart = playback.current.restart;
  let rollingTurn = -1;
  let rollRevolutions = 1;

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

      if (restart !== playback.current.restart) {
        playhead = 0;
        restart = playback.current.restart;
        lastTurnIndex = -1;
        rollingTurn = -1;
      }
      const rate = Math.pow(cycleDuration / 30, playback.current.pace / 100);
      if (!playback.current.paused && !document.hidden) playhead += delta * rate;
      const cycleTime = playhead % cycleDuration;
      const finished = cycleTime >= gameDuration;
      const turnIndex = Math.min(
        turnSequence.length - 1,
        Math.floor(cycleTime / turnDuration),
      );
      const turn = turnSequence[turnIndex];
      const turnTime = cycleTime - turnIndex * turnDuration;
      const seconds = cycleDuration / rate;
      setHud(hudRoot, "game-duration", seconds < 60 ? `${seconds.toFixed(0)} SEC / GAME` : `${Math.floor(seconds / 60)}:${Math.round(seconds % 60).toString().padStart(2, "0")} / GAME`);
      const rollProgress = THREE.MathUtils.clamp(turnTime / 2.2, 0, 1);
      const rollEase = THREE.MathUtils.smootherstep(rollProgress, 0, 1);
      if (rollingTurn !== turnIndex) {
        rollingTurn = turnIndex;
        // At 30-second/game pace the roll lasts only ~80ms. Extra revolutions
        // would alias into a strobe; retain the shortest visible tumble instead.
        rollRevolutions = rate > 14 ? 0 : rate > 5 ? 1 : 2;
      }
      diceElements.forEach((die, index) => {
        const previous = turnSequence[(turnIndex - 1 + turnSequence.length) % turnSequence.length].dice[index];
        const [fromX, fromY] = faceAngles[previous];
        const [toX, toY] = faceAngles[turn.dice[index]];
        const shortest = (from: number, to: number) => ((to - from + 540) % 360) - 180;
        const x = fromX + (shortest(fromX, toX) + 360 * rollRevolutions) * rollEase;
        const y = fromY + (shortest(fromY, toY) + 360 * rollRevolutions) * rollEase;
        const lift = Math.sin(Math.PI * rollProgress) * 13;
        const drift = Math.sin(Math.PI * rollProgress * 2) * 6 * (index ? -1 : 1);
        die.style.transform = `translate3d(${drift}px, ${-lift}px, 0) rotateZ(${Math.sin(Math.PI * rollProgress) * (index ? -10 : 10)}deg)`;
        const cube = cubeElements[index];
        if (cube) cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
      });
      scanLine.visible = !finished;
      scanLine.position.z =
        -2.35 + Math.min(1, turnTime / turnDuration) * 4.7;

      pieces.forEach((piece) => {
        piece.object.position.copy(piece.initialPosition);
        piece.fill.color.set(
          piece.player === "BLACK" ? CHECKER_DARK : CHECKER_LIGHT,
        );
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
      if (activeMoveIndex >= 0) {
        const move = timeline[activeMoveIndex];
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
          !finished && activeMoveIndex < 0 && index < targetMarkerCount;
      });

      if (lastTurnIndex !== turnIndex) {
        const orderedWays = turn.dice[0] === turn.dice[1] ? 1 : 2;
        const outcomes = turn.opening ? 30 : 36;
        const probability = ((orderedWays / outcomes) * 100).toFixed(2);
        setHud(hudRoot, "dice-space", turn.opening ? "OPENING / 30 UNEQUAL OUTCOMES" : "DICE SPACE / 36 ORDERED OUTCOMES");
        setHud(
          hudRoot,
          "dice-caption",
          `${turn.dice[0]}—${turn.dice[1]}`,
        );
        hudRoot
          ?.querySelectorAll<HTMLElement>("[data-die-index]")
          .forEach((die, index) => {
            die.dataset.value = String(turn.dice[index] ?? 1);
          });
        setHud(
          hudRoot,
          "probability",
          `P({${turn.dice[0]},${turn.dice[1]}}) = ${orderedWays} / ${outcomes} = ${probability}%`,
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
          .forEach((node) => {
            node.classList.remove("is-active");
            const [first, second] = (node.dataset.roll ?? "").split("-");
            node.style.opacity = turn.opening && first === second ? "0.12" : "";
          });
        hudRoot?.querySelector(".dice-lattice")?.setAttribute("aria-label", turn.opening ? "Thirty unequal opening dice outcomes; doubles excluded" : "Thirty-six dice outcomes");
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
          .filter((move) => move.turn === turnIndex && !move.hit)
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

      setHud(hudRoot, "turn", `${turnIndex + 1} / ${turnSequence.length}`);
      const barCount = pieces.filter(p => currentPoints.get(p) === barPoint(p.player)).length;
      const offCount = pieces.filter(p => currentPoints.get(p) === offPoint(p.player)).length;
      const hits = timeline.filter(m => m.hit && m.endsAt <= cycleTime).length;
      setHud(hudRoot, "board-counts", `30 CHECKERS · ${barCount} BAR · ${offCount} OFF · ${hits} HITS`);
      setHud(hudRoot, "player", turn.player);
      setHud(hudRoot, "roll", `${turn.dice[0]}–${turn.dice[1]}`);
      setHud(
        hudRoot,
        "move",
        activeMoveIndex >= 0
          ? timeline[activeMoveIndex].hit ? "HIT / RETURN TO BAR" : `PLAY · ${turn.notation}`
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
          ? `${timeline[activeMoveIndex].hit ? "HIT → BAR" : "EXECUTING"} / DIE ${timeline[activeMoveIndex].die}`
          : finished ? `${game.winner} WINS / ${game.result}`
          : turnTime < 2.2
            ? "ROLLING"
            : "LEGAL POSITION / SIM",
      );
    },
  };
}

const SYMBOL_GRID_SIZE = 26;
const SYMBOL_GRID_STEP = 8.19 / 25;
const SYMBOL_GRID_HALF = ((SYMBOL_GRID_SIZE - 1) * SYMBOL_GRID_STEP) / 2;
const SYMBOL_PATH_COUNT = SYMBOL_FEATURE_PATH_COUNT;
const SYMBOL_VERTICES_PER_PATH = SYMBOL_FEATURE_SAMPLES;
const SYMBOL_VERTEX_COUNT = SYMBOL_PATH_COUNT * SYMBOL_VERTICES_PER_PATH;
const SYMBOL_EDGE_COUNT = SYMBOL_PATH_COUNT * (SYMBOL_VERTICES_PER_PATH - 1);

function roundPointMaterial(
  color: number,
  opacity: number,
  pointSize: number,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPointSize: { value: pointSize * Math.min(window.devicePixelRatio || 1, 1.5) },
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
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
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
  const latticeMaterial = roundPointMaterial(INK, SCENE_IS_DARK ? 0.08 : 0.065, 1.2);
  const lattice = new THREE.Points(latticeGeometry, latticeMaterial);
  lattice.frustumCulled = false;
  root.add(lattice);

  const shapes = buildSymbolForms();
  const activePositions = new Float32Array(shapes[0].positions);
  const pointGeometry = new THREE.BufferGeometry();
  const pointAttribute = new THREE.BufferAttribute(activePositions, 3);
  pointAttribute.setUsage(THREE.DynamicDrawUsage);
  pointGeometry.setAttribute("position", pointAttribute);
  const activePointMaterial = roundPointMaterial(RED, 0.72, 1.6);
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
    opacity: 1,
    depthWrite: false,
    toneMapped: false,
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
  const morphDuration = 2.6;
  const holdDuration = 5;
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
          (Math.floor(index / SYMBOL_VERTICES_PER_PATH) / (SYMBOL_PATH_COUNT - 1)) * 0.08;
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
      lineMaterial.opacity = 0.70 + redResolve * 0.30;
      (
        activePointMaterial.uniforms.uColor.value as THREE.Color
      ).copy(workingColor);
      activePointMaterial.uniforms.uOpacity.value =
        0.52 + redResolve * 0.20;

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
        if (previous.distanceTo(next) < 0.001) {
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
          <strong>SILVERSTONE</strong>
          <span>RECONSTRUCTED CIRCUIT · MODELLED LAP</span>
          <span>
            LAP TIME <b data-hud="lap-time">00:00.000</b>
          </span>
          <span>
            PROGRESS <b data-hud="lap-progress">0.0%</b> · SIMULATION 1×
          </span>
          <span className="signal-copy" data-hud="phase">
            RACING LINE / SIMULATION
          </span>
        </section>

        <section className="formula-primary" aria-label="Simulated telemetry">
          <div className="gear-stack">
            <strong data-hud="gear">–</strong>
            <span>GEAR / SIM</span>
          </div>
          <div className="speed-stack">
            <strong data-hud="speed">–––</strong>
            <span>KM/H · SIMULATED</span>
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
        <span title="Road reconstructed from recorded XY samples; kerbs and verges are illustrative, not surveyed.">SILVERSTONE / XY RECONSTRUCTION</span>
      </section>

      <section className="formula-derived">
        <strong>VEHICLE STATE / DERIVED</strong>
        <span data-hud="derived">+0.0° STEER · 0.0G LAT</span>
        <span data-hud="temperature">320°C / SIM</span>
        <span data-hud="model-state">LOADING / GEOMETRY + LAP</span>
        <span>RACING LINE / MIN-CURVATURE ESTIMATE</span>
        <span>RED = BRAKING · GRIP/POWER MODELLED</span>
      </section>

      <div className="scene-credits">
        <a href="https://openf1.org/" target="_blank" rel="noreferrer">
          DATA / OPENF1
        </a>
        <a
          href="https://sketchfab.com/3d-models/mercedes-f1-w14-free-26fda66f3e8a48d5a636056f8a64e299"
          target="_blank"
          rel="noreferrer"
        >
          MODEL / 3DBLENDER_1 · CC BY
        </a>
      </div>
    </>
  );
}

function BackgammonRail({ side, controls }: { side: "left" | "right"; controls?: ReactNode }) {
  if (side === "left") {
    return (
      <>
        <section className="board-primary">
          <div>
            <span>TURN</span>
            <strong data-hud="turn">1 / 65</strong>
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

        {controls}
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
        <small data-hud="board-counts">30 CHECKERS · 0 BAR · 0 OFF</small>
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
          <strong data-hud="dice-space">DICE SPACE / 36 ORDERED OUTCOMES</strong>
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
          ORIGINAL SYMBOLIC FORMS · CONTINUOUS CORRESPONDENCE
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

function PlaybackControls({ onChange }: { onChange: (update: Partial<Playback>) => void }) {
  const [pace, setPace] = useState(65);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    onChange({ paused: reduced });
    const frame = requestAnimationFrame(() => setPaused(reduced));
    return () => cancelAnimationFrame(frame);
  }, [onChange]);
  return (
    <section className="playback-controls" aria-label="Backgammon playback">
      <div><label htmlFor="game-pace">GAME PACE</label><span data-hud="game-duration">FULL GAME</span></div>
      <input id="game-pace" type="range" min="0" max="100" step="1" value={pace}
        aria-label="Backgammon playback speed"
        aria-valuetext={pace === 0 ? "Real time: 12 seconds per turn" : pace === 100 ? "Full game in 30 seconds" : `Playback speed ${pace} percent`}
        onChange={event => { const value = Number(event.target.value); onChange({ pace: value }); setPace(value); }} />
      <div className="playback-scale"><span>REAL TIME</span><span>30 SEC</span></div>
      <div className="playback-actions">
        <button type="button" onClick={() => { onChange({ paused: !paused }); setPaused(!paused); }}>{paused ? "PLAY" : "PAUSE"}</button>
        <button type="button" onClick={() => onChange({ restart: Date.now() })}>RESTART</button>
      </div>
    </section>
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
            className="die-flight"
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
    distance: 17,
    minimumPitch: 0.12,
    minimumDistance: 6.4,
    maximumDistance: 17,
  },
  2: {
    yaw: 0.676,
    pitch: 0.79,
    distance: 21,
    minimumPitch: 0.28,
    minimumDistance: 8.5,
    maximumDistance: 21,
  },
  3: {
    yaw: 0.06,
    pitch: 0.15,
    distance: 23,
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
  const [sceneTheme, setSceneTheme] = useState<SceneTheme | null>(null);
  const viewRef = useRef<SceneView>(defaultView(mode));
  const playbackRef = useRef<Playback>({ pace: 65, paused: false, restart: 0 });
  const updatePlayback = useCallback((update: Partial<Playback>) => {
    Object.assign(playbackRef.current, update);
  }, []);
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
    const syncTheme = () => setSceneTheme(currentSceneTheme());
    syncTheme();
    window.addEventListener("site-themechange", syncTheme);
    return () => window.removeEventListener("site-themechange", syncTheme);
  }, []);

  useEffect(() => {
    // Start after the initial scene has had an opportunity to paint. This only
    // warms immutable data; it never creates another WebGL context or scene.
    const timer = window.setTimeout(() => { void loadFormulaResources().catch(() => {}); }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !sceneTheme) return;

    applySceneTheme(sceneTheme);

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
    renderer.toneMappingExposure = sceneTheme === "dark" ? 1 : 1.15;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
          setHud(hudRootRef.current, "model-state", "LOADING / GEOMETRY + LAP");
          const resources = await loadFormulaResources();
          // A user may switch away while the shared prefetch is in flight.
          if (disposed) return;
          controller = buildFormulaScene(
            scene,
            camera,
            hudRootRef.current,
            trackCanvasRef.current,
            resources,
          );
        } else if (mode === 2) {
          controller = buildBackgammonScene(
            scene,
            camera,
            hudRootRef.current,
            playbackRef,
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
        0.1,
      );
      lastFrameTime = frameTime;
      if (document.hidden) {
        frame = window.requestAnimationFrame(animate);
        return;
      }
      if (!document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) elapsed += delta;
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
      const textures = new Set<THREE.Texture>();
      const disposeMaterial = (material: THREE.Material) => {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
        material.dispose();
      };
      scene.traverse((object) => {
        const geometry = (object as THREE.Mesh).geometry;
        if (geometry) geometry.dispose();
        const material = (object as THREE.Mesh).material;
        if (Array.isArray(material)) {
          material.forEach(disposeMaterial);
        } else if (material) {
          disposeMaterial(material);
        }
      });
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      // Disposing Three.js resources alone does not release the browser's
      // context slot. Theme/scene switches otherwise accumulate live contexts.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [mode, sceneTheme]);

  return (
    <div className={`system-frame mode-${mode}`} ref={hudRootRef}>
      <aside className="telemetry-rail telemetry-rail-left">
        {mode === 1 ? (
          <FormulaRail side="left" trackCanvasRef={trackCanvasRef} />
        ) : mode === 2 ? (
          <BackgammonRail side="left" controls={<PlaybackControls onChange={updatePlayback} />} />
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
              "ArrowUp",
              "ArrowDown",
              "a",
              "A",
              "d",
              "D",
              "+",
              "=",
              "-",
              "0",
            ].includes(event.key)
          ) {
            event.preventDefault();
          }
          if (event.key === "a" || event.key === "A") {
            viewRef.current.yaw += 0.12;
          }
          if (event.key === "d" || event.key === "D") {
            viewRef.current.yaw -= 0.12;
          }
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
            ? "Interactive Formula simulation on a reconstructed Silverstone circuit. Drag to orbit and scroll to zoom."
            : mode === 2
              ? "Interactive full-game backgammon simulation with exact state analysis. Drag to orbit and scroll to zoom."
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
