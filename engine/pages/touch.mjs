// Touch control for phones and tablets. The page handles every touch on the
// game itself and gives ScummVM mouse events and keys, so ScummVM's own touch
// handling never runs and the two cannot disagree.
//
//   tap                     left click where the finger was
//   drag                    moves the pointer (what it points at lights up);
//                           lifting the finger does not click
//   hold still (0.5 s)      right click
//   two fingers             the game's menu (F5)
//   three fingers           skip a scene (Esc)
//
// The screen is never turned; the page follows how the phone is held.

export const HOLD_MS = 500;
export const MOVE_PX = 12;

// The gestures without the browser around them, so they can be tested.
// out: {move(x, y), click(x, y, button), key(name), hold()}
export class TouchGestures {
  // Timers are wrapped: setTimeout called as a method of this object is an illegal invocation
  constructor(out, {setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id)} = {}) {
    this.out = out;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.reset();
  }

  reset() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
    this.state = null;
  }

  // touches: [{x, y}] for the fingers on the screen now
  start(touches) {
    if (!this.state) {
      const {x, y} = touches[0];
      this.state = {x0: x, y0: y, x, y, fingers: touches.length, moved: false, held: false};
      this.out.move(x, y);
    }
    this.state.fingers = Math.max(this.state.fingers, touches.length);
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
    if (this.state.fingers === 1) {
      this.timer = this.setTimer(() => {
        this.timer = null;
        const s = this.state;
        if (!s || s.fingers !== 1 || s.moved) return;
        s.held = true;
        this.out.hold?.();
        this.out.click(s.x, s.y, 2);
      }, HOLD_MS);
    }
  }

  move(touches) {
    const s = this.state;
    if (!s || s.fingers !== 1 || touches.length !== 1) return;
    s.x = touches[0].x;
    s.y = touches[0].y;
    if (!s.moved && Math.hypot(s.x - s.x0, s.y - s.y0) > MOVE_PX) {
      s.moved = true;
      if (this.timer) this.clearTimer(this.timer);
      this.timer = null;
    }
    if (s.moved) this.out.move(s.x, s.y);
  }

  // remaining: how many fingers are still on the screen
  end(remaining) {
    const s = this.state;
    if (!s || remaining > 0) return;
    if (s.fingers >= 3) this.out.key('Escape');
    else if (s.fingers === 2) this.out.key('F5');
    else if (!s.moved && !s.held) this.out.click(s.x, s.y, 0);
    this.reset();
  }
}

// Hooks the gestures to the game's canvas. sendKey(name) presses a key.
export function attachTouch(canvas, sendKey) {
  const mouse = (type, x, y, button) => canvas.dispatchEvent(new MouseEvent(type, {
    clientX: x, clientY: y, screenX: x, screenY: y, button,
    buttons: type === 'mousedown' ? (button === 2 ? 2 : 1) : 0,
    bubbles: true, cancelable: true, view: window
  }));
  const gestures = new TouchGestures({
    move: (x, y) => mouse('mousemove', x, y, 0),
    click: (x, y, button) => {
      mouse('mousemove', x, y, 0);
      mouse('mousedown', x, y, button);
      // The game looks at the button once per frame; let it stay down for one
      setTimeout(() => mouse('mouseup', x, y, button), 80);
    },
    key: sendKey,
    hold: () => navigator.vibrate?.(15)
  });
  const points = list => [...list].map(t => ({x: t.clientX, y: t.clientY}));
  const mine = event => event.target === canvas;

  // Capture on window: runs before ScummVM's own listeners on the canvas, which
  // then never see the touch
  const options = {capture: true, passive: false};
  window.addEventListener('touchstart', event => {
    if (!mine(event)) return;
    event.preventDefault();
    event.stopPropagation();
    canvas.focus();
    gestures.start(points(event.touches));
  }, options);
  window.addEventListener('touchmove', event => {
    if (!mine(event)) return;
    event.preventDefault();
    event.stopPropagation();
    gestures.move(points(event.touches));
  }, options);
  for (const type of ['touchend', 'touchcancel']) {
    window.addEventListener(type, event => {
      if (!mine(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (type === 'touchcancel') gestures.reset();
      else gestures.end(event.touches.length);
      // On a phone the game gets the whole screen at the first touch (not turned)
      if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen({navigationUI: 'hide'}).catch(() => {});
      }
    }, options);
  }
  // Pointer events for touch would reach ScummVM too
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    window.addEventListener(type, event => {
      if (mine(event) && event.pointerType === 'touch') event.stopPropagation();
    }, {capture: true});
  }
  return gestures;
}
