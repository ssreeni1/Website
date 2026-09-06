// Regenerate using npm run prepare:formula (Node 22.13+).
// The checked-in runtime asset means normal site builds do not run this script.
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptEncoder } from "meshoptimizer/encoder";
import { buildModernFormulaModel, formulaTireContours } from "../app/formula-model.ts";
import { buildRacingPath } from "../app/racing-path.ts";

const source = await readFile(new URL("../public/models/formula-w14.glb", import.meta.url));
const loader = new GLTFLoader();
loader.register(parser => ({
  name: "SCHEMATIC_MATERIALS",
  loadMaterial: index => Promise.resolve(new THREE.MeshStandardMaterial({ name: parser.json.materials[index].name })),
}));
const gltf = await loader.parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), "");
const model = buildModernFormulaModel(gltf.scene);
await MeshoptEncoder.ready;
const chunks = [], buffers = [], nodes = [];
let byteLength = 0;
function pack(array, itemSize, indexMode = "TRIANGLES") {
  // Retain every vertex and triangle. Round floats to 0.00002: positions move
  // at most 0.01 mm per axis. Wheel normals have a separate octahedral encoder.
  // Removing sub-micron float noise allows much better lossless integer coding.
  const integer = array instanceof Uint16Array || array instanceof Uint32Array;
  const quantum = integer ? 0 : 0.00002;
  const values = integer ? new Uint32Array(array) : Int32Array.from(array, value => Math.round(value / quantum));
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  const stride = itemSize * values.BYTES_PER_ELEMENT;
  const mode = integer ? indexMode : "ATTRIBUTES";
  const encoded = MeshoptEncoder.encodeGltfBuffer(bytes, values.length / itemSize, stride, mode, 0);
  const index = buffers.length;
  buffers.push({ offset: byteLength, length: encoded.length, count: values.length / itemSize, stride, itemSize, integer, quantum, mode });
  chunks.push(encoded);
  byteLength += encoded.length;
  return index;
}
function packNormals(array) {
  const count = array.length / 3;
  const vectors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) vectors.set(array.subarray(i * 3, i * 3 + 3), i * 4);
  const filtered = MeshoptEncoder.encodeFilterOct(vectors, count, 8, 16);
  const encoded = MeshoptEncoder.encodeGltfBuffer(filtered, count, 8, "ATTRIBUTES", 0);
  const index = buffers.length;
  buffers.push({ offset: byteLength, length: encoded.length, count, stride: 8, itemSize: 3, integer: false, quantum: 0, mode: "ATTRIBUTES", filter: "OCTAHEDRAL" });
  chunks.push(encoded);
  byteLength += encoded.length;
  return index;
}
function visit(object, parent = -1) {
  const node = { name: object.name, parent, position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), userData: object.userData };
  if (object.isMesh) {
    const geometry = object.geometry;
    const tire = object.userData.formulaRole === "wheel" && object.userData.sourceMaterial === "Material.001";
    const edges = tire ? formulaTireContours(geometry) : new THREE.EdgesGeometry(geometry, object.userData.formulaRole === "wheel" ? 35 : 16);
    const position = geometry.getAttribute("position");
    const edgePosition = edges.getAttribute("position");
    let edgeBuffer;
    if (tire) edgeBuffer = pack(edgePosition.array, 3);
    else {
      // Structural outlines use existing mesh vertices, not another copy of
      // their coordinates. This also guarantees exact outline/surface alignment.
      const lookup = new Map();
      const key = (attribute, i) => [attribute.getX(i), attribute.getY(i), attribute.getZ(i)].join(",");
      for (let i = 0; i < position.count; i++) lookup.set(key(position, i), i);
      const indices = new Uint32Array(edgePosition.count);
      for (let i = 0; i < indices.length; i++) {
        const vertex = lookup.get(key(edgePosition, i));
        if (vertex === undefined) throw new Error("Outline vertex is not on its mesh");
        indices[i] = vertex;
      }
      edgeBuffer = pack(indices, 1, "INDICES");
    }
    node.mesh = {
      position: pack(geometry.getAttribute("position").array, 3),
      // Only rubber/rims use lighting; the body uses unlit schematic material.
      normal: object.userData.formulaRole === "wheel" ? packNormals(geometry.getAttribute("normal").array) : null,
      index: geometry.index ? pack(geometry.index.array, 1) : null,
      edges: edgeBuffer,
      edgesIndexed: !tire,
      material: object.material.name,
    };
    edges.dispose();
  }
  const index = nodes.length;
  nodes.push(node);
  object.children.forEach(child => visit(child, index));
}
visit(model.root);
const telemetry = JSON.parse(await readFile(new URL("../public/data/silverstone-antonelli-l18.json", import.meta.url), "utf8"));
const racing = buildRacingPath(telemetry.location, telemetry.car, telemetry.source.lapDurationMs);
const metadata = {
  version: 1, nodes, buffers, racingOffsets: racing.controlOffsets,
  wheels: model.wheels.map(({ name, front, side, hub, radius }) => ({ name, front, side, hub: hub.toArray(), radius })),
  wheelbase: model.wheelbase, frontTrack: model.frontTrack, rearTrack: model.rearTrack,
  width: model.width, scale: model.scale, sourceOffset: model.sourceOffset.toArray(),
  bounds: { min: model.bounds.min.toArray(), max: model.bounds.max.toArray() },
};
const json = Buffer.from(JSON.stringify(metadata));
const header = Buffer.alloc(8); header.write("FS01"); header.writeUInt32LE(json.length, 4);
const output = Buffer.concat([header, json, ...chunks]);
await writeFile(new URL("../public/models/formula-runtime-v1.bin", import.meta.url), output);
const compressed = gzipSync(output, { level: 9 });
await writeFile(new URL("../public/models/formula-runtime-v1.bin.gz", import.meta.url), compressed);
console.log(JSON.stringify({ sourceBytes: source.length, runtimeBytes: output.length, transferBytes: compressed.length, nodes: nodes.length, buffers: buffers.length }));
