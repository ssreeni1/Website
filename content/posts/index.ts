import fiveLinesDocument from "./five_lines/index.html?raw";
import fiveLinesStyles from "./five_lines/styles.css?raw";
import fiveLinesRuntime from "./five_lines/visuals.js?raw";

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
    description: "A brief on harness history and where we're going.",
    publishedAt: "2026-07-30",
    document: extractBody(fiveLinesDocument),
    styles: fiveLinesStyles,
    runtime: fiveLinesRuntime,
  },
] as const;

const duplicateSlug = posts.find(
  (post, index) => posts.findIndex((item) => item.slug === post.slug) !== index,
);

if (duplicateSlug) {
  throw new Error(`Duplicate post slug: ${duplicateSlug.slug}`);
}

for (const post of posts) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) {
    throw new Error(`Invalid post slug: ${post.slug}`);
  }
}

export const postSummaries: readonly PostSummary[] = posts.map(
  ({ document: _document, styles: _styles, runtime: _runtime, ...summary }) =>
    summary,
);

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}
