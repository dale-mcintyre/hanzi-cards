// How often each deck character appears in real Chinese text -
// public/char_freq.json, built by build-char-frequency.py from the
// SUBTLEX-CH corpus. Shape: { total, counts: { [char]: count } }.

let cachedFrequency = null;

export async function fetchCharFrequency() {
  if (cachedFrequency) return cachedFrequency;

  try {
    const response = await fetch('/char_freq.json');
    if (!response.ok) throw new Error(`Failed to load character frequency: ${response.statusText}`);
    cachedFrequency = await response.json();
    return cachedFrequency;
  } catch (error) {
    // Only the "~N% of everyday text" line needs this - it just stays
    // hidden without it.
    console.error('Error loading character frequency:', error);
    return null;
  }
}
