import { pushCardProgress } from './syncClient';
import { enqueue as enqueueSync } from './syncQueue';

const STORAGE_KEY = 'hanzi_deck_progress';
const SENTENCE_CACHE_KEY = 'hz_sentence_cache';

// Set by AuthContext on every auth state change (sign in/out). Kept as a
// plain module-level value rather than storage.js importing React context,
// so this file stays framework-agnostic like the rest of its exports.
let currentSyncUserId = null;

export function setCurrentSyncUser(userId) {
  currentSyncUserId = userId || null;
}

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

  // Fail-open: the localStorage write above already happened and this
  // function already has its return value ready - a slow or failed
  // network push must never delay grading or lose the grade event, so
  // this runs unawaited and queues for retry on failure instead of
  // throwing. See syncQueue.js and PLAN.md's "Fail-open philosophy".
  if (currentSyncUserId) {
    pushCardProgress(currentSyncUserId, cardId, stamped).then((result) => {
      if (!result.ok) enqueueSync(cardId, stamped);
    });
  }

  return stamped;
}

/**
 * Replaces the whole local progress object with syncClient's
 * mergeLocalAndRemoteProgress() result - used once after sign-in (fresh
 * device: populates local state from remote; existing device: reconciles
 * both sides). A full replace is correct here, not a merge-on-top, because
 * `merged` is already the complete reconciled union of every card either
 * side has touched.
 */
export function hydrateLocalFromRemote(mergedProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedProgress));
  } catch (e) {
    console.error('Failed to hydrate local progress from remote:', e);
  }
}

/**
 * Categorizes the deck into mastery groups based on SM-2 interval stats:
 * new: never studied (no stats, or reset back to repetitions === 0).
 * learning: studied at least once but the SM-2 interval hasn't reached
 *   21 days yet.
 * mastered: interval has reached 21+ days - SM-2's interval grows
 *   multiplicatively on repeated Easy grades, so this reflects sustained
 *   recall, not a single lucky grade.
 */
export function getCardMasteryStats(deck) {
  const progress = getProgress();

  const newCards = [];
  const learning = [];
  const mastered = [];

  deck.forEach((card) => {
    const stat = progress[card.id];

    if (!stat || stat.repetitions === 0) {
      newCards.push(card);
    } else if (stat.interval >= 21) {
      mastered.push(card);
    } else {
      learning.push(card);
    }
  });

  return { new: newCards, learning, mastered };
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