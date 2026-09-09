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
// Phase 3 (Sentence Writing) is a short coda, not a third full batch.
const SENTENCE_QUEUE_SIZE = 2;

/**
 * Builds a Pen & Paper session batch, mirroring buildSelfStudyQueue's
 * due-first convention (sessionQueue.js) but keyed on writing fields
 * instead of reading ones. Only draws from cards already read-mastered
 * (SM-2 interval >= MASTERED_INTERVAL_DAYS) - writing practice is
 * reproduction of something already recognized, not a way to first learn
 * a character.
 *
 * Returns `{ primeQueue, recallQueue, sentenceQueue }`:
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
 *  - `sentenceQueue`: up to SENTENCE_QUEUE_SIZE (2) cards for Phase 3
 *    (Sentence Writing), drawn from `eligible` cards with an
 *    `example_sentence` that aren't already in `recallQueue`, so Phase 3
 *    tests fresh material rather than repeating what Recall just
 *    covered. Prefers cards the user has already written before
 *    (most-recently-practiced first), but falls back to never-written
 *    eligible cards rather than coming up empty - `recallQueue`'s review
 *    slots draw from that same already-written pool first, and for
 *    anyone without much writing history yet (or while sentence
 *    enrichment is still rolling out across the deck) that pool alone is
 *    often fully claimed by Recall, which would otherwise starve Phase 3
 *    silently. Empty only if no eligible card with a sentence is left at
 *    all - Phase 3 simply doesn't run that session (WritingSession
 *    renders nothing extra).
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

  const recallIds = new Set(recallQueue.map((c) => c.id));
  // Written (nonzero lastWrittenAt) sorts ahead of never-written (0) via
  // plain numeric descending order, most-recently-practiced first among
  // the written ones - so a never-written card only fills a slot once
  // the already-written pool actually runs out.
  const sentenceCandidates = eligible
    .filter((c) => c.example_sentence && !recallIds.has(c.id))
    .sort((a, b) => (b.stats.lastWrittenAt || 0) - (a.stats.lastWrittenAt || 0));
  const sentenceQueue = sentenceCandidates.slice(0, SENTENCE_QUEUE_SIZE);

  return { primeQueue, recallQueue, sentenceQueue };
}
