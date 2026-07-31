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
  assert.match(html, /property="og:title" content="Saneel"/i);
  assert.match(html, /name="twitter:title" content="Saneel"/i);
  assert.match(html, /property="og:image" content="https:\/\/saneel\.xyz\/og\.png"/i);
  assert.match(html, /property="og:image:width" content="1200"/i);
  assert.match(html, /property="og:image:height" content="630"/i);
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
  assert.match(html, /14(?:<!-- -->)? ENTRIES/);
  assert.match(html, /Five Lines to Infinity/);
  assert.match(html, /2026\.07\.30/);
  assert.match(html, /href="\/collections\/five-lines"/);
  assert.match(html, /Tracebase/);
  assert.match(html, /2026\.05\.27/);
  assert.match(
    html,
    /https:\/\/x\.com\/sanlsrni\/status\/2059710155881677025/,
  );
  assert.match(html, /Eternal Atlas/);
  assert.match(html, /2026\.05\.08/);
  assert.match(html, /https:\/\/atlaseternal\.xyz/);
  assert.match(html, /GENESIS Pt\. I/);
  assert.match(html, /href="\/collections\/genesis-i"/);
  assert.match(html, /Permanence Is the Rarest Asset Class/);
  assert.match(
    html,
    /href="\/collections\/permanence-is-the-rarest-asset-class"/,
  );
  assert.match(html, /RICKS Mechanism Analysis/);
  assert.match(html, /https:\/\/observablehq\.com\/@ssreeni1\/picklerick/);
  assert.match(html, /Collection entries/);
  assert.match(html, /Use up and down arrow keys to change selection/);
  assert.match(html, /\[↓\]\s*\[↑\]/);
  assert.doesNotMatch(html, /Investing in early-stage|Products for BTC Miners/);
});

test("serves registered posts as Collection subpages", async () => {
  const response = await render("/collections/five-lines/");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>Five Lines to Infinity — Saneel<\/title>/i);
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/saneel\.xyz\/collections\/five-lines\/"/i,
  );
  assert.match(html, /property="og:type" content="article"/i);
  assert.match(html, /property="article:published_time" content="2026-07-30"/i);
  assert.match(html, /data-post="five-lines"/i);
  assert.match(html, /Home\s*<span>\[H\]<\/span>/);
  assert.match(html, /About\s*<span>\[A\]<\/span>/);
  assert.match(html, /Collection\s*<span>\[C\]<\/span>/);
  assert.match(html, /Back\s*<span>\[B\]<\/span>/);
  assert.match(html, /class="topbar-back"/);
  assert.match(
    html,
    /<span class="title-bracket" aria-hidden="true">\[<\/span>Five<span class="title-bracket" aria-hidden="true">\]<\/span> Lines to Infinity/,
  );
  assert.match(html, /href="\/collection"/);
  assert.match(html, /Two settings changed the apparent frontier/);
  assert.match(html, /The Session You Cannot Take With You/);
  assert.match(html, /post-runtime-five-lines/);
  assert.doesNotMatch(html, /<footer/i);
});

test("preserves lists and clean embeds in imported X articles", async () => {
  const [hyperspeculationResponse, permanenceResponse] = await Promise.all([
    render("/collections/hyperspeculation-genesis-ii/"),
    render("/collections/permanence-is-the-rarest-asset-class/"),
  ]);

  assert.equal(hyperspeculationResponse.status, 200);
  assert.equal(permanenceResponse.status, 200);

  const hyperspeculation = await hyperspeculationResponse.text();
  const permanence = await permanenceResponse.text();

  assert.match(hyperspeculation, /Processing information at unprecedented scale/);
  assert.match(hyperspeculation, /Open environment for incentive engineering/);
  assert.match(hyperspeculation, /<ol><li>/);
  assert.match(hyperspeculation, /--media-width: var\(--article-width\)/);
  assert.match(permanence, /class="imported-embed"/);
  assert.doesNotMatch(permanence, /\d+ (?:reposts|likes|bookmarks|views)/i);
  assert.doesNotMatch(permanence, /<strong>\s*<br>\s*<\/strong>/i);
});

test("exports the complete GitHub Pages artifact", async () => {
  const [home, about, collection, fiveLines] = await Promise.all([
    readFile(new URL("../dist/client/index.html", import.meta.url), "utf8"),
    readFile(
      new URL("../dist/client/about/index.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../dist/client/collection/index.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../dist/client/collections/five-lines/index.html",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(home, /<title>Saneel — Independent Builder<\/title>/);
  assert.match(home, /localStorage\.getItem\("saneel-theme"\)/);
  assert.match(home, /href="https:\/\/saneel\.xyz\/"/);
  assert.match(about, /href="https:\/\/saneel\.xyz\/about\/"/);
  assert.match(collection, /href="https:\/\/saneel\.xyz\/collection\/"/);
  assert.match(
    fiveLines,
    /href="https:\/\/saneel\.xyz\/collections\/five-lines\/"/,
  );
  assert.match(fiveLines, /Five Lines to Infinity/);

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
