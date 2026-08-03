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

const formatDate = (date: string) => date.replaceAll("-", ".");
const DEFAULT_COLLAPSED_THROUGH_YEAR = 2025;

export function CollectionList({ entries }: CollectionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const yearGroups = useMemo(
    () =>
      entries.reduce<
        Array<{
          year: string;
          entries: Array<{ entry: CollectionEntry; index: number }>;
        }>
      >((groups, entry, index) => {
        const year = entry.date.slice(0, 4);
        const currentGroup = groups.at(-1);

        if (currentGroup?.year === year) {
          currentGroup.entries.push({ entry, index });
        } else {
          groups.push({ year, entries: [{ entry, index }] });
        }

        return groups;
      }, []),
    [entries],
  );
  const [collapsedYears, setCollapsedYears] = useState(
    () =>
      new Set(
        yearGroups
          .filter(
            ({ year }) => Number(year) <= DEFAULT_COLLAPSED_THROUGH_YEAR,
          )
          .map(({ year }) => year),
      ),
  );
  const visibleIndices = useMemo(
    () =>
      yearGroups.flatMap((group) =>
        collapsedYears.has(group.year)
          ? []
          : group.entries.map(({ index }) => index),
      ),
    [collapsedYears, yearGroups],
  );

  const toggleYear = (year: string, groupIndices: readonly number[]) => {
    const willCollapse = !collapsedYears.has(year);

    if (willCollapse && groupIndices.includes(selectedIndex)) {
      const nextVisibleIndex = visibleIndices.find(
        (index) => !groupIndices.includes(index),
      );

      if (nextVisibleIndex !== undefined) {
        setSelectedIndex(nextVisibleIndex);
      }
    }

    setCollapsedYears((currentYears) => {
      const nextYears = new Set(currentYears);

      if (nextYears.has(year)) {
        nextYears.delete(year);
      } else {
        nextYears.add(year);
      }

      return nextYears;
    });
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
    <div className="collection-years" aria-label="Collection entries by year">
      {yearGroups.map((group) => {
        const isCollapsed = collapsedYears.has(group.year);
        const groupIndices = group.entries.map(({ index }) => index);
        const listId = `collection-year-list-${group.year}`;

        return (
          <section
            className="collection-year-group"
            aria-labelledby={`collection-year-${group.year}`}
            key={group.year}
          >
            <header className="collection-year-heading">
              <h2>
                <button
                  id={`collection-year-${group.year}`}
                  className="collection-year-toggle"
                  type="button"
                  aria-controls={listId}
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleYear(group.year, groupIndices)}
                >
                  <span>[{group.year}]</span>
                  <i aria-hidden="true">{isCollapsed ? "[+]" : "[−]"}</i>
                </button>
              </h2>
              <span>
                {String(group.entries.length).padStart(2, "0")}{" "}
                {group.entries.length === 1 ? "ENTRY" : "ENTRIES"}
              </span>
            </header>

            <ol className="collection-list" id={listId} hidden={isCollapsed}>
              {group.entries.map(({ entry, index }) => (
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
          </section>
        );
      })}
    </div>
  );
}
