import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  assert.match(html, /<title>Saneel — Independent Builder<\/title>/i);
  assert.match(html, /I build software, interfaces, and systems/);
  assert.match(html, /Formula \/ telemetry/);
  assert.match(
    html,
    /Interactive Formula car replaying recorded Silverstone telemetry/,
  );
  assert.match(html, /DRAG \/ ORBIT · SCROLL \/ ZOOM/);
  assert.match(html, /ANTONELLI #12 \/ SILVERSTONE/);
  assert.match(html, /DATA \/ OPENF1/);
  assert.match(html, /Find\s*<span>\[F\]<\/span>/);
  assert.match(html, /Select backgammon probability visual/);
  assert.doesNotMatch(html, /codex-preview|Building your site|Open menu \[M\]/i);
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
