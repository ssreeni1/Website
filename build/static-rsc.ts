import type { Plugin } from "vite";

/** Adapt Vinext 0.0.50's client router to static exports: index.rsc for Home,
 * and GitHub Pages' application/octet-stream MIME type for .rsc files.
 * Keep dev's live endpoints and the server implementation intact. */
export function staticRscRoot(): Plugin {
  return {
    name: "static-rsc-root",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (this.environment.name !== "client") return;
      const path = id.replaceAll("\\", "/");
      if (path.endsWith("/vinext/dist/server/app-browser-entry.js")) {
        const initial = 'contentType.startsWith("text/x-component")';
        const navigation = '(navResponse.headers.get("content-type") ?? "").startsWith("text/x-component")';
        if (!code.includes(initial) || !code.includes(navigation)) throw new Error("Vinext response handling changed; recheck static RSC MIME compatibility.");
        const helper = `function __saneelRscType(contentType, responseUrl) {
          if (contentType.startsWith("text/x-component")) return true;
          if (contentType.split(";")[0].trim() !== "application/octet-stream") return false;
          try {
            const url = new URL(responseUrl, window.location.href);
            return url.origin === window.location.origin && url.pathname.endsWith(".rsc");
          } catch { return false; }
        }\n`;
        return { code: helper + code
          .replace(initial, '__saneelRscType(contentType, rscResponse.url)')
          .replace(navigation, '__saneelRscType(navResponse.headers.get("content-type") ?? "", navResponseUrl || navResponse.url || rscUrl)'), map: null };
      }
      if (!path.endsWith("/vinext/dist/server/app-rsc-cache-busting.js")) return;
      const original = 'pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname';
      if (!code.includes(original)) throw new Error("Vinext RSC URL implementation changed; recheck the static Home navigation fix.");
      return { code: code.replace(original, `pathname === "/" ? "/index" : ${original}`), map: null };
    },
  };
}
