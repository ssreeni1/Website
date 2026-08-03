import fiveLinesDocument from "./five_lines/index.html?raw";
import fiveLinesStyles from "./five_lines/styles.css?raw";
import fiveLinesRuntime from "./five_lines/visuals.js?raw";
import importedArticleStyles from "./imported-article.css?raw";
import whenEverythingDocument from "./when-everything-goes-to-zero/index.html?raw";
import hyperspeculationDocument from "./hyperspeculation-genesis-ii/index.html?raw";
import shigetasDreamDocument from "./shigetas-dream/index.html?raw";
import genesisOneDocument from "./genesis-i/index.html?raw";
import hedonistsStoneDocument from "./the-hedonists-stone/index.html?raw";
import speculationDocument from "./speculation-is-dead/index.html?raw";
import buildingTradingDocument from "./building-trading/index.html?raw";
import permanenceDocument from "./permanence-is-the-rarest-asset-class/index.html?raw";
import { writingRoutes } from "./writing-routes";

export type Post = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  document: string;
  styles: string;
  runtime?: string;
};

export type PostSummary = Omit<Post, "document" | "styles" | "runtime">;

function extractBody(document: string) {
  const body = document.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? document;

  return body
    .replace(
      /<script\b[^>]*\bsrc=["'][^"']*visuals\.js[^"']*["'][^>]*><\/script>/gi,
      "",
    )
    .trim();
}

export const posts: readonly Post[] = [
  {
    slug: "five-lines",
    title: "Five Lines to Infinity",
    description: "A brief history of the systems that turned model calls into agents. Model providers will absorb generic harness logic through co-training, but the last mile remains irreducible: the tools, state, permissions, verification, and recovery specific to an enterprise, domain, workflow, or person.",
    publishedAt: "2026-07-30",
    document: extractBody(fiveLinesDocument),
    styles: fiveLinesStyles,
    runtime: fiveLinesRuntime,
  },
  {
    slug: "permanence-is-the-rarest-asset-class",
    title: "Permanence Is the Rarest Asset Class",
    description: "What does the anti-AI portfolio look like? A theory of cultural permanence as an increasingly scarce and valuable asset.",
    publishedAt: "2026-05-12",
    document: extractBody(permanenceDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "when-everything-goes-to-zero",
    title: "when everything goes to 0",
    description: "What is left standing when the cost of software goes to zero?",
    publishedAt: "2026-02-16",
    document: extractBody(whenEverythingDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "hyperspeculation-genesis-ii",
    title: "HYPERSPECUL(A)T(I)ON (GENESIS II)",
    description: "What happens when the greatest game ever played meets infinite intelligence?",
    publishedAt: "2025-09-03",
    document: extractBody(hyperspeculationDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "shigetas-dream",
    title: "Shigeta's Dream: The Gachafication of Everything",
    description: "Ryuzo Shigeta wanted to create a better vending machine. He ended up making every modern consumer application a casino.",
    publishedAt: "2025-08-04",
    document: extractBody(shigetasDreamDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "genesis-i",
    title: "GENESIS Pt. I: What The F*ck Happened to Crypto x AI?",
    description: "The first AI x crypto wave collapsed. A look at what failed, what survived, and where the category goes next.",
    publishedAt: "2025-07-24",
    document: extractBody(genesisOneDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "the-hedonists-stone",
    title: "The Hedonist's Stone",
    description: "What Cluely, OnlyFans, pump.fun, Whop, Zyn, and AG1 reveal about the products people cannot stop consuming.",
    publishedAt: "2025-07-09",
    document: extractBody(hedonistsStoneDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "speculation-is-dead",
    title: "Speculation is Dead, Long Live Speculation",
    description: "Speculation is not dead, but the old ways sure as hell are.",
    publishedAt: "2025-07-03",
    document: extractBody(speculationDocument),
    styles: importedArticleStyles,
  },
  {
    slug: "building-trading",
    title: "Building <-> Trading",
    description: "Why trading and investing can make someone a better builder.",
    publishedAt: "2025-06-20",
    document: extractBody(buildingTradingDocument),
    styles: importedArticleStyles,
  },
] as const;

const duplicateSlug = posts.find(
  (post, index) => posts.findIndex((item) => item.slug === post.slug) !== index,
);

if (duplicateSlug) {
  throw new Error(`Duplicate post slug: ${duplicateSlug.slug}`);
}

const mismatchedWritingRoute = posts.find(
  (post) =>
    !writingRoutes.some(
      (route) => route.slug === post.slug && route.title === post.title,
    ),
);
const staleWritingRoute = writingRoutes.find(
  (route) =>
    !posts.some(
      (post) => post.slug === route.slug && post.title === route.title,
    ),
);

if (mismatchedWritingRoute || staleWritingRoute) {
  throw new Error("Writing routes must match the registered collection posts");
}

for (const post of posts) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    throw new Error(`Invalid post slug: ${post.slug}`);
  }
}

export const postSummaries: readonly PostSummary[] = posts.map(
  ({ slug, title, description, publishedAt }) => ({
    slug,
    title,
    description,
    publishedAt,
  }),
);

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}
