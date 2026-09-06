import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildRacingPath} from '../app/racing-path.ts';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {gunzipSync} from 'node:zlib';
import {decodeFormulaAsset, instantiateFormulaAsset} from '../app/formula-assets.ts';
import {buildModernFormulaModel, applyFormulaSteering, formulaWheelYaw, formulaTireContours, wheelDetailVisibility} from '../app/formula-model.ts';
import { initialState, pipCount, legalMoves, legalPlays, applyMove, generateGame, validateGame, offPoint } from '../app/backgammon-engine.ts';
import { buildSymbolForms, SYMBOL_FEATURE_PATH_COUNT, SYMBOL_FEATURE_SAMPLES } from '../app/symbol-geometry.ts';

const empty = () => ({ WHITE: Array(26).fill(0), BLACK: Array(26).fill(0) });

test('wheel detail fades continuously without changing spin speed', () => {
  assert.equal(wheelDetailVisibility(0),1);
  assert.equal(wheelDetailVisibility(320),0);
  let previous=1;
  for(let speed=0;speed<=320;speed+=0.25){
    const detail=wheelDetailVisibility(speed);
    assert.ok(detail<=previous && detail>=0);
    assert.ok(previous-detail<0.011);
    assert.equal(detail,wheelDetailVisibility(-speed));
    previous=detail;
  }
});

test('road-wheel yaw follows curvature with correct direction and inner-wheel angle', () => {
  for (const curvature of [-0.03, -0.01, 0.01, 0.03]) {
    const left = formulaWheelYaw(curvature, 3.42, 1.583, 1);
    const right = formulaWheelYaw(curvature, 3.42, 1.583, -1);
    assert.equal(Math.sign(left), -Math.sign(curvature));
    assert.equal(Math.sign(right), -Math.sign(curvature));
    assert.ok(curvature < 0 ? Math.abs(left) > Math.abs(right) : Math.abs(right) > Math.abs(left));
    assert.ok(Math.abs(left + formulaWheelYaw(-curvature, 3.42, 1.583, -1)) < 1e-12);
  }
  assert.equal(formulaWheelYaw(0, 3.42, 1.583, 1), 0);
  assert.equal(formulaWheelYaw(0, 3.42, 1.583, -1), 0);
});

test('shipped tire geometry steers along its contact velocity through a full lap', async () => {
  const binary = gunzipSync(readFileSync(new URL('../public/models/formula-runtime-v1.bin.gz', import.meta.url)));
  const template = await decodeFormulaAsset(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
  const { prepared } = instantiateFormulaAsset(template);
  const data = JSON.parse(readFileSync(new URL('../public/data/silverstone-antonelli-l18.json', import.meta.url)));
  const path = buildRacingPath(data.location, data.car, data.source.lapDurationMs, template.metadata.racingOffsets);
  let min = Infinity, max = -Infinity;
  const rearZ = (prepared.wheels[2].hub.z + prepared.wheels[3].hub.z) / 2;
  for (let time = 0; time < path.duration; time += 50) {
    const k = path.atTime(time).curvature;
    const steer = applyFormulaSteering(prepared.wheels, k, prepared.wheelbase, prepared.frontTrack);
    min = Math.min(min, steer); max = Math.max(max, steer);
    for (const wheel of prepared.wheels) wheel.spin.rotation.x = time / 37;
    prepared.root.updateMatrixWorld(true);
    for (const wheel of prepared.wheels) {
      const tire = wheel.spin.children.find(mesh => mesh.userData.sourceMaterial === 'Material.001');
      const axle = new THREE.Vector3(1, 0, 0).transformDirection(tire.matrixWorld);
      const tireForward = axle.cross(new THREE.Vector3(0, 1, 0)).normalize();
      // Rigid-body velocity at each contact, with the rear axle on the path.
      const contactVelocity = new THREE.Vector3(-k * (wheel.hub.z - rearZ), 0, 1 + k * wheel.hub.x).normalize();
      assert.ok(tireForward.angleTo(contactVelocity) < 0.0002, `${wheel.name} must roll in its direction of travel`);
      assert.ok(wheel.spin.getWorldPosition(new THREE.Vector3()).distanceTo(wheel.hub) < 1e-10, 'steering must not displace a hub');
      assert.equal(Math.sign(wheel.yaw.rotation.y), wheel.front ? Math.sign(steer) : 0);
    }
  }
  assert.ok(min < -0.10 && max > 0.08, 'both actual front tires steer through left and right corners');
});

test('standard opening has 167 pips per player', () => {
  const state = initialState();
  assert.equal(pipCount(state, 'WHITE'), 167);
  assert.equal(pipCount(state, 'BLACK'), 167);
});

test('bar entry takes priority and blocked points cannot be entered', () => {
  const state = empty();
  state.WHITE[25] = 1; state.WHITE[6] = 14; state.BLACK[24] = 2;
  assert.deepEqual(legalMoves(state, 'WHITE', 1), []);
  assert.deepEqual(legalMoves(state, 'WHITE', 2), [{from:25,to:23,die:2}]);
});

test('a hit transfers exactly one opposing checker to its bar', () => {
  const state = empty(); state.WHITE[8] = 1; state.BLACK[5] = 1;
  const after = applyMove(state, 'WHITE', {from:8,to:5,die:3});
  assert.equal(after.WHITE[5], 1); assert.equal(after.BLACK[5], 0);
  assert.equal(after.BLACK[0], 1); assert.equal(state.BLACK[5], 1);
});

test('bear-off overshoot is allowed only from the farthest occupied point', () => {
  const state = empty(); state.WHITE[5] = 1; state.WHITE[3] = 14;
  assert.deepEqual(legalMoves(state, 'WHITE', 6), [{from:5,to:0,die:6}]);
  state.WHITE[8] = 1;
  assert.ok(legalMoves(state, 'WHITE', 6).every(move => move.to !== 0));
});

test('a turn uses the maximum dice and the higher die when only one can be used', () => {
  const state = empty(); state.WHITE[25] = 1; state.WHITE[0] = 14; state.BLACK[22] = 2;
  const plays = legalPlays(state, 'WHITE', [1,2]);
  assert.ok(plays.length > 0);
  assert.ok(plays.every(play => play.moves.length === 1 && play.moves[0].die === 2));
  assert.ok(legalPlays(initialState(), 'WHITE', [3,3]).every(play => play.moves.length === 4));
});

test('exhibition games finish with 15 checkers off and every turn legal', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const game = generateGame(seed);
    validateGame(game);
    assert.equal(game.final[game.winner][offPoint(game.winner)], 15);
    assert.notEqual(game.turns[0].dice[0], game.turns[0].dice[1]);
  }
  const game = generateGame(5);
  assert.equal(game.turns.length, 65);
  assert.equal(game.result, 'SINGLE');
});

test('all symbols share finite, bounded 3D correspondence geometry', () => {
  const forms = buildSymbolForms();
  assert.deepEqual(forms.map(form => form.name), ['PHOENIX','OUROBOROS','GANDIVA']);
  for (const form of forms) {
    assert.equal(form.paths.length, SYMBOL_FEATURE_PATH_COUNT);
    assert.equal(form.positions.length, SYMBOL_FEATURE_PATH_COUNT * SYMBOL_FEATURE_SAMPLES * 3);
    assert.ok([...form.positions].every(value => Number.isFinite(value) && Math.abs(value) <= 4.095));
    const depths = form.paths.flat().map(point => point.z);
    assert.ok(Math.max(...depths) - Math.min(...depths) > 0.5, `${form.name} must have depth`);
  }
});

test('racing path closes with continuous position, tangent and curvature', () => {
  const data=JSON.parse(readFileSync(new URL('../public/data/silverstone-antonelli-l18.json',import.meta.url)));
  const path=buildRacingPath(data.location,data.car,data.source.lapDurationMs);
  const a=path.atDistance(0), b=path.atDistance(path.length-0.00001);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<0.001);
  assert.ok(Math.abs(Math.atan2(a.dx,a.dy)-Math.atan2(b.dx,b.dy))<0.00001);
  assert.ok(Math.abs(a.curvature-b.curvature)<0.00001);
  assert.ok(Math.abs(path.length/path.integratedLength-1)<0.03);
  assert.ok(path.roadSamples.length>8000);
  const turnSign=Math.sign(path.atDistance(995).curvature);
  const offsets=[905,995,1085].map(s=>path.atDistance(s).signedOffset*turnSign);
  assert.ok(offsets[0]<-4 && offsets[1]>5 && offsets[2]<-5, 'outside / apex / outside');
  let previous=path.atTime(0);
  for(let time=16;time<path.duration;time+=16){
    const pose=path.atTime(time);
    assert.ok([pose.x,pose.y,pose.dx,pose.dy,pose.curvature].every(Number.isFinite));
    assert.ok(pose.offset<=6.000001, 'inside road clearance corridor');
    const v=pose.modeledSpeed/3.6;
    assert.ok(v*v*Math.abs(pose.curvature)<=path.model.mechanicalGrip+path.model.downforceGrip*v*v, 'within modeled grip envelope');
    assert.ok(pose.modeledAcceleration>=-30.000001, 'within modeled braking bound');
    const angle=Math.atan2(pose.dx,pose.dy)-Math.atan2(previous.dx,previous.dy);
    assert.ok(Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<0.03,'no abrupt frame-to-frame heading jumps');
    previous=pose;
  }
});

test('actual GLTF loader preserves four hub-centered steering and spin rigs', async () => {
  const binary=readFileSync(new URL('../public/models/formula-w14.glb',import.meta.url));
  const loader=new GLTFLoader();
  // Preserve real node/material names while omitting browser texture decoding.
  loader.register(parser=>({name:'QA_MATERIALS',loadMaterial:index=>Promise.resolve(new THREE.MeshStandardMaterial({name:parser.json.materials[index].name}))}));
  const gltf=await loader.parseAsync(binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength),'');
  const model=buildModernFormulaModel(gltf.scene);
  const packed=readFileSync(new URL('../public/models/formula-runtime-v1.bin.gz',import.meta.url));
  assert.ok(packed.length<1600000,'runtime transfer budget');
  const unpacked=gunzipSync(packed);
  const template=await decodeFormulaAsset(unpacked.buffer.slice(unpacked.byteOffset,unpacked.byteOffset+unpacked.byteLength));
  const telemetry=JSON.parse(readFileSync(new URL('../public/data/silverstone-antonelli-l18.json',import.meta.url),'utf8'));
  const slowPath=buildRacingPath(telemetry.location,telemetry.car,telemetry.source.lapDurationMs);
  const fastPath=buildRacingPath(telemetry.location,telemetry.car,telemetry.source.lapDurationMs,template.metadata.racingOffsets);
  assert.deepEqual(fastPath.roadSamples,slowPath.roadSamples);
  assert.equal(fastPath.duration,slowPath.duration);
  for(let t=-100;t<slowPath.duration+100;t+=137)assert.deepEqual(fastPath.atTime(t),slowPath.atTime(t));
  const {prepared:fast,edges}=instantiateFormulaAsset(template);
  assert.equal(fast.wheelbase,model.wheelbase);
  assert.equal(fast.frontTrack,model.frontTrack);
  assert.deepEqual(fast.bounds,model.bounds);
  let meshes=0;
  const restoredMeshes=[];
  fast.root.traverse(object=>{if(object.isMesh)restoredMeshes.push(object)});
  model.root.traverse(original=>{
    if(!original.isMesh)return;
    const restored=restoredMeshes[meshes++];
    assert.ok(restored?.isMesh,original.name);
    assert.deepEqual(restored.position.toArray(),original.position.toArray());
    assert.deepEqual(restored.userData,original.userData);
    for(const key of ['position','normal']){
      if(key==='normal' && original.userData.formulaRole!=='wheel')continue;
      const before=original.geometry.getAttribute(key).array;
      const after=restored.geometry.getAttribute(key).array;
      assert.equal(before.length,after.length);
      for(let i=0;i<before.length;i++)assert.ok(Math.abs(before[i]-after[i])<(key==='normal'?0.0001:0.0000105),original.name+' '+key);
    }
    const before=original.geometry.index?.array,after=restored.geometry.index?.array;
    assert.equal(before?.length,after?.length);
    if(before)for(let i=0;i<before.length;i+=3){
      // Meshopt may cyclically rotate a triangle, never alter its winding.
      assert.ok([0,1,2].some(shift=>[0,1,2].every(k=>before[i+k]===after[i+(k+shift)%3])));
    }
    const tire=original.userData.formulaRole==='wheel' && original.userData.sourceMaterial==='Material.001';
    const oldEdges=tire?formulaTireContours(original.geometry):new THREE.EdgesGeometry(original.geometry,original.userData.formulaRole==='wheel'?35:16);
    const beforeEdges=oldEdges.getAttribute('position').array;
    const afterEdges=edges.get(restored.geometry).getAttribute('position').array;
    assert.equal(beforeEdges.length,afterEdges.length);
    for(let i=0;i<beforeEdges.length;i++)assert.ok(Math.abs(beforeEdges[i]-afterEdges[i])<0.0000105);
    oldEdges.dispose();
  });
  assert.equal(edges.size,meshes,'no mesh or outline omitted');
  // GPU wrappers must not be shared with independently mounted scenes.
  const second=instantiateFormulaAsset(template);
  assert.notEqual(second.prepared.root,fast.root);
  assert.notEqual(second.edges.keys().next().value,edges.keys().next().value);
  assert.equal(model.wheels.length,4);
  assert.ok(Math.abs(model.bounds.max.x-model.bounds.min.x-2)<0.001);
  assert.ok(Math.abs(model.bounds.min.y)<0.001);
  for(const wheel of model.wheels){
    assert.equal(wheel.spin.children.length,5);
    if(wheel.front) assert.equal(wheel.yaw.children.filter(node=>node.name.includes('upright-deflector')).length,2);
    assert.ok(wheel.radius>.34 && wheel.radius<.37);
    const tire=wheel.spin.children.find(mesh=>mesh.userData.sourceMaterial==='Material.001');
    const contours=formulaTireContours(tire.geometry);
    const points=contours.getAttribute('position');
    assert.equal(points.count,512);
    for(let i=0;i<points.count;i++){
      const r=Math.hypot(points.getY(i),points.getZ(i));
      assert.ok(r>wheel.radius*.85 && r<wheel.radius*1.01,'contours follow the actual tire shoulder');
      assert.ok(Math.abs(points.getX(i))<.23,'contours remain on the wheel');
    }
    contours.dispose();
    const center=wheel.spin.getWorldPosition(new THREE.Vector3());
    wheel.yaw.rotation.y=wheel.front?0.2:0;
    wheel.spin.rotation.x=2.7;
    model.root.updateMatrixWorld(true);
    assert.ok(center.distanceTo(wheel.spin.getWorldPosition(new THREE.Vector3()))<1e-8);
  }
});
