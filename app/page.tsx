"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "./SiteNav";
import { SystemCanvas } from "./SystemCanvas";

type VisualNumber = 1 | 2 | 3;

const visualLabels = {
  1: "FROM OLD, THE NEW",
  2: "PEACE IN VARIANCE",
  3: "SIGNIFIERS AS CENTERS",
} as const;

const visualNames = {
  1: "Formula telemetry",
  2: "backgammon probability",
  3: "symbol topology",
} as const;

const visualSequence: readonly VisualNumber[] = [2, 1, 3];

function adjacentVisual(
  visual: VisualNumber,
  direction: -1 | 1,
): VisualNumber {
  const currentIndex = visualSequence.indexOf(visual);
  const nextIndex =
    (currentIndex + direction + visualSequence.length) % visualSequence.length;
  return visualSequence[nextIndex];
}

export default function Home() {
  const [activeVisual, setActiveVisual] = useState<VisualNumber>(
    visualSequence[0],
  );
  const [autoCycle, setAutoCycle] = useState(true);

  const shiftVisual = useCallback((direction: -1 | 1) => {
    setAutoCycle(false);
    setActiveVisual((visual) => adjacentVisual(visual, direction));
  }, []);

  useEffect(() => {
    if (!autoCycle) return;
    const interval = window.setInterval(() => {
      setActiveVisual((visual) => adjacentVisual(visual, 1));
    }, 26000);

    return () => window.clearInterval(interval);
  }, [autoCycle]);

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        !["ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']") ||
        document.querySelector(".finder-scrim.is-open")
      ) {
        return;
      }

      event.preventDefault();
      shiftVisual(event.key === "ArrowLeft" ? -1 : 1);
    };

    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [shiftVisual]);

  const previousVisual = adjacentVisual(activeVisual, -1);
  const nextVisual = adjacentVisual(activeVisual, 1);

  return (
    <main className="home-page">
      <SiteNav />

      <section className="system" id="about" aria-labelledby="system-title">
        <h1 id="system-title">Saneel</h1>

        <div
          className="canvas-shell"
          key={activeVisual}
          onPointerDownCapture={() => setAutoCycle(false)}
          onWheelCapture={() => setAutoCycle(false)}
          onKeyDownCapture={() => setAutoCycle(false)}
        >
          <SystemCanvas mode={activeVisual} />

          <div className="visual-shift-group">
            <button
              className="visual-shift"
              type="button"
              aria-label={`Show previous visual: ${visualNames[previousVisual]}`}
              onClick={() => shiftVisual(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>

            <button
              className="visual-shift"
              type="button"
              aria-label={`Show next visual: ${visualNames[nextVisual]}`}
              onClick={() => shiftVisual(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      <footer className="controls">
        <nav className="visual-selector" aria-label="Visual selector">
          {visualSequence.map((number) => (
            <button
              className={number === activeVisual ? "is-active" : ""}
              type="button"
              key={number}
              aria-label={`Select ${visualNames[number]} visual`}
              aria-pressed={number === activeVisual}
              onClick={() => {
                setAutoCycle(false);
                setActiveVisual(number);
              }}
            >
              <span aria-hidden="true" />
            </button>
          ))}
          <span className="selector-label">
            {visualLabels[activeVisual]}
          </span>
        </nav>

        <p>© 2026 / NEW YORK</p>
      </footer>
    </main>
  );
}
