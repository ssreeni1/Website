"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SystemCanvas } from "./SystemCanvas";

const routes = [
  { name: "Index", path: "/", href: "/" },
  { name: "Formula system", path: "visual/01", visual: 1 as const },
  { name: "Backgammon system", path: "visual/02", visual: 2 as const },
  { name: "Symbol system", path: "visual/03", visual: 3 as const },
  { name: "About", path: "#about", href: "#about" },
] as const;

export default function Home() {
  const [finderOpen, setFinderOpen] = useState(false);
  const [activeVisual, setActiveVisual] = useState<1 | 2 | 3>(1);
  const [autoCycle, setAutoCycle] = useState(true);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderIndex, setFinderIndex] = useState(0);
  const finderInputRef = useRef<HTMLInputElement>(null);
  const filteredRoutes = routes.filter((route) =>
    `${route.name} ${route.path}`
      .toLowerCase()
      .includes(finderQuery.trim().toLowerCase()),
  );
  const visitRoute = (route: (typeof routes)[number]) => {
    if ("visual" in route) {
      setAutoCycle(false);
      setActiveVisual(route.visual);
    } else {
      window.location.href = route.href;
    }
    setFinderOpen(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (event.key.toLowerCase() === "f" && !isTyping) {
        event.preventDefault();
        setFinderIndex(0);
        setFinderOpen((open) => !open);
      }

      if (event.key === "Escape") setFinderOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!finderOpen) return;
    window.requestAnimationFrame(() => finderInputRef.current?.focus());
  }, [finderOpen]);

  useEffect(() => {
    if (!autoCycle) return;
    const interval = window.setInterval(() => {
      setActiveVisual((visual) => (visual === 3 ? 1 : ((visual + 1) as 2 | 3)));
    }, 26000);

    return () => window.clearInterval(interval);
  }, [autoCycle]);

  return (
    <main>
      <header className="topbar">
        <Link className="mark" href="/" aria-label="Saneel, home">
          Saneel
        </Link>
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
              : activeVisual === 2
                ? "Backgammon / probability"
                : "Symbols / topology"}
          </strong>
        </div>

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
            {activeVisual === 1
              ? "FORMULA"
              : activeVisual === 2
                ? "BACKGAMMON"
                : "SYMBOLS"}
          </span>
        </nav>

        <button
          className="find-control"
          type="button"
          onClick={() => {
            setFinderIndex(0);
            setFinderOpen(true);
          }}
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
              ref={finderInputRef}
              aria-label="Search Saneel"
              placeholder="find"
              tabIndex={finderOpen ? 0 : -1}
              value={finderQuery}
              onChange={(event) => {
                setFinderQuery(event.target.value);
                setFinderIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setFinderIndex((index) =>
                    Math.min(
                      Math.max(0, filteredRoutes.length - 1),
                      index + 1,
                    ),
                  );
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setFinderIndex((index) => Math.max(0, index - 1));
                }
                if (event.key === "Enter" && filteredRoutes[finderIndex]) {
                  visitRoute(filteredRoutes[finderIndex]);
                }
              }}
            />
          </div>

          <nav aria-label="Directory navigation">
            {filteredRoutes.map((route, index) => (
              <a
                className={index === finderIndex ? "is-selected" : ""}
                href={"href" in route ? route.href : `#${route.path}`}
                key={route.name}
                tabIndex={finderOpen ? 0 : -1}
                onClick={(event) => {
                  if ("visual" in route) event.preventDefault();
                  visitRoute(route);
                }}
              >
                <span>{route.name}</span>
                <i>{route.path}</i>
                <b>{String(index + 1).padStart(2, "0")}</b>
              </a>
            ))}
            {filteredRoutes.length === 0 && (
              <p className="finder-empty">No matching route</p>
            )}
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
    </main>
  );
}
