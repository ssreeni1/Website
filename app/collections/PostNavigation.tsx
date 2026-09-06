"use client";

import { memo, useEffect, useMemo, useRef } from "react";

/** Reinitialize imported essays on every client visit, and release observers
 * when leaving. A once-per-document script cannot handle SPA return visits. */
export const PostNavigation = memo(function PostNavigation({ slug, html }: { slug: string; html: string }) {
  const articleRef = useRef<HTMLDivElement>(null);
  // Hash/history updates must not replace the enhanced DOM with the raw HTML.
  const documentHtml = useMemo(() => ({ __html: html }), [html]);
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const links = [...article.querySelectorAll<HTMLAnchorElement>(".article-toc a[data-section]")];
    const sections = links.map(link => article.querySelector<HTMLElement>(`#${link.dataset.section}`)).filter((section): section is HTMLElement => section !== null);
    const select = (id: string) => {
      for (const link of links) {
        if (link.dataset.section === id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    };
    const click = (event: Event) => select((event.currentTarget as HTMLElement).dataset.section!);
    links.forEach(link => link.addEventListener("click", click));
    const visible = new Map<string, number>();
    const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
        else visible.delete(entry.target.id);
      }
      const current = [...visible].sort((a, b) => Math.abs(a[1] - 96) - Math.abs(b[1] - 96))[0];
      if (current) select(current[0]);
    }, { rootMargin: "-72px 0px -58% 0px", threshold: [0, 0.05, 0.2] }) : null;
    sections.forEach(section => observer?.observe(section));
    return () => {
      observer?.disconnect();
      links.forEach(link => link.removeEventListener("click", click));
    };
  }, [slug]);
  return <div ref={articleRef} className="post-document" data-post={slug} dangerouslySetInnerHTML={documentHtml} />;
});
