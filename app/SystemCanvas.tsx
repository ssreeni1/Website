"use client";

import { useEffect, useRef } from "react";

type VisualMode = 1 | 2;

const INK = "#161616";
const PAPER = "#f6f6f3";
const RED = "#f02b1d";

function crisp(value: number) {
  return Math.round(value) + 0.5;
}

function label(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  align: CanvasTextAlign = "left",
  color = INK,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = "9px monospace";
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

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.055;
  for (let x = 0; x <= width; x += 40) {
    line(ctx, crisp(x), 0, crisp(x), height);
  }
  for (let y = 0; y <= height; y += 40) {
    line(ctx, 0, crisp(y), width, crisp(y));
  }
  ctx.restore();
}

function drawF1(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const scale = Math.min(width / 980, height / 650);
  const cx = width * 0.52;
  const cy = height * 0.51;
  const pulse = (Math.sin(time * 0.003) + 1) / 2;
  const speed = 317.4 + Math.sin(time * 0.0012) * 7.8;
  const brake = 682 + Math.sin(time * 0.0018) * 34;
  const frontTemp = 101.2 + Math.sin(time * 0.0014) * 4.5;
  const rearTemp = 97.8 + Math.sin(time * 0.0011 + 2) * 3.2;

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1;

  label(ctx, "FORMULA / TELEMETRY MODEL 01", 22, 28);
  label(ctx, `V  ${speed.toFixed(1)} KM/H`, 22, 44);
  label(ctx, `RPM  ${(11380 + pulse * 420).toFixed(0)}`, 22, 57);
  label(ctx, "GEAR  7", 22, 70, "left", RED);

  label(ctx, "LIVE SENSOR ARRAY", width - 22, 28, "right");
  label(ctx, `BRAKE  ${brake.toFixed(0)}°C`, width - 22, 44, "right");
  label(ctx, `TYRE F  ${frontTemp.toFixed(1)}°C`, width - 22, 57, "right");
  label(ctx, `TYRE R  ${rearTemp.toFixed(1)}°C`, width - 22, 70, "right");

  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 276, 272, -0.13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 214, 292, 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  line(ctx, -340, 0, 340, 0, 0.14);
  line(ctx, 0, -290, 0, 290, 0.14);

  // Front and rear wings.
  ctx.strokeRect(-112, -237, 224, 15);
  ctx.strokeRect(-86, 214, 172, 18);
  line(ctx, -78, -222, -58, -188);
  line(ctx, 78, -222, 58, -188);
  line(ctx, -57, 214, -46, 177);
  line(ctx, 57, 214, 46, 177);

  // Wheels.
  const wheels = [
    [-78, -153, 33, 72],
    [45, -153, 33, 72],
    [-82, 116, 37, 79],
    [45, 116, 37, 79],
  ];
  wheels.forEach(([x, y, w, h]) => {
    ctx.strokeRect(x, y, w, h);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = INK;
    ctx.fillRect(x + 4, y + 5, w - 8, h - 10);
    ctx.restore();
  });

  // Top-down chassis.
  ctx.beginPath();
  ctx.moveTo(0, -221);
  ctx.bezierCurveTo(-18, -203, -26, -179, -31, -151);
  ctx.bezierCurveTo(-38, -114, -58, -83, -53, -37);
  ctx.bezierCurveTo(-50, 5, -39, 31, -45, 72);
  ctx.bezierCurveTo(-52, 118, -44, 169, -27, 211);
  ctx.lineTo(27, 211);
  ctx.bezierCurveTo(44, 169, 52, 118, 45, 72);
  ctx.bezierCurveTo(39, 31, 50, 5, 53, -37);
  ctx.bezierCurveTo(58, -83, 38, -114, 31, -151);
  ctx.bezierCurveTo(26, -179, 18, -203, 0, -221);
  ctx.closePath();
  ctx.stroke();

  // Sidepods and floor.
  ctx.beginPath();
  ctx.moveTo(-31, -115);
  ctx.lineTo(-57, -86);
  ctx.lineTo(-72, 50);
  ctx.lineTo(-48, 131);
  ctx.lineTo(-42, 55);
  ctx.lineTo(-50, -35);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(31, -115);
  ctx.lineTo(57, -86);
  ctx.lineTo(72, 50);
  ctx.lineTo(48, 131);
  ctx.lineTo(42, 55);
  ctx.lineTo(50, -35);
  ctx.closePath();
  ctx.stroke();

  // Cockpit / halo.
  ctx.beginPath();
  ctx.ellipse(0, -34, 22, 48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -43, 13, 28, 0, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, 0, -72, 0, -13);
  line(ctx, -22, -39, 22, -39);

  // Aerodynamic flow.
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.setLineDash([3, 5]);
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(side * 118, -215);
    ctx.bezierCurveTo(side * 146, -121, side * 122, 45, side * 92, 198);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 92, -212);
    ctx.bezierCurveTo(side * 112, -92, side * 91, 63, side * 74, 205);
    ctx.stroke();
  });
  ctx.restore();

  const sensors = [
    { x: 0, y: -194, tag: "PITOT / 42.1 kPa" },
    { x: -53, y: -121, tag: "FL / 101.2°C" },
    { x: 53, y: -121, tag: "FR / 103.8°C" },
    { x: -55, y: 75, tag: "DIFF / 842 Nm" },
    { x: 55, y: 75, tag: "HYD / 201 bar" },
    { x: 0, y: 187, tag: "DRS / ACTIVE" },
  ];
  const active = Math.floor(time / 1700) % sensors.length;

  sensors.forEach((sensor, index) => {
    const isActive = index === active;
    ctx.save();
    ctx.fillStyle = isActive ? RED : PAPER;
    ctx.strokeStyle = isActive ? RED : INK;
    ctx.beginPath();
    ctx.rect(sensor.x - 3, sensor.y - 3, 6, 6);
    ctx.fill();
    ctx.stroke();
    const side = sensor.x <= 0 ? -1 : 1;
    const elbowX = sensor.x + side * (82 + index * 4);
    const endX = sensor.x + side * (142 + index * 7);
    ctx.globalAlpha = isActive ? 1 : 0.38;
    line(ctx, sensor.x, sensor.y, elbowX, sensor.y + (index - 2) * 8);
    line(
      ctx,
      elbowX,
      sensor.y + (index - 2) * 8,
      endX,
      sensor.y + (index - 2) * 8,
    );
    label(
      ctx,
      sensor.tag,
      endX + side * 5,
      sensor.y + (index - 2) * 8 + 3,
      side < 0 ? "right" : "left",
      isActive ? RED : INK,
    );
    ctx.restore();
  });

  ctx.restore();

  label(
    ctx,
    "CHASSIS LOAD MODEL / SENSOR VALUES ARE SIMULATED",
    width / 2,
    height - 18,
    "center",
  );
}

function checkerPosition(
  point: number,
  fromTop: boolean,
  boardX: number,
  boardY: number,
  boardW: number,
  boardH: number,
) {
  const half = boardW / 2;
  const slot = (half - 14) / 6;
  const local = point % 12;
  const onRight = local < 6;
  const column = local % 6;
  const x = onRight
    ? boardX + boardW - slot * (column + 0.5)
    : boardX + slot * (5.5 - column);
  const y = fromTop ? boardY + 17 : boardY + boardH - 17;
  return { x, y, slot };
}

function drawBackgammon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
) {
  const scale = Math.min(width / 980, height / 650);
  const boardW = 560 * scale;
  const boardH = 326 * scale;
  const boardX = (width - boardW) / 2;
  const boardY = (height - boardH) / 2 + 8;
  const phase = Math.floor(time / 2500);
  const diceSets = [
    [6, 2],
    [4, 3],
    [5, 1],
    [3, 3],
  ];
  const dice = diceSets[phase % diceSets.length];
  const equity = 54.1 + Math.sin(time * 0.0011) * 7.2;

  ctx.save();
  ctx.strokeStyle = INK;
  ctx.fillStyle = PAPER;
  ctx.lineWidth = 1;

  label(ctx, "BACKGAMMON / POSITION ENGINE 02", 22, 28);
  label(ctx, `ROLL  ${dice[0]}-${dice[1]}`, 22, 44, "left", RED);
  label(ctx, `EQUITY  ${equity.toFixed(1)}%`, 22, 57);
  label(ctx, "CUBE  2 / CENTERED", 22, 70);

  label(ctx, "128K MONTE CARLO PLAYOUTS", width - 22, 28, "right");
  label(ctx, "DEPTH  3-PLY", width - 22, 44, "right");
  label(ctx, `NOISE  ${(0.12 + Math.sin(time * 0.002) * 0.02).toFixed(2)}`, width - 22, 57, "right");
  label(ctx, "MODEL  BG/01", width - 22, 70, "right");

  // Token-like reasoning sequence.
  const fragments = [
    ["POSITION", "0.09"],
    ["ROLL", "0.17"],
    ["LEGAL", "0.22"],
    ["MOVE", "0.41"],
    ["EQUITY", "0.68"],
  ];
  let fragmentX = width / 2 - 215;
  fragments.forEach(([word, probability], index) => {
    const active = phase % fragments.length === index;
    label(ctx, word, fragmentX, 98, "left", active ? RED : INK);
    label(ctx, probability, fragmentX + 8, 110, "left", "#a4a49e");
    if (index < fragments.length - 1) {
      label(ctx, "→", fragmentX + 66, 99, "left", "#a4a49e");
    }
    fragmentX += 91;
  });

  // Board.
  ctx.strokeRect(boardX, boardY, boardW, boardH);
  ctx.strokeRect(boardX + boardW / 2 - 9, boardY, 18, boardH);
  line(ctx, boardX, boardY + boardH / 2, boardX + boardW, boardY + boardH / 2, 0.2);

  const slot = (boardW / 2 - 14) / 6;
  const triangleHeight = boardH * 0.42;
  for (let half = 0; half < 2; half++) {
    for (let i = 0; i < 6; i++) {
      const x0 =
        half === 0
          ? boardX + i * slot
          : boardX + boardW / 2 + 14 + i * slot;
      const center = x0 + slot / 2;
      ctx.save();
      ctx.globalAlpha = (i + half) % 2 === 0 ? 0.5 : 0.18;
      ctx.beginPath();
      ctx.moveTo(x0, boardY);
      ctx.lineTo(x0 + slot, boardY);
      ctx.lineTo(center, boardY + triangleHeight);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, boardY + boardH);
      ctx.lineTo(x0 + slot, boardY + boardH);
      ctx.lineTo(center, boardY + boardH - triangleHeight);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  const position = [
    { point: 0, count: 2, top: true, dark: true },
    { point: 5, count: 5, top: false, dark: true },
    { point: 7, count: 3, top: false, dark: true },
    { point: 11, count: 5, top: true, dark: true },
    { point: 12, count: 5, top: false, dark: false },
    { point: 16, count: 3, top: true, dark: false },
    { point: 18, count: 5, top: true, dark: false },
    { point: 23, count: 2, top: false, dark: false },
  ];

  position.forEach((stack, stackIndex) => {
    const pos = checkerPosition(
      stack.point,
      stack.top,
      boardX,
      boardY,
      boardW,
      boardH,
    );
    const radius = Math.min(13 * scale, pos.slot * 0.39);
    for (let i = 0; i < stack.count; i++) {
      const y =
        pos.y + (stack.top ? 1 : -1) * i * (radius * 1.72);
      ctx.save();
      ctx.fillStyle = stack.dark ? INK : PAPER;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(pos.x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!stack.dark) {
        ctx.beginPath();
        ctx.arc(pos.x, y, radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (stackIndex === phase % position.length) {
      const movingY =
        pos.y +
        (stack.top ? 1 : -1) *
          (stack.count - 1) *
          (radius * 1.72);
      ctx.save();
      ctx.strokeStyle = RED;
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(pos.x, movingY, radius + 4 + Math.sin(time * 0.004) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, movingY);
      ctx.bezierCurveTo(
        width / 2,
        boardY + boardH / 2 - 50 * scale,
        width / 2 + 110 * scale,
        boardY + boardH / 2 + 25 * scale,
        boardX + boardW * 0.76,
        boardY + boardH * 0.72,
      );
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.restore();
    }
  });

  // Dice.
  const dieSize = 34 * scale;
  dice.forEach((value, index) => {
    const x = width / 2 + (index === 0 ? -dieSize - 5 : 5);
    const y = boardY + boardH / 2 - dieSize / 2;
    ctx.strokeRect(x, y, dieSize, dieSize);
    label(ctx, String(value), x + dieSize / 2, y + dieSize / 2 + 4, "center", index === 0 ? RED : INK);
  });

  // Candidate moves.
  const candidates = [
    { move: `${dice[0]}/13 ${dice[1]}/8`, base: 61.8 },
    { move: `${dice[0]}/18 ${dice[1]}/13`, base: 24.7 },
    { move: `${dice[0]}/8 ${dice[1]}/6`, base: 13.5 },
  ];
  const oddsX = Math.min(width - 172, boardX + boardW + 24);
  const oddsY = boardY + 62;
  candidates.forEach((candidate, index) => {
    const amount =
      candidate.base + Math.sin(time * 0.001 + index * 2) * (index === 0 ? 3 : 1.5);
    label(ctx, `0${index + 1}  ${candidate.move}`, oddsX, oddsY + index * 42);
    label(
      ctx,
      `${amount.toFixed(1)}%`,
      oddsX + 132,
      oddsY + index * 42,
      "right",
      index === 0 ? RED : INK,
    );
    ctx.save();
    ctx.fillStyle = index === 0 ? RED : INK;
    ctx.globalAlpha = index === 0 ? 1 : 0.22;
    ctx.fillRect(oddsX, oddsY + 9 + index * 42, (amount / 100) * 132, 2);
    ctx.restore();
  });

  ctx.restore();

  label(
    ctx,
    "CANDIDATE MOVES UPDATE WITH EACH SIMULATED ROLL",
    width / 2,
    height - 18,
    "center",
  );
}

export function SystemCanvas({ mode }: { mode: VisualMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      drawGrid(context, width, height);
      if (mode === 1) drawF1(context, width, height, time);
      else drawBackgammon(context, width, height, time);
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
      aria-label={
        mode === 1
          ? "Animated Formula One technical diagram with live sensor telemetry"
          : "Animated backgammon position simulation with candidate move probabilities"
      }
      role="img"
    />
  );
}
