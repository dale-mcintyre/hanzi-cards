const PROGRESS_KEY = 'hanzi_deck_progress';
const CACHE_PREFIX = 'hanzi_deck_cache_';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SENTENCE_CACHE_KEY = 'hanzi_sentence_cache';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // localStorage can throw in private-browsing / storage-disabled contexts.
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Progress store: { [cardKey]: Sm2State } */
export function loadProgress() {
  return safeParse(safeGet(PROGRESS_KEY), {});
}

export function saveProgress(progress) {
  return safeSet(PROGRESS_KEY, JSON.stringify(progress ?? {}));
}

export function cardKey(level, simplified) {
  return `${level}:${simplified}`;
}

/** Vocab deck cache, keyed by HSK level, so a returning learner isn't re-fetching every load. */
export function loadCachedDeck(level) {
  const raw = safeGet(CACHE_PREFIX + level);
  const parsed = safeParse(raw, null);
  if (!parsed || !Array.isArray(parsed.words) || !parsed.cachedAt) return null;
  if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
  return parsed.words;
}

export function saveCachedDeck(level, words) {
  return safeSet(
    CACHE_PREFIX + level,
    JSON.stringify({ words, cachedAt: Date.now() })
  );
}

/**
 * Small derived cache: { [simplifiedWord]: { sentence, pinyin, english } | null }
 * Shared across all HSK levels — a word looked up once stays cached, no TTL,
 * since example sentences don't go stale.
 */
export function loadSentenceCache() {
  return safeParse(safeGet(SENTENCE_CACHE_KEY), {});
}

export function saveSentenceCache(cache) {
  return safeSet(SENTENCE_CACHE_KEY, JSON.stringify(cache ?? {}));
}
