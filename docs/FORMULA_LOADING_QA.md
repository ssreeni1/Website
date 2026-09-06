# Formula startup optimization

## What changed

- A prepared model replaces the original 7,422,004-byte GLB on the visitor's
  loading path. The gzip transfer is 1,164,666 bytes (84.3% smaller).
- The original asset remains checked in for attribution, regeneration, and tests.
- Every rendered mesh, vertex, triangle, hub transform, and contour is retained.
  Positions have at most 0.01 mm per-axis rounding; wheel normals use high-precision
  octahedral encoding. No mesh simplification or reduced-detail model is used.
- Structural outlines reference their mesh's own vertices. Unused textures, UVs,
  sponsor decals, and normals for unlit body materials are omitted.
- Geometry transforms, wheel rigging, outline extraction, and the 3,200-iteration
  racing-line solve run in the asset compiler, not during visitor startup.
- The original continuous path evaluator and physics remain in use. Prepared
  offsets give exactly equal road samples, lap duration, and sampled motion.
- A low-priority home-page preload starts the download alongside the page.
  Immutable decoded data and the prepared path are cached across scene/theme
  changes. Individual scenes own their GPU wrappers and dispose them normally.
- Switching away while loading cannot attach a stale car to a newer scene.
  Failed loads clear their promise cache, allowing the next visit to retry.
- Browsers without DecompressionStream use the uncompressed runtime asset.

Regenerate with `npm run prepare:formula`. Normal builds use checked-in assets.
If the source model or lap changes, regenerate and run the geometry/motion tests.

## Measured startup

5 September 2026. Local production build served with gzip for HTML/JS/CSS,
Chromium, cold browser context, 10 Mbps download and 40 ms latency. Desktop:
1440 × 1000; mobile: 390 × 844, 2× DPR and 4× CPU throttling.

| Selection | Original desktop | Original mobile | Optimized desktop | Optimized mobile |
| --- | ---: | ---: | ---: | ---: |
| Immediate first click | 6,461 ms | 7,569 ms | 928 ms | 848 ms |
| Return to car | 6,435 ms | 7,560 ms | 103 ms | 223 ms |

Original measurements waited for the home page to finish loading; the optimized
immediate-click test deliberately clicked as soon as the initial canvas mounted,
before the preload finished. Timings include selection, model setup, and two
animation frames after readiness. Cold full-page navigation time is separate.
These are measured examples, not a subsecond guarantee on every network/device.

## Validation

The visuals skill's geometry, causality, and continuity gates informed this pass.

- Compare all vertex positions, every triangle (including winding), every outline,
  body bounds, materials/semantic metadata, and wheel rig against the source.
- Compare prepared racing motion to the original solver over a complete lap,
  including times just before and after the wrap.
- Browser checks: desktop/mobile, light/dark, orbit, zoom/reset, scan, turns,
  reduced motion, repeated mode/theme switching, and switch-away during loading.
- Watched an uninterrupted 90-second run through the lap seam; the final readout
  wrapped smoothly to 00:02.502 with no browser runtime errors.
- Normal clients fetch the model once across repeated selections/theme changes.
  The older-browser uncompressed fallback also renders successfully.
- Production build and 21 regression tests pass; scoped TypeScript and ESLint pass.
  The whole-workspace type check remains blocked by existing errors in the
  unrelated local astra project and Worker environment types.
