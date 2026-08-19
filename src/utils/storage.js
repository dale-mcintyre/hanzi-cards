import { pushCardProgress, pushSettings } from './syncClient';
import { enqueue as enqueueSync, clear as clearSyncQueue, QUEUE_KEY as SYNC_QUEUE_KEY } from './syncQueue';

const STORAGE_KEY = 'hanzi_deck_progress';
const SENTENCE_CACHE_KEY = 'hz_sentence_cache';
const PREFS_KEY = 'hz_study_prefs';
const STREAK_COUNT_KEY = 'hz_streak_count';
const LAST_ACTIVE_DATE_KEY = 'hz_last_active_date';
const DEFAULT_PREFS = { revisionLevels: [], includeNonHsk: true };

// SM-2 interval (days) at which a card counts as "mastered" - shared by
// getCardMasteryStats and getTierStats below (and StudySession's per-card
// history pill) so none of them drift onto different thresholds for the
// same underlying question.
export const MASTERED_INTERVAL_DAYS = 21;

// --- One-time card-ID migration (vocab_<index>_<char> -> <char>) ---------
// The old ID embedded a word's position within whatever HSK/non-HSK filter
// was active when its deck loaded, so the same word got different progress
// keys across filter changes. `character` is verified unique across all
// 7,429 rows of unified_vocab.json, so remapping straight onto it is a
// safe, lossless 1:1 rekey. Runs once per browser, at module load time
// (see the bare call at the bottom of this block) - that guarantees it
// completes before React renders and before AuthContext's mount effect
// fires, with no orchestration needed elsewhere.
const LOCAL_MIGRATION_FLAG = 'hz_card_id_migrated_v1';
const OLD_CARD_ID_PATTERN = /^vocab_\d+_(.+)$/;

function rekeyByPattern(obj, getTimestamp) {
  const rekeyed = {};
  let changed = false;
  for (const [id, value] of Object.entries(obj)) {
    const match = id.match(OLD_CARD_ID_PATTERN);
    const newId = match ? match[1] : id;
    if (match) changed = true;

    // Two old-format keys can collide onto the same character (the word
    // appeared at different index positions in different filter sessions) -
    // keep whichever has the newer lastReviewed, same rule
    // mergeLocalAndRemoteProgress already uses for local/remote collisions.
    const existing = rekeyed[newId];
    if (!existing || getTimestamp(value) > getTimestamp(existing)) {
      rekeyed[newId] = value;
    }
  }
  return { rekeyed, changed };
}

function migrateLocalCardIds() {
  try {
    if (localStorage.getItem(LOCAL_MIGRATION_FLAG) === 'true') return;
  } catch {
    return; // localStorage unavailable - nothing to migrate, nothing to flag
  }

  try {
    const savedProgress = localStorage.getItem(STORAGE_KEY);
    if (savedProgress) {
      const { rekeyed, changed } = rekeyByPattern(JSON.parse(savedProgress), (s) => s.lastReviewed || 0);
      if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(rekeyed));
    }

    // Also rekey any not-yet-flushed offline sync-queue entries, so a
    // stale pre-migration queue item doesn't push an old-format row to
    // Supabase after this ships (see syncQueue.js's { [cardId]: { stats, attempts } } shape).
    const savedQueue = localStorage.getItem(SYNC_QUEUE_KEY);
    if (savedQueue) {
      const { rekeyed, changed } = rekeyByPattern(JSON.parse(savedQueue), (q) => q.stats?.lastReviewed || 0);
      if (changed) localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(rekeyed));
    }

    localStorage.setItem(LOCAL_MIGRATION_FLAG, 'true');
  } catch (e) {
    console.error('Failed to migrate local card IDs:', e);
    // Leave the flag unset - retried on next load instead of getting stuck.
  }
}

migrateLocalCardIds();

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
 * Study preferences: HSK level filter + whether non-HSK frequency words
 * are included. Same local-first, fail-open shape as progress above, but
 * simpler - a single preference blob has no per-item loss risk the way a
 * graded card does, so a failed push here just isn't queued for retry;
 * the next explicit change or the next sign-in's pull naturally
 * reconciles it (see AuthContext.jsx's runSettingsSync).
 */
export function getPrefs() {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (!saved) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(saved);
    return {
      revisionLevels: Array.isArray(parsed.revisionLevels) ? parsed.revisionLevels : [],
      includeNonHsk: typeof parsed.includeNonHsk === 'boolean' ? parsed.includeNonHsk : true,
    };
  } catch (e) {
    console.error('Failed to load study preferences:', e);
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error('Failed to save study preferences:', e);
  }

  if (currentSyncUserId) {
    pushSettings(currentSyncUserId, prefs);
  }

  return prefs;
}

/** Replaces local preferences with a signed-in account's remote settings
 * row - used once after sign-in (see runSettingsSync). */
export function hydratePrefsFromRemote(remotePrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(remotePrefs));
  } catch (e) {
    console.error('Failed to hydrate study preferences from remote:', e);
  }
}

/**
 * Wipes every locally-cached piece of the just-signed-out account's data -
 * card progress, study prefs, streak, and any not-yet-flushed sync queue
 * items - so a shared/public device doesn't keep showing the previous
 * account's characters and stats after logout. Deliberately leaves the
 * sentence cache and entitlement cache alone: neither is account-specific,
 * and both are expensive/pointless to rebuild. Called from AuthContext's
 * signOut, followed by a full reload - clearing localStorage alone doesn't
 * touch whatever's already sitting in React state on the current page.
 */
export function clearLocalUserData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem(STREAK_COUNT_KEY);
    localStorage.removeItem(LAST_ACTIVE_DATE_KEY);
  } catch (e) {
    console.error('Failed to clear local user data:', e);
  }
  clearSyncQueue();
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
    } else if (stat.interval >= MASTERED_INTERVAL_DAYS) {
      mastered.push(card);
    } else {
      learning.push(card);
    }
  });

  return { new: newCards, learning, mastered };
}

/**
 * Per-tier (HSK 1-6 + 'non-hsk') seen/mastered breakdown, independent of
 * whatever HSK/non-HSK filter is currently active - takes the FULL,
 * unfiltered vocab list (see data/vocabLoader.js's fetchUnifiedVocab) so a
 * tier that's currently deselected still reports accurate stats. Uses the
 * same MASTERED_INTERVAL_DAYS threshold as getCardMasteryStats above - one
 * classification rule, two different aggregations, so they can't drift.
 */
export function getTierStats(fullVocab, progress) {
  const tiers = {};
  for (const key of ['1', '2', '3', '4', '5', '6', 'non-hsk']) {
    tiers[key] = { total: 0, seen: 0, mastered: 0 };
  }

  fullVocab.forEach((word) => {
    const key = word.level === null || word.level === undefined ? 'non-hsk' : String(word.level);
    const tier = tiers[key];
    if (!tier) return; // defensive: unexpected level value, skip rather than throw
    tier.total += 1;

    const stat = progress[word.character];
    if (!stat || stat.repetitions === 0) return;
    tier.seen += 1;
    if (stat.interval >= MASTERED_INTERVAL_DAYS) tier.mastered += 1;
  });

  return tiers;
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