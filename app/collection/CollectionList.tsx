"use client";

import { useEffect, useRef, useState } from "react";

type CollectionEntry = {
  title: string;
  date: string;
  url: string;
};

type CollectionListProps = {
  entries: readonly CollectionEntry[];
};

const formatDate = (date: string) => date.replaceAll("-", ".");

export function CollectionList({ entries }: CollectionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const yearGroups = entries.reduce<
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
  }, []);

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
        setSelectedIndex((index) => (index + 1) % entries.length);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(
          (index) => (index - 1 + entries.length) % entries.length,
        );
      }

      if (event.key === "Enter") {
        event.preventDefault();
        linkRefs.current[selectedIndex]?.click();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entries.length, selectedIndex]);

  useEffect(() => {
    linkRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex]);

  return (
    <div className="collection-years" aria-label="Collection entries by year">
      {yearGroups.map((group) => (
        <section
          className="collection-year-group"
          aria-labelledby={`collection-year-${group.year}`}
          key={group.year}
        >
          <header className="collection-year-heading">
            <h2 id={`collection-year-${group.year}`}>[{group.year}]</h2>
            <span>
              {String(group.entries.length).padStart(2, "0")} {group.entries.length === 1 ? "ENTRY" : "ENTRIES"}
            </span>
          </header>

          <ol className="collection-list">
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
      ))}
    </div>
  );
}
