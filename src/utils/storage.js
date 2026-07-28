const STORAGE_KEY = 'hanzi_deck_progress';

export function getProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error('Failed to load progress:', e);
    return {};
  }
}

export function saveCardProgress(cardId, newStats) {
  try {
    const progress = getProgress();
    progress[cardId] = newStats;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
}