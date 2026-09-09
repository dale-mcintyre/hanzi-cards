const SOUND_ENABLED_KEY = 'hz_sound_enabled';

function readSoundEnabled() {
  try {
    const saved = localStorage.getItem(SOUND_ENABLED_KEY);
    return saved === null ? true : saved === 'true'; // default on
  } catch {
    return true;
  }
}

let soundEnabled = readSoundEnabled();

export function getSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage unavailable - in-memory flag still applies this session
  }
}

const MIN_RATE = 0.9;
const MAX_RATE = 1.0;
const DEFAULT_RATE = 0.9; // Slightly slower for language learners, within the clamp below

function clampRate(rate) {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/** Prefers an on-device zh-CN voice (localService === true) over a
 * network-backed one - remote voices add latency and are more prone to
 * dropped/garbled playback on mobile, especially right after a cancel(),
 * which is exactly the pattern speakText uses on every call. Falls back
 * to any zh-CN voice, then any zh-* voice, so playback still works on a
 * device with no local Chinese voice installed rather than going silent. */
function pickVoice(voices) {
  return (
    voices.find((v) => v.lang === 'zh-CN' && v.localService) ||
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang.startsWith('zh')) ||
    null
  );
}

/** Safe, cross-browser Web Speech API wrapper for Mandarin (zh-CN).
 * Gated on the mute flag here, not at each call site, so every caller
 * (auto-play, flip, the manual replay buttons) automatically respects it -
 * no risk of a call site forgetting to check. */
export function speakText(text) {
  if (!soundEnabled) return;

  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  // Cancel any in-flight utterance first, so rapid successive calls (flip
  // then immediately tap the replay button, or swiping past a card whose
  // delayed auto-play just fired) never stack. On several mobile browsers,
  // calling speak() in the very same tick as cancel() can silently drop
  // the new utterance instead of replacing the old one (a known
  // speechSynthesis race, not specific to this app) - deferring the
  // speak() one tick gives the cancellation time to actually land first.
  window.speechSynthesis.cancel();

  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = clampRate(DEFAULT_RATE);

    const zhVoice = pickVoice(window.speechSynthesis.getVoices());
    if (zhVoice) utterance.voice = zhVoice;

    window.speechSynthesis.speak(utterance);
  }, 0);
}

/** Stops any in-flight or pending speech immediately, with no replacement
 * utterance queued - unlike speakText's own cancel-then-speak, this is for
 * call sites that just want speech to stop (e.g. grading a card should not
 * let its delayed auto-pronunciation start talking over the next card's
 * feedback tone/audio). */
export function cancelSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}