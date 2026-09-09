import { getSoundEnabled } from './tts';

// Synthesized via the Web Audio API rather than bundled audio files - no
// licensing, no new assets, no network dependency. Reuses tts.js's mute
// flag through getSoundEnabled() (it's module-private there by design, so
// there's no binding to import directly).
let audioCtx = null;
let suspendTimeoutId = null;

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

// A running AudioContext holds the hardware audio output channel open
// indefinitely, even with nothing currently scheduled - on some mobile
// browsers this contends with (or delays) other audio on the page, most
// relevantly StudySession's delayed auto-pronunciation (speakText, fired
// ~1.5s after a card appears). Suspending releases the channel;
// getAudioContext() above already resumes on the next feedback call - but
// resuming a suspended context is itself a known source of an audible
// pop on several mobile browsers, so this waits for real inactivity
// (SUSPEND_IDLE_MS) rather than suspending right after each tone -
// grading is almost always faster than that gap, so a normal study
// session's back-to-back feedback calls never actually trigger a
// resume(). Debounced against a single pending timeout (not one per
// call) so a fast correct/incorrect/correct burst can't have an earlier
// call's timer suspend the context out from under a later call's still-
// playing tones.
const SUSPEND_IDLE_MS = 3000;

function scheduleSuspend(ctx, endTime) {
  if (suspendTimeoutId) clearTimeout(suspendTimeoutId);
  const delayMs = Math.max(0, (endTime - ctx.currentTime) * 1000) + SUSPEND_IDLE_MS;
  suspendTimeoutId = setTimeout(() => {
    suspendTimeoutId = null;
    if (ctx.state === 'running') ctx.suspend();
  }, delayMs);
}

function playTone(ctx, freq, startTime, duration, peak = 0.15) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.02);
  // A linear ramp all the way to true 0 (not exponentialRampToValueAtTime,
  // which can only approach a small non-zero floor like 0.001) - stopping
  // the oscillator on that leftover amplitude is the classic Web Audio
  // click/pop. Ending on an exact 0 sample means osc.stop() cuts nothing
  // audible. The stop is scheduled a hair after the ramp finishes so
  // there's no race between the two being processed in the same audio
  // quantum.
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
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
  scheduleSuspend(ctx, now + 0.08 + 0.16);
}

export function playIncorrectFeedback() {
  vibrate([30, 40, 30]);
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone(ctx, 180, now, 0.18, 0.12);
  scheduleSuspend(ctx, now + 0.18);
}

// Supersedes playCorrectFeedback on the exact grade that crosses a card
// into "Mastered" - a bigger, distinct moment, not an extra chime on top.
export function playMasteryFeedback() {
  vibrate([20, 40, 20, 40, 80]);
  if (!getSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6 - ascending "ta-da"
  notes.forEach((freq, i) => playTone(ctx, freq, now + i * 0.11, 0.28, 0.16));
  scheduleSuspend(ctx, now + (notes.length - 1) * 0.11 + 0.28);
}
