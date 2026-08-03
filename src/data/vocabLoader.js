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
 * Filters the vocab dataset based on selected HSK levels (e.g., ['1', '2']).
 * An empty/missing selection means no filter - the full frequency-ranked
 * deck (HSK words plus the non-HSK top-frequency words), used for the main
 * "Learn" flow. A non-empty selection is a targeted revision filter.
 */
export async function getFilteredDeck(selectedLevels = []) {
  const allVocab = await fetchUnifiedVocab();

  const filtered = selectedLevels.length > 0
    ? allVocab.filter((item) => selectedLevels.includes(String(item.level)))
    : allVocab;

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