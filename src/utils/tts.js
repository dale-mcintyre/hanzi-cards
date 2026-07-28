let cachedVoice = null;
let voicesReadyPromise = null;

function pickChineseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh')) ||
    null
  );
}

function ensureVoicesLoaded() {
  if (voicesReadyPromise) return voicesReadyPromise;
  voicesReadyPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve();
      return;
    }
    const handle = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handle);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handle);
    // Some browsers never fire the event — don't hang forever.
    setTimeout(resolve, 1000);
  });
  return voicesReadyPromise;
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export async function speakMandarin(text) {
  if (!isSpeechSupported() || !text) return false;

  await ensureVoicesLoaded();
  if (!cachedVoice) cachedVoice = pickChineseVoice();

  window.speechSynthesis.cancel(); // stop anything mid-utterance first
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.9;
  if (cachedVoice) utterance.voice = cachedVoice;

  window.speechSynthesis.speak(utterance);
  return true;
}
