import { getSentencesFor } from './sentenceSource';

let cachedVocab = null;

/**
 * Fetches and caches the unified vocabulary JSON from the public folder.
 */
export async function fetchUnifiedVocab() {
  if (cachedVocab) return cachedVocab;

  try {
    const response = await fetch('/unified_vocab.json');
    if (!response.ok) {
      throw new Error(`Failed to load vocabulary: ${response.statusText}`);
    }
    cachedVocab = await response.json();
    return cachedVocab;
  } catch (error) {
    console.error('Error loading unified vocab:', error);
    return [];
  }
}

/**
 * Filters the vocab dataset by HSK level selection and non-HSK inclusion,
 * independently of each other:
 *  - selectedLevels: [] = no level filter (every HSK level passes);
 *    non-empty = only those HSK levels pass.
 *  - includeNonHsk: whether the ~2,400 level:null CC-CEDICT filler words
 *    (see build-vocab.py) are included, regardless of selectedLevels.
 * Defaults ([], true) reproduce the deck's only-ever-observed steady
 * state before these were persisted: the full frequency-ranked deck,
 * HSK and non-HSK words together.
 */
export async function getFilteredDeck(selectedLevels = [], includeNonHsk = true) {
  const allVocab = await fetchUnifiedVocab();

  const filtered = allVocab.filter((item) => {
    const isNonHsk = item.level === null || item.level === undefined;
    if (isNonHsk) return includeNonHsk;
    return selectedLevels.length === 0 || selectedLevels.includes(String(item.level));
  });

  const sentenceMap = await getSentencesFor(filtered.map((item) => item.character));

  return filtered.map((item) => {
    const s = sentenceMap[item.character];
    return {
      ...item,
      sentence: s?.sentence || '',
      sentencePinyin: s?.pinyin || '',
      sentenceEnglish: s?.english || '',
    };
  });
}