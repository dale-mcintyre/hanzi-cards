/**
 * Builds a rapid-recognition Warmup queue: up to `count` questions, each
 * carrying a precomputed set of 4 answer options (`quizOptions`, correct
 * answer's position randomized) so WarmupSession never has to recompute/
 * reshuffle them on re-render. Each option keeps its pinyin alongside the
 * character - WarmupSession reveals pinyin for all 4 after answering, not
 * just the correct one, so a wrong guess still teaches you the other 3
 * characters shown that round.
 *
 * Draws from `seenCards` first (real recognition testing on something
 * already studied), then - if that pool is thin - fills the remainder
 * with never-seen cards from `fullDeck`, most-frequent-word first, each
 * flagged `isNew: true`. Warmup is now one of the app's new-character
 * intake points (alongside Pen & Paper's Priming): WarmupSession gives an
 * `isNew` card one ungraded reveal before its quiz question ever appears,
 * so testing it isn't a blind guess.
 */
export function buildWarmupQueue(seenCards, fullDeck, count = 10) {
  const seenIds = new Set(seenCards.map((c) => c.id));
  const questions = [...seenCards].sort(() => 0.5 - Math.random()).slice(0, count);

  if (questions.length < count) {
    const fresh = fullDeck
      .filter((c) => !seenIds.has(c.id))
      .sort((a, b) => (a.frequency ?? Infinity) - (b.frequency ?? Infinity))
      .slice(0, count - questions.length)
      .map((c) => ({ ...c, isNew: true }));
    questions.push(...fresh);
  }

  const queue = [...questions].sort(() => 0.5 - Math.random());
  return queue.map((card) => ({ ...card, quizOptions: buildDistractorOptions(card, fullDeck) }));
}

/**
 * 3 distractors + the correct answer (4 total, a 2x2 grid), shuffled.
 * Distractors are pulled from the same HSK tier as the correct answer
 * where possible, so the wrong options are actually plausible instead of
 * trivially different - falls back to the whole deck if that tier doesn't
 * have enough entries.
 */
function buildDistractorOptions(correctCard, fullDeck) {
  let pool = fullDeck.filter((c) => c.character !== correctCard.character && c.level === correctCard.level);
  if (pool.length < 3) {
    pool = fullDeck.filter((c) => c.character !== correctCard.character);
  }

  const distractors = [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);
  return [...distractors, correctCard]
    .sort(() => 0.5 - Math.random())
    .map((c) => ({ character: c.character, pinyin: c.pinyin }));
}
