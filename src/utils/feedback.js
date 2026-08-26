import { getSoundEnabled } from './tts';

// Synthesized via the Web Audio API rather than bundled audio files - no
// licensing, no new assets, no network dependency. Reuses tts.js's mute
// flag through getSoundEnabled() (it's module-private there by design, so
// there's no binding to import directly).
let audioCtx = null;

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  // Browsers suspend a freshly-created context until a user gesture -
  // every caller here only ever runs inside a real gesture handler
  // (swipe release, quiz tap), so resuming is always safe.
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(ctx, freq, startTime, duration, peak = 0.15) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Deliberately not gated by the sound mute toggle - vibration is silent to
// everyone nearby regardless, and gracefully no-ops on platforms that never
// implemented the Vibration API (iOS Safari/WebKit, notably).
function vibrate(pattern) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

export function playCorrectFeedback() {
  vibrate(20);
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 880, now, 0.12); // A5
  playTone(ctx, 1318.5, now + 0.08, 0.16); // E6
}

export function playIncorrectFeedback() {
  vibrate([30, 40, 30]);
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 180, ctx.currentTime, 0.18, 0.12);
}

// Supersedes playCorrectFeedback on the exact grade that crosses a card
// into "Mastered" - a bigger, distinct moment, not an extra chime on top.
export function playMasteryFeedback() {
  vibrate([20, 40, 20, 40, 80]);
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => // C5 E5 G5 C6 - ascending "ta-da"
    playTone(ctx, freq, now + i * 0.11, 0.28, 0.16)
  );
}
