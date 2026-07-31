import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = process.argv[2] ?? "/tmp/x-article-imports";
const projectRoot = process.cwd();

const articles = [
  { slug: "when-everything-goes-to-zero", date: "2026-02-16" },
  { slug: "hyperspeculation-genesis-ii", date: "2025-09-03" },
  { slug: "shigetas-dream", date: "2025-08-04" },
  { slug: "genesis-i", date: "2025-07-24" },
  { slug: "the-hedonists-stone", date: "2025-07-09" },
  { slug: "speculation-is-dead", date: "2025-07-03" },
  { slug: "building-trading", date: "2025-06-20" },
  { slug: "permanence-is-the-rarest-asset-class", date: "2026-05-12" },
];

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const cleanRichHtml = (html) =>
  html
    .replace(/<(strong|em|u)>\s*<br>\s*<\/\1>/gi, "<br>")
    .replace(/<(strong|em|u)>(\s*)<\/\1>/gi, "$2")
    .replace(/<h2><strong>([\s\S]*?)<\/strong><\/h2>/gi, "<h2>$1</h2>")
    .replace(
      /<p class="imported-emphasis"><strong>((?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s[\s\S]*?)<\/strong><\/p>/gi,
      "<h2>$1</h2>",
    )
    .replace(
      /<p class="imported-emphasis"><strong>([\s\S]*?)<\/strong><\/p>/gi,
      '<p class="imported-emphasis">$1</p>',
    )
    .replace(/<h2>\s+/gi, "<h2>")
    .replace(/\s+<\/h2>/gi, "</h2>")
    .replace(/<p>\s*(?:<br>\s*)+/gi, "<p>")
    .replace(/(?:\s*<br>)+\s*<\/p>/gi, "</p>")
    .replace(/(?:<br>\s*){2,}/gi, "<br>")
    .replace(/<p>\s*<\/p>/gi, "");

const formatEmbedText = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/-\s*\n+\s*(@[A-Za-z0-9_]+)/g, "- $1")
    .replace(/(@[A-Za-z0-9_]+)\s*\n+\s*\/\s*\n+\s*(@[A-Za-z0-9_]+)/g, "$1 / $2")
    .replace(/(@[A-Za-z0-9_]+)\s*\n+\s*(\([^\n)]+\))/g, "$1 $2");
  const output = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    output.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const group of normalized.split(/\n{2,}/).filter(Boolean)) {
    const lines = group.split("\n").map((line) => line.trim()).filter(Boolean);
    const prose = [];
    for (const line of lines) {
      if (line.startsWith("- ")) {
        if (prose.length) {
          flushList();
          output.push(`<p>${prose.map(escapeHtml).join("<br>")}</p>`);
          prose.length = 0;
        }
        listItems.push(line.slice(2).trim());
      } else {
        flushList();
        prose.push(line);
      }
    }
    if (prose.length) output.push(`<p>${prose.map(escapeHtml).join("<br>")}</p>`);
  }
  flushList();
  return output.join("");
};

const imageExtension = (url) => {
  const format = new URL(url).searchParams.get("format")?.toLowerCase();
  return format === "png" || format === "webp" ? format : "jpg";
};

const originalSizeUrl = (url) => {
  const parsed = new URL(url);
  parsed.searchParams.set("name", "orig");
  return parsed.href;
};

for (const article of articles) {
  const sourcePath = path.join(sourceDir, `${article.slug}.json`);
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  if (!source.found) throw new Error(`Missing X Article: ${article.slug}`);

  const articleDir = path.join(projectRoot, "content", "posts", article.slug);
  const publicDir = path.join(projectRoot, "public", "collections", article.slug);
  await mkdir(articleDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

  const localImages = new Map();
  let imageNumber = 0;
  const queueImage = async (image, preferredName) => {
    if (!image?.src) return null;
    if (localImages.has(image.src)) return localImages.get(image.src);

    imageNumber += 1;
    const extension = imageExtension(image.src);
    const fileName = `${preferredName ?? `image-${String(imageNumber).padStart(2, "0")}`}.${extension}`;
    const publicPath = `/collections/${article.slug}/${fileName}`;
    const response = await fetch(originalSizeUrl(image.src));
    if (!response.ok) {
      throw new Error(`Could not download ${image.src}: ${response.status}`);
    }
    await writeFile(path.join(publicDir, fileName), Buffer.from(await response.arrayBuffer()));
    localImages.set(image.src, publicPath);
    return publicPath;
  };

  const coverPath = await queueImage(source.cover, "cover");
  for (const block of source.blocks) {
    for (const image of block.images ?? []) await queueImage(image);
  }

  const body = [];
  for (const block of source.blocks) {
    if (block.type === "html") {
      body.push(`<div class="imported-prose">${cleanRichHtml(block.html)}</div>`);
    } else if (block.type === "text") {
      body.push(`<div class="imported-prose">${cleanRichHtml(block.html)}</div>`);
    } else if (block.type === "separator") {
      body.push('<hr class="imported-rule" aria-hidden="true">');
    } else if (block.type === "media") {
      for (const image of block.images) {
        const src = localImages.get(image.src);
        body.push(`<figure class="imported-media"><img src="${src}" alt="${escapeHtml(image.alt || "Article image")}" loading="lazy"${image.width ? ` width="${image.width}"` : ""}${image.height ? ` height="${image.height}"` : ""}></figure>`);
      }
    } else if (block.type === "embed") {
      const embeddedImages = (block.images ?? [])
        .map((image) => `<img src="${localImages.get(image.src)}" alt="${escapeHtml(image.alt || "Embedded post image")}" loading="lazy">`)
        .join("");
      body.push(`<blockquote class="imported-embed">
        <header><strong>${escapeHtml(block.byline || "Post on X")}</strong>${block.href ? `<a href="${escapeHtml(block.href)}" target="_blank" rel="noreferrer">${escapeHtml(block.date || "View on X")} ↗</a>` : ""}</header>
        ${formatEmbedText(block.text)}
${embeddedImages ? `        ${embeddedImages}\n` : ""}
      </blockquote>`);
    }
  }

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${article.date}T00:00:00Z`));

  const document = `<article class="imported-article">
  <header class="imported-header">
    <div class="imported-meta"><span>ESSAY</span><time datetime="${article.date}">${formattedDate}</time></div>
    <h1>${escapeHtml(source.title)}</h1>
    <a class="imported-origin" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">Originally published on X ↗</a>
  </header>
  ${coverPath ? `<figure class="imported-cover"><img src="${coverPath}" alt="Cover for ${escapeHtml(source.title)}" width="${source.cover.width}" height="${source.cover.height}"></figure>` : ""}
  <section class="imported-body">
    ${body.join("\n    ")}
  </section>
</article>`;

  await writeFile(path.join(articleDir, "index.html"), `${document}\n`);
  console.log(`Imported ${article.slug}: ${source.blocks.length} blocks, ${imageNumber} images`);
}
