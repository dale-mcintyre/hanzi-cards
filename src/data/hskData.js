import { loadCachedDeck, saveCachedDeck } from '../utils/storage';

export const LEVELS = [
  { level: 1, label: 'HSK 1', words: 150, tag: 'Beginner' },
  { level: 2, label: 'HSK 2', words: 150, tag: 'Beginner' },
  { level: 3, label: 'HSK 3', words: 300, tag: 'Default' },
  { level: 4, label: 'HSK 4', words: 600, tag: 'Challenge' },
];

const REPO_ROOT =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main';

// The dataset's real layout (confirmed against the repo's README) is
// wordlists/{exclusive|inclusive}/new/{level}.json — "exclusive" gives just the
// words introduced at that level, which is what a per-level study pack wants.
// "inclusive" (everything up to and including that level) is used as a fallback
// in case a given level file has moved.
function candidateUrls(level) {
  return [
    `${REPO_ROOT}/wordlists/exclusive/new/${level}.json`,
    `${REPO_ROOT}/wordlists/inclusive/new/${level}.json`,
  ];
}

/**
 * Normalizes one raw entry from the dataset into the flat shape the UI uses.
 * This dataset itself has no example sentences — those are looked up
 * separately, per-word, from sentenceSource.js.
 */
function normalizeEntry(raw, level) {
  if (!raw || typeof raw !== 'object' || !raw.simplified) return null;

  const form = Array.isArray(raw.forms) && raw.forms.length > 0 ? raw.forms[0] : {};
  const transcriptions = form.transcriptions || {};
  const meanings = Array.isArray(form.meanings) ? form.meanings.filter(Boolean) : [];

  return {
    simplified: raw.simplified,
    traditional: form.traditional || raw.simplified,
    radical: raw.radical || null,
    level,
    frequency: typeof raw.frequency === 'number' ? raw.frequency : null,
    pos: Array.isArray(raw.pos) ? raw.pos : [],
    pinyin: transcriptions.pinyin || null,
    numericPinyin: transcriptions.numeric || null,
    meanings,
    classifiers: Array.isArray(form.classifiers) ? form.classifiers : [],
  };
}

async function fetchFromCandidates(level) {
  let lastError = null;
  for (const url of candidateUrls(level)) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`${res.status} ${res.statusText} for ${url}`);
        continue;
      }
      const json = await res.json();
      if (!Array.isArray(json) || json.length === 0) {
        lastError = new Error(`Empty or unexpected response from ${url}`);
        continue;
      }
      return json;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No candidate URLs succeeded');
}

/**
 * Loads a deck for a given HSK level: cache first, then network, always
 * returning a clean array (never throws — callers get { words, error }).
 */
export async function loadDeck(level) {
  const cached = loadCachedDeck(level);
  if (cached && cached.length > 0) {
    return { words: cached, error: null, fromCache: true };
  }

  try {
    const raw = await fetchFromCandidates(level);
    const words = raw.map((entry) => normalizeEntry(entry, level)).filter(Boolean);
    if (words.length === 0) {
      throw new Error('Dataset returned no usable entries');
    }
    saveCachedDeck(level, words);
    return { words, error: null, fromCache: false };
  } catch (err) {
    return { words: [], error: err instanceof Error ? err.message : String(err), fromCache: false };
  }
}
