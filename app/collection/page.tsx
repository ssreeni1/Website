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

const externalEntries = [
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
    title: "RICKS Mechanism Analysis",
    date: "2021-10-01",
    url: "https://observablehq.com/@ssreeni1/picklerick",
  },
] as const;

const entries = [
  ...postSummaries.map((post) => ({
    title: post.title,
    date: post.publishedAt,
    url: `/collections/${post.slug}`,
  })),
  ...externalEntries,
].sort((a, b) => b.date.localeCompare(a.date));

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
