export function getHardModeDeck(allDeck, savedProgress) {
  // 1. Grab cards where repetitions > 0 and interval <= 2 (your actual struggling spots)
  const struggling = allDeck.filter((c) => {
    const stat = savedProgress[c.id];
    return stat && stat.repetitions > 0 && stat.interval <= 2;
  });

  let finalPool = [...struggling];

  // 2. If you don't have enough struggling cards yet, pad out with random deck cards
  if (finalPool.length < 10) {
    const remaining = allDeck.filter(c => !finalPool.includes(c));
    const padded = remaining.sort(() => 0.5 - Math.random()).slice(0, 10 - finalPool.length);
    finalPool = [...finalPool, ...padded];
  }

  // 3. Shuffle and cap at exactly 10 cards for a focused review blitz
  return finalPool.sort(() => 0.5 - Math.random()).slice(0, 10);
}