# Truth carousel: motion and loading

## Design contract

- Poem opens first; no dots or visible position counter.
- Back stays above. Left/Right are centered below a stable image area, with a
  72–132 px gap (108 px at 1280 × 900; 101 px at 390 × 844).
- Slides move on a native horizontal scroll-snap surface. Touch gestures retain
  browser momentum, vertical page scrolling, and pinch zoom.
- Three identical sets provide neighbouring previews across wraparound. Rebase
  only after scrolling stops; never remount the imagery during a transition.
- Reduced-motion preference disables animated arrow scrolling.
- Offscreen slides are inert and hidden from assistive technology.
- The song's static cover loads with the other images. YouTube mounts only after
  an explicit Play click, and stops when navigating away.

## Validation, 5 September 2026

The visuals skill's continuity and geometry checks informed the stable slide
dimensions, mounted neighbours, and fractional-pixel positioning.

- Desktop 1280 × 900 and mobile 390 × 844: opening state, button and keyboard
  navigation, previous/next wrap, real emulated touch swipes, no page-width
  overflow, no browser runtime errors.
- Inspected light and dark renderings.
- Production HTML, CSS and JS served locally with gzip. Cold browser cache;
  10 Mbps download, 40 ms latency, 4× CPU throttling, mobile viewport and 2× DPR.
- Main content appeared at 372–400 ms in the two theme runs.
- Four consecutive arrow transitions settled in 263–292 ms.
- No YouTube request before Play. All three mobile images arrived by 433 ms.
- Display artwork: 82 KB mobile / 262 KB high-resolution, versus a 3.3 MB original.
  Originals remain available; the carousel uses WebP derivatives.

These are local production-build measurements, not a guarantee for every network,
device, or YouTube playback startup. This pass measured Truth, not the homepage's
3D scene loading. The font loader still downloads all of its generated subsets:
its preload flag did not reduce the measured requests, so that attempted change
was reverted rather than claimed as an optimization.
