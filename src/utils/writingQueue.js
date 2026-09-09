import { MASTERED_INTERVAL_DAYS } from './storage';

function isWritingDue(stats) {
  if (!stats.lastWrittenAt) return true; // never attempted - due immediately
  return Date.now() >= (stats.writingNextDue || 0);
}

/**
 * Builds a Pen & Paper session batch, mirroring buildSelfStudyQueue's
 * due-first convention (sessionQueue.js) but keyed on writing fields
 * instead of reading ones. Only draws from cards already read-mastered
 * (SM-2 interval >= MASTERED_INTERVAL_DAYS) - writing practice is
 * reproduction of something already recognized, not a way to first learn
 * a character.
 *
 * Returns `{ primeQueue, recallQueue }`:
 *  - `primeQueue`: up to 2 never-written eligible cards - these are the
 *    only ones WritingSession's Priming phase walks through (see there
 *    for why: a card that's already proven Spontaneous recall shouldn't
 *    be shown its own answer right before being tested on it).
 *  - `recallQueue`: `primeQueue`'s cards plus up to
 *    `targetBatchSize - primeQueue.length` (capped at 8) already-written
 *    cards whose writing schedule has come due again, most-overdue first
 *    then shuffled together - Blind Recall always tests the whole batch,
 *    new and review cards alike, in one shuffled pass.
 */
export function buildPenAndPaperQueue(deck, targetBatchSize = 8) {
  const eligible = deck.filter((c) => (c.stats?.interval || 0) >= MASTERED_INTERVAL_DAYS);
  const dueReview = eligible.filter((c) => c.stats?.lastWrittenAt && isWritingDue(c.stats));
  const neverWritten = eligible.filter((c) => !c.stats?.lastWrittenAt);

  dueReview.sort((a, b) => (a.stats.writingNextDue || 0) - (b.stats.writingNextDue || 0)); // most overdue first

  const primeQueue = neverWritten.slice(0, 2);
  const reviewSlots = Math.min(8, Math.max(0, targetBatchSize - primeQueue.length));
  const reviewItems = dueReview.slice(0, reviewSlots);

  const recallQueue = [...primeQueue, ...reviewItems].sort(() => 0.5 - Math.random());

  return { primeQueue, recallQueue };
}
