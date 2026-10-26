import { getDueCards } from './sessionQueue';
import { getPrimingCandidates, getWritingDueCards, pickSentenceCards } from './writingQueue';
import { buildDistractorOptions } from './warmupQueue';

const MINUTE_MS = 60 * 1000;

const WARMUP_SIZE = 8;
// Fewer already-seen cards than this and Warm Up is skipped - a quiz that
// keeps repeating the same 2-3 characters isn't a warm-up.
const MIN_WARMUP_POOL = 4;
const REVIEW_READING_MAX = 20;
const REVIEW_WRITING_MAX = 8;
const SENTENCE_COUNT = 2;
const MAX_NEW = 5;

// The Close the Loop steps re-test a missed card until it's right, but
// never more than this many times in one lesson - after that it's better
// left to tomorrow's spaced review than drilled into frustration.
export const MAX_RECHECK_ATTEMPTS = 3;

// Below this share of correct answers in the steps before Learn New, the lesson
// halves today's new characters - a tutor wouldn't pile new material on
// top of a review that's going badly. Ignored until at least
// MIN_GRADES_FOR_ACCURACY grades, so 1 miss out of 2 doesn't count.
const ACCURACY_TARGET = 0.8;
const MIN_GRADES_FOR_ACCURACY = 5;

// Rough per-card pace, for the dashboard's "~N min" label only - same
// spirit as App.jsx's estimateWritingMinutes, not a measured average.
const SECONDS_PER_CARD = { quiz: 6, flashcard: 10, writing: 20, writeout: 40 };
const PRIMING_SECONDS = 30;
const SENTENCE_SECONDS = 30;

function shuffle(cards) {
  return [...cards].sort(() => 0.5 - Math.random());
}

// A heavy review day gets fewer new characters, down to none - clearing
// what's due comes first.
function newCountForBacklog(dueTotal) {
  if (dueTotal >= 40) return 0;
  if (dueTotal >= 25) return 2;
  if (dueTotal >= 12) return 3;
  return MAX_NEW;
}

/**
 * Builds the guided ~20 minute lesson: one session that runs the app's
 * existing quiz, flashcard and writing screens in a tutor's order -
 *  1. Warm Up: a short 4-choice quiz on already-seen, not-due cards.
 *  2. Review: due flashcards, then due writing recall.
 *  3. Learn New: Priming + recall on today's new characters, then a quiz
 *     on just those.
 *  4. Use It: Cloze sentence writing.
 *  5. Close the Loop: everything missed earlier, then all of today's new
 *     characters again, each repeated until it's right (up to
 *     MAX_RECHECK_ATTEMPTS). Then Write Them Out: every miss from the
 *     whole lesson shown once more, to be copied out 5 or 10 times by
 *     hand - repetition for the motor memory, ungraded.
 *
 * Returns an array of stages, each `{ key, section, title, intro, kind,
 * cards, budgetMs, ... }`. `kind` picks the screen ('quiz' = WarmupSession,
 * 'flashcard' = StudySession, 'writing' = WritingSession, 'writeout' =
 * WriteOutSession) and `budgetMs`
 * is that step's time box - App.jsx ends a step early once it's spent,
 * leaving whatever wasn't reached for the next lesson. Close the Loop's
 * three stages are `dynamic`: their cards only exist once the earlier steps
 * have run, so resolveStageCards fills them in on the way in. Static
 * stages with nothing to show are left out entirely.
 *
 * `charParts` (data/charParts.js), when loaded, makes the quiz steps use
 * look-alike wrong answers - see buildDistractorOptions.
 *
 * Warm Up and Close the Loop are `practiceOnly` - neither touches the
 * schedule. Warm Up's cards aren't due (grading them would be an early
 * review). Every card in Close the Loop was already graded once earlier in
 * the same lesson, and that first grade is what the schedule should
 * reflect - re-grading here would let a missed card turn "correct" for the
 * schedule just because it was seen a minute ago.
 */
export function buildLessonPlan(deck, charParts = null) {
  const readingDue = getDueCards(deck);
  const writingDueAll = getWritingDueCards(deck);

  const newCards = getPrimingCandidates(deck).slice(0, newCountForBacklog(readingDue.length + writingDueAll.length));
  const newIds = new Set(newCards.map((c) => c.id));

  const reviewReading = readingDue.filter((c) => !newIds.has(c.id)).slice(0, REVIEW_READING_MAX);
  const reviewWriting = writingDueAll.slice(0, REVIEW_WRITING_MAX);

  const reviewIds = new Set(reviewReading.map((c) => c.id));
  const warmupPool = deck.filter((c) => c.stats.lastReviewed && !reviewIds.has(c.id) && !newIds.has(c.id));
  const warmupCards = warmupPool.length >= MIN_WARMUP_POOL ? shuffle(warmupPool).slice(0, WARMUP_SIZE) : [];

  const writingIds = new Set([...newCards, ...reviewWriting].map((c) => c.id));
  const sentenceCards = pickSentenceCards(deck, writingIds, SENTENCE_COUNT);

  const withQuizOptions = (c) => ({ ...c, quizOptions: buildDistractorOptions(c, deck, charParts) });

  const stages = [
    {
      key: 'warmup',
      section: 'Warm up',
      title: 'Warm up',
      intro: 'A few quick ones you already know, to get your head into Chinese.',
      kind: 'quiz',
      // These cards aren't due - grading them would review them early
      // and nudge them toward Known without a real gap (see
      // utils/charProgress.js). Misses still come back in Close the Loop.
      practiceOnly: true,
      cards: warmupCards.map(withQuizOptions),
      budgetMs: 2 * MINUTE_MS,
    },
    {
      key: 'review-reading',
      section: 'Review',
      title: 'Review',
      intro: 'These are due today. Say the reading and meaning to yourself before you flip.',
      kind: 'flashcard',
      cards: reviewReading,
      budgetMs: 3.5 * MINUTE_MS,
    },
    {
      key: 'review-writing',
      section: 'Review',
      title: 'Write from memory',
      intro: 'Characters due for a writing check. Write each one in your notebook before you reveal it.',
      kind: 'writing',
      cards: shuffle(reviewWriting),
      budgetMs: 2.5 * MINUTE_MS,
    },
    {
      key: 'learn-new',
      section: 'Learn new',
      title: 'New characters',
      intro: 'Watch the strokes and copy each one once. Then write them all from memory.',
      kind: 'writing',
      primeQueue: newCards,
      cards: shuffle(newCards),
      budgetMs: null,
    },
    {
      key: 'new-check',
      section: 'Learn new',
      title: 'Check the new ones',
      intro: 'Pick the right character for each meaning.',
      kind: 'quiz',
      cards: shuffle(newCards).map(withQuizOptions),
      budgetMs: null,
    },
    {
      key: 'sentence',
      section: 'Use it',
      title: 'Use it in a sentence',
      intro: 'Read the sentence and write the missing word.',
      kind: 'writing',
      isSentence: true,
      cards: sentenceCards,
      budgetMs: 3 * MINUTE_MS,
    },
    {
      key: 'recheck-reading',
      section: 'Close the loop',
      title: 'Second look',
      intro: 'The ones you missed earlier. Each comes back until you get it.',
      kind: 'flashcard',
      dynamic: true,
      practiceOnly: true,
      retryMisses: true,
      cards: [],
      budgetMs: 2 * MINUTE_MS,
    },
    {
      key: 'recheck-writing',
      section: 'Close the loop',
      title: 'Close the loop',
      intro: "Write today's new characters and earlier misses from memory, until each one is right.",
      kind: 'writing',
      dynamic: true,
      practiceOnly: true,
      retryMisses: true,
      cards: [],
      budgetMs: 4 * MINUTE_MS,
    },
    {
      key: 'write-out',
      section: 'Close the loop',
      title: 'Write them out',
      intro: 'Everything you missed or hesitated on today. Write each one out in your notebook, again and again.',
      kind: 'writeout',
      dynamic: true,
      practiceOnly: true,
      // The learner picks how many times on the intro card - see
      // LessonStageIntro.
      repsOptions: [5, 10],
      cards: [],
      budgetMs: null,
    },
  ];

  return stages.filter((s) => s.dynamic || s.cards.length > 0);
}

/**
 * The cards a stage should actually run with, given what's happened in
 * the lesson so far - `misses` is `{ reading: Map, writing: Map }` of
 * cards graded wrong in non-practice stages (by id), `results` the
 * lesson's grade log. Returns the stage's own `cards` unchanged except
 * for:
 *  - Learn New: trimmed to half (at least 1) when accuracy so far came
 *    in under ACCURACY_TARGET - App.jsx trims its primeQueue to match.
 *    Its quiz then follows whatever Learn New actually taught.
 *  - The two Close the Loop stages, filled from `misses` (and, for the
 *    writing one, today's new characters).
 */
export function resolveStageCards(stage, stages, misses, results) {
  if (stage.key === 'recheck-reading') {
    return [...misses.reading.values()];
  }

  if (stage.key === 'recheck-writing') {
    const learnNew = stages.find((s) => s.key === 'learn-new');
    const byId = new Map(misses.writing);
    for (const c of learnNew?.cards || []) byId.set(c.id, c);
    return shuffle([...byId.values()]);
  }

  // Every card missed (or, for writing, hesitated on) anywhere in the
  // lesson, reading or writing, once each in the order they went wrong.
  if (stage.key === 'write-out') {
    const byId = new Map([...misses.reading, ...misses.writing]);
    return [...byId.values()];
  }

  if (stage.key === 'learn-new') {
    const keep = newCardsToKeep(stage.cards.length, results);
    const keptIds = new Set(stage.primeQueue.slice(0, keep).map((c) => c.id));
    return stage.cards.filter((c) => keptIds.has(c.id));
  }

  // Whatever Learn New actually taught, after any trim above.
  if (stage.key === 'new-check') {
    const learnNew = stages.find((s) => s.key === 'learn-new');
    const taughtIds = new Set((learnNew?.cards || []).map((c) => c.id));
    return stage.cards.filter((c) => taughtIds.has(c.id));
  }

  return stage.cards;
}

function newCardsToKeep(newCount, results) {
  if (results.length < MIN_GRADES_FOR_ACCURACY) return newCount;
  const accuracy = results.filter((r) => r.isSuccess).length / results.length;
  return accuracy < ACCURACY_TARGET ? Math.max(1, Math.ceil(newCount / 2)) : newCount;
}

/** Rough lesson length in minutes, for the dashboard label. */
export function estimateLessonMinutes(stages) {
  let seconds = 0;
  for (const stage of stages) {
    let stageSeconds = stage.cards.length * (stage.isSentence ? SENTENCE_SECONDS : SECONDS_PER_CARD[stage.kind]);
    if (stage.primeQueue) stageSeconds += stage.primeQueue.length * PRIMING_SECONDS;
    if (stage.key === 'recheck-writing') {
      const learnNew = stages.find((s) => s.key === 'learn-new');
      stageSeconds = (learnNew?.cards.length || 0) * SECONDS_PER_CARD.writing + 60;
    }
    seconds += stage.budgetMs ? Math.min(stage.budgetMs / 1000, stageSeconds) : stageSeconds;
  }
  return Math.max(1, Math.round(seconds / 60));
}
