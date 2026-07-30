import type { Metadata } from "next";
import { postSummaries } from "../../content/posts";
import { SiteNav } from "../SiteNav";
import { CollectionList } from "./CollectionList";

export const metadata: Metadata = {
  title: "Collection — Saneel Sreeni",
  description: "A collection of projects, research, and writing.",
  alternates: {
    canonical: "/collection/",
  },
};

const entries = [
  ...postSummaries.map((post) => ({
    title: post.title,
    date: post.publishedAt,
    url: `/${post.slug}`,
  })),
  {
    title: "Tracebase",
    date: "2026-05-27",
    url: "https://x.com/sanlsrni/status/2059710155881677025",
  },
  {
    title: "Eternal Atlas",
    date: "2026-05-08",
    url: "https://atlaseternal.xyz",
  },
  {
    title: "pain.flights",
    date: "2026-04-28",
    url: "https://pain.flights",
  },
  {
    title: "Superpositioned",
    date: "2026-03-02",
    url: "https://superpositioned.co",
  },
  {
    title: "When Everything Goes to 0",
    date: "2026-02-16",
    url: "https://x.com/sanlsrni/status/2023466205168976002",
  },
  {
    title: "HYPERSPECUL(A)T(I)ON (GENESIS II)",
    date: "2025-09-03",
    url: "https://x.com/sanlsrni/status/1963298338645704781",
  },
  {
    title: "Shigeta's Dream: The Gachafication of Everything",
    date: "2025-08-04",
    url: "https://x.com/sanlsrni/status/1952427934779859450",
  },
  {
    title: "GENESIS I",
    date: "2025-07-24",
    url: "https://x.com/sanlsrni/status/1948422534803652829",
  },
  {
    title: "The Hedonist's Stone",
    date: "2025-07-09",
    url: "https://x.com/sanlsrni/status/1943004564745261271",
  },
  {
    title: "Speculation is Dead, Long Live Speculation",
    date: "2025-07-03",
    url: "https://x.com/sanlsrni/status/1940824199099981930",
  },
  {
    title: "Building <> Trading",
    date: "2025-06-20",
    url: "https://x.com/sanlsrni/status/1935070994361614592",
  },
  {
    title: "RICKS Mechanism Analysis",
    date: "2021-10-01",
    url: "https://observablehq.com/@ssreeni1/picklerick",
  },
] as const;

export default function CollectionPage() {
  return (
    <main className="collection-page">
      <SiteNav />

      <section className="collection-shell" aria-labelledby="collection-title">
        <header className="collection-heading">
          <div className="collection-heading-title">
            <h1 id="collection-title">COLLECTION</h1>
            <span
              className="collection-key-hint"
              aria-label="Use up and down arrow keys to change selection"
            >
              [↓] [↑]
            </span>
          </div>
          <span>{String(entries.length).padStart(2, "0")} ENTRIES</span>
        </header>

        <CollectionList entries={entries} />
      </section>
    </main>
  );
}
