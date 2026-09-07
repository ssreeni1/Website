"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ifPoem } from "./if-poem";

type Slide = { name: string; asset: string; alt: string; width: number; height: number; youtubeId?: string; artist?: string; themedSvg?: boolean };
const slides: Slide[] = [
  { name: "Poem", asset: "poem", alt: "The poem, photographed from the page", width: 736, height: 736 },
  { name: "Hunting Nirvana", asset: "hunting-nirvana", alt: "Hunting Nirvana — SAINt JHN", artist: "SAINt JHN", width: 480, height: 360, youtubeId: "dhCo5U1oByc" },
  { name: "Mahabharata", asset: "krishna-arjuna", alt: "Krishna teaching Arjuna in their canopied chariot, drawn by four white horses", width: 1280, height: 1600 },
  { name: "Good Life", asset: "good-life", alt: "Good Life — ZHU", artist: "ZHU", width: 1280, height: 720, youtubeId: "0CWVgu2Odjg" },
  { name: "If—", asset: "if", alt: "If—, a poem by Rudyard Kipling", width: 1280, height: 1600 },
  { name: "Judo", asset: "judo", alt: "Two judo athletes in white gis mid-throw on a red and gold mat", width: 627, height: 640 },
  { name: "Momentum", asset: "momentum", alt: "Momentum — Av King Hamilton", artist: "Av King Hamilton", width: 1280, height: 720, youtubeId: "6pmdglykhjE" },
  { name: "Figure and sun", asset: "figure-sun", alt: "A textured painting of a green figure raising a dark orb against a golden halo", width: 1200, height: 800 },
  { name: "Unravel", asset: "unravel", alt: "Unravel — Animenz Piano Sheets", artist: "Animenz Piano Sheets", width: 1280, height: 720, youtubeId: "sEQf5lcnj_o" },
  { name: "Nolan / Time", asset: "nolan-time", alt: "Nolan / Time: thirteen wireframe diagrams pairing Christopher Nolan's films with their temporal motifs", width: 1800, height: 1840, themedSvg: true },
];
const count = slides.length;
// Three copies keep both neighbours mounted, including across the loop seam.
const slots = Array.from({ length: count * 3 }, (_, index) => index);

export function TruthCarousel() {
  const [active, setActive] = useState(count);
  const [player, setPlayer] = useState<number | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const target = useRef(count);
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
    setActive(Math.max(0, Math.min(slots.length - 1, Math.round(position))));
  }, []);

  const settle = useCallback(() => {
    const node = viewport.current;
    if (!node || touching.current) return;
    let index = Math.round(node.scrollLeft / stride.current);
    if (index < count) index += count;
    else if (index >= count * 2) index -= count;
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
    target.current = Math.max(0, Math.min(slots.length - 1, target.current + direction));
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
      <section className="truth-carousel" style={{ "--truth-copy-count": count } as CSSProperties} aria-label="Thoughts" aria-roledescription="carousel">
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
              const poster = slide.themedSvg ? (
                <>
                  {(["dark", "light"] as const).map((theme) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={theme} className={`truth-art-${theme}`}
                      src={`/truth/${slide.asset}-${theme}.svg`}
                      width={slide.width} height={slide.height} alt={slide.alt}
                      decoding="async" draggable={false} />
                  ))}
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/truth/${slide.asset}-1280.webp`}
                  srcSet={slide.width <= 640 ? undefined : `/truth/${slide.asset}-640.webp 640w, /truth/${slide.asset}-1280.webp ${slide.width}w`}
                  sizes="(max-width: 700px) 64vw, 560px"
                  width={slide.width}
                  height={slide.height}
                  alt={slide.alt}
                  decoding="async"
                  draggable={false}
                  fetchPriority={slot === count ? "high" : "auto"}
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
                  {slide.youtubeId ? (
                    <div className="truth-song">
                      <div className="truth-song-heading">
                        <h2>{slide.name}</h2>
                        <p>{slide.artist}</p>
                      </div>
                      <div className="truth-song-player">
                      {player === slot && selected ? (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${slide.youtubeId}?playsinline=1&rel=0&autoplay=1`}
                          title={slide.alt}
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      ) : (
                        <button className="truth-play" type="button" aria-label={`Play ${slide.alt}`} onClick={() => setPlayer(slot)}>
                          <span className="truth-play-mark" aria-hidden="true">▷</span>
                          <span>Play <span className="truth-play-bracket" aria-hidden="true">[↗]</span></span>
                        </button>
                      )}
                      </div>
                      <a className="truth-song-source" href={`https://www.youtube.com/watch?v=${slide.youtubeId}`} target="_blank" rel="noopener noreferrer">
                        YouTube <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  ) : poster}
                  {slide.asset === "if" && <figcaption className="sr-only">{ifPoem.map((stanza, index) => <p key={index}>{stanza.join("\n")}</p>)}</figcaption>}
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
