import hsk1Data from './hsk1.json';
import hsk2Data from './hsk2.json';
import hsk3Data from './hsk3.json';

import hsk1Sentences from './hsk1Sentences.json';
import hsk2Sentences from './hsk2Sentences.json';
import hsk3Sentences from './hsk3Sentences.json';

const rawDecks = {
  '1': hsk1Data,
  '2': hsk2Data,
  '3': hsk3Data,
};

const sentenceBanks = {
  ...hsk1Sentences,
  ...hsk2Sentences,
  ...hsk3Sentences,
};

export function getHardwiredDeck(levels = ['1', '2', '3'], sortMode = 'frequency') {
  let combined = [];

  levels.forEach((lvl) => {
    const deck = rawDecks[lvl] || [];
    combined = combined.concat(deck);
  });

  // Deduplicate cards by simplified character
  const seen = new Set();
  const uniqueCards = [];

  combined.forEach((card) => {
    const charKey = card.simplified || card.character;
    if (!seen.has(charKey)) {
      seen.add(charKey);
      uniqueCards.push(card);
    }
  });

  // Enrich cards with dedicated 1-to-1 sentences & clean properties
  const enriched = uniqueCards.map((card) => {
    const charKey = card.simplified || card.character;
    const sentenceObj = sentenceBanks[charKey];

    const primaryForm = card.forms ? card.forms[0] : null;
    const pinyin = card.pinyin || primaryForm?.transcriptions?.pinyin || '';
    const meaning = card.meaning || primaryForm?.meanings?.join(', ') || '';

    return {
      id: charKey,
      character: charKey,
      pinyin: pinyin,
      meaning: meaning,
      frequency: card.frequency || 99999, // Lower rank = higher frequency
      sentence: sentenceObj ? sentenceObj.zh : `我们今天学习“${charKey}”。`,
      sentencePinyin: sentenceObj ? sentenceObj.pinyin : '',
      sentenceEnglish: sentenceObj ? sentenceObj.en : '',
    };
  });

  // Sort by frequency (most common words first)
  if (sortMode === 'frequency') {
    return enriched.sort((a, b) => a.frequency - b.frequency);
  }

  // Fallback to random shuffle
  return enriched.sort(() => 0.5 - Math.random());
}