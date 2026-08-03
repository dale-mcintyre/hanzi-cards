const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isDue(stats) {
  if (!stats.lastReviewed) return true; // seen before but no timestamp on record - treat as due
  return Date.now() - stats.lastReviewed >= stats.interval * MS_PER_DAY;
}

function overdueAmount(stats) {
  const lastReviewed = stats.lastReviewed || 0;
  return Date.now() - lastReviewed - stats.interval * MS_PER_DAY;
}

function byFrequency(a, b) {
  return (a.freq_rank ?? Infinity) - (b.freq_rank ?? Infinity);
}

/**
 * Builds a "Learn" session queue that respects spaced repetition and the
 * deck's frequency ranking, instead of a flat random shuffle:
 *  1. Cards due for review (already seen, SM-2 interval has elapsed) come
 *     first, most-overdue first.
 *  2. Never-studied cards fill the rest, most-frequent-word first - this is
 *     the whole point of the frequency-ranked dataset: a beginner meets 的
 *     and 我 long before rank-6000 words.
 *  3. If there aren't enough due + new cards (small deck, or everything's
 *     already comfortably scheduled), pad with the not-yet-due remainder,
 *     still frequency-ordered, so a session is never short.
 */
export function buildLearnQueue(deck, count = 20) {
  const due = [];
  const fresh = [];
  const notYetDue = [];

  for (const card of deck) {
    // Keyed off lastReviewed, not repetitions: a failed card's repetitions
    // resets to 0 too, but it's still "seen before, due again soon" rather
    // than genuinely new - it should compete on overdue-ness, not just
    // frequency rank alongside words never studied at all.
    if (!card.stats.lastReviewed) {
      fresh.push(card);
    } else if (isDue(card.stats)) {
      due.push(card);
    } else {
      notYetDue.push(card);
    }
  }

  due.sort((a, b) => overdueAmount(b.stats) - overdueAmount(a.stats));
  fresh.sort(byFrequency);

  const queue = [...due, ...fresh].slice(0, count);

  if (queue.length < count) {
    const used = new Set(queue);
    const padding = notYetDue.filter((c) => !used.has(c)).sort(byFrequency);
    queue.push(...padding.slice(0, count - queue.length));
  }

  return queue;
}
