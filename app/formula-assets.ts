import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { buildModernFormulaModel } from "./formula-model";

type BufferSpec = { offset: number; length: number; count: number; stride: number; itemSize: number; integer: boolean; quantum: number; mode: "ATTRIBUTES" | "TRIANGLES" | "INDICES"; filter?: "OCTAHEDRAL" };
type MeshSpec = { position: number; normal: number | null; index: number | null; edges: number; edgesIndexed: boolean; material: string };
type NodeSpec = { name: string; parent: number; position: number[]; quaternion: number[]; scale: number[]; userData: Record<string, unknown>; mesh?: MeshSpec };
type WheelSpec = { name: "front-left" | "front-right" | "rear-left" | "rear-right"; front: boolean; side: -1 | 1; hub: number[]; radius: number };
type Metadata = {
  version: number; nodes: NodeSpec[]; buffers: BufferSpec[]; wheels: WheelSpec[]; racingOffsets: number[];
  wheelbase: number; frontTrack: number; rearTrack: number; width: number; scale: number;
  sourceOffset: number[]; bounds: { min: number[]; max: number[] };
};
export type FormulaTemplate = { metadata: Metadata; arrays: (Float32Array | Uint32Array)[] };

/** Decode immutable CPU buffers once. No textures, geometry baking, or edge
 * extraction on the UI thread; all of those are handled by the asset compiler. */
export async function decodeFormulaAsset(binary: ArrayBuffer): Promise<FormulaTemplate> {
  const view = new DataView(binary);
  if (binary.byteLength < 8 || view.getUint32(0, true) !== 0x31305346) throw new Error("Invalid Formula asset");
  const jsonLength = view.getUint32(4, true);
  const metadata: Metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(binary, 8, jsonLength)));
  if (metadata.version !== 1) throw new Error("Unsupported Formula asset");
  await MeshoptDecoder.ready;
  const start = 8 + jsonLength;
  const arrays = metadata.buffers.map(spec => {
    const decoded = new Uint8Array(spec.count * spec.stride);
    MeshoptDecoder.decodeGltfBuffer(decoded, spec.count, spec.stride, new Uint8Array(binary, start + spec.offset, spec.length), spec.mode, spec.filter);
    if (spec.filter === "OCTAHEDRAL") {
      const packed = new Int16Array(decoded.buffer);
      const normals = new Float32Array(spec.count * 3);
      for (let i = 0; i < spec.count; i++) for (let k = 0; k < 3; k++) normals[i * 3 + k] = packed[i * 4 + k] / 32767;
      return normals;
    }
    return spec.integer ? new Uint32Array(decoded.buffer) : Float32Array.from(new Int32Array(decoded.buffer), value => value * spec.quantum);
  });
  return { metadata, arrays };
}

/** Each scene owns its Three.js wrappers; cached typed arrays are immutable.
 * Disposing one scene therefore cannot invalidate another scene's GPU objects. */
export function instantiateFormulaAsset(template: FormulaTemplate) {
  const { metadata, arrays } = template;
  const attribute = (index: number) => new THREE.BufferAttribute(arrays[index], metadata.buffers[index].itemSize);
  const edges = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  const nodes: THREE.Object3D[] = metadata.nodes.map(node => {
    let object: THREE.Object3D;
    if (node.mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", attribute(node.mesh.position));
      if (node.mesh.normal !== null) geometry.setAttribute("normal", attribute(node.mesh.normal));
      if (node.mesh.index !== null) geometry.setIndex(attribute(node.mesh.index));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const outline = new THREE.BufferGeometry();
      if (node.mesh.edgesIndexed) {
        const indices = arrays[node.mesh.edges];
        const positions = arrays[node.mesh.position];
        const values = new Float32Array(indices.length * 3);
        indices.forEach((vertex, i) => {
          values[i * 3] = positions[vertex * 3];
          values[i * 3 + 1] = positions[vertex * 3 + 1];
          values[i * 3 + 2] = positions[vertex * 3 + 2];
        });
        outline.setAttribute("position", new THREE.BufferAttribute(values, 3));
      } else outline.setAttribute("position", attribute(node.mesh.edges));
      edges.set(geometry, outline);
      object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: node.mesh.material }));
    } else object = new THREE.Group();
    object.name = node.name;
    object.position.fromArray(node.position);
    object.quaternion.fromArray(node.quaternion);
    object.scale.fromArray(node.scale);
    object.userData = { ...node.userData };
    return object;
  });
  metadata.nodes.forEach((node, index) => { if (node.parent >= 0) nodes[node.parent].add(nodes[index]); });
  const root = nodes[0] as THREE.Group;
  root.updateMatrixWorld(true);
  const prepared: ReturnType<typeof buildModernFormulaModel> = {
    root,
    chassis: root.getObjectByName("modern-formula-chassis") as THREE.Group,
    cockpit: root.getObjectByName("modern-formula-steering-wheel") as THREE.Group,
    wheels: metadata.wheels.map(wheel => ({
      ...wheel, hub: new THREE.Vector3().fromArray(wheel.hub),
      yaw: root.getObjectByName(wheel.name + "-yaw") as THREE.Group,
      spin: root.getObjectByName(wheel.name + "-spin") as THREE.Group,
    })),
    wheelbase: metadata.wheelbase, frontTrack: metadata.frontTrack, rearTrack: metadata.rearTrack,
    width: metadata.width, scale: metadata.scale,
    sourceOffset: new THREE.Vector3().fromArray(metadata.sourceOffset),
    bounds: new THREE.Box3(new THREE.Vector3().fromArray(metadata.bounds.min), new THREE.Vector3().fromArray(metadata.bounds.max)),
  };
  return { prepared, edges };
}

let cached: Promise<FormulaTemplate> | undefined;
export function loadFormulaAsset() {
  const compressed = typeof DecompressionStream !== "undefined";
  return cached ??= fetch("/models/formula-runtime-v1.bin" + (compressed ? ".gz" : ""))
    .then(async response => {
      if (!response.ok) throw new Error("Formula asset could not be loaded");
      // Explicit gzip works on static hosts regardless of their MIME compression
      // policy. Older browsers retain a functional uncompressed fallback.
      if (compressed) {
        const bytes = await response.arrayBuffer();
        // Some CDNs transparently decompress .gz files using Content-Encoding.
        if (new Uint8Array(bytes)[0] !== 0x1f) return bytes;
        return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      }
      return response.arrayBuffer();
    })
    .then(decodeFormulaAsset)
    .catch(error => { cached = undefined; throw error; });
}
