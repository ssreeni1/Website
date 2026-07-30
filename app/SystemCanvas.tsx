"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

type VisualMode = 1 | 2;

const INK = 0x161616;
const PAPER = 0xf6f6f3;
const RED = 0xf02b1d;

function wireObject(
  geometry: THREE.BufferGeometry,
  color = INK,
  opacity = 0.58,
  fillOpacity = 0.025,
) {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: fillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const wires = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    }),
  );
  group.add(fill, wires);
  return group;
}

function edgeObject(
  geometry: THREE.BufferGeometry,
  color = INK,
  opacity = 0.72,
  fillOpacity = 0.035,
) {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: fillOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
      }),
    ),
  );
  return group;
}

function lineBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color = INK,
  opacity = 0.42,
) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([start, end]),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    }),
  );
}

function buildFormulaScene() {
  const root = new THREE.Group();
  const car = new THREE.Group();
  root.add(car);
  const movingParts: THREE.Object3D[] = [];
  const sensors: THREE.Mesh[] = [];

  // Floor and primary survival cell.
  const floor = edgeObject(new THREE.BoxGeometry(2.45, 0.1, 6.4), INK, 0.36, 0.018);
  floor.position.y = 0.08;
  car.add(floor);

  const survivalCell = wireObject(
    new THREE.CapsuleGeometry(0.62, 3.15, 7, 14),
    INK,
    0.62,
    0.022,
  );
  survivalCell.rotation.x = Math.PI / 2;
  survivalCell.position.set(0, 0.58, 0.05);
  car.add(survivalCell);

  const nose = wireObject(new THREE.ConeGeometry(0.48, 3.25, 12, 6), INK, 0.72, 0.02);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.45, -3.05);
  car.add(nose);

  const engineCover = wireObject(
    new THREE.ConeGeometry(0.74, 2.8, 12, 7),
    INK,
    0.56,
    0.024,
  );
  engineCover.rotation.x = -Math.PI / 2;
  engineCover.scale.set(1, 1, 0.72);
  engineCover.position.set(0, 0.72, 2.15);
  car.add(engineCover);

  // Sidepods and venturi tunnels.
  [-1, 1].forEach((side) => {
    const pod = wireObject(new THREE.BoxGeometry(1.05, 0.72, 2.55, 3, 2, 7), INK, 0.48, 0.018);
    pod.position.set(side * 0.95, 0.46, 0.65);
    pod.rotation.y = side * -0.06;
    car.add(pod);

    const tunnel = wireObject(new THREE.BoxGeometry(0.72, 0.22, 4.2, 2, 1, 10), INK, 0.28, 0);
    tunnel.position.set(side * 0.9, 0.13, 0.65);
    car.add(tunnel);

    for (let i = 0; i < 6; i++) {
      car.add(
        lineBetween(
          new THREE.Vector3(side * 0.54, 0.8 + i * 0.035, 0.05 + i * 0.18),
          new THREE.Vector3(side * 1.33, 0.74 + i * 0.02, 0.18 + i * 0.18),
          INK,
          0.22,
        ),
      );
    }
  });

  // Wings and active aero flaps.
  const frontWing = edgeObject(new THREE.BoxGeometry(4.5, 0.11, 0.48), INK, 0.75, 0.018);
  frontWing.position.set(0, 0.25, -4.82);
  car.add(frontWing);
  for (let layer = 0; layer < 3; layer++) {
    const flap = edgeObject(new THREE.BoxGeometry(4.0 - layer * 0.35, 0.055, 0.3), INK, 0.4, 0);
    flap.position.set(0, 0.34 + layer * 0.09, -4.56 + layer * 0.12);
    flap.rotation.x = -0.08 - layer * 0.04;
    car.add(flap);
  }

  const rearWing = new THREE.Group();
  const rearMain = edgeObject(new THREE.BoxGeometry(3.45, 0.12, 0.48), INK, 0.76, 0.02);
  rearMain.position.y = 1.42;
  rearWing.add(rearMain);
  const rearFlap = edgeObject(new THREE.BoxGeometry(3.18, 0.08, 0.38), RED, 0.65, 0.012);
  rearFlap.position.set(0, 1.68, -0.02);
  rearWing.add(rearFlap);
  [-1, 1].forEach((side) => {
    const endplate = edgeObject(new THREE.BoxGeometry(0.08, 1.55, 0.92), INK, 0.55, 0);
    endplate.position.set(side * 1.7, 0.92, 0);
    rearWing.add(endplate);
  });
  rearWing.position.z = 4.0;
  car.add(rearWing);
  movingParts.push(rearFlap);

  // Wheels, brake discs, hubs, and suspension.
  const wheelPositions: Array<[number, number]> = [
    [-1.62, -2.6],
    [1.62, -2.6],
    [-1.68, 2.62],
    [1.68, 2.62],
  ];
  wheelPositions.forEach(([x, z], index) => {
    const wheelGroup = new THREE.Group();
    const tyre = wireObject(new THREE.CylinderGeometry(0.72, 0.72, 0.52, 20, 5), INK, 0.58, 0.045);
    tyre.rotation.z = Math.PI / 2;
    wheelGroup.add(tyre);

    const hub = wireObject(new THREE.CylinderGeometry(0.31, 0.31, 0.58, 12, 2), index < 2 ? RED : INK, 0.48, 0.02);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);
    wheelGroup.position.set(x, 0.63, z);
    car.add(wheelGroup);
    movingParts.push(wheelGroup);

    const side = Math.sign(x);
    const chassisX = side * (index < 2 ? 0.35 : 0.52);
    const chassisZ = z + (index < 2 ? 0.38 : -0.42);
    car.add(
      lineBetween(new THREE.Vector3(chassisX, 0.34, chassisZ), new THREE.Vector3(x, 0.58, z - 0.24)),
      lineBetween(new THREE.Vector3(chassisX, 0.67, chassisZ), new THREE.Vector3(x, 0.74, z + 0.22)),
      lineBetween(new THREE.Vector3(chassisX, 0.45, chassisZ), new THREE.Vector3(x, 0.72, z)),
    );
  });

  // Cockpit, halo, steering wheel, intake.
  const cockpit = wireObject(new THREE.TorusGeometry(0.56, 0.055, 8, 24), INK, 0.76, 0);
  cockpit.rotation.x = Math.PI / 2;
  cockpit.scale.z = 1.35;
  cockpit.position.set(0, 1.13, -0.55);
  car.add(cockpit);
  const haloPillar = edgeObject(new THREE.BoxGeometry(0.08, 0.62, 0.08), INK, 0.7, 0);
  haloPillar.position.set(0, 1.22, -0.98);
  haloPillar.rotation.x = -0.32;
  car.add(haloPillar);
  const intake = wireObject(new THREE.TorusGeometry(0.3, 0.07, 8, 18), INK, 0.7, 0);
  intake.rotation.x = Math.PI / 2;
  intake.position.set(0, 1.35, 0.68);
  car.add(intake);

  // Sensor array.
  const sensorPositions = [
    [0, 0.7, -4.34],
    [-1.62, 1.0, -2.6],
    [1.62, 1.0, -2.6],
    [-0.9, 0.58, 0.72],
    [0.9, 0.58, 0.72],
    [0, 1.72, 4.0],
  ];
  sensorPositions.forEach(([x, y, z], index) => {
    const sensor = new THREE.Mesh(
      new THREE.SphereGeometry(index === 0 ? 0.1 : 0.075, 12, 8),
      new THREE.MeshBasicMaterial({
        color: RED,
        transparent: true,
        opacity: index === 0 ? 1 : 0.28,
      }),
    );
    sensor.position.set(x, y, z);
    car.add(sensor);
    sensors.push(sensor);
  });

  // Animated aero-flow points.
  const flowGeometry = new THREE.BufferGeometry();
  const flowPositions = new Float32Array(80 * 3);
  flowGeometry.setAttribute("position", new THREE.BufferAttribute(flowPositions, 3));
  const flow = new THREE.Points(
    flowGeometry,
    new THREE.PointsMaterial({
      color: RED,
      size: 0.035,
      transparent: true,
      opacity: 0.48,
    }),
  );
  car.add(flow);

  // Silverstone's current 18-corner Grand Prix layout, redrawn as a
  // normalized technical trace from Formula 1's official circuit map.
  const circuitPoints = [
    [-0.4, 3.2],
    [0.2, 2.45],
    [0.15, 1.1],
    [0.9, -0.15],
    [0.15, -1.05],
    [1.35, -1.35],
    [3.05, 0.55],
    [2.85, 2.25],
    [4.45, 1.95],
    [5.0, -1.25],
    [2.85, -1.85],
    [1.7, -2.05],
    [0.55, -1.95],
    [-0.35, -2.45],
    [-1.45, -1.95],
    [-4.75, -0.15],
    [-3.25, 1.25],
    [-3.35, 2.15],
    [-2.55, 3.05],
  ].map(([x, z]) => new THREE.Vector3(x, 0.08, z));
  const track = new THREE.CatmullRomCurve3(circuitPoints, true, "catmullrom", 0.18);
  const samples = track.getSpacedPoints(360);
  const leftRail: THREE.Vector3[] = [];
  const rightRail: THREE.Vector3[] = [];
  samples.forEach((point, index) => {
    const tangent = track.getTangentAt(index / (samples.length - 1));
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    leftRail.push(point.clone().addScaledVector(normal, 0.29));
    rightRail.push(point.clone().addScaledVector(normal, -0.29));
  });
  const trackMaterial = new THREE.LineBasicMaterial({
    color: INK,
    transparent: true,
    opacity: 0.64,
  });
  root.add(
    new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(leftRail), trackMaterial),
    new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rightRail), trackMaterial.clone()),
  );
  const centerTrace = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(samples),
    new THREE.LineDashedMaterial({
      color: RED,
      dashSize: 0.11,
      gapSize: 0.17,
      transparent: true,
      opacity: 0.34,
    }),
  );
  centerTrace.computeLineDistances();
  root.add(centerTrace);

  const startLine = new THREE.Group();
  for (let stripe = -3; stripe <= 3; stripe++) {
    const tile = edgeObject(new THREE.BoxGeometry(0.11, 0.025, 0.08), stripe % 2 === 0 ? INK : PAPER, 0.7, 0.3);
    tile.position.set(stripe * 0.105, 0.12, 0);
    startLine.add(tile);
  }
  const startPoint = track.getPointAt(0);
  const startTangent = track.getTangentAt(0);
  startLine.position.copy(startPoint);
  startLine.rotation.y = Math.atan2(startTangent.z, startTangent.x);
  root.add(startLine);

  car.scale.setScalar(0.2);
  return { root, car, track, movingParts, sensors, flow };
}

function addTriangleOutline(
  group: THREE.Group,
  x0: number,
  x1: number,
  zBase: number,
  zTip: number,
  opacity: number,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x0, 0.22, zBase),
    new THREE.Vector3(x1, 0.22, zBase),
    new THREE.Vector3((x0 + x1) / 2, 0.22, zTip),
    new THREE.Vector3(x0, 0.22, zBase),
  ]);
  group.add(
    new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: INK,
        transparent: true,
        opacity,
      }),
    ),
  );
}

function buildBackgammonScene() {
  const root = new THREE.Group();

  const board = edgeObject(new THREE.BoxGeometry(8.4, 0.34, 5.3), INK, 0.74, 0.022);
  root.add(board);
  const inner = edgeObject(new THREE.BoxGeometry(8.05, 0.09, 4.95), INK, 0.32, 0);
  inner.position.y = 0.21;
  root.add(inner);
  const bar = edgeObject(new THREE.BoxGeometry(0.25, 0.16, 4.95), INK, 0.38, 0.012);
  bar.position.y = 0.28;
  root.add(bar);

  const slot = 0.63;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 6; i++) {
      const center = (side === 0 ? -3.82 : 0.36) + i * slot;
      addTriangleOutline(root, center, center + slot, -2.42, -0.48, i % 2 === 0 ? 0.42 : 0.18);
      addTriangleOutline(root, center, center + slot, 2.42, 0.48, i % 2 === 0 ? 0.18 : 0.42);
    }
  }

  const checkerMaterialDark = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.76 });
  const checkerMaterialLight = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.94 });
  const checkerGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.13, 20, 2);
  const edgeGeometry = new THREE.EdgesGeometry(checkerGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.68 });

  type Player = "WHITE" | "BLACK";
  type Piece = {
    object: THREE.Group;
    player: Player;
    initialPoint: number;
    initialPosition: THREE.Vector3;
  };

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
      0.36 + stackIndex * 0.016,
      edgeZ + direction * stackIndex * 0.47,
    );
  };

  const initialPoints: Record<Player, number[]> = {
    WHITE: [24, 24, 13, 13, 13, 13, 13, 8, 8, 8, 6, 6, 6, 6, 6],
    BLACK: [1, 1, 12, 12, 12, 12, 12, 17, 17, 17, 19, 19, 19, 19, 19],
  };
  const pieces: Piece[] = [];
  (Object.keys(initialPoints) as Player[]).forEach((player) => {
    initialPoints[player].forEach((point, pieceIndex, allPoints) => {
      const checker = new THREE.Group();
      checker.add(
        new THREE.Mesh(
          checkerGeometry,
          player === "BLACK" ? checkerMaterialDark : checkerMaterialLight,
        ),
        new THREE.LineSegments(edgeGeometry, edgeMaterial),
      );
      const stackIndex = allPoints.slice(0, pieceIndex).filter((value) => value === point).length;
      checker.position.copy(pointPosition(point, stackIndex));
      root.add(checker);
      pieces.push({
        object: checker,
        player,
        initialPoint: point,
        initialPosition: checker.position.clone(),
      });
    });
  });

  const turnSequence = [
    {
      player: "WHITE" as const,
      dice: [6, 1] as const,
      notation: "13/7 · 8/7",
      moves: [{ from: 13, to: 7, die: 6 }, { from: 8, to: 7, die: 1 }],
    },
    {
      player: "BLACK" as const,
      dice: [5, 3] as const,
      notation: "12/17 · 1/4",
      moves: [{ from: 12, to: 17, die: 5 }, { from: 1, to: 4, die: 3 }],
    },
    {
      player: "WHITE" as const,
      dice: [4, 2] as const,
      notation: "24/20 · 13/11",
      moves: [{ from: 24, to: 20, die: 4 }, { from: 13, to: 11, die: 2 }],
    },
    {
      player: "BLACK" as const,
      dice: [6, 4] as const,
      notation: "12/18 · 17/21",
      moves: [{ from: 12, to: 18, die: 6 }, { from: 17, to: 21, die: 4 }],
    },
    {
      player: "WHITE" as const,
      dice: [5, 3] as const,
      notation: "8/3 · 6/3",
      moves: [{ from: 8, to: 3, die: 5 }, { from: 6, to: 3, die: 3 }],
    },
  ];

  const simulatedPoints = new Map<Piece, number>(
    pieces.map((piece) => [piece, piece.initialPoint]),
  );
  const timeline: Array<{
    turn: number;
    piece: Piece;
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
      midpoint.y = 1.2 + Math.min(0.55, start.distanceTo(end) * 0.06);
      const startsAt = turnIndex * 4.2 + 0.72 + moveIndex * 1.42;
      timeline.push({
        turn: turnIndex,
        piece,
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
  const dice = [-0.48, 0.48].map((x, index) => {
    const die = edgeObject(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      index === 0 ? RED : INK,
      0.82,
      0.025,
    );
    const pips = pipPositions.map(([px, pz]) => {
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(0.047, 8, 6),
        new THREE.MeshBasicMaterial({ color: index === 0 ? RED : INK }),
      );
      pip.position.set(px, 0.325, pz);
      die.add(pip);
      return pip;
    });
    die.userData.pips = pips;
    die.position.set(x, 0.65, 0);
    root.add(die);
    return die;
  });
  const setDieValue = (die: THREE.Group, value: number) => {
    const visible = pipIndexes[value];
    (die.userData.pips as THREE.Mesh[]).forEach((pip, index) => {
      pip.visible = visible.includes(index);
    });
  };
  setDieValue(dice[0], 6);
  setDieValue(dice[1], 1);

  const activeHalo = wireObject(
    new THREE.TorusGeometry(0.35, 0.025, 7, 26),
    RED,
    0.95,
    0,
  );
  activeHalo.rotation.x = Math.PI / 2;
  activeHalo.visible = false;
  root.add(activeHalo);

  const activePathGeometry = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 32 }, () => new THREE.Vector3()),
  );
  const activePath = new THREE.Line(
    activePathGeometry,
    new THREE.LineDashedMaterial({
      color: RED,
      dashSize: 0.11,
      gapSize: 0.09,
      transparent: true,
      opacity: 0.72,
    }),
  );
  activePath.visible = false;
  root.add(activePath);

  return {
    root,
    pieces,
    dice,
    setDieValue,
    activeHalo,
    activePath,
    timeline,
    turnSequence,
    pointPosition,
  };
}

type HudRefs = {
  lineOne: RefObject<HTMLSpanElement | null>;
  lineTwo: RefObject<HTMLSpanElement | null>;
  lineThree: RefObject<HTMLSpanElement | null>;
};

function sceneHud(mode: VisualMode, refs: HudRefs) {
  if (mode === 1) {
    return (
      <>
        <div className="scene-hud scene-hud-left">
          <strong>SILVERSTONE / GP LAYOUT</strong>
          <span>LENGTH&nbsp;&nbsp;&nbsp;&nbsp;5.891 KM</span>
          <span>CORNERS&nbsp;&nbsp;&nbsp;18</span>
          <span>RACE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;52 LAPS</span>
          <span className="signal-copy">CAR&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;LIVE TRACE</span>
        </div>
        <div className="scene-hud scene-hud-right">
          <strong>LIVE / CIRCUIT POSITION</strong>
          <span ref={refs.lineOne}>CORNER&nbsp;&nbsp;&nbsp;01 / 18</span>
          <span ref={refs.lineTwo}>LAP TRACE&nbsp;00.0%</span>
          <span ref={refs.lineThree}>PACE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SIMULATED</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="scene-hud scene-hud-left">
        <strong>BACKGAMMON / LIVE OPENING</strong>
        <span ref={refs.lineOne}>TURN&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1 / 5 · WHITE</span>
        <span ref={refs.lineTwo}>ROLL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;6–1 · P 5.56%</span>
        <span className="signal-copy" ref={refs.lineThree}>MOVE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;13/7 · 8/7</span>
      </div>
      <div className="scene-hud scene-hud-right">
        <strong>STANDARD START / LEGAL PLAY</strong>
        <span>CHECKERS&nbsp;&nbsp;&nbsp;15 / 15</span>
        <span>PLIES&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;10 / 10</span>
        <span>SEQUENCE&nbsp;&nbsp;&nbsp;RESET AFTER TURN 5</span>
      </div>
    </>
  );
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const hudLineOneRef = useRef<HTMLSpanElement>(null);
  const hudLineTwoRef = useRef<HTMLSpanElement>(null);
  const hudLineThreeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(PAPER, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const built =
      mode === 1 ? buildFormulaScene() : buildBackgammonScene();
    const root = built.root;
    scene.add(root);

    const grid = new THREE.GridHelper(18, 36, INK, INK);
    grid.material.transparent = true;
    grid.material.opacity = 0.055;
    grid.position.y = -0.26;
    scene.add(grid);

    const baseScale = mode === 1 ? 1.06 : 1.04;

    if (mode === 1) {
      camera.position.set(7.7, 6.5, 9.6);
      root.rotation.y = -0.12;
    } else {
      camera.position.set(8.2, 7.5, 9.4);
      root.rotation.y = -0.08;
    }
    root.scale.setScalar(baseScale);
    camera.lookAt(0, 0.45, 0);

    let frame = 0;
    let elapsed = 0;
    let lastTurnIndex = -1;
    let activeMoveIndex = -1;
    const clock = new THREE.Clock();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      const scaleDivisor = mode === 1 ? 1.22 : 1.42;
      const responsiveScale = THREE.MathUtils.clamp(
        camera.aspect / scaleDivisor,
        0.48,
        1,
      );
      root.scale.setScalar(baseScale * responsiveScale);
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const animate = () => {
      elapsed += clock.getDelta();
      const targetY = pointerRef.current.x * 0.36 + Math.sin(elapsed * 0.18) * 0.05;
      const targetX = pointerRef.current.y * 0.16;
      root.rotation.y += (targetY - root.rotation.y) * 0.035;
      root.rotation.x += (targetX - root.rotation.x) * 0.035;
      root.position.y = Math.sin(elapsed * 0.7) * 0.035;

      if (mode === 1) {
        const formula = built as ReturnType<typeof buildFormulaScene>;
        const lapProgress = (elapsed * 0.044) % 1;
        const carPosition = formula.track.getPointAt(lapProgress);
        const carTangent = formula.track.getTangentAt(lapProgress);
        formula.car.position.copy(carPosition);
        formula.car.position.y += 0.11;
        formula.car.rotation.y = Math.atan2(-carTangent.x, -carTangent.z);
        formula.movingParts.slice(1).forEach((wheel) => {
          wheel.rotation.x = elapsed * 5.6;
        });
        formula.movingParts[0].rotation.x = -0.08 + Math.sin(elapsed * 0.8) * 0.025;
        formula.sensors.forEach((sensor, index) => {
          const active = Math.floor(elapsed / 1.2) % formula.sensors.length === index;
          const material = sensor.material as THREE.MeshBasicMaterial;
          material.opacity += ((active ? 1 : 0.22) - material.opacity) * 0.08;
          sensor.scale.setScalar(active ? 1.35 : 1);
        });
        const positions = formula.flow.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
          const lane = i % 8;
          const progress = (elapsed * 0.16 + i / positions.count) % 1;
          const side = lane < 4 ? -1 : 1;
          positions.setXYZ(
            i,
            side * (2.45 - Math.sin(progress * Math.PI) * 0.62) + (lane % 4) * 0.12,
            0.34 + (lane % 3) * 0.12,
            -5.5 + progress * 11,
          );
        }
        positions.needsUpdate = true;

        const corner = Math.min(18, Math.floor(lapProgress * 18) + 1);
        if (hudLineOneRef.current) {
          hudLineOneRef.current.textContent = `CORNER    ${String(corner).padStart(2, "0")} / 18`;
        }
        if (hudLineTwoRef.current) {
          hudLineTwoRef.current.textContent = `LAP TRACE ${(lapProgress * 100).toFixed(1)}%`;
        }
        if (hudLineThreeRef.current) {
          hudLineThreeRef.current.textContent = `SECTOR    ${Math.min(3, Math.floor(lapProgress * 3) + 1)} / 3 · SIM`;
        }
      } else {
        const backgammon = built as ReturnType<typeof buildBackgammonScene>;
        const cycleTime = elapsed % 23;
        const turnIndex = Math.min(4, Math.floor(cycleTime / 4.2));
        const turn = backgammon.turnSequence[turnIndex];
        const turnTime = cycleTime - turnIndex * 4.2;

        backgammon.pieces.forEach((piece) => {
          piece.object.position.copy(piece.initialPosition);
        });
        backgammon.timeline.forEach((move) => {
          if (cycleTime >= move.endsAt) move.piece.object.position.copy(move.end);
        });

        const currentMoveIndex = backgammon.timeline.findIndex(
          (move) => cycleTime >= move.startsAt && cycleTime < move.endsAt,
        );
        if (currentMoveIndex >= 0) {
          const move = backgammon.timeline[currentMoveIndex];
          const progress = THREE.MathUtils.smoothstep(
            (cycleTime - move.startsAt) / (move.endsAt - move.startsAt),
            0,
            1,
          );
          const position = move.curve.getPoint(progress);
          move.piece.object.position.copy(position);
          backgammon.activeHalo.visible = true;
          backgammon.activeHalo.position.copy(position);
          backgammon.activeHalo.position.y += 0.09;
          if (activeMoveIndex !== currentMoveIndex) {
            backgammon.activePath.geometry.setFromPoints(move.curve.getPoints(31));
            backgammon.activePath.computeLineDistances();
            backgammon.activePath.visible = true;
            activeMoveIndex = currentMoveIndex;
          }
        } else {
          backgammon.activeHalo.visible = false;
          backgammon.activePath.visible = false;
          activeMoveIndex = -1;
        }

        if (lastTurnIndex !== turnIndex) {
          backgammon.setDieValue(backgammon.dice[0], turn.dice[0]);
          backgammon.setDieValue(backgammon.dice[1], turn.dice[1]);
          lastTurnIndex = turnIndex;
        }
        const rollEnergy = 1 - THREE.MathUtils.smoothstep(turnTime / 0.68, 0, 1);
        backgammon.dice.forEach((die, index) => {
          die.rotation.x =
            0.12 + Math.sin(turnTime * 16 + index) * rollEnergy * 0.8;
          die.rotation.y =
            (index === 0 ? 0.3 : -0.3) +
            Math.cos(turnTime * 14 + index) * rollEnergy * 0.9;
          die.rotation.z = 0.06 + Math.sin(turnTime * 11) * rollEnergy * 0.35;
        });

        if (hudLineOneRef.current) {
          hudLineOneRef.current.textContent =
            `TURN      ${turnIndex + 1} / 5 · ${turn.player}`;
        }
        if (hudLineTwoRef.current) {
          hudLineTwoRef.current.textContent =
            `ROLL      ${turn.dice[0]}–${turn.dice[1]} · P 5.56%`;
        }
        if (hudLineThreeRef.current) {
          hudLineThreeRef.current.textContent =
            cycleTime >= 21
              ? "STATE     SEQUENCE COMPLETE"
              : `MOVE      ${turn.notation}`;
        }
      }

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = (mesh as THREE.Mesh).material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material) material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mode]);

  return (
    <div
      className="system-scene"
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
          ? "Interactive Formula wireframe car driving the Silverstone Grand Prix circuit"
          : "Interactive five-turn legal backgammon opening from the standard position"
      }
      role="img"
    >
      {sceneHud(mode, {
        lineOne: hudLineOneRef,
        lineTwo: hudLineTwoRef,
        lineThree: hudLineThreeRef,
      })}
    </div>
  );
}
