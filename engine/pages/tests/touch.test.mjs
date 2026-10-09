import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchGestures, HOLD_MS} from '../touch.mjs';

// Timers by hand: fire() runs the pending timer as if the time had passed
function setup() {
  const log = [];
  let pending = null;
  const g = new TouchGestures({
    move: (x, y) => log.push(['move', x, y]),
    click: (x, y, b) => log.push(['click', x, y, b]),
    key: name => log.push(['key', name])
  }, {setTimer: (fn, ms) => { pending = {fn, ms}; return 1; }, clearTimer: () => { pending = null; }});
  return {g, log, fire: () => { const p = pending; pending = null; p?.fn(); return p?.ms; }};
}

test('a tap is a left click where the finger was', () => {
  const {g, log} = setup();
  g.start([{x: 100, y: 50}]);
  g.move([{x: 104, y: 52}]);
  g.end(0);
  assert.deepEqual(log, [['move', 100, 50], ['click', 104, 52, 0]]);
});

test('a drag moves the pointer and does not click', () => {
  const {g, log, fire} = setup();
  g.start([{x: 100, y: 50}]);
  g.move([{x: 140, y: 50}]);
  g.move([{x: 180, y: 60}]);
  assert.equal(fire(), undefined);  // no hold after moving
  g.end(0);
  assert.deepEqual(log, [['move', 100, 50], ['move', 140, 50], ['move', 180, 60]]);
});

test('holding still is a right click, and lifting the finger does nothing more', () => {
  const {g, log, fire} = setup();
  g.start([{x: 30, y: 40}]);
  assert.equal(fire(), HOLD_MS);
  g.end(0);
  assert.deepEqual(log, [['move', 30, 40], ['click', 30, 40, 2]]);
});

test('two fingers open the menu, three skip a scene, with no clicks', () => {
  for (const [n, key] of [[2, 'F5'], [3, 'Escape']]) {
    const {g, log, fire} = setup();
    const fingers = Array.from({length: n}, (_, i) => ({x: 10 + i * 50, y: 10}));
    for (let i = 1; i <= n; i++) g.start(fingers.slice(0, i));
    assert.equal(fire(), undefined);  // no hold with more than one finger
    for (let i = n - 1; i >= 0; i--) g.end(i);
    assert.deepEqual(log, [['move', 10, 10], ['key', key]]);
  }
});
