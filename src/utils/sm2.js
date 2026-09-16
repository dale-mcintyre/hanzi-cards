// Ceiling on how far an interval can grow, in days (~10 years) - without
// one, interval *= ease compounds forever on a long streak of correct
// grades, and eventually overflows Supabase's card_progress.interval
// column (a plain int4, max ~2.1 billion) - exactly what happened to two
// real cards after ~19 correct reviews at a high ease factor (Postgres
// error 22003 "value out of range for type integer"). Ten years is far
// beyond any interval a review-timing algorithm needs to distinguish -
// "come back in 4,000 days" and "come back in 8 million days" both just
// mean "you know this cold", so capping here loses nothing practical.
export const MAX_INTERVAL_DAYS = 3650;

export function calculateSM2(quality, prevRepetitions = 0, prevInterval = 1, prevEase = 2.5) {
  let nextRepetitions = prevRepetitions;
  let nextInterval = prevInterval;
  let nextEase = prevEase;

  if (quality >= 3) {
    if (prevRepetitions === 0) nextInterval = 1;
    else if (prevRepetitions === 1) nextInterval = 6;
    else nextInterval = Math.min(MAX_INTERVAL_DAYS, Math.round(prevInterval * prevEase));
    nextRepetitions += 1;
  } else {
    nextRepetitions = 0;
    nextInterval = 1;
  }

  nextEase = prevEase + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEase < 1.3) nextEase = 1.3;

  return {
    repetitions: nextRepetitions,
    interval: nextInterval,
    easeFactor: Number(nextEase.toFixed(2)),
  };
}