import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildRacingPath} from '../app/racing-path.ts';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildModernFormulaModel, formulaWheelYaw} from '../app/formula-model.ts';
import { initialState, pipCount, legalMoves, legalPlays, applyMove, generateGame, validateGame, offPoint } from '../app/backgammon-engine.ts';
import { buildSymbolForms, SYMBOL_FEATURE_PATH_COUNT, SYMBOL_FEATURE_SAMPLES } from '../app/symbol-geometry.ts';

const empty = () => ({ WHITE: Array(26).fill(0), BLACK: Array(26).fill(0) });

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
  assert.equal(model.wheels.length,4);
  assert.ok(Math.abs(model.bounds.max.x-model.bounds.min.x-2)<0.001);
  assert.ok(Math.abs(model.bounds.min.y)<0.001);
  for(const wheel of model.wheels){
    assert.equal(wheel.spin.children.length,5);
    if(wheel.front) assert.equal(wheel.yaw.children.filter(node=>node.name.includes('upright-deflector')).length,2);
    assert.ok(wheel.radius>.34 && wheel.radius<.37);
    const center=wheel.spin.getWorldPosition(new THREE.Vector3());
    wheel.yaw.rotation.y=wheel.front?0.2:0;
    wheel.spin.rotation.x=2.7;
    model.root.updateMatrixWorld(true);
    assert.ok(center.distanceTo(wheel.spin.getWorldPosition(new THREE.Vector3()))<1e-8);
  }
});
