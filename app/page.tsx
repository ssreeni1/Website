"use client";

import { useEffect, useRef, useState } from "react";

const routes = [
  { name: "Index", path: "/" },
  { name: "About", path: "#about" },
  { name: "Work", path: "#work" },
  { name: "Notes", path: "#notes" },
];

const nodes = [
  { x: 18, y: 46, kind: "plus", delay: "-1s" },
  { x: 24, y: 58, kind: "square", delay: "-3s" },
  { x: 32, y: 39, kind: "plus", delay: "-6s" },
  { x: 38, y: 63, kind: "plus", delay: "-2s" },
  { x: 43, y: 49, kind: "square", delay: "-8s" },
  { x: 48, y: 69, kind: "plus", delay: "-4s" },
  { x: 54, y: 41, kind: "plus", delay: "-7s" },
  { x: 59, y: 56, kind: "square", delay: "-5s" },
  { x: 65, y: 34, kind: "plus", delay: "-9s" },
  { x: 69, y: 64, kind: "plus", delay: "-2s" },
  { x: 76, y: 47, kind: "square", delay: "-6s" },
  { x: 82, y: 57, kind: "plus", delay: "-4s" },
];

export default function Home() {
  const [finderOpen, setFinderOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeVisual, setActiveVisual] = useState(1);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (event.key.toLowerCase() === "f" && !isTyping) {
        event.preventDefault();
        setFinderOpen((open) => !open);
        setMenuOpen(false);
      }

      if (event.key.toLowerCase() === "m" && !isTyping) {
        event.preventDefault();
        setMenuOpen((open) => !open);
        setFinderOpen(false);
      }

      if (event.key === "Escape") {
        setFinderOpen(false);
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!fieldRef.current) return;
    const bounds = fieldRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    fieldRef.current.style.setProperty("--rx", `${y * -4}deg`);
    fieldRef.current.style.setProperty("--ry", `${x * 5}deg`);
  };

  return (
    <main>
      <header className="topbar">
        <a className="mark" href="/" aria-label="Saneel, home">
          Saneel
        </a>
        <button
          className="key-control menu-control"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => !open);
            setFinderOpen(false);
          }}
        >
          [{menuOpen ? "×" : "M"}]
        </button>
      </header>

      <section
        className={`menu-panel ${menuOpen ? "is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <nav aria-label="Main navigation">
          {routes.slice(1).map((route) => (
            <a
              href={route.path}
              key={route.name}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            >
              {route.name}
            </a>
          ))}
        </nav>
        <p>
          Independent builder working across
          <br />
          software, interfaces, and new ideas.
        </p>
      </section>

      <section className="system" aria-labelledby="system-title">
        <h1 id="system-title">Saneel</h1>
        <p className="system-intro" id="about">
          I build software, interfaces, and systems
          <br />
          for a more interesting world.
        </p>

        <div
          className="field"
          ref={fieldRef}
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            fieldRef.current?.style.setProperty("--rx", "0deg");
            fieldRef.current?.style.setProperty("--ry", "0deg");
          }}
          role="img"
          aria-label="A live wireframe system of orbiting nodes"
        >
          <div className="field-label">
            <span>00:01 / LIVE SYSTEM</span>
            <span>40.7128 N, 74.0060 W</span>
            <span>NEW YORK, US</span>
          </div>

          <div className="wireframe">
            <div className="axis axis-x" />
            <div className="axis axis-y" />
            <div className="ring ring-a" />
            <div className="ring ring-b" />
            <div className="ring ring-c" />
            <div className="ring ring-d" />
            <div className="live-core">
              <span />
            </div>
            {nodes.map((node, index) => (
              <i
                className={`node node-${node.kind}`}
                key={`${node.x}-${node.y}`}
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  animationDelay: node.delay,
                }}
              >
                {node.kind === "plus" ? "+" : ""}
                <b>{String(index + 1).padStart(2, "0")}</b>
              </i>
            ))}
          </div>

          <div className="field-caption">
            <span className="status-dot" />
            ACTIVE NODE / HUMAN–MACHINE INTERFACE
          </div>
        </div>
      </section>

      <footer className="controls">
        <nav className="visual-selector" aria-label="Visual selector">
          {[1, 2, 3, 4].map((number) => (
            <button
              className={number === activeVisual ? "is-active" : ""}
              type="button"
              key={number}
              aria-label={`Select visual ${number}`}
              aria-pressed={number === activeVisual}
              onClick={() => setActiveVisual(number)}
            >
              [{number === activeVisual ? "" : number}]
            </button>
          ))}
        </nav>

        <button
          className="find-control"
          type="button"
          onClick={() => {
            setFinderOpen(true);
            setMenuOpen(false);
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
