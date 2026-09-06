"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TruthBack } from "./TruthBack";

const slides = [
  { name: "Poem", asset: "poem", alt: "The poem, photographed from the page", width: 736, height: 736 },
  { name: "Hunting Nirvana", asset: "hunting-nirvana", alt: "Hunting Nirvana — SAINt JHN", width: 480, height: 360 },
  { name: "Mahabharata", asset: "krishna-arjuna", alt: "Krishna teaching Arjuna in their canopied chariot, drawn by four white horses", width: 1280, height: 1600 },
] as const;
// Three copies keep both neighbours mounted, including across the loop seam.
const slots = Array.from({ length: 9 }, (_, index) => index);

export function TruthCarousel() {
  const [active, setActive] = useState(3);
  const [player, setPlayer] = useState<number | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const target = useRef(3);
  const touching = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stride = useRef(1);

  const updateAppearance = useCallback(() => {
    const node = viewport.current;
    if (!node) return;
    const position = node.scrollLeft / stride.current;
    node.querySelectorAll<HTMLElement>(".truth-card").forEach((card, index) => {
      card.style.opacity = String(1 - Math.min(1, Math.abs(index - position)) * 0.78);
    });
    setActive(Math.max(0, Math.min(8, Math.round(position))));
  }, []);

  const settle = useCallback(() => {
    const node = viewport.current;
    if (!node || touching.current) return;
    let index = Math.round(node.scrollLeft / stride.current);
    if (index < 3) index += 3;
    else if (index > 5) index -= 3;
    target.current = index;
    // Rebase only after motion has stopped; identical copies make this invisible.
    if (Math.abs(node.scrollLeft - index * stride.current) > 1) {
      node.scrollTo({ left: index * stride.current, behavior: "instant" });
    }
    updateAppearance();
  }, [updateAppearance]);

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const resize = () => {
      const cards = node.querySelectorAll<HTMLElement>(".truth-card");
      stride.current = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
      node.dataset.ready = "true";
      node.scrollTo({ left: target.current * stride.current, behavior: "instant" });
      updateAppearance();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    node.addEventListener("scrollend", settle);
    return () => {
      observer.disconnect();
      node.removeEventListener("scrollend", settle);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [settle, updateAppearance]);

  const move = useCallback((direction: number) => {
    const node = viewport.current;
    if (!node) return;
    setPlayer(null);
    target.current = Math.max(0, Math.min(8, target.current + direction));
    node.scrollTo({
      left: target.current * stride.current,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest("input, textarea, select, [role='dialog']")))
      ) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  return (
    <>
      <TruthBack />
      <section className="truth-carousel" aria-label="Thoughts" aria-roledescription="carousel">
        <div
          className="truth-window"
          id="truth-slide"
          ref={viewport}
          onTouchStart={() => {
            touching.current = true;
            target.current = Math.round((viewport.current?.scrollLeft ?? 0) / stride.current);
          }}
          onTouchEnd={() => { touching.current = false; }}
          onTouchCancel={() => { touching.current = false; }}
          onScroll={() => {
            updateAppearance();
            if (player !== null && Math.abs((viewport.current?.scrollLeft ?? 0) / stride.current - player) > 0.1) setPlayer(null);
            if (settleTimer.current) clearTimeout(settleTimer.current);
            settleTimer.current = setTimeout(settle, 180);
          }}
        >
          <div className="truth-strip">
            {slots.map((slot) => {
              const slide = slides[slot % slides.length];
              const selected = slot === active;
              const poster = (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/truth/${slide.asset}-1280.webp`}
                  srcSet={slide.asset === "hunting-nirvana" ? undefined : `/truth/${slide.asset}-640.webp 640w, /truth/${slide.asset}-1280.webp ${slide.width}w`}
                  sizes="(max-width: 700px) 64vw, 560px"
                  width={slide.width}
                  height={slide.height}
                  alt={slide.alt}
                  decoding="async"
                  draggable={false}
                  fetchPriority={slot === 3 ? "high" : "auto"}
                />
              );
              return (
                <figure
                  key={slot}
                  className={`truth-card truth-figure${selected ? " is-active" : ""}`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={slide.name}
                  aria-hidden={!selected}
                  inert={!selected}
                >
                  {slot % slides.length === 1 ? (
                    <div className="truth-song">
                      {player === slot && selected ? (
                        <iframe
                          src="https://www.youtube-nocookie.com/embed/dhCo5U1oByc?playsinline=1&rel=0&autoplay=1"
                          title="Hunting Nirvana — SAINt JHN"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      ) : (
                        <button className="truth-play" type="button" aria-label="Play Hunting Nirvana — SAINt JHN" onClick={() => setPlayer(slot)}>
                          {poster}
                          <span aria-hidden="true">▶</span>
                        </button>
                      )}
                    </div>
                  ) : poster}
                </figure>
              );
            })}
          </div>
        </div>
        <nav className="topbar-nav truth-nav" aria-label="Carousel navigation">
          <button type="button" onClick={() => move(-1)} aria-controls="truth-slide" aria-keyshortcuts="ArrowLeft">Left <span aria-hidden="true">[←]</span></button>
          <button type="button" onClick={() => move(1)} aria-controls="truth-slide" aria-keyshortcuts="ArrowRight">Right <span aria-hidden="true">[→]</span></button>
        </nav>
        <p className="sr-only" aria-live="polite" aria-atomic="true">{slides[active % slides.length].name}</p>
      </section>
    </>
  );
}
