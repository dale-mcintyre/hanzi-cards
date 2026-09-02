import { MASTERED_INTERVAL_DAYS } from './storage';
import { isWritingDue } from './writingQueue';
import { attachQuizOptions } from './quizQueue';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Below this, a card is still early enough in the SM-2 curve that a full
// flashcard (recall the meaning/pronunciation from the character) is the
// right level of difficulty - multiple choice would be too easy this early.
const QUIZ_PROMPT_MIN_INTERVAL_DAYS = 7;

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

// A previously-seen card counts as "due" for the unified session if it's
// due by the reading (SM-2) schedule OR - independently - due by the
// writing schedule. Without the writing half, a fully read-mastered card
// (long SM-2 interval, rarely due for reading again) would almost never
// resurface even though Writing Recall Mode has its own, much shorter
// cadence for the same card - the whole point of giving writing its own
// schedule in the first place.
function isUnifiedDue(stats, includeWriting) {
  if (isDue(stats)) return true;
  return includeWriting && stats.interval >= MASTERED_INTERVAL_DAYS && isWritingDue(stats);
}

// Count of already-seen cards due by either schedule - drives the
// LaunchScreen primary CTA's "Start Session (N Due)" label. Deliberately
// excludes never-studied cards (buildLearnQueue/buildInterleavedQueue's
// "fresh" bucket) - those aren't "due" in the overdue-review sense,
// they're just new material a session pads in when there isn't enough
// due material to fill a full batch.
export function getUnifiedDueCount(deck, includeWriting = true) {
  return deck.filter((c) => c.stats.lastReviewed && isUnifiedDue(c.stats, includeWriting)).length;
}

// A card's prompt type is a function of how far along it is, not of which
// queue it happened to come from - matches the maturity model directly:
// still-fresh material gets a full flashcard, mid-curve material gets
// multiple choice, and fully read-mastered material gets writing practice
// (falling back to quiz when writing is turned off or this particular
// card isn't due for it yet).
function assignPromptType(stats, includeWriting) {
  const interval = stats.interval || 1;
  if (interval < QUIZ_PROMPT_MIN_INTERVAL_DAYS) return 'learn';
  if (interval < MASTERED_INTERVAL_DAYS) return 'quiz';
  if (includeWriting && isWritingDue(stats)) return 'write';
  return 'quiz';
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

/**
 * Builds the unified, interleaved study queue: one mixed batch spanning
 * flashcard, multiple-choice, and paper-writing prompts, each card's
 * `promptType` assigned by how mature it is (assignPromptType above)
 * rather than by which mode launched the session - this is what makes it
 * "unified" rather than three separate session types glued together.
 *
 * Gathering mirrors buildLearnQueue's due-first, fresh-second,
 * not-yet-due-last priority (see there for the full rationale) - the only
 * difference is "due" here means isUnifiedDue (reading OR writing) instead
 * of plain reading due-ness, so a read-mastered card whose writing has
 * come due can still surface even though it'd rarely qualify as reading-due
 * on its own.
 *
 * Every card gets its multiple-choice quizOptions precomputed regardless
 * of its assigned promptType - a 'write' card can be downgraded to 'quiz'
 * mid-session (WritingSession's "Can't write right now" fallback) and
 * needs those options ready with no extra recompute at that point.
 */
export function buildInterleavedQueue(deck, { limit = 10, includeWriting = true } = {}) {
  const due = [];
  const fresh = [];
  const notYetDue = [];

  for (const card of deck) {
    if (!card.stats.lastReviewed) {
      fresh.push(card);
    } else if (isUnifiedDue(card.stats, includeWriting)) {
      due.push(card);
    } else {
      notYetDue.push(card);
    }
  }

  due.sort((a, b) => overdueAmount(b.stats) - overdueAmount(a.stats));
  fresh.sort(byFrequency);

  let queue = [...due, ...fresh].slice(0, limit);

  if (queue.length < limit) {
    const used = new Set(queue);
    const padding = notYetDue.filter((c) => !used.has(c)).sort(byFrequency);
    queue = [...queue, ...padding.slice(0, limit - queue.length)];
  }

  return queue.map((card) => ({
    ...attachQuizOptions(card, deck),
    promptType: assignPromptType(card.stats, includeWriting),
  }));
}
