/** Safe, cross-browser Web Speech API wrapper for Mandarin (zh-CN) */
export function speakText(text) {
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