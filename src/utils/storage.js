const STORAGE_KEY = 'hanzi_deck_progress';
const SENTENCE_CACHE_KEY = 'hz_sentence_cache';

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
  const stamped = { ...newStats, lastReviewed: Date.now() };
  try {
    const progress = getProgress();
    progress[cardId] = stamped;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
  return stamped;
}

/**
 * Categorizes the deck into mastery groups based on SM-2 interval stats
 */
export function getCardMasteryStats(deck) {
  const progress = getProgress();
  
  const nailed = [];
  const practicing = [];
  const struggling = [];

  deck.forEach((card) => {
    const stat = progress[card.id];
    
    // If never reviewed or interval is 1 or less with low reps
    if (!stat || (stat.repetitions === 0 && stat.interval <= 1)) {
      struggling.push(card); // Unseen or reset counts as needing practice/struggling initially
    } else if (stat.interval > 10) {
      nailed.push(card);
    } else if (stat.interval > 1 && stat.interval <= 10) {
      practicing.push(card);
    } else {
      struggling.push(card);
    }
  });

  return { nailed, practicing, struggling };
}

/**
 * Small localStorage-backed cache of { word -> {sentence, pinyin, english} | null }
 * so sentenceSource.js only has to fetch/scan the Tatoeba corpus once per word.
 */
export function loadSentenceCache() {
  try {
    const saved = localStorage.getItem(SENTENCE_CACHE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error('Failed to load sentence cache:', e);
    return {};
  }
}

export function saveSentenceCache(cache) {
  try {
    localStorage.setItem(SENTENCE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Failed to save sentence cache:', e);
  }
}