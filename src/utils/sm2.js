// SuperMemo-2 spaced repetition, adapted for a two-button (Hard / Easy) flashcard flow.
//
// Grade mapping:
//   'hard'  -> quality 2  (below the SM-2 "pass" threshold of 3: resets the streak)
//   'easy'  -> quality 4  (a solid recall: advances the streak on the normal SM-2 curve)
//
// Card record shape (persisted per-word in localStorage):
//   { repetitions: number, interval: number, easeFactor: number,
//     dueDate: string (ISO date), lastReviewed: string (ISO date) }

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export function createInitialSm2State() {
  return {
    repetitions: 0,
    interval: 0,
    easeFactor: DEFAULT_EASE,
    dueDate: null,
    lastReviewed: null,
  };
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Given a card's current SM-2 state and a grade ('hard' | 'easy'), returns the
 * next state. Defensive against a missing/corrupt prior state.
 */
export function nextSm2State(prevState, grade) {
  const prev = prevState && typeof prevState === 'object' ? prevState : createInitialSm2State();
  const quality = grade === 'easy' ? 4 : 2;

  let { repetitions = 0, easeFactor = DEFAULT_EASE } = prev;
  let interval;

  if (quality < 3) {
    // "Hard / Again" — reset the streak, review again tomorrow.
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round((prev.interval || 1) * easeFactor);
    }
  }

  // Ease factor updates on every review, pass or fail, per the classic SM-2 formula.
  easeFactor =
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  return {
    repetitions,
    interval,
    easeFactor: Number(easeFactor.toFixed(2)),
    dueDate: addDays(interval),
    lastReviewed: new Date().toISOString(),
  };
}

export function isDue(state) {
  if (!state || !state.dueDate) return true;
  return new Date(state.dueDate).getTime() <= Date.now();
}
