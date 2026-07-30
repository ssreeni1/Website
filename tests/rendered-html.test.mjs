import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the personal site shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*data-theme="dark"/i);
  assert.match(html, /<title>Saneel — Independent Builder<\/title>/i);
  assert.doesNotMatch(html, /I build software, interfaces, and systems/);
  assert.doesNotMatch(html, /Formula \/ telemetry/);
  assert.match(
    html,
    /Interactive five-turn backgammon simulation with exact state analysis/,
  );
  assert.match(html, /DRAG \/ ORBIT · SCROLL \/ ZOOM/);
  assert.match(html, /PIP COUNT \/ EXACT BOARD STATE/);
  assert.match(html, /Live dice roll/);
  assert.doesNotMatch(html, />SILVERSTONE<\/strong>/);
  assert.doesNotMatch(html, /ANTONELLI #12/);
  assert.match(html, /Saneel Sreeni/);
  assert.match(html, /Home\s*<span>\[H\]<\/span>/);
  assert.match(html, /About\s*<span>\[A\]<\/span>/);
  assert.match(html, /Collection\s*<span>\[C\]<\/span>/);
  assert.match(html, /Find\s*<span>\[F\]<\/span>/);
  assert.match(html, /Vibe\s*<span>\[V\]<\/span>/);
  assert.match(html, />Home<\/span>\s*<i>\/<\/i>/);
  assert.match(html, />About<\/span>\s*<i>\/about<\/i>/);
  assert.match(html, />Collection<\/span>\s*<i>\/collection<\/i>/);
  assert.doesNotMatch(html, />Formula system<\/span>/);
  assert.match(html, /Select backgammon probability visual/);
  assert.match(
    html,
    /Select backgammon probability visual[\s\S]*Select Formula telemetry visual[\s\S]*Select symbol topology visual/,
  );
  assert.match(html, /Select symbol topology visual/);
  assert.match(html, /Show previous visual: symbol topology/);
  assert.match(html, /Show next visual: Formula telemetry/);
  assert.match(html, /PEACE IN VARIANCE/);
  assert.doesNotMatch(html, /codex-preview|Building your site|Open menu \[M\]/i);
});

test("serves the linked About page", async () => {
  for (const path of ["/about/"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<title>About — Saneel Sreeni<\/title>/i);
    assert.match(html, /Saneel Sreeni/);
    assert.match(html, /frontier agentic systems/);
    assert.match(html, /My work spans both legacy/);
    assert.doesNotMatch(html, /My work there spans/);
    assert.match(html, /an assortment of investing\/data science/);
    assert.match(html, /https:\/\/ritual\.net/);
    assert.match(html, /https:\/\/accomplice\.co/);
    assert.match(html, /https:\/\/met\.berkeley\.edu\//);
    assert.match(
      html,
      /https:\/\/x\.com\/sanlsrni\/status\/2054306602849652752/,
    );
    assert.match(html, /https:\/\/center\.study\//);
    assert.match(html, /https:\/\/x\.com\/sanlsrni/);
    assert.match(html, /https:\/\/www\.linkedin\.com\/in\/snlsrn\//);
    assert.match(html, /Home\s*<span>\[H\]<\/span>/);
    assert.match(html, /About\s*<span>\[A\]<\/span>/);
    assert.match(html, /Collection\s*<span>\[C\]<\/span>/);
    assert.doesNotMatch(html, /Interactive Formula car/);
  }
});

test("serves the linked Collection archive without descriptions", async () => {
  const response = await render("/collection/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Collection — Saneel Sreeni<\/title>/i);
  assert.match(html, /12(?:<!-- -->)? ENTRIES/);
  assert.match(html, /Tracebase/);
  assert.match(html, /2026\.05\.27/);
  assert.match(
    html,
    /https:\/\/x\.com\/sanlsrni\/status\/2059710155881677025/,
  );
  assert.match(html, /Eternal Atlas/);
  assert.match(html, /2026\.05\.08/);
  assert.match(html, /https:\/\/atlaseternal\.xyz/);
  assert.match(html, /GENESIS I/);
  assert.doesNotMatch(html, /GENESIS Pt\. I/);
  assert.match(html, /RICKS Mechanism Analysis/);
  assert.match(html, /https:\/\/observablehq\.com\/@ssreeni1\/picklerick/);
  assert.match(html, /Collection entries/);
  assert.match(html, /Use up and down arrow keys to change selection/);
  assert.match(html, /\[↓\]\s*\[↑\]/);
  assert.doesNotMatch(html, /Investing in early-stage|Products for BTC Miners/);
});

test("exports the complete GitHub Pages artifact", async () => {
  const [home, about, collection] = await Promise.all([
    readFile(new URL("../dist/client/index.html", import.meta.url), "utf8"),
    readFile(
      new URL("../dist/client/about/index.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../dist/client/collection/index.html", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(home, /<title>Saneel — Independent Builder<\/title>/);
  assert.match(home, /localStorage\.getItem\("saneel-theme"\)/);
  assert.match(home, /href="https:\/\/saneel\.xyz\/"/);
  assert.match(about, /href="https:\/\/saneel\.xyz\/about\/"/);
  assert.match(collection, /href="https:\/\/saneel\.xyz\/collection\/"/);

  const assetDirectory = new URL("../dist/client/assets/", import.meta.url);
  const assetNames = await readdir(assetDirectory);
  const [styles, scripts] = await Promise.all([
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".css"))
        .map((name) => readFile(new URL(name, assetDirectory), "utf8")),
    ),
    Promise.all(
      assetNames
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFile(new URL(name, assetDirectory), "utf8")),
    ),
  ]);
  assert.match(styles.join("\n"), /data-theme=dark/);
  assert.match(styles.join("\n"), /prefers-color-scheme:\s*dark/);
  assert.match(scripts.join("\n"), /site-themechange/);
});

test("ships bounded model assets and recorded telemetry", async () => {
  const modelUrl = new URL("../public/models/formula1.glb", import.meta.url);
  const telemetryUrl = new URL(
    "../public/data/silverstone-antonelli-l18.json",
    import.meta.url,
  );
  const attributionUrl = new URL(
    "../public/models/ATTRIBUTION.md",
    import.meta.url,
  );
  const [modelStats, telemetryRaw, attribution] = await Promise.all([
    stat(modelUrl),
    readFile(telemetryUrl, "utf8"),
    readFile(attributionUrl, "utf8"),
  ]);

  assert.ok(modelStats.size > 1_000_000);
  assert.ok(modelStats.size < 3_000_000);

  const telemetry = JSON.parse(telemetryRaw);
  assert.equal(telemetry.source.name, "OpenF1");
  assert.equal(telemetry.source.sessionKey, 11322);
  assert.equal(telemetry.source.driverNumber, 12);
  assert.equal(telemetry.source.lap, 18);
  assert.equal(telemetry.source.lapDurationMs, 88111);
  assert.equal(telemetry.source.replayRate, 4);
  assert.equal(telemetry.car.length, 333);
  assert.equal(telemetry.location.length, 339);
  assert.equal(Math.min(...telemetry.car.map((sample) => sample.gear)), 2);
  assert.equal(Math.max(...telemetry.car.map((sample) => sample.gear)), 8);
  assert.match(attribution, /dark_igorek/i);
  assert.match(attribution, /Creative Commons Attribution 4\.0/i);
});
