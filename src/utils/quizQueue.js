/**
 * Builds a multiple-choice quiz queue: `count` questions sampled from
 * already-studied cards (quizzing on something never seen is just
 * guessing, no learning value), each carrying a precomputed set of 6
 * answer options (`quizOptions`, correct answer's position randomized) so
 * QuizSession never has to recompute/reshuffle them on re-render. Each
 * option keeps its pinyin alongside the character - QuizSession reveals
 * pinyin for all 6 after answering, not just the correct one, so a wrong
 * guess still teaches you the other 5 characters shown that round.
 */
export function buildQuizQueue(seenCards, fullDeck, count = 10) {
  const questions = [...seenCards].sort(() => 0.5 - Math.random()).slice(0, count);
  return questions.map((card) => ({ ...card, quizOptions: buildDistractorOptions(card, fullDeck) }));
}

/**
 * 5 distractors + the correct answer, shuffled. Distractors are pulled
 * from the same HSK tier as the correct answer where possible, so the
 * wrong options are actually plausible instead of trivially different -
 * falls back to the whole deck if that tier doesn't have enough entries.
 */
function buildDistractorOptions(correctCard, fullDeck) {
  let pool = fullDeck.filter((c) => c.character !== correctCard.character && c.level === correctCard.level);
  if (pool.length < 5) {
    pool = fullDeck.filter((c) => c.character !== correctCard.character);
  }

  const distractors = [...pool].sort(() => 0.5 - Math.random()).slice(0, 5);
  return [...distractors, correctCard]
    .sort(() => 0.5 - Math.random())
    .map((c) => ({ character: c.character, pinyin: c.pinyin }));
}
