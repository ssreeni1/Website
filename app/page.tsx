"use client";

import { useEffect, useRef, useState } from "react";

const directory = [
  { key: "01", label: "Index", href: "#index" },
  { key: "02", label: "About", href: "#about" },
  { key: "03", label: "Work", href: "#work" },
  { key: "04", label: "Notes", href: "#notes" },
];

export default function Home() {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          event.preventDefault();
          setDirectoryOpen((open) => !open);
        }
      }

      if (event.key === "Escape") setDirectoryOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!visualRef.current) return;
    const bounds = visualRef.current.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    visualRef.current.style.setProperty("--mx", `${x * 14}px`);
    visualRef.current.style.setProperty("--my", `${y * 14}px`);
  };

  return (
    <main id="index">
      <header className="site-header">
        <a className="wordmark" href="#index" aria-label="Saneel — home">
          SANEEL<span className="wordmark-dot">.</span>
        </a>

        <div className="header-meta" aria-label="Current status">
          <span className="signal" aria-hidden="true" />
          NEW YORK / ONLINE
        </div>

        <button
          className="directory-trigger"
          type="button"
          aria-label="Open directory"
          aria-expanded={directoryOpen}
          onClick={() => setDirectoryOpen(true)}
        >
          <kbd>F</kbd>
          <span>DIRECTORY</span>
        </button>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">INDEPENDENT BUILDER / 2026</p>
          <h1 id="hero-title">
            I build systems
            <br />
            for a more
            <br />
            <span>interesting world.</span>
          </h1>
          <p className="intro" id="about">
            Working across software, design, and new ideas.
            <br />
            Currently making things on the internet.
          </p>
        </div>

        <div
          className="cybernetic-stage"
          ref={visualRef}
          onPointerMove={onPointerMove}
          onPointerLeave={() => {
            visualRef.current?.style.setProperty("--mx", "0px");
            visualRef.current?.style.setProperty("--my", "0px");
          }}
          aria-label="An animated cybernetic system orbiting the ideas build, think, make, and learn"
          role="img"
        >
          <div className="coordinate coordinate-top">40.7128° N</div>
          <div className="coordinate coordinate-right">74.0060° W</div>

          <div className="visual-system">
            <div className="crosshair horizontal" />
            <div className="crosshair vertical" />
            <div className="orbit orbit-outer">
              <span className="orbital-word word-build">BUILD</span>
              <span className="orbital-word word-think">THINK</span>
              <span className="orbital-word word-make">MAKE</span>
              <span className="orbital-word word-learn">LEARN</span>
            </div>
            <div className="orbit orbit-mid">
              <span className="satellite satellite-a" />
              <span className="satellite satellite-b" />
            </div>
            <div className="orbit orbit-inner" />
            <div className="core">
              <span className="core-index">01</span>
              <span className="core-label">HUMAN / MACHINE</span>
            </div>
          </div>

          <div className="system-caption">
            <span>AN OPEN SYSTEM</span>
            <span>MOVE TO INSPECT</span>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <p>IDEAS → INTERFACES → SYSTEMS</p>
        <nav aria-label="Social links">
          <a href="mailto:hello@saneel.com">EMAIL</a>
          <a href="#work">WORK</a>
          <a href="#notes">NOTES</a>
        </nav>
      </footer>

      <aside
        className={`directory ${directoryOpen ? "is-open" : ""}`}
        aria-hidden={!directoryOpen}
        aria-label="Site directory"
      >
        <div className="directory-header">
          <span>DIRECTORY / INDEX</span>
          <button
            type="button"
            onClick={() => setDirectoryOpen(false)}
            aria-label="Close directory"
          >
            <kbd>ESC</kbd>
            CLOSE
          </button>
        </div>

        <nav className="directory-nav" aria-label="Directory navigation">
          {directory.map((item) => (
            <a
              href={item.href}
              key={item.key}
              tabIndex={directoryOpen ? 0 : -1}
              onClick={() => setDirectoryOpen(false)}
            >
              <span>{item.key}</span>
              <strong>{item.label}</strong>
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </nav>

        <div className="directory-footer">
          <p>
            A small corner of the internet
            <br />
            for work, notes, and experiments.
          </p>
          <div>
            <span>LOCAL TIME</span>
            <time suppressHydrationWarning>
              {new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "America/New_York",
              }).format(new Date())}{" "}
              EST
            </time>
          </div>
        </div>
      </aside>
    </main>
  );
}
