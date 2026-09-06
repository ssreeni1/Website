import type { Plugin } from "vite";

/** Vinext 0.0.50 exports the root payload as index.rsc but its browser router
 * requests .rsc. Correct the client URL at build time; no server rewrite or
 * hidden file is needed on GitHub Pages. Keep dev's live RSC endpoint intact. */
export function staticRscRoot(): Plugin {
  return {
    name: "static-rsc-root",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (this.environment.name !== "client" || !id.replaceAll("\\", "/").endsWith("/vinext/dist/server/app-rsc-cache-busting.js")) return;
      const original = 'pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname';
      if (!code.includes(original)) throw new Error("Vinext RSC URL implementation changed; recheck the static Home navigation fix.");
      return { code: code.replace(original, `pathname === "/" ? "/index" : ${original}`), map: null };
    },
  };
}
