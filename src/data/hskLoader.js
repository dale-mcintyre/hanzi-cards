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
      // 1. Extract simplified character
      const char = item.simplified || item.hanzi || item.character || '字';
      
      // 2. Extract pinyin from nested forms array
      const pinyinStr = item.forms?.[0]?.transcriptions?.pinyin || item.pinyin || '';

      // 3. Extract meanings list safely
      const meaningsList = item.forms?.[0]?.meanings || item.translations || item.meaning || ['meaning'];
      const meaningsJoined = Array.isArray(meaningsList) ? meaningsList.join(', ') : String(meaningsList);

      return {
        id: `hsk${lvl}_${idx}_${char}`,
        character: char,
        pinyin: pinyinStr,
        meaning: meaningsJoined,
        hskLevel: `HSK ${lvl}`,
        sentence: `这是“${char}”字。`,
        sentencePinyin: '',
        sentenceEnglish: `This is the character for ${Array.isArray(meaningsList) ? meaningsList[0] : meaningsJoined}.`,
        culturalNote: item.radical ? `Radical: ${item.radical}` : 'Standard HSK vocabulary word.',
      };
    });

    combinedRaw = [...combinedRaw, ...formatted];
  });

  return combinedRaw;
}