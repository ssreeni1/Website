"use client";

import { useEffect, useRef } from "react";
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
  const movingParts: THREE.Object3D[] = [];
  const sensors: THREE.Mesh[] = [];

  // Floor and primary survival cell.
  const floor = edgeObject(new THREE.BoxGeometry(2.45, 0.1, 6.4), INK, 0.36, 0.018);
  floor.position.y = 0.08;
  root.add(floor);

  const survivalCell = wireObject(
    new THREE.CapsuleGeometry(0.62, 3.15, 7, 14),
    INK,
    0.62,
    0.022,
  );
  survivalCell.rotation.x = Math.PI / 2;
  survivalCell.position.set(0, 0.58, 0.05);
  root.add(survivalCell);

  const nose = wireObject(new THREE.ConeGeometry(0.48, 3.25, 12, 6), INK, 0.72, 0.02);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.45, -3.05);
  root.add(nose);

  const engineCover = wireObject(
    new THREE.ConeGeometry(0.74, 2.8, 12, 7),
    INK,
    0.56,
    0.024,
  );
  engineCover.rotation.x = -Math.PI / 2;
  engineCover.scale.set(1, 1, 0.72);
  engineCover.position.set(0, 0.72, 2.15);
  root.add(engineCover);

  // Sidepods and venturi tunnels.
  [-1, 1].forEach((side) => {
    const pod = wireObject(new THREE.BoxGeometry(1.05, 0.72, 2.55, 3, 2, 7), INK, 0.48, 0.018);
    pod.position.set(side * 0.95, 0.46, 0.65);
    pod.rotation.y = side * -0.06;
    root.add(pod);

    const tunnel = wireObject(new THREE.BoxGeometry(0.72, 0.22, 4.2, 2, 1, 10), INK, 0.28, 0);
    tunnel.position.set(side * 0.9, 0.13, 0.65);
    root.add(tunnel);

    for (let i = 0; i < 6; i++) {
      root.add(
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
  root.add(frontWing);
  for (let layer = 0; layer < 3; layer++) {
    const flap = edgeObject(new THREE.BoxGeometry(4.0 - layer * 0.35, 0.055, 0.3), INK, 0.4, 0);
    flap.position.set(0, 0.34 + layer * 0.09, -4.56 + layer * 0.12);
    flap.rotation.x = -0.08 - layer * 0.04;
    root.add(flap);
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
  root.add(rearWing);
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
    root.add(wheelGroup);
    movingParts.push(wheelGroup);

    const side = Math.sign(x);
    const chassisX = side * (index < 2 ? 0.35 : 0.52);
    const chassisZ = z + (index < 2 ? 0.38 : -0.42);
    root.add(
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
  root.add(cockpit);
  const haloPillar = edgeObject(new THREE.BoxGeometry(0.08, 0.62, 0.08), INK, 0.7, 0);
  haloPillar.position.set(0, 1.22, -0.98);
  haloPillar.rotation.x = -0.32;
  root.add(haloPillar);
  const intake = wireObject(new THREE.TorusGeometry(0.3, 0.07, 8, 18), INK, 0.7, 0);
  intake.rotation.x = Math.PI / 2;
  intake.position.set(0, 1.35, 0.68);
  root.add(intake);

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
    root.add(sensor);
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
  root.add(flow);

  return { root, movingParts, sensors, flow };
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
  const movingParts: THREE.Object3D[] = [];

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

  const checkerMaterialDark = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.72 });
  const checkerMaterialLight = new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.9 });
  const checkerGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.13, 20, 2);
  const edgeGeometry = new THREE.EdgesGeometry(checkerGeometry);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.68 });

  const stacks = [
    [-3.45, -2.1, 2, true],
    [-0.3, 2.1, 5, true],
    [0.68, 2.1, 3, true],
    [3.82, -2.1, 5, true],
    [-3.45, 2.1, 5, false],
    [-0.93, -2.1, 3, false],
    [0.68, -2.1, 5, false],
    [3.82, 2.1, 2, false],
  ] as const;

  stacks.forEach(([x, z, count, dark]) => {
    for (let i = 0; i < count; i++) {
      const checker = new THREE.Group();
      checker.add(
        new THREE.Mesh(checkerGeometry, dark ? checkerMaterialDark : checkerMaterialLight),
        new THREE.LineSegments(edgeGeometry, edgeMaterial),
      );
      const direction = z < 0 ? 1 : -1;
      checker.position.set(x, 0.35 + i * 0.015, z + direction * i * 0.47);
      root.add(checker);
    }
  });

  const dice: THREE.Group[] = [];
  const dieValues = [6, 2];
  const diePips: Record<number, Array<[number, number]>> = {
    2: [[-0.16, -0.16], [0.16, 0.16]],
    6: [
      [-0.16, -0.18], [0.16, -0.18],
      [-0.16, 0], [0.16, 0],
      [-0.16, 0.18], [0.16, 0.18],
    ],
  };
  [-0.48, 0.48].forEach((x, index) => {
    const die = edgeObject(new THREE.BoxGeometry(0.62, 0.62, 0.62), index === 0 ? RED : INK, 0.8, 0.02);
    diePips[dieValues[index]].forEach(([px, pz]) => {
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 6),
        new THREE.MeshBasicMaterial({ color: index === 0 ? RED : INK }),
      );
      pip.position.set(px, 0.325, pz);
      die.add(pip);
    });
    die.position.set(x, 0.63, 0);
    die.rotation.set(0.18, index === 0 ? 0.4 : -0.35, 0.08);
    root.add(die);
    dice.push(die);
  });

  const movingChecker = wireObject(new THREE.CylinderGeometry(0.31, 0.31, 0.16, 22, 2), RED, 0.95, 0.04);
  movingChecker.position.set(3.18, 0.68, -1.82);
  root.add(movingChecker);
  movingParts.push(movingChecker, ...dice);

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.18, 0.68, -1.82),
    new THREE.Vector3(3.6, 1.35, -0.6),
    new THREE.Vector3(2.9, 1.2, 0.65),
    new THREE.Vector3(2.25, 0.68, 1.72),
  ]);
  root.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(path.getPoints(42)),
      new THREE.LineDashedMaterial({
        color: RED,
        dashSize: 0.12,
        gapSize: 0.1,
        transparent: true,
        opacity: 0.7,
      }),
    ),
  );
  const pathLine = root.children[root.children.length - 1] as THREE.Line;
  pathLine.computeLineDistances();

  return { root, movingParts, movingChecker, path };
}

function sceneHud(mode: VisualMode) {
  if (mode === 1) {
    return (
      <>
        <div className="scene-hud scene-hud-left">
          <strong>FORMULA / 2026 MODEL</strong>
          <span>WHEELBASE&nbsp;&nbsp;3400 MM</span>
          <span>WIDTH&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1900 MM</span>
          <span>MIN MASS&nbsp;&nbsp;&nbsp;770 KG</span>
          <span className="signal-copy">ERS-K&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;350 KW</span>
        </div>
        <div className="scene-hud scene-hud-right">
          <strong>LIVE 3D WIREFRAME</strong>
          <span>POINTER&nbsp;&nbsp;ORBIT / INSPECT</span>
          <span>SENSORS&nbsp;&nbsp;6 NODES</span>
          <span>TRACE&nbsp;&nbsp;&nbsp;&nbsp;SIMULATED</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="scene-hud scene-hud-left">
        <strong>BACKGAMMON / EXACT ROLL</strong>
        <span>CURRENT&nbsp;&nbsp;&nbsp;&nbsp;6–2</span>
        <span>P(6–2)&nbsp;&nbsp;&nbsp;&nbsp;2/36 = 5.56%</span>
        <span>P(SUM 8)&nbsp;&nbsp;5/36 = 13.89%</span>
        <span className="signal-copy">36 ORDERED OUTCOMES</span>
      </div>
      <div className="scene-hud scene-hud-right">
        <strong>EXACT DISTRIBUTION</strong>
        <span>DOUBLES&nbsp;&nbsp;&nbsp;6/36 = 16.67%</span>
        <span>NON-DOUBLE&nbsp;30/36 = 83.33%</span>
        <span>≥ ONE 6&nbsp;&nbsp;&nbsp;11/36 = 30.56%</span>
      </div>
    </>
  );
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

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
    const clock = new THREE.Clock();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      const responsiveScale = THREE.MathUtils.clamp(camera.aspect / 1.22, 0.52, 1);
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
        formula.movingParts.forEach((part, index) => {
          if (index < 4) part.rotation.x = elapsed * 1.8;
        });
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
      } else {
        const backgammon = built as ReturnType<typeof buildBackgammonScene>;
        const progress = (Math.sin(elapsed * 0.72) + 1) / 2;
        backgammon.movingChecker.position.copy(backgammon.path.getPoint(progress));
        backgammon.movingParts.slice(1).forEach((die, index) => {
          die.rotation.y = elapsed * (index === 0 ? 0.24 : -0.2);
        });
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
          ? "Interactive three-dimensional Formula wireframe model"
          : "Interactive three-dimensional backgammon probability model"
      }
      role="img"
    >
      {sceneHud(mode)}
    </div>
  );
}
