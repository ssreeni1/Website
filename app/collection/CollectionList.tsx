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
    <ol className="collection-list" aria-label="Collection entries">
      {entries.map((entry, index) => (
        <li key={entry.url}>
          <a
            className={index === selectedIndex ? "is-selected" : ""}
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            ref={(element) => {
              linkRefs.current[index] = element;
            }}
            onPointerEnter={() => setSelectedIndex(index)}
            onFocus={() => setSelectedIndex(index)}
          >
            {entry.title}
          </a>
          <time dateTime={entry.date}>{formatDate(entry.date)}</time>
        </li>
      ))}
    </ol>
  );
}
