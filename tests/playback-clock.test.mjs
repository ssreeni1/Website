import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackDelta } from '../app/playback-clock.ts';

test('playback speed advances continuously without jumping the existing playhead', () => {
  let elapsed = 42;
  elapsed += playbackDelta(1 / 60, 4);
  assert.ok(Math.abs(elapsed - (42 + 4 / 60)) < 1e-12);
  elapsed += playbackDelta(1 / 60, 0.25);
  assert.ok(Math.abs(elapsed - (42 + 4.25 / 60)) < 1e-12);
});

test('playback is refresh-rate independent at slow, normal, and fast rates', () => {
  for (const rate of [0.25, 1, 4]) {
    for (const hz of [30, 60, 120, 144]) {
      let elapsed = 0;
      for (let i = 0; i < hz * 30; i++) elapsed += playbackDelta(1 / hz, rate);
      assert.ok(Math.abs(elapsed - 30 * rate) < 1e-8);
    }
  }
});

test('playback bounds suspension gaps and invalid inputs', () => {
  assert.equal(playbackDelta(60, 4), 0.4);
  assert.equal(playbackDelta(-1, 1), 0);
  assert.equal(playbackDelta(NaN, 1), 0);
  assert.equal(playbackDelta(0.1, Infinity), 0.1);
  assert.equal(playbackDelta(0.1, 100), 0.4);
  assert.equal(playbackDelta(0.1, 0), 0.025);
});
