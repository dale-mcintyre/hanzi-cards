import { leafParts } from '../data/charParts';

// How many of the closest look-alikes to choose 3 distractors from - a
// little wider than 3 so the same word doesn't always get the same three.
const SHORTLIST_SIZE = 6;

// A word's visual "features": each character it contains, and each
// component those characters are built from. Two words sharing features
// look alike - 她/他/地 share 也, 知道/知识 share 知.
function featuresOf(word, charParts) {
  const features = new Set();
  for (const c of word) {
    features.add(`c:${c}`);
    for (const p of leafParts(c, charParts)) features.add(`p:${p}`);
  }
  return features;
}

function firstMeaning(meaning) {
  return typeof meaning === 'string' ? meaning.split(';')[0].trim().toLowerCase() : '';
}

// feature -> cards having it, built once per deck array. rawDeck is
// replaced (not mutated) after every grade, so a WeakMap keyed on it never
// serves a stale index and lets old ones be garbage-collected.
const indexCache = new WeakMap();

function getIndex(deck, charParts) {
  let index = indexCache.get(deck);
  if (index && index.charParts === charParts) return index.byFeature;

  const byFeature = new Map();
  for (const card of deck) {
    for (const f of featuresOf(card.character, charParts)) {
      if (!byFeature.has(f)) byFeature.set(f, []);
      byFeature.get(f).push(card);
    }
  }
  indexCache.set(deck, { charParts, byFeature });
  return byFeature;
}

/**
 * Up to 3 cards from `deck` that look like `target`: the same number of
 * characters and as many shared characters/components as possible, same
 * HSK tier breaking ties. Skips anything sharing the target's first
 * meaning, so a look-alike can never also be a correct answer. May return
 * fewer than 3 (or none) - the caller fills the rest.
 */
export function pickLookalikes(target, deck, charParts) {
  if (!charParts) return [];

  const index = getIndex(deck, charParts);
  const targetMeaning = firstMeaning(target.meaning);
  const scores = new Map();

  for (const f of featuresOf(target.character, charParts)) {
    for (const card of index.get(f) || []) {
      if (card.character === target.character || card.character.length !== target.character.length) continue;
      scores.set(card, (scores.get(card) || 0) + 1);
    }
  }

  const ranked = [...scores.entries()]
    .filter(([card]) => firstMeaning(card.meaning) !== targetMeaning)
    .map(([card, score]) => [card, score + (card.level === target.level ? 0.5 : 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHORTLIST_SIZE)
    .map(([card]) => card);

  return ranked.sort(() => 0.5 - Math.random()).slice(0, 3);
}
