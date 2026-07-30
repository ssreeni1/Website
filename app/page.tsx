"use client";

import { useEffect, useState } from "react";
import { SystemCanvas } from "./SystemCanvas";

const routes = [
  { name: "Index", path: "/" },
  { name: "About", path: "#about" },
  { name: "Work", path: "#work" },
  { name: "Notes", path: "#notes" },
];

export default function Home() {
  const [finderOpen, setFinderOpen] = useState(false);
  const [activeVisual, setActiveVisual] = useState<1 | 2>(1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (event.key.toLowerCase() === "f" && !isTyping) {
        event.preventDefault();
        setFinderOpen((open) => !open);
      }

      if (event.key === "Escape") setFinderOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveVisual((visual) => (visual === 1 ? 2 : 1));
    }, 14000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <main>
      <header className="topbar">
        <a className="mark" href="/" aria-label="Saneel, home">
          Saneel
        </a>
      </header>

      <section className="system" aria-labelledby="system-title">
        <h1 id="system-title">Saneel</h1>
        <p className="system-intro" id="about">
          I build software, interfaces, and systems
          <br />
          for a more interesting world.
        </p>

        <div className="mode-title" aria-live="polite">
          <span>0{activeVisual}</span>
          <strong>
            {activeVisual === 1
              ? "Formula / telemetry"
              : "Backgammon / probability"}
          </strong>
        </div>

        <div className="canvas-shell" key={activeVisual}>
          <SystemCanvas mode={activeVisual} />
        </div>
      </section>

      <footer className="controls">
        <nav className="visual-selector" aria-label="Visual selector">
          {([1, 2] as const).map((number) => (
            <button
              className={number === activeVisual ? "is-active" : ""}
              type="button"
              key={number}
              aria-label={`Select ${
                number === 1 ? "Formula telemetry" : "backgammon probability"
              } visual`}
              aria-pressed={number === activeVisual}
              onClick={() => setActiveVisual(number)}
            >
              [{number === activeVisual ? "" : number}]
            </button>
          ))}
          <span className="selector-label">
            {activeVisual === 1 ? "FORMULA" : "BACKGAMMON"}
          </span>
        </nav>

        <button
          className="find-control"
          type="button"
          onClick={() => setFinderOpen(true)}
          aria-label="Open directory"
        >
          Find <span>[F]</span>
        </button>

        <p>© 2026 / NEW YORK</p>
      </footer>

      <div
        className={`finder-scrim ${finderOpen ? "is-open" : ""}`}
        aria-hidden={!finderOpen}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) setFinderOpen(false);
        }}
      >
        <section
          className="finder"
          role="dialog"
          aria-modal="true"
          aria-label="Directory"
        >
          <div className="finder-input">
            <span>saneel/</span>
            <input
              aria-label="Search Saneel"
              autoFocus={finderOpen}
              placeholder="find"
              tabIndex={finderOpen ? 0 : -1}
            />
          </div>

          <nav aria-label="Directory navigation">
            {routes.map((route, index) => (
              <a
                href={route.path}
                key={route.name}
                tabIndex={finderOpen ? 0 : -1}
                onClick={() => setFinderOpen(false)}
              >
                <span>{route.name}</span>
                <i>{route.path}</i>
                <b>{String(index + 1).padStart(2, "0")}</b>
              </a>
            ))}
          </nav>

          <div className="finder-help">
            <span>[↓] [↑]</span>
            <span>[enter] to visit</span>
            <button
              type="button"
              tabIndex={finderOpen ? 0 : -1}
              onClick={() => setFinderOpen(false)}
            >
              Close [esc]
            </button>
          </div>
        </section>
      </div>

      <div id="work" className="anchor" />
      <div id="notes" className="anchor" />
    </main>
  );
}
