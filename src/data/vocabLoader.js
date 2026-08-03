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
 * Filters the vocab dataset based on selected HSK levels (e.g., ['1', '2'])
 */
export async function getFilteredDeck(selectedLevels = ['1']) {
  const allVocab = await fetchUnifiedVocab();

  // Filter words that match the selected HSK levels
  const filtered = allVocab.filter((item) => {
    return selectedLevels.includes(String(item.level));
  });

  return filtered;
}