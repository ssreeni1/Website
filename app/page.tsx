"use client";

import { useEffect, useState } from "react";
import { SiteNav } from "./SiteNav";
import { SystemCanvas } from "./SystemCanvas";

const visualLabels = {
  1: "FROM OLD, THE NEW",
  2: "PEACE IN VARIANCE",
  3: "SIGNIFIERS AS CENTERS",
} as const;

export default function Home() {
  const [activeVisual, setActiveVisual] = useState<1 | 2 | 3>(1);
  const [autoCycle, setAutoCycle] = useState(true);

  useEffect(() => {
    if (!autoCycle) return;
    const interval = window.setInterval(() => {
      setActiveVisual((visual) => (visual === 3 ? 1 : ((visual + 1) as 2 | 3)));
    }, 26000);

    return () => window.clearInterval(interval);
  }, [autoCycle]);

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
        </div>
      </section>

      <footer className="controls">
        <nav className="visual-selector" aria-label="Visual selector">
          {([1, 2, 3] as const).map((number) => (
            <button
              className={number === activeVisual ? "is-active" : ""}
              type="button"
              key={number}
              aria-label={`Select ${
                number === 1
                  ? "Formula telemetry"
                  : number === 2
                    ? "backgammon probability"
                    : "symbol topology"
              } visual`}
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
