import hsk1 from './hsk/hsk1.json';
import hsk2 from './hsk/hsk2.json';
import hsk3 from './hsk/hsk3.json';
import hsk4 from './hsk/hsk4.json';
import hsk5 from './hsk/hsk5.json';
import hsk6 from './hsk/hsk6.json';

const ALL_LEVELS = {
  '1': hsk1,
  '2': hsk2,
  '3': hsk3,
  '4': hsk4,
  '5': hsk5,
  '6': hsk6,
};

export function getHardwiredDeck(activeLevels = ['3']) {
  let combinedRaw = [];

  activeLevels.forEach((lvl) => {
    const list = ALL_LEVELS[lvl] || [];
    const formatted = list.map((item, idx) => {
      // Handles downloaded JSON structure options cleanly
      const char = item.hanzi || item.simplified || item.character || '字';
      const pinyinStr = item.pinyin || item.forms?.[0]?.transcriptions?.pinyin || '';
      
      let meanings = item.translations || item.meanings || item.meaning || ['meaning'];
      if (Array.isArray(meanings)) {
        meanings = meanings.join(', ');
      }

      return {
        id: `hsk${lvl}_${idx}_${char}`,
        character: char,
        pinyin: pinyinStr,
        meaning: meanings,
        hskLevel: `HSK ${lvl}`,
        sentence: item.example?.hanzi || `这是“${char}”字。`,
        sentencePinyin: item.example?.pinyin || '',
        sentenceEnglish: item.example?.translation || `This is the character for ${meanings.split(',')[0]}.`,
        culturalNote: item.radical ? `Radical: ${item.radical}` : 'Standard HSK vocabulary word.',
      };
    });

    combinedRaw = [...combinedRaw, ...formatted];
  });

  return combinedRaw;
}