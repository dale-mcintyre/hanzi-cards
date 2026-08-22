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

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.85; // Slightly slower for language learners

  // Pick a native Chinese voice if available
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find((v) => v.lang.includes('zh') || v.lang.includes('CN'));
  if (zhVoice) utterance.voice = zhVoice;

  window.speechSynthesis.speak(utterance);
}