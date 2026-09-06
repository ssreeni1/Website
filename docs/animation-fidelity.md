# Landing simulation contract

Keep the site's restrained, red-accented schematic language. Depth comes from
geometry, occlusion, restrained lighting, and coherent movement—not a glossy
rendering style. Fade viewport boundaries gently along their edges; do not add
a circular vignette or cover the telemetry with a mask.

## Backgammon

- A deterministic exhibition game (seed 5), from the standard opening through
  65 legal turns to a single-game victory. Move selection is heuristic, not
  expert or optimal play. Rules reference: https://usbgf.org/backgammon-basics-how-to-play/
- The engine enforces bar priority, blocked points, hits, maximum dice use,
  higher-die priority, four moves for doubles, and legal bearing off.
- Checker identities persist. Take the last checker in a stack; move a hit blot
  to its bar before the arriving checker lands. Reserve separate bar/off slots.
- One playhead drives dice, checker moves, and displayed state. Changing speed
  changes the clock's rate, never its position. Pause and restart are explicit.
- The slow endpoint budgets 12 seconds per turn; it is a presentation pace,
  not a recording of human thought time. The fast endpoint completes the entire
  cycle, including a brief winner hold, in 30 seconds.
- At very high speed, reduce dice revolutions to prevent temporal aliasing.
  Geometry still interpolates continuously and settles on the displayed result.
- Pip counts and topology describe the rendered position. Dice probability is
  exact for an unordered outcome: 2/36 ordinarily, 1/36 for doubles; opening
  doubles are excluded, giving 2/30. These are not win probabilities.

## Formula

- The current W14 interpretation by 3dblender_1 is CC BY 4.0; see
  public/models/ATTRIBUTION.md. It is an artist model, not manufacturer CAD.
  Sponsor decal planes are removed before schematic materials are applied.
- OpenF1 XY data informs the road reconstruction. Track width, kerbs and verges
  are illustrative, not surveyed. The road and racing trajectory are separate.
- A periodic C2 cubic B-spline keeps position, tangent and curvature continuous.
  Road triangles are spaced approximately 0.65m apart, independent of timestamps.
- A bounded minimum-curvature solve places the racing line within a 6m offset
  corridor, leaving clearance for the 2m-wide model inside the 15m-wide road.
  It is an approximation, not a globally optimal minimum-lap-time solution.
- Speed follows a modeled lateral-grip envelope and cyclic acceleration/braking
  constraints. Red on the guide means modeled braking. Speed, gear, RPM, throttle
  and braking are explicitly SIM, not mislabeled OpenF1 recordings. The nominal
  eight-speed drivetrain is illustrative, not a calibrated W14 powertrain.
- Wheel steering uses separate hub pivots and inner/outer steering angles.
  Spin follows traveled distance. Parent wheel transforms also own highlights.
- Wheel yaw is derived directly from the continuous curve, without a second
  delayed steering filter. Tire contours come from the actual tire mesh; do not
  exaggerate steering angles or add detached wheel overlays for visibility.
- Bake nonuniform GLTF transforms before rigging; account for the loader's node
  name sanitization. Upright deflectors steer but do not spin with the tires.
- Physical pose follows the curve directly. Camera bearing trails independently
  so the camera does not visually cancel the car's cornering.
- Chassis pitch/roll and brake temperatures are illustrative responses, not a
  full tire, suspension, aero, or thermal solver. Do not label them recorded.
- Keep tire contact fixed; never tilt the complete car rig for body movement.
- Rendering is an unlit technical drawing: fine model contours, subtly masked
  faces, outlined road rails, and no asphalt grain, filled verges, or cast shadows.
  This does not change the model geometry, trajectory, steering, or drivetrain.
- The red scan is evaluated on the actual world-space model edges, including
  articulated wheels. There is no floating scan panel. The racing guide starts
  beyond the nose so it does not cut through the X-ray chassis; its braking
  colors sample the same lookahead as its positions.

## Symbols

- The backdrop remains a 26³ point lattice. The authored figures use independent
  continuous geometry: 160 paths × 64 vertices, with 10,080 connecting edges.
  Do not claim the figure vertices are snapped to the backdrop lattice.
- The backdrop has no enclosing cube outline; the figures remain visually open.
- Phoenix: distinct head, beak, neck, torso, separated feathers and tail.
  Ouroboros: volumetric serpent, scales, and explicit mouth-to-tail connection.
  Gandiva: interpreted recurved bow, string, nock and arrow—not an artifact scan.
- Every form shares the same correspondence topology. Smooth staggered morphs
  must reach every target vertex before the resolved hold starts.
- Geometric telemetry is computed from the current rendered positions. Closed
  paths require coincident endpoints, not merely endpoints within a grid cell.

## Checks

Contrast is scene-wide, not just an F1 adjustment. Essential contours, checker
rings, dice borders, and symbol lines stay visible in both themes; background
lattices stay subordinate. Canvas red is deeper on light paper. Symbol points
account for the renderer's capped pixel density and convert linear color to sRGB.
Check the resolved symbols and morphs at desktop and mobile sizes in both themes.
The guide reuses point buffers and samples positions/braking once per point.
Scan and brake fades use elapsed-time damping; hidden documents skip rendering.

`npm test` builds the site and runs rendered-route and simulation tests.
`npm run lint` checks source. Browser checks additionally cover the entire fast
game, pause/restart/speed interaction, camera orbit, all three resolved forms,
dark/light themes, desktop/mobile overflow, and console errors. Headless timing
is diagnostic only; it does not guarantee a frame rate on every device.
