import { MASTERED_INTERVAL_DAYS } from './storage';

function isWritingDue(stats) {
  if (!stats.lastWrittenAt) return true; // never attempted - due immediately
  return Date.now() >= (stats.writingNextDue || 0);
}

/**
 * Builds a Writing Recall session queue, mirroring buildLearnQueue's
 * due-first convention (sessionQueue.js) but keyed on writing fields
 * instead of reading ones. Only draws from cards already read-mastered
 * (SM-2 interval >= MASTERED_INTERVAL_DAYS) - writing practice is
 * reproduction of something already recognized, not a way to first learn
 * a character.
 */
export function buildWritingQueue(deck, count = 6) {
  const eligible = deck.filter(
    (c) => (c.stats?.interval || 0) >= MASTERED_INTERVAL_DAYS && isWritingDue(c.stats || {})
  );

  const due = eligible.filter((c) => c.stats?.lastWrittenAt);
  const neverWritten = eligible.filter((c) => !c.stats?.lastWrittenAt);
  due.sort((a, b) => (a.stats.writingNextDue || 0) - (b.stats.writingNextDue || 0)); // most overdue first

  return [...due, ...neverWritten].slice(0, count);
}
