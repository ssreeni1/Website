import * as THREE from "three";

export type ModernFormulaRole = "body" | "wheel" | "interior";
export type ModernFormulaWheel = {
  name: "front-left" | "front-right" | "rear-left" | "rear-right";
  front: boolean;
  side: -1 | 1;
  yaw: THREE.Group;
  spin: THREE.Group;
  hub: THREE.Vector3;
  radius: number;
};

/** Road curvature is XY counterclockwise; model yaw is +Y, +Z forward. */
export function formulaWheelYaw(curvature: number, wheelbase: number, track: number, side: -1 | 1) {
  if (Math.abs(curvature) < 1e-12) return 0;
  const yawSign = -Math.sign(curvature);
  const insideSide = yawSign > 0 ? 1 : -1;
  const radius = 1 / Math.abs(curvature);
  const wheelRadius = radius + (side === insideSide ? -1 : 1) * track / 2;
  return yawSign * Math.atan(wheelbase / wheelRadius);
}

/** Suppress unresolved rotating line detail, not the physical angular speed. */
export function wheelDetailVisibility(speedKmh: number) {
  return 1 - THREE.MathUtils.smoothstep(Math.abs(speedKmh), 8, 45);
}

/** Two continuous shoulder contours sampled from the actual tire profile.
 * Attach to the steering hub (not spin): a circular contour is rotationally
 * invariant. This avoids tessellation edges strobing as the tire rotates.
 */
export function formulaTireContours(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const centerX = (box.min.x + box.max.x) / 2;
  const halfWidth = (box.max.x - box.min.x) / 2;
  const attribute = geometry.getAttribute("position");
  const points: THREE.Vector3[] = [];
  for (const side of [-1, 1]) {
    const x = centerX + side * halfWidth * 0.70;
    let radius = 0;
    for (let i = 0; i < attribute.count; i++) {
      if (Math.abs(attribute.getX(i) - x) < halfWidth * 0.12) {
        radius = Math.max(radius, Math.hypot(attribute.getY(i), attribute.getZ(i)));
      }
    }
    for (let i = 0; i < 128; i++) {
      for (const j of [i, i + 1]) {
        const a = j / 128 * Math.PI * 2;
        points.push(new THREE.Vector3(x, Math.cos(a) * (radius + 0.001), Math.sin(a) * (radius + 0.001)));
      }
    }
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

const WHEEL_SOURCES = [
  { source: "FL_6", name: "front-left", front: true, side: 1 },
  { source: "FR_74", name: "front-right", front: true, side: -1 },
  { source: "rear left_18", name: "rear-left", front: false, side: 1 },
  { source: "rear right_77", name: "rear-right", front: false, side: -1 },
] as const;

// These are separate transparent logo planes in this specific source asset.
// Dropping textures without dropping their meshes produces floating rectangles.
const DECAL_NAMES = /^(44_lewis|akkodis|amd_png|amg[ _]logo|crowdstrike|pirelli|INEOS|iwc_sponsor|Mercedes-Logo|petronas|sndg_bw|stynium|teamviewer)/i;

function ancestorNamed(object: THREE.Object3D, names: Set<string>) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (names.has(current.name)) return current.name;
    for (const name of names) {
      if (THREE.PropertyBinding.sanitizeNodeName(name) === current.name) return name;
    }
    current = current.parent;
  }
  return null;
}

function isDecal(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (DECAL_NAMES.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Prepare 3dblender_1's W14 interpretation for schematic rendering.
 * Source GLB: https://s3-eu-west-1.amazonaws.com/fetchcfd/original/file-1683823947211.glb
 * Original: https://sketchfab.com/3d-models/mercedes-f1-w14-free-26fda66f3e8a48d5a636056f8a64e299
 * CC BY 4.0. Keep attribution and record the schematic material/rig changes.
 *
 * Output is meters, +Y up, +Z forward, +X vehicle-left, width 2m.
 * All nested/nonuniform source transforms are baked into geometry. Consequently
 * front yaw rotates around Y and all wheel spin rotates around X without shear.
 * The passed scene is read only; the caller remains responsible for disposing it.
 */
export function buildModernFormulaModel(source: THREE.Group) {
  source.updateMatrixWorld(true);
  const wheelNames = new Set<string>(WHEEL_SOURCES.map((wheel) => wheel.source));
  const cockpitNames = new Set(["steering_24"]);
  const carbonNames = new Set([
    "Cube.001_7", "Cube.002_8", "Cube.003_9", "Cube.004_10",
    "Cube.010_19", "Cube.011_20", "Cube.013_27", "Cube.016_30",
    "Cube.018_33", "Cube.019_32", "Cylinder.005_34", "Cylinder.006_58",
    "Cylinder.011_35",
  ]);
  const records: Array<{
    geometry: THREE.BufferGeometry;
    sourceName: string;
    sourceMaterial: string;
    wheel: string | null;
    cockpit: boolean;
    carbon: boolean;
    upright: boolean;
  }> = [];
  const bodyBounds = new THREE.Box3();
  const tireBounds = new THREE.Box3();
  const wheelBounds = new Map<string, THREE.Box3>();
  const sourceHubs = new Map<string, THREE.Vector3>();

  for (const config of WHEEL_SOURCES) {
    const node = source.getObjectByName(config.source) ?? source.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(config.source));
    if (!node) throw new Error(`Modern Formula model missing ${config.source}`);
    sourceHubs.set(config.source, node.getWorldPosition(new THREE.Vector3()));
    wheelBounds.set(config.source, new THREE.Box3());
  }

  source.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh || isDecal(object)) return;
    const mesh = object as THREE.Mesh;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    // All structural materials in this asset are Material.###. Named materials
    // are sponsor decals; this also guards against unexpected logo hierarchy.
    if (!/^Material(?:\.\d+)?$/.test(material.name)) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    bodyBounds.union(geometry.boundingBox);
    const wheel = ancestorNamed(mesh, wheelNames);
    if (wheel) {
      wheelBounds.get(wheel)!.union(geometry.boundingBox);
      tireBounds.union(geometry.boundingBox);
    }
    records.push({
      geometry,
      sourceName: mesh.name,
      sourceMaterial: material.name,
      wheel,
      cockpit: ancestorNamed(mesh, cockpitNames) !== null,
      carbon: ancestorNamed(mesh, carbonNames) !== null,
      upright: ancestorNamed(mesh, new Set(["Cube.007_13"])) !== null,
    });
  });

  if (bodyBounds.isEmpty() || tireBounds.isEmpty()) {
    throw new Error("Modern Formula model has no structural or wheel geometry");
  }
  const sourceWidth = bodyBounds.max.x - bodyBounds.min.x;
  const scale = 2 / sourceWidth;
  const frontZ = (sourceHubs.get("FL_6")!.z + sourceHubs.get("FR_74")!.z) / 2;
  const rearZ = (sourceHubs.get("rear left_18")!.z + sourceHubs.get("rear right_77")!.z) / 2;
  const offset = new THREE.Vector3(
    (bodyBounds.min.x + bodyBounds.max.x) / 2,
    tireBounds.min.y,
    (frontZ + rearZ) / 2,
  );
  const normalize = (point: THREE.Vector3) => point.clone().sub(offset).multiplyScalar(scale);
  const normalizeMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);
  normalizeMatrix.setPosition(offset.clone().multiplyScalar(-scale));

  const root = new THREE.Group();
  root.name = "modern-formula";
  const chassis = new THREE.Group();
  chassis.name = "modern-formula-chassis";
  root.add(chassis);
  const cockpit = new THREE.Group();
  cockpit.name = "modern-formula-steering-wheel";
  const steeringSource = source.getObjectByName("steering_24");
  cockpit.position.copy(normalize(steeringSource?.getWorldPosition(new THREE.Vector3()) ?? offset));
  chassis.add(cockpit);

  const wheels: ModernFormulaWheel[] = WHEEL_SOURCES.map((config) => {
    const hub = normalize(sourceHubs.get(config.source)!);
    const box = wheelBounds.get(config.source)!;
    const size = box.getSize(new THREE.Vector3());
    const yaw = new THREE.Group();
    yaw.name = `${config.name}-yaw`;
    yaw.position.copy(hub);
    const spin = new THREE.Group();
    spin.name = `${config.name}-spin`;
    yaw.add(spin);
    root.add(yaw);
    return {
      name: config.name,
      front: config.front,
      side: config.side,
      yaw,
      spin,
      hub,
      radius: Math.max(size.y, size.z) * scale / 2,
    };
  });

  for (const record of records) {
    record.geometry.applyMatrix4(normalizeMatrix);
    const wheelIndex = WHEEL_SOURCES.findIndex((config) => config.source === record.wheel);
    const wheel = wheels[wheelIndex];
    const role: ModernFormulaRole = wheel ? "wheel" : record.cockpit || record.carbon ? "interior" : "body";
    const rim = wheel && ["Material.004", "Material.005"].includes(record.sourceMaterial);
    const material = new THREE.MeshStandardMaterial({
      name: `${role}_${rim ? "rim" : record.sourceMaterial}`,
      color: role === "wheel" ? (rim ? 0x62666a : 0x17191b) : role === "interior" ? 0x34383a : 0x33383b,
      roughness: role === "wheel" ? (rim ? 0.42 : 0.88) : 0.55,
      metalness: rim ? 0.72 : role === "interior" ? 0.25 : 0.15,
    });
    const mesh = new THREE.Mesh(record.geometry, material);
    mesh.name = `modern_${role}_${record.sourceName}`;
    mesh.userData.formulaRole = role;
    mesh.userData.semanticRole = role;
    mesh.userData.formulaPart = rim ? "rim" : record.carbon ? "carbon" : role;
    mesh.userData.sourceMaterial = record.sourceMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (record.upright) {
      // Combined left/right deflectors follow the uprights, never tire spin.
      const flat = record.geometry.index ? record.geometry.toNonIndexed() : record.geometry.clone();
      const positions = flat.getAttribute("position");
      const normals = flat.getAttribute("normal");
      for (const front of wheels.filter(item => item.front)) {
        const vertices: number[] = [], normalValues: number[] = [];
        for (let i = 0; i < positions.count; i += 3) {
          const centerX = (positions.getX(i) + positions.getX(i+1) + positions.getX(i+2)) / 3;
          if (Math.sign(centerX) !== front.side) continue;
          for (let k = i; k < i+3; k++) {
            vertices.push(positions.getX(k)-front.hub.x, positions.getY(k)-front.hub.y, positions.getZ(k)-front.hub.z);
            if (normals) normalValues.push(normals.getX(k),normals.getY(k),normals.getZ(k));
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices,3));
        if (normalValues.length) geometry.setAttribute("normal",new THREE.Float32BufferAttribute(normalValues,3));
        else geometry.computeVertexNormals();
        const deflector = mesh.clone();
        deflector.geometry = geometry;
        deflector.name = `${front.name}-upright-deflector`;
        front.yaw.add(deflector);
      }
      flat.dispose();
      record.geometry.dispose();
      continue;
    }
    if (wheel) {
      record.geometry.translate(-wheel.hub.x, -wheel.hub.y, -wheel.hub.z);
      wheel.spin.add(mesh);
    } else if (record.cockpit) {
      record.geometry.translate(-cockpit.position.x, -cockpit.position.y, -cockpit.position.z);
      cockpit.add(mesh);
    } else {
      chassis.add(mesh);
    }
    record.geometry.computeBoundingBox();
    record.geometry.computeBoundingSphere();
  }

  root.updateMatrixWorld(true);
  return {
    root,
    chassis,
    cockpit,
    wheels,
    wheelbase: (frontZ - rearZ) * scale,
    frontTrack: Math.abs(wheels[0].hub.x - wheels[1].hub.x),
    rearTrack: Math.abs(wheels[2].hub.x - wheels[3].hub.x),
    width: 2,
    scale,
    sourceOffset: offset,
    bounds: new THREE.Box3().setFromObject(root, true),
  };
}
