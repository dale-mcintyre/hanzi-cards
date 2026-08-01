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