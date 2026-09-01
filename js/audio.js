/*
 * audio.js — plays a single background music file (theme.mp3, expected at
 * the repo root next to index.html). No Tone.js dependency needed for this
 * version. Same public interface as before (init/setEnabled/isStarted) so
 * main.js doesn't need to change: silent until init() is called from a user
 * gesture, toggled on/off via setEnabled(), and nothing persists across a
 * page reload — a fresh load always starts silent until "Enter Orbit" is
 * clicked again.
 */

const AUDIO = (() => {
  let started = false;
  let el = null;
  let fadeTimer = null;
  const TARGET_VOLUME = 0.8;

  function build() {
    el = new Audio('theme.mp3');
    el.loop = true;
    el.volume = 0;
    el.preload = 'auto';
  }

  function fadeTo(target, ms) {
    if (!el) return;
    if (fadeTimer) clearInterval(fadeTimer);
    const start = el.volume;
    const t0 = performance.now();
    fadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      el.volume = start + (target - start) * t;
      if (t >= 1) {
        clearInterval(fadeTimer);
        if (target === 0) el.pause();
      }
    }, 40);
  }

  return {
    async init() {
      if (started) return;
      build();
      started = true;
    },
    setEnabled(on) {
      if (!started || !el) return;
      if (on) {
        el.play().catch(() => {});
        fadeTo(TARGET_VOLUME, 1200);
      } else {
        fadeTo(0, 900);
      }
    },
    isStarted() { return started; }
  };
})();
