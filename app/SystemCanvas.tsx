"use client";

import { useEffect, useRef } from "react";

type VisualMode = 1 | 2;
type PointerState = { x: number; y: number; active: boolean };

const INK = "#161616";
const PAPER = "#f6f6f3";
const RED = "#f02b1d";
const MUTED = "#8d8d87";

function label(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  align: CanvasTextAlign = "left",
  color = INK,
  size = 9,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `${size}px monospace`;
  ctx.fillText(value, x, y);
  ctx.restore();
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function grid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.045;
  for (let x = 0.5; x < width; x += 40) line(ctx, x, 0, x, height);
  for (let y = 0.5; y < height; y += 40) line(ctx, 0, y, width, y);
  ctx.restore();
}

function sparkline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  time: number,
  phase: number,
  color = INK,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = color === RED ? 0.8 : 0.25;
  ctx.strokeRect(x, y, width, height);
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) {
    const px = x + (i / 34) * width;
    const wave =
      Math.sin(i * 0.71 + time * 0.002 + phase) * 0.22 +
      Math.sin(i * 0.17 + time * 0.0007) * 0.14;
    const py = y + height * (0.5 + wave);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCarLayer(
  ctx: CanvasRenderingContext2D,
  time: number,
  detail: boolean,
) {
  const treadOffset = (time * 0.032) % 13;

  // Front and rear active aero assemblies.
  ctx.strokeRect(-126, -246, 252, 16);
  ctx.strokeRect(-102, -229, 204, 8);
  ctx.strokeRect(-94, 222, 188, 18);
  line(ctx, -108, -237, -76, -207);
  line(ctx, 108, -237, 76, -207);
  line(ctx, -68, 222, -48, 185);
  line(ctx, 68, 222, 48, 185);

  const wheels = [
    [-96, -164, 38, 78],
    [58, -164, 38, 78],
    [-101, 119, 43, 86],
    [58, 119, 43, 86],
  ];

  wheels.forEach(([x, y, w, h]) => {
    if (detail) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      roundedRect(ctx, x + 7, y + 9, w, h, 6);
      ctx.stroke();
      line(ctx, x, y + 6, x + 7, y + 15);
      line(ctx, x + w, y + 6, x + w + 7, y + 15);
      line(ctx, x, y + h - 6, x + 7, y + h + 3);
      line(ctx, x + w, y + h - 6, x + w + 7, y + h + 3);
      ctx.restore();
    }
    roundedRect(ctx, x, y, w, h, 6);
    ctx.stroke();
    if (detail) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = INK;
      roundedRect(ctx, x + 4, y + 4, w - 8, h - 8, 4);
      ctx.fill();
      ctx.strokeStyle = PAPER;
      ctx.globalAlpha = 0.5;
      for (let ty = y - 10 + treadOffset; ty < y + h; ty += 13) {
        line(ctx, x + 5, ty, x + w - 5, ty + 5);
      }
      ctx.restore();
    }
  });

  // Suspension: upper/lower wishbones and pushrods.
  const wishbones = [
    [-37, -147, -76, -140],
    [-39, -112, -76, -125],
    [37, -147, 76, -140],
    [39, -112, 76, -125],
    [-45, 137, -80, 148],
    [-43, 173, -80, 178],
    [45, 137, 80, 148],
    [43, 173, 80, 178],
  ];
  wishbones.forEach(([x1, y1, x2, y2], index) => {
    line(ctx, x1, y1, x2, y2);
    line(ctx, x1, y1 + (index < 4 ? 7 : -7), x2, y2);
  });
  line(ctx, -76, -140, -33, -91, 0.55);
  line(ctx, 76, -140, 33, -91, 0.55);
  line(ctx, -80, 148, -39, 102, 0.55);
  line(ctx, 80, 148, 39, 102, 0.55);

  // Chassis shell.
  ctx.beginPath();
  ctx.moveTo(0, -230);
  ctx.bezierCurveTo(-17, -214, -25, -184, -29, -154);
  ctx.bezierCurveTo(-34, -123, -58, -91, -55, -45);
  ctx.bezierCurveTo(-52, -4, -39, 32, -46, 77);
  ctx.bezierCurveTo(-53, 122, -43, 176, -27, 219);
  ctx.lineTo(27, 219);
  ctx.bezierCurveTo(43, 176, 53, 122, 46, 77);
  ctx.bezierCurveTo(39, 32, 52, -4, 55, -45);
  ctx.bezierCurveTo(58, -91, 34, -123, 29, -154);
  ctx.bezierCurveTo(25, -184, 17, -214, 0, -230);
  ctx.closePath();
  ctx.stroke();

  if (detail) {
    // Longitudinal body facets give the shell an isometric wireframe volume.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -230);
    ctx.lineTo(-17, -154);
    ctx.lineTo(-28, -43);
    ctx.lineTo(-23, 93);
    ctx.lineTo(-15, 219);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -230);
    ctx.lineTo(17, -154);
    ctx.lineTo(28, -43);
    ctx.lineTo(23, 93);
    ctx.lineTo(15, 219);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-29, -154);
    ctx.quadraticCurveTo(0, -138, 29, -154);
    ctx.moveTo(-53, -45);
    ctx.quadraticCurveTo(0, -20, 53, -45);
    ctx.moveTo(-46, 77);
    ctx.quadraticCurveTo(0, 97, 46, 77);
    ctx.stroke();
    ctx.restore();
  }

  // Floor edge and venturi tunnels.
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * 29, -119);
    ctx.lineTo(side * 66, -87);
    ctx.lineTo(side * 79, 69);
    ctx.lineTo(side * 51, 145);
    ctx.lineTo(side * 43, 60);
    ctx.lineTo(side * 52, -36);
    ctx.closePath();
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(side * 55, -68);
    ctx.bezierCurveTo(side * 64, 8, side * 59, 81, side * 47, 137);
    ctx.stroke();
    ctx.restore();
  });

  // Cockpit, halo and driver cell.
  ctx.beginPath();
  ctx.ellipse(0, -36, 23, 50, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -44, 14, 29, 0, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, -23, -41, 23, -41);
  line(ctx, 0, -74, 0, -11);
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.setLineDash([2, 3]);
  ctx.strokeRect(-25, 35, 50, 62);
  ctx.strokeRect(-21, 106, 42, 58);
  ctx.strokeRect(-31, -109, 62, 27);
  ctx.restore();
  label(ctx, "ICE", 0, 69, "center", MUTED, 7);
  label(ctx, "ES", 0, 137, "center", MUTED, 7);
  label(ctx, "CELL", 0, -91, "center", MUTED, 7);

  if (detail) {
    // Cooling louvres and body reference stations.
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 7; i++) {
        line(ctx, side * 34, 7 + i * 7, side * (45 - i * 0.7), 10 + i * 7, 0.28);
      }
    });
    for (let y = -200; y <= 190; y += 39) {
      line(ctx, -6, y, 6, y, 0.24);
    }
  }
}

function drawFormula(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  pointer: PointerState,
) {
  const scale = Math.min(width / 1040, height / 660);
  const cx = width * 0.5;
  const cy = height * 0.53;
  const pulse = (Math.sin(time * 0.003) + 1) / 2;
  const simSpeed = 296 + Math.sin(time * 0.0011) * 18;
  const simRpm = 10600 + pulse * 720;
  const simBrake = 640 + Math.sin(time * 0.0017) * 42;

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1;

  label(ctx, "FORMULA / 2026 TECHNICAL MODEL", 22, 27);
  label(ctx, "REG  WHEELBASE 3400 MM", 22, 44);
  label(ctx, "REG  WIDTH 1900 MM", 22, 57);
  label(ctx, "REG  MINIMUM MASS 770 KG", 22, 70);
  label(ctx, "REG  ERS-K 350 KW", 22, 83, "left", RED);

  label(ctx, "SIMULATED LAP TRACE", width - 22, 27, "right");
  label(ctx, `SIM  SPEED ${simSpeed.toFixed(0)} KM/H`, width - 22, 44, "right");
  label(ctx, `SIM  ENGINE ${simRpm.toFixed(0)} RPM`, width - 22, 57, "right");
  label(ctx, `SIM  BRAKE ${simBrake.toFixed(0)} °C`, width - 22, 70, "right");
  label(ctx, "MOVE POINTER TO INSPECT", width - 22, 83, "right", RED);

  sparkline(ctx, 22, 96, 145, 22, time, 0.2, RED);
  sparkline(ctx, width - 167, 96, 145, 22, time, 2.3);

  ctx.translate(cx, cy);
  ctx.transform(1, -0.1, 0.23, 0.83, 0, 0);
  ctx.scale(scale, scale);

  // Isometric construction layer.
  ctx.save();
  ctx.translate(11, 16);
  ctx.globalAlpha = 0.16;
  drawCarLayer(ctx, time, false);
  ctx.restore();

  // Visible depth cage between the upper shell and lower construction layer.
  ctx.save();
  ctx.globalAlpha = 0.22;
  const depth = { x: 11, y: 16 };
  const depthAnchors = [
    [-126, -246], [126, -246], [-94, 222], [94, 222],
    [-96, -164], [96, -164], [-101, 205], [101, 205],
    [0, -230], [-55, -45], [55, -45], [-27, 219], [27, 219],
  ];
  depthAnchors.forEach(([x, y]) => line(ctx, x, y, x + depth.x, y + depth.y));
  ctx.beginPath();
  ctx.moveTo(-126 + depth.x, -246 + depth.y);
  ctx.lineTo(126 + depth.x, -246 + depth.y);
  ctx.lineTo(126, -246);
  ctx.moveTo(-94 + depth.x, 240 + depth.y);
  ctx.lineTo(94 + depth.x, 240 + depth.y);
  ctx.stroke();
  ctx.restore();

  // Datum ellipses and center axes.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.setLineDash([4, 7]);
  ctx.lineDashOffset = -(time * 0.012) % 11;
  ctx.beginPath();
  ctx.ellipse(0, 0, 292, 279, -0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 225, 304, 0.39, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  line(ctx, -355, 0, 355, 0, 0.12);
  line(ctx, 0, -304, 0, 304, 0.12);

  drawCarLayer(ctx, time, true);

  // Moving airflow particles.
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 5; i++) {
      const progress = ((time * 0.00009 + i / 5) % 1);
      const y = -230 + progress * 455;
      const x = side * (118 - Math.sin(progress * Math.PI) * 29);
      ctx.save();
      ctx.fillStyle = RED;
      ctx.globalAlpha = 0.18 + progress * 0.32;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      ctx.restore();
    }
  });

  // Pressure scan line.
  const scanY = -225 + ((time * 0.072) % 450);
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.globalAlpha = 0.28;
  line(ctx, -126, scanY, 126, scanY);
  ctx.fillStyle = RED;
  ctx.fillRect(-128, scanY - 2, 4, 4);
  ctx.restore();

  const sensors = [
    { x: 0, y: -202, tag: "PITOT / P0" },
    { x: -76, y: -132, tag: "FL WHEEL-SPEED" },
    { x: 76, y: -132, tag: "FR WHEEL-SPEED" },
    { x: -55, y: 72, tag: "DIFFERENTIAL" },
    { x: 55, y: 72, tag: "HYDRAULIC" },
    { x: 0, y: 194, tag: "REAR ACTIVE AERO" },
  ];
  const active = pointer.active
    ? Math.max(0, Math.min(5, Math.floor(pointer.y * 6)))
    : Math.floor(time / 1600) % sensors.length;

  sensors.forEach((sensor, index) => {
    const on = index === active;
    const side = sensor.x <= 0 ? -1 : 1;
    const elbowX = sensor.x + side * (92 + index * 5);
    const endX = sensor.x + side * (154 + index * 7);
    const endY = sensor.y + (index - 2.5) * 9;
    ctx.save();
    ctx.strokeStyle = on ? RED : INK;
    ctx.fillStyle = on ? RED : PAPER;
    ctx.globalAlpha = on ? 1 : 0.34;
    ctx.fillRect(sensor.x - 3, sensor.y - 3, 6, 6);
    ctx.strokeRect(sensor.x - 3, sensor.y - 3, 6, 6);
    line(ctx, sensor.x, sensor.y, elbowX, endY);
    line(ctx, elbowX, endY, endX, endY);
    label(ctx, sensor.tag, endX + side * 5, endY + 3, side < 0 ? "right" : "left", on ? RED : INK, 8);
    ctx.restore();
  });

  // Pointer-reactive reticle.
  if (pointer.active) {
    const px = (pointer.x * width - cx) / scale;
    const py = (pointer.y * height - cy) / scale;
    ctx.save();
    ctx.strokeStyle = RED;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(px, py, 19 + Math.sin(time * 0.004) * 3, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, px - 31, py, px + 31, py);
    line(ctx, px, py - 31, px, py + 31);
    ctx.restore();
  }

  ctx.restore();
  label(ctx, "REGULATORY VALUES: FIA 2026 / MOVING VALUES: LABELED SIM", width / 2, height - 18, "center");
}

function drawDie(
  ctx: CanvasRenderingContext2D,
  value: number,
  x: number,
  y: number,
  size: number,
  active: boolean,
) {
  const pips: Record<number, Array<[number, number]>> = {
    1: [[0.5, 0.5]],
    2: [[0.28, 0.28], [0.72, 0.72]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
  };
  roundedRect(ctx, x, y, size, size, 4);
  ctx.stroke();
  ctx.save();
  ctx.fillStyle = active ? RED : INK;
  for (const [px, py] of pips[value]) {
    ctx.beginPath();
    ctx.arc(x + px * size, y + py * size, Math.max(1.5, size * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawChecker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  dark: boolean,
) {
  ctx.save();
  ctx.fillStyle = dark ? INK : PAPER;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = dark ? 0.18 : 0.24;
  ctx.beginPath();
  ctx.arc(x - radius * 0.18, y - radius * 0.18, radius * 0.63, 0, Math.PI * 2);
  ctx.strokeStyle = dark ? PAPER : INK;
  ctx.stroke();
  ctx.restore();
}

function drawBackgammon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  pointer: PointerState,
) {
  const scale = Math.min(width / 1060, height / 680);
  const boardW = 560 * scale;
  const boardH = 326 * scale;
  const boardX = width / 2 - boardW * 0.56;
  const boardY = height / 2 - boardH * 0.43;
  const phase = Math.floor(time / 2700);
  const diceSets = [[6, 2], [4, 3], [5, 1], [3, 3], [6, 6]];
  const [dieA, dieB] = diceSets[phase % diceSets.length];
  const isDouble = dieA === dieB;
  const unorderedOutcomes = isDouble ? 1 : 2;
  const rollProbability = (unorderedOutcomes / 36) * 100;
  const sum = dieA + dieB;
  const sumWays = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1][sum];

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1;

  label(ctx, "BACKGAMMON / EXACT ROLL MODEL", 22, 27);
  label(ctx, `CURRENT ROLL  ${dieA}-${dieB}`, 22, 44, "left", RED);
  label(ctx, `UNORDERED P(ROLL)  ${unorderedOutcomes}/36 = ${rollProbability.toFixed(2)}%`, 22, 57);
  label(ctx, `P(SUM ${sum})  ${sumWays}/36 = ${((sumWays / 36) * 100).toFixed(2)}%`, 22, 70);
  label(ctx, "SAMPLE SPACE  36 EQUIPROBABLE OUTCOMES", 22, 83);

  label(ctx, "EXACT NEXT-ROLL DISTRIBUTION", width - 22, 27, "right");
  label(ctx, "P(DOUBLES)  6/36 = 16.67%", width - 22, 44, "right");
  label(ctx, "P(NON-DOUBLE)  30/36 = 83.33%", width - 22, 57, "right");
  label(ctx, "P(AT LEAST ONE 6)  11/36 = 30.56%", width - 22, 70, "right");
  label(ctx, "MOVE POINTER TO SELECT LINE", width - 22, 83, "right", RED);

  const fragments = [
    ["POSITION", "given"],
    ["ROLL", `${unorderedOutcomes}/36`],
    ["ORDER", isDouble ? "4 uses" : "2 ways"],
    ["LINE", "select"],
    ["RESULT", "exact"],
  ];
  let fragmentX = width / 2 - 220;
  fragments.forEach(([word, value], index) => {
    const active = phase % fragments.length === index;
    label(ctx, word, fragmentX, 103, "left", active ? RED : INK);
    label(ctx, value, fragmentX + 7, 115, "left", MUTED);
    if (index < fragments.length - 1) label(ctx, "→", fragmentX + 67, 104, "left", MUTED);
    fragmentX += 92;
  });

  // Board projection produces restrained isometric depth.
  ctx.save();
  ctx.translate(boardX, boardY);
  ctx.transform(1, -0.08, 0.2, 0.88, 0, 0);
  const w = boardW;
  const h = boardH;
  const bar = Math.max(15, w * 0.035);
  const slot = (w / 2 - bar / 2) / 6;

  ctx.save();
  ctx.translate(8, 12);
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.restore();
  ctx.strokeRect(w / 2 - bar / 2, 0, bar, h);
  line(ctx, 0, h / 2, w, h / 2, 0.12);

  for (let half = 0; half < 2; half++) {
    for (let i = 0; i < 6; i++) {
      const x0 = half === 0 ? i * slot : w / 2 + bar / 2 + i * slot;
      const center = x0 + slot / 2;
      const pointHeight = h * 0.41;
      ctx.save();
      ctx.globalAlpha = (i + half) % 2 === 0 ? 0.085 : 0.025;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + slot, 0);
      ctx.lineTo(center, pointHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.lineTo(x0 + slot, h);
      ctx.lineTo(center, h - pointHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      label(ctx, String(half === 0 ? 13 + i : 19 + i), center, -7, "center", MUTED, 7);
      label(ctx, String(half === 0 ? 12 - i : 6 - i), center, h + 13, "center", MUTED, 7);
    }
  }

  const stacks = [
    { half: 0, column: 0, top: true, count: 2, dark: true },
    { half: 0, column: 5, top: false, count: 5, dark: true },
    { half: 1, column: 1, top: false, count: 3, dark: true },
    { half: 1, column: 5, top: true, count: 5, dark: true },
    { half: 0, column: 0, top: false, count: 5, dark: false },
    { half: 0, column: 4, top: true, count: 3, dark: false },
    { half: 1, column: 0, top: true, count: 5, dark: false },
    { half: 1, column: 5, top: false, count: 2, dark: false },
  ];

  stacks.forEach((stack) => {
    const x0 = stack.half === 0 ? stack.column * slot : w / 2 + bar / 2 + stack.column * slot;
    const x = x0 + slot / 2;
    const radius = Math.min(12 * scale, slot * 0.34);
    for (let i = 0; i < stack.count; i++) {
      const y = stack.top
        ? 16 + i * radius * 1.62
        : h - 16 - i * radius * 1.62;
      drawChecker(ctx, x, y, radius, stack.dark);
    }
  });

  const dieSize = 32 * scale;
  drawDie(ctx, dieA, w / 2 - dieSize - 5, h / 2 - dieSize / 2, dieSize, true);
  drawDie(ctx, dieB, w / 2 + 5, h / 2 - dieSize / 2, dieSize, false);

  // Smooth legal-line animation.
  const progress = (time % 2700) / 2700;
  const eased = 0.5 - Math.cos(progress * Math.PI) / 2;
  const sx = w * 0.82;
  const sy = h * 0.22;
  const ex = w * 0.69;
  const ey = h * 0.78;
  const cpx = w * 0.94;
  const cpy = h * 0.48;
  const inv = 1 - eased;
  const mx = inv * inv * sx + 2 * inv * eased * cpx + eased * eased * ex;
  const my = inv * inv * sy + 2 * inv * eased * cpy + eased * eased * ey;
  ctx.save();
  ctx.strokeStyle = RED;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cpx, cpy, ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.arc(mx, my, Math.max(8, 11 * scale), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  const selectedLine = pointer.active
    ? Math.max(0, Math.min(2, Math.floor(pointer.y * 3)))
    : phase % 3;
  const lines = isDouble
    ? [`USE 4 × ${dieA}`, `2 × (${dieA} + ${dieA})`, `SPLIT FOUR MOVES`]
    : [
        `USE ${dieA} THEN ${dieB}`,
        `USE ${dieB} THEN ${dieA}`,
        `SPLIT CHECKERS`,
      ];
  const panelX = boardX + boardW + 38;
  const panelY = boardY + 38;
  const panelW = Math.max(120, Math.min(182, width - panelX - 20));
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeRect(panelX - 11, panelY - 24, panelW + 22, 154);
  ctx.restore();
  label(ctx, "MOVE ORDER / POSITION-DEPENDENT", panelX, panelY - 9, "left", INK, 8);
  lines.forEach((move, index) => {
    const active = index === selectedLine;
    label(ctx, `0${index + 1}  ${move}`, panelX, panelY + index * 42, "left", active ? RED : INK, 8);
    ctx.save();
    ctx.fillStyle = active ? RED : INK;
    ctx.globalAlpha = active ? 1 : 0.16;
    ctx.fillRect(panelX, panelY + 10 + index * 42, panelW, 1.5);
    ctx.restore();
  });

  ctx.restore();
  label(ctx, "ALL DISPLAYED PROBABILITIES DERIVE FROM 36 TWO-DIE OUTCOMES", width / 2, height - 18, "center");
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<PointerState>({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let animationFrame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      grid(context, width, height);
      if (mode === 1) drawFormula(context, width, height, time, pointerRef.current);
      else drawBackgammon(context, width, height, time, pointerRef.current);
      animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [mode]);

  return (
    <canvas
      className="system-canvas"
      ref={canvasRef}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: (event.clientX - bounds.left) / bounds.width,
          y: (event.clientY - bounds.top) / bounds.height,
          active: true,
        };
      }}
      onPointerLeave={() => {
        pointerRef.current = { x: 0.5, y: 0.5, active: false };
      }}
      aria-label={
        mode === 1
          ? "Interactive isometric Formula One technical diagram with sourced 2026 specifications and simulated telemetry"
          : "Interactive isometric backgammon position with exact two-dice probabilities and animated legal lines"
      }
      role="img"
    />
  );
}
