"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const routes = [
  { name: "Home", path: "/", href: "/" },
  { name: "About", path: "/about", href: "/about" },
  { name: "Collection", path: "/collection", href: "/collection" },
] as const;

type SiteTheme = "light" | "dark";

const THEME_STORAGE_KEY = "saneel-theme";

function getSystemTheme(): SiteTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applySiteTheme(theme: SiteTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(
    new CustomEvent<SiteTheme>("site-themechange", { detail: theme }),
  );
}

export function SiteNav() {
  const router = useRouter();
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderIndex, setFinderIndex] = useState(0);
  const finderInputRef = useRef<HTMLInputElement>(null);
  const themeRef = useRef<SiteTheme>("light");
  const themeOverrideRef = useRef<SiteTheme | null>(null);
  const filteredRoutes = routes.filter((route) =>
    `${route.name} ${route.path}`
      .toLowerCase()
      .includes(finderQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      if (key === "h") {
        event.preventDefault();
        router.push("/");
      }

      if (key === "a") {
        event.preventDefault();
        router.push("/about");
      }

      if (key === "c") {
        event.preventDefault();
        router.push("/collection");
      }

      if (key === "f") {
        event.preventDefault();
        setFinderIndex(0);
        setFinderOpen((open) => !open);
      }

      if (key === "d") {
        event.preventDefault();
        const nextTheme = themeRef.current === "dark" ? "light" : "dark";
        themeRef.current = nextTheme;
        themeOverrideRef.current = nextTheme;
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applySiteTheme(nextTheme);
      }

      if (event.key === "Escape") setFinderOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const override =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : null;
    themeOverrideRef.current = override;

    const syncTheme = () => {
      const theme = themeOverrideRef.current ?? getSystemTheme();
      themeRef.current = theme;
      applySiteTheme(theme);
    };
    const onSystemThemeChange = () => {
      if (!themeOverrideRef.current) syncTheme();
    };

    syncTheme();
    media.addEventListener("change", onSystemThemeChange);
    return () => media.removeEventListener("change", onSystemThemeChange);
  }, []);

  useEffect(() => {
    if (!finderOpen) return;
    window.requestAnimationFrame(() => finderInputRef.current?.focus());
  }, [finderOpen]);

  return (
    <>
      <header className="topbar">
        <Link className="mark" href="/" aria-label="Saneel Sreeni, home">
          Saneel Sreeni
        </Link>

        <nav className="topbar-nav" aria-label="Primary navigation">
          <Link href="/">
            Home <span>[H]</span>
          </Link>
          <Link href="/about">
            About <span>[A]</span>
          </Link>
          <Link href="/collection">
            Collection <span>[C]</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setFinderIndex(0);
              setFinderOpen(true);
            }}
            aria-label="Open directory"
          >
            Find <span>[F]</span>
          </button>
        </nav>
      </header>

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
                  router.push(filteredRoutes[finderIndex].href);
                  setFinderOpen(false);
                }
              }}
            />
          </div>

          <nav aria-label="Directory navigation">
            {filteredRoutes.map((route, index) => (
              <Link
                className={index === finderIndex ? "is-selected" : ""}
                href={route.href}
                key={route.name}
                tabIndex={finderOpen ? 0 : -1}
                onClick={() => setFinderOpen(false)}
              >
                <span>{route.name}</span>
                <i>{route.path}</i>
                <b>{String(index + 1).padStart(2, "0")}</b>
              </Link>
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
    </>
  );
}
