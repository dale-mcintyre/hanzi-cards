export function calculateSM2(quality, prevRepetitions = 0, prevInterval = 1, prevEase = 2.5) {
  let nextRepetitions = prevRepetitions;
  let nextInterval = prevInterval;
  let nextEase = prevEase;

  if (quality >= 3) {
    if (prevRepetitions === 0) nextInterval = 1;
    else if (prevRepetitions === 1) nextInterval = 6;
    else nextInterval = Math.round(prevInterval * prevEase);
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