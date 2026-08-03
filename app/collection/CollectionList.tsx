"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CollectionEntry = {
  title: string;
  date: string;
  url: string;
};

type CollectionListProps = {
  entries: readonly CollectionEntry[];
};

type IndexedEntry = {
  entry: CollectionEntry;
  index: number;
};

type CollectionPeriod = {
  id: "current" | "archive";
  label: string;
  entries: IndexedEntry[];
};

const formatDate = (date: string) => date.replaceAll("-", ".");

export function CollectionList({ entries }: CollectionListProps) {
  const [activePeriod, setActivePeriod] =
    useState<CollectionPeriod["id"]>("current");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const periods = useMemo<CollectionPeriod[]>(() => {
    const indexedEntries = entries.map((entry, index) => ({ entry, index }));
    const currentYear = entries.at(0)?.date.slice(0, 4) ?? "2026";

    return [
      {
        id: "current",
        label: currentYear,
        entries: indexedEntries.filter(
          ({ entry }) => entry.date.slice(0, 4) === currentYear,
        ),
      },
      {
        id: "archive",
        label: "ARCHIVE",
        entries: indexedEntries.filter(
          ({ entry }) => entry.date.slice(0, 4) !== currentYear,
        ),
      },
    ];
  }, [entries]);
  const activeEntries = useMemo(
    () => periods.find(({ id }) => id === activePeriod)?.entries ?? [],
    [activePeriod, periods],
  );
  const visibleIndices = useMemo(
    () => activeEntries.map(({ index }) => index),
    [activeEntries],
  );

  const selectPeriod = (period: CollectionPeriod) => {
    setActivePeriod(period.id);

    const firstIndex = period.entries.at(0)?.index;
    if (firstIndex !== undefined) setSelectedIndex(firstIndex);
  };

  const onPeriodKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    periodIndex: number,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (periodIndex + direction + periods.length) % periods.length;
    selectPeriod(periods[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => {
          if (visibleIndices.length === 0) return index;

          const position = visibleIndices.indexOf(index);
          return visibleIndices[(position + 1) % visibleIndices.length];
        });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => {
          if (visibleIndices.length === 0) return index;

          const position = visibleIndices.indexOf(index);
          const previousPosition =
            position === -1 ? visibleIndices.length - 1 : position - 1;
          return visibleIndices[
            (previousPosition + visibleIndices.length) % visibleIndices.length
          ];
        });
      }

      if (event.key === "Enter") {
        if (!visibleIndices.includes(selectedIndex)) return;

        event.preventDefault();
        linkRefs.current[selectedIndex]?.click();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, visibleIndices]);

  useEffect(() => {
    linkRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex]);

  return (
    <section
      className="collection-periods"
      aria-label="Collection entries by period"
    >
      <header className="collection-period-heading">
        <div
          className="collection-period-tabs"
          role="tablist"
          aria-label="Collection period"
        >
          {periods.map((period, periodIndex) => {
            const isActive = period.id === activePeriod;
            const tabId = `collection-period-${period.id}`;
            const panelId = `collection-period-list-${period.id}`;

            return (
              <button
                id={tabId}
                className="collection-period-toggle"
                type="button"
                role="tab"
                aria-controls={panelId}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                key={period.id}
                ref={(element) => {
                  tabRefs.current[periodIndex] = element;
                }}
                onClick={() => selectPeriod(period)}
                onKeyDown={(event) => onPeriodKeyDown(event, periodIndex)}
              >
                [{period.label}]
              </button>
            );
          })}
        </div>
        <span>
          {String(activeEntries.length).padStart(2, "0")} {" "}
          {activeEntries.length === 1 ? "ENTRY" : "ENTRIES"}
        </span>
      </header>

      {periods.map((period) => {
        const isActive = period.id === activePeriod;

        return (
          <ol
            className="collection-list collection-period-panel"
            id={`collection-period-list-${period.id}`}
            role="tabpanel"
            aria-labelledby={`collection-period-${period.id}`}
            hidden={!isActive}
            key={period.id}
          >
            {period.entries.map(({ entry, index }) => (
              <li
                className={index === selectedIndex ? "is-selected" : ""}
                key={entry.url}
                onPointerEnter={() => setSelectedIndex(index)}
              >
                <a
                  className={index === selectedIndex ? "is-selected" : ""}
                  href={entry.url}
                  target={entry.url.startsWith("http") ? "_blank" : undefined}
                  rel={entry.url.startsWith("http") ? "noreferrer" : undefined}
                  ref={(element) => {
                    linkRefs.current[index] = element;
                  }}
                  onFocus={() => setSelectedIndex(index)}
                >
                  {entry.title}
                </a>
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              </li>
            ))}
          </ol>
        );
      })}
    </section>
  );
}
