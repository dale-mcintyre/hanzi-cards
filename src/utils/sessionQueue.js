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
  return (a.frequency ?? Infinity) - (b.frequency ?? Infinity);
}

// Count of already-seen cards whose SM-2 interval has elapsed - drives the
// LaunchScreen "Self-Study (N Due)" label. Deliberately excludes
// never-studied cards - those aren't "due" in the overdue-review sense,
// they're just new material.
export function getDueCount(deck) {
  return deck.filter((c) => c.stats.lastReviewed && isDue(c.stats)).length;
}

/**
 * Builds the Free Self-Study reading queue: pure review over material
 * already introduced elsewhere (Warmup/Pen & Paper now own new-character
 * intake - see warmupQueue.js/writingQueue.js), respecting spaced
 * repetition and the deck's frequency ranking instead of a flat random
 * shuffle:
 *  1. Cards due for review (already seen, SM-2 interval has elapsed) come
 *     first, most-overdue first.
 *  2. If there aren't enough due cards (small deck, or everything's
 *     already comfortably scheduled), pad with the not-yet-due remainder,
 *     frequency-ordered, so a session is never short on its own -
 *     reviewing something slightly early beats an empty session.
 *  Never-studied cards are deliberately excluded, even as padding - a
 *  brand new user (or one with nothing due yet) sees "Nothing due right
 *  now" rather than Free Self-Study quietly becoming a new-card intake
 *  path again.
 */
export function buildSelfStudyQueue(deck, count = 20) {
  const due = [];
  const notYetDue = [];

  for (const card of deck) {
    // Keyed off lastReviewed, not repetitions: a failed card's repetitions
    // resets to 0 too, but it's still "seen before, due again soon" rather
    // than genuinely new - it should compete on overdue-ness, not just be
    // excluded alongside words never studied at all.
    if (!card.stats.lastReviewed) continue;
    if (isDue(card.stats)) {
      due.push(card);
    } else {
      notYetDue.push(card);
    }
  }

  due.sort((a, b) => overdueAmount(b.stats) - overdueAmount(a.stats));

  const queue = due.slice(0, count);

  if (queue.length < count) {
    const used = new Set(queue);
    const padding = notYetDue.filter((c) => !used.has(c)).sort(byFrequency);
    queue.push(...padding.slice(0, count - queue.length));
  }

  return queue;
}
