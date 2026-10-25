import { MASTERED_INTERVAL_DAYS } from './storage';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * MS_PER_DAY;
export const CHART_WEEKS = 8;
// Pace (for the HSK goal and per-level ETAs) averages over this many
// days, and isn't shown until known_at has been recorded for at least
// that long - a pace from 3 days of data would swing wildly.
const PACE_WINDOW_DAYS = 14;

// A word is Known once it's passed SM-2's third review in a row - the
// first one with a real gap behind it (reviews land at day 0, 1, then
// ~6 days later). Any miss resets repetitions to 0, so a forgotten word
// drops back out of Known on its own.
const KNOWN_REPETITIONS = 3;
// Can Write: written cleanly from memory twice running, the second time
// after writingSchedule.js's 7-day gap. A Missed or Hesitated grade
// resets writingReps, same honesty rule as Known.
const CAN_WRITE_LEVEL = 2;
const CAN_WRITE_REPS = 2;

export const MILESTONES = [50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000];

export function isReadKnown(stat) {
  return !!stat?.lastReviewed && (stat.repetitions || 0) >= KNOWN_REPETITIONS;
}

export function isReadSolid(stat) {
  return isReadKnown(stat) && (stat.interval || 0) >= MASTERED_INTERVAL_DAYS;
}

export function canWrite(stat) {
  return !!stat?.lastWrittenAt && (stat.writingLevel || 0) >= CAN_WRITE_LEVEL && (stat.writingReps || 0) >= CAN_WRITE_REPS;
}

// character -> { level, words } for every character in the vocab, where
// `level` is the lowest HSK level of any word containing it ('non-hsk' if
// none) - so 们 counts toward HSK 1 because 我们 is HSK 1. Built once per
// vocab array.
const indexCache = new WeakMap();

function getCharacterIndex(fullVocab) {
  let index = indexCache.get(fullVocab);
  if (index) return index;

  index = new Map();
  for (const word of fullVocab) {
    const level = word.level === null || word.level === undefined ? null : Number(word.level);
    for (const c of word.character) {
      const entry = index.get(c) || { level: null, words: [] };
      entry.words.push(word.character);
      if (level !== null && (entry.level === null || level < entry.level)) entry.level = level;
      index.set(c, entry);
    }
  }
  for (const entry of index.values()) entry.tier = entry.level === null ? 'non-hsk' : String(entry.level);
  indexCache.set(fullVocab, index);
  return index;
}

// Earliest of the given timestamps, where a missing one (a word that
// became Known before known_at was recorded) counts as "long ago".
function earliest(times) {
  let min = Infinity;
  for (const t of times) min = Math.min(min, t || 0);
  return min === Infinity ? null : min;
}

/**
 * Character-level progress, derived from per-word progress: a character
 * is Known (or Solid, or Can Write) once any word containing it is - so
 * learning 知道 counts toward both 知 and 道. `knownAt`/`canWriteAt` is
 * when the first such word got there, which drives "this week" and the
 * weekly chart.
 *
 * Returns:
 *  - totals: { introduced, known, solid, canWrite } across every character
 *  - tiers: per HSK tier, { total, introduced, known, canWrite,
 *    knownThisWeek, canWriteThisWeek }
 *  - weekly: CHART_WEEKS counts of characters that became Known each week,
 *    oldest first, the last one being this week
 *  - knownThisWeek / canWriteThisWeek: the same two "last 7 days" numbers
 *    across all tiers
 *  - knownChars / canWriteChars / introducedChars: Sets of characters,
 *    for text coverage and the lesson recap's before/after comparison
 *  - trackingSince: earliest recorded knownAt, or null - how long pace
 *    data has existed
 */
export function getCharacterProgress(fullVocab, progress, now = Date.now()) {
  const index = getCharacterIndex(fullVocab);
  const weekStart = now - WEEK_MS;
  const chartStart = now - CHART_WEEKS * WEEK_MS;

  const tiers = {};
  for (const key of ['1', '2', '3', '4', '5', '6', 'non-hsk']) {
    tiers[key] = { total: 0, introduced: 0, known: 0, canWrite: 0, knownThisWeek: 0, canWriteThisWeek: 0, knownInPaceWindow: 0 };
  }
  const totals = { introduced: 0, known: 0, solid: 0, canWrite: 0 };
  const weekly = new Array(CHART_WEEKS).fill(0);
  const knownChars = new Set();
  const canWriteChars = new Set();
  const introducedChars = new Set();
  const paceStart = now - PACE_WINDOW_DAYS * MS_PER_DAY;
  let trackingSince = null;
  let knownThisWeek = 0;
  let canWriteThisWeek = 0;

  for (const [char, entry] of index) {
    const tier = tiers[entry.tier];
    tier.total += 1;

    const stats = entry.words.map((w) => progress[w]).filter(Boolean);
    if (stats.length === 0) continue;

    if (stats.some((s) => s.lastReviewed || s.lastWrittenAt)) {
      introducedChars.add(char);
      tier.introduced += 1;
      totals.introduced += 1;
    }

    const knownStats = stats.filter(isReadKnown);
    if (knownStats.length > 0) {
      knownChars.add(char);
      tier.known += 1;
      totals.known += 1;
      if (knownStats.some(isReadSolid)) totals.solid += 1;

      const knownAt = earliest(knownStats.map((s) => s.knownAt));
      if (knownAt > 0 && (trackingSince === null || knownAt < trackingSince)) trackingSince = knownAt;
      if (knownAt >= paceStart) tier.knownInPaceWindow += 1;
      if (knownAt >= weekStart) {
        tier.knownThisWeek += 1;
        knownThisWeek += 1;
      }
      if (knownAt >= chartStart) {
        const weeksAgo = Math.floor((now - knownAt) / WEEK_MS);
        weekly[CHART_WEEKS - 1 - Math.min(weeksAgo, CHART_WEEKS - 1)] += 1;
      }
    }

    const writeStats = stats.filter(canWrite);
    if (writeStats.length > 0) {
      canWriteChars.add(char);
      tier.canWrite += 1;
      totals.canWrite += 1;
      if (earliest(writeStats.map((s) => s.canWriteAt)) >= weekStart) {
        tier.canWriteThisWeek += 1;
        canWriteThisWeek += 1;
      }
    }
  }

  return { totals, tiers, weekly, knownThisWeek, canWriteThisWeek, knownChars, canWriteChars, introducedChars, trackingSince };
}

/**
 * Per-tier pace in Known characters, shaped like storage.js's
 * getCommitmentStatus expects ({ total, mastered, remaining, perWeek,
 * etaDays }, `mastered` meaning Known here). perWeek is 0 - which
 * getCommitmentStatus and the drawer read as "can't estimate yet" - until
 * there's PACE_WINDOW_DAYS of known_at history, rather than guessing from
 * a few days.
 */
export function getCharacterPace(charProgress, now = Date.now()) {
  const hasEnoughHistory =
    charProgress.trackingSince !== null && now - charProgress.trackingSince >= PACE_WINDOW_DAYS * MS_PER_DAY;

  const pace = {};
  for (const [key, tier] of Object.entries(charProgress.tiers)) {
    const perWeek = hasEnoughHistory ? (tier.knownInPaceWindow / PACE_WINDOW_DAYS) * 7 : 0;
    const remaining = tier.total - tier.known;
    pace[key] = {
      total: tier.total,
      mastered: tier.known,
      remaining,
      perWeek,
      etaDays: perWeek > 0 ? remaining / (perWeek / 7) : null,
    };
  }
  return pace;
}

/**
 * What changed between two getCharacterProgress snapshots - the lesson
 * recap's "+4 introduced · 3 became Known · 2 slipped back" line.
 */
export function diffCharacterProgress(before, after) {
  const count = (a, b) => [...a].filter((c) => !b.has(c)).length;
  return {
    introduced: count(after.introducedChars, before.introducedChars),
    becameKnown: count(after.knownChars, before.knownChars),
    slippedBack: count(before.knownChars, after.knownChars),
    canNowWrite: count(after.canWriteChars, before.canWriteChars),
  };
}

/** The next milestone above `count`, or null past the last one. */
export function nextMilestone(count) {
  return MILESTONES.find((m) => m > count) ?? null;
}

/**
 * Share (0-1) of the Chinese characters in everyday text that are in
 * `knownChars`, from public/char_freq.json (see build-char-frequency.py).
 * Null until that's loaded.
 */
export function textCoverage(knownChars, charFreq) {
  if (!charFreq?.total) return null;
  let covered = 0;
  for (const c of knownChars) covered += charFreq.counts[c] || 0;
  return covered / charFreq.total;
}
