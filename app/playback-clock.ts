/** Advance only the next frame, never rescale the accumulated playhead. */
export function playbackDelta(seconds: number, rate: number) {
  const dt = Number.isFinite(seconds) ? Math.min(0.1, Math.max(0, seconds)) : 0;
  const speed = Number.isFinite(rate) ? Math.min(4, Math.max(0.25, rate)) : 1;
  return dt * speed;
}
