// Real example sentences, sourced from krmanik/Chinese-Example-Sentences on GitHub —
// 63k Chinese sentences (simplified/traditional/pinyin/English) derived from the
// Tatoeba corpus. Important caveat, surfaced in the UI: the English side was
// machine-translated (Google Translate), not the original human Tatoeba
// translations, so quality varies more than the vocab data does.
//
// The file has no per-word index, so we scan it once per session and derive a
// small { word -> best sentence } map, choosing the *shortest* sentence that
// contains the word (simplest sentence = most useful for a learner). That small
// derived map is what gets cached in localStorage — not the 9.8MB source file.

import { loadSentenceCache, saveSentenceCache } from '../utils/storage';

const TSV_URL =
  'https://raw.githubusercontent.com/krmanik/Chinese-Example-Sentences/main/Chinese%20Example%20Sentences/cmn_sen_db_2.tsv';

const MAX_WORD_LEN = 4; // HSK words are essentially always 1-4 characters

let corpusPromise = null; // in-memory, once per tab session

function parseTsv(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    const [, simplified, , pinyin, english] = cols;
    if (!simplified) continue;
    rows.push({ simplified: simplified.trim(), pinyin: pinyin?.trim() || '', english: english?.trim() || '' });
  }
  return rows;
}

async function getCorpus() {
  if (!corpusPromise) {
    corpusPromise = fetch(TSV_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then(parseTsv)
      .catch((err) => {
        corpusPromise = null; // allow a retry on the next call
        throw err;
      });
  }
  return corpusPromise;
}

/**
 * One pass over the corpus: for every sentence, check its length-1..4
 * substrings against the set of words we still need, keeping the shortest
 * matching sentence per word. O(corpus size) rather than O(words x corpus).
 */
function indexMissingWords(corpus, missingWords) {
  const found = new Map();
  const wantSet = new Set(missingWords);

  for (const row of corpus) {
    const text = row.simplified;
    for (let start = 0; start < text.length; start++) {
      for (let len = 1; len <= MAX_WORD_LEN && start + len <= text.length; len++) {
        const candidate = text.slice(start, start + len);
        if (!wantSet.has(candidate)) continue;
        const existing = found.get(candidate);
        if (!existing || text.length < existing.sentence.length) {
          found.set(candidate, { sentence: text, pinyin: row.pinyin, english: row.english });
        }
      }
    }
  }

  return found;
}

/**
 * Returns { [word]: { sentence, pinyin, english } | null } for every word
 * requested — cache-first, falling back to a single corpus fetch + scan for
 * whatever wasn't already cached. Never throws: on network failure every
 * uncached word simply resolves to null so the UI can show its honest
 * "no sentence" state instead of breaking.
 */
export async function getSentencesFor(words) {
  const cache = loadSentenceCache();
  const result = {};
  const missing = [];

  for (const w of words) {
    if (Object.prototype.hasOwnProperty.call(cache, w)) {
      result[w] = cache[w];
    } else {
      missing.push(w);
    }
  }

  if (missing.length === 0) return result;

  try {
    const corpus = await getCorpus();
    const found = indexMissingWords(corpus, missing);

    const updatedCache = { ...cache };
    for (const w of missing) {
      const entry = found.get(w) || null;
      result[w] = entry;
      updatedCache[w] = entry;
    }
    saveSentenceCache(updatedCache);
  } catch {
    // Corpus fetch failed — leave the missing words unresolved (undefined),
    // the UI treats that the same as "no sentence yet" without caching a
    // permanent null, so it can retry on a later visit.
    for (const w of missing) {
      if (!(w in result)) result[w] = null;
    }
  }

  return result;
}
