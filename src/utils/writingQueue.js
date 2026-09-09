import { MASTERED_INTERVAL_DAYS } from './storage';

function isWritingDue(stats) {
  if (!stats.lastWrittenAt) return true; // never attempted - due immediately
  return Date.now() >= (stats.writingNextDue || 0);
}

const MIN_PRIME = 2;
const BOOSTED_PRIME = 6;
const MIN_BATCH = 6;
const MAX_BATCH = 8;
// Below this many due reviews, a session built on reviews alone would be
// too thin to be worth sitting down for - boost how many new characters
// get primed instead so the batch has real substance.
const THIN_REVIEW_THRESHOLD = 4;

/**
 * Builds a Pen & Paper session batch, mirroring buildSelfStudyQueue's
 * due-first convention (sessionQueue.js) but keyed on writing fields
 * instead of reading ones. Only draws from cards already read-mastered
 * (SM-2 interval >= MASTERED_INTERVAL_DAYS) - writing practice is
 * reproduction of something already recognized, not a way to first learn
 * a character.
 *
 * Returns `{ primeQueue, recallQueue }`:
 *  - `primeQueue`: never-written eligible cards, frequency-ranked - these
 *    are the only ones WritingSession's Priming phase walks through (see
 *    there for why: a card that's already proven Spontaneous recall
 *    shouldn't be shown its own answer right before being tested on it).
 *    Normally just MIN_PRIME (2), but boosted up to BOOSTED_PRIME (6)
 *    when due reviews are thin, so a light-review day still yields a
 *    substantial session instead of a 2-card afterthought.
 *  - `recallQueue`: `primeQueue`'s cards plus up to MAX_BATCH -
 *    primeQueue.length already-written cards, most-overdue first. If
 *    that still falls short of MIN_BATCH (e.g. few due reviews and few
 *    new characters left), pads with the most-recently-practiced
 *    not-yet-due cards for reinforcement rather than leaving the batch
 *    anemic - reviewing something slightly early beats a session too
 *    small to bother with. All shuffled together - Blind Recall always
 *    tests the whole batch, new/review/padding alike, in one pass.
 *    (A deck with very few eligible cards overall may still fall below
 *    MIN_BATCH - there's only so much material to draw from.)
 */
export function buildPenAndPaperQueue(deck, targetBatchSize = 8) {
  const eligible = deck.filter((c) => (c.stats?.interval || 0) >= MASTERED_INTERVAL_DAYS);
  const written = eligible.filter((c) => c.stats?.lastWrittenAt);
  const neverWritten = eligible.filter((c) => !c.stats?.lastWrittenAt);

  const dueReview = written.filter((c) => isWritingDue(c.stats));
  dueReview.sort((a, b) => (a.stats.writingNextDue || 0) - (b.stats.writingNextDue || 0)); // most overdue first

  const notYetDue = written.filter((c) => !isWritingDue(c.stats));
  notYetDue.sort((a, b) => (b.stats.lastWrittenAt || 0) - (a.stats.lastWrittenAt || 0)); // most-recently-practiced first

  const primeCount = dueReview.length < THIN_REVIEW_THRESHOLD
    ? Math.min(BOOSTED_PRIME, neverWritten.length)
    : Math.min(MIN_PRIME, neverWritten.length);
  const primeQueue = neverWritten.slice(0, primeCount);

  const reviewSlots = Math.max(0, Math.min(MAX_BATCH, targetBatchSize) - primeQueue.length);
  let reviewItems = dueReview.slice(0, reviewSlots);

  const shortfall = MIN_BATCH - (primeQueue.length + reviewItems.length);
  if (shortfall > 0) {
    reviewItems = [...reviewItems, ...notYetDue.slice(0, shortfall)];
  }

  const recallQueue = [...primeQueue, ...reviewItems].sort(() => 0.5 - Math.random());

  return { primeQueue, recallQueue };
}
