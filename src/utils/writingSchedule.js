// Distinct overlearning schedule for Writing Recall Mode - deliberately
// separate from sm2.js's reading schedule (Amnesia/Hesitated/Spontaneous
// grades don't map onto SM-2 quality semantics, and writing intervals grow
// on a flatter, capped curve since the goal is "still reflexive after a
// long gap", not ever-increasing spacing).
export const WRITING_MASTERED_LEVEL = 3; // "Reflexive"

const REFLEXIVE_GROWTH_FACTOR = 1.5;
const REFLEXIVE_MIN_CEILING_DAYS = 90;
const REFLEXIVE_MAX_CEILING_DAYS = 120;

export function calculateWritingSchedule(quality, prev = {}) {
  const prevReps = prev.writingReps || 0;
  const prevIntervalDays = prev.writingIntervalDays || 0;

  if (quality === 1) {
    return { writingLevel: 0, writingReps: 0, writingIntervalDays: 1 }; // Amnesia
  }
  if (quality === 2) {
    return { writingLevel: 1, writingReps: 1, writingIntervalDays: 3 }; // Hesitated
  }

  // quality === 3, Spontaneous
  const nextReps = prevReps + 1;
  if (nextReps === 1) return { writingLevel: 2, writingReps: 1, writingIntervalDays: 7 };
  if (nextReps === 2) return { writingLevel: 2, writingReps: 2, writingIntervalDays: 21 };

  // Reflexive: first hit is a flat 60 days, then each further successful
  // rep grows the interval ~1.5x, clamped to a 90-120 day plateau.
  const grownInterval =
    nextReps === 3
      ? 60
      : Math.min(REFLEXIVE_MAX_CEILING_DAYS, Math.max(REFLEXIVE_MIN_CEILING_DAYS, Math.round(prevIntervalDays * REFLEXIVE_GROWTH_FACTOR)));

  return { writingLevel: 3, writingReps: nextReps, writingIntervalDays: grownInterval };
}
