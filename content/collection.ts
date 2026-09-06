import { postSummaries } from "./posts";

export type CollectionEntry = {
  title: string;
  date: string;
  url: string;
  archived: boolean;
};

const externalEntries = [
  { title: "Tracebase", date: "2026-05-27", url: "https://x.com/sanlsrni/status/2059710155881677025" },
  { title: "Eternal Atlas", date: "2026-05-08", url: "https://atlaseternal.xyz" },
  { title: "pain.flights", date: "2026-04-28", url: "https://pain.flights" },
  { title: "Superpositioned", date: "2026-03-02", url: "https://superpositioned.co" },
  { title: "RICKS Mechanism Analysis", date: "2021-10-01", url: "https://observablehq.com/@ssreeni1/picklerick" },
];

const archivedUrls = new Set([
  "https://pain.flights",
  "/collections/when-everything-goes-to-zero",
  "/collections/permanence-is-the-rarest-asset-class",
]);

const datedEntries = [
  ...postSummaries.map(post => ({ title: post.title, date: post.publishedAt, url: `/collections/${post.slug}` })),
  ...externalEntries,
].sort((a, b) => b.date.localeCompare(a.date));

const currentYear = datedEntries[0]?.date.slice(0, 4) ?? "2026";

// Preserve publication dates; archive membership is a separate editorial choice.
export const collectionEntries: readonly CollectionEntry[] = datedEntries.map(entry => ({
  ...entry,
  archived: archivedUrls.has(entry.url) || entry.date.slice(0, 4) !== currentYear,
}));
