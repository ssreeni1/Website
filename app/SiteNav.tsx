"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CollectionEntry } from "../content/collection";

const pageRoutes = [
  { name: "Home", path: "/", href: "/", depth: 0 },
  { name: "About", path: "/about", href: "/about", depth: 0 },
  { name: "Truth", path: "/truth", href: "/truth", depth: 0 },
  {
    name: "Collection",
    path: "/collection",
    href: "/collection",
    depth: 0,
  },
];

type SiteTheme = "light" | "dark";

const THEME_STORAGE_KEY = "saneel-theme";

function applySiteTheme(theme: SiteTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(
    new CustomEvent<SiteTheme>("site-themechange", { detail: theme }),
  );
}

export function SiteNav({ collectionEntries }: { collectionEntries: readonly CollectionEntry[] }) {
  const routes = useMemo(() => [
    ...pageRoutes,
    ...collectionEntries
      .toSorted((a, b) => Number(a.archived) - Number(b.archived) || b.date.localeCompare(a.date))
      .map(entry => ({ name: entry.title, path: entry.url, href: entry.url, depth: 1 })),
  ], [collectionEntries]);
  const router = useRouter();
  const pathname = usePathname();
  const isTruth = /^\/truth\/?$/.test(pathname);
  const backHref = isTruth ? "/about" : pathname.startsWith("/collections/") ? "/collection" : undefined;
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderIndex, setFinderIndex] = useState(0);
  const [theme, setTheme] = useState<SiteTheme>("dark");
  const finderInputRef = useRef<HTMLInputElement>(null);
  const finderTriggerRef = useRef<HTMLButtonElement>(null);
  const finderRouteRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const themeRef = useRef<SiteTheme>("dark");
  const filteredRoutes = routes.filter((route) =>
    `${route.name} ${route.path}`
      .toLowerCase()
      .includes(finderQuery.trim().toLowerCase()),
  );

  const toggleTheme = useCallback(() => {
    const nextTheme = themeRef.current === "dark" ? "light" : "dark";
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applySiteTheme(nextTheme);
  }, []);

  useEffect(() => {
    // Imported essays contain real HTML anchors. Keep those internal links on
    // the same client router too, without hijacking downloads or external URLs.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href, location.href);
      const path = url.pathname.replace(/\/$/, "") || "/";
      if (url.origin !== location.origin || !routes.some(route => route.href === path)) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      event.preventDefault();
      router.push(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router, routes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && finderOpen) {
        event.preventDefault();
        setFinderOpen(false);
        finderTriggerRef.current?.focus();
        return;
      }
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (event.defaultPrevented || isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

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

      if (key === "b" && backHref) {
        event.preventDefault();
        router.push(backHref);
      }

      if (key === "f") {
        event.preventDefault();
        setFinderIndex(0);
        setFinderOpen((open) => !open);
      }

      if (key === "v") {
        event.preventDefault();
        toggleTheme();
      }

    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [backHref, router, toggleTheme, finderOpen]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : "dark";
    themeRef.current = initialTheme;
    applySiteTheme(initialTheme);
    const frame = window.requestAnimationFrame(() => setTheme(initialTheme));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!finderOpen) return;
    const input = finderInputRef.current;
    const trigger = finderTriggerRef.current;
    const frame = window.requestAnimationFrame(() => input?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      // A fast Escape must not lose focus to the deferred autofocus above.
      if (input?.closest(".finder")?.contains(document.activeElement)) {
        trigger?.focus();
      }
    };
  }, [finderOpen]);

  useEffect(() => {
    if (!finderOpen) return;
    finderRouteRefs.current[finderIndex]?.scrollIntoView({ block: "nearest" });
  }, [filteredRoutes.length, finderIndex, finderOpen]);

  return (
    <>
      <header className="topbar">
        {isTruth ? (
          <nav className="topbar-nav" aria-label="Back navigation">
            <Link href="/about">Back <span>[B]</span></Link>
          </nav>
        ) : <>
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
            ref={finderTriggerRef}
            onClick={() => {
              setFinderIndex(0);
              setFinderOpen(true);
            }}
            aria-label="Open directory"
          >
            Find <span>[F]</span>
          </button>
          <button
            type="button"
            aria-label={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            aria-pressed={theme === "dark"}
            onClick={toggleTheme}
          >
            Vibe <span>[V]</span>
          </button>
        </nav>

        {backHref ? (
          <Link className="topbar-back" href={backHref}>
            Back <span>[B]</span>
          </Link>
        ) : null}
        </>}
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
                  finderRouteRefs.current[finderIndex]?.click();
                }
              }}
            />
          </div>

          <nav aria-label="Directory navigation">
            {filteredRoutes.map((route, index) => (
              <Link
                className={`${route.depth === 1 ? "is-subroute " : ""}${
                  index === finderIndex ? "is-selected" : ""
                }`}
                href={route.href}
                target={route.href.startsWith("http") ? "_blank" : undefined}
                rel={route.href.startsWith("http") ? "noreferrer" : undefined}
                key={route.href}
                tabIndex={finderOpen ? 0 : -1}
                ref={(element) => {
                  finderRouteRefs.current[index] = element;
                }}
                onPointerEnter={() => setFinderIndex(index)}
                onClick={() => setFinderOpen(false)}
              >
                <span>{route.name}</span>
                <i>{route.path}</i>
                <b className="finder-number">{String(index + 1).padStart(2, "0")}</b>
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
