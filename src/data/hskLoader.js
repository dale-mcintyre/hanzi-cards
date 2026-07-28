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
    
    // 🔍 DEBUG LOG: Check DevTools Console to inspect the actual raw object keys
    if (list.length > 0 && lvl === activeLevels[0]) {
      console.log(`🔍 [HSK ${lvl} Sample Raw JSON Item]:`, list[0]);
    }

    const formatted = list.map((item, idx) => {
      // Deep key extraction
      const char = 
        item.hanzi || 
        item.simplified || 
        item.character || 
        item.word || 
        item.forms?.[0]?.traditional || 
        (typeof item === 'string' ? item : '字');

      const pinyinStr = 
        item.pinyin || 
        item.forms?.[0]?.transcriptions?.pinyin || 
        item.pronunciation || 
        '';

      let meanings = 
        item.translations || 
        item.forms?.[0]?.meanings || 
        item.meanings || 
        item.meaning || 
        item.definition || 
        ['definition'];

      if (Array.isArray(meanings)) {
        meanings = meanings.join(', ');
      }

      return {
        id: `hsk${lvl}_${idx}_${char}`,
        character: String(char),
        pinyin: String(pinyinStr),
        meaning: String(meanings),
        hskLevel: `HSK ${lvl}`,
        sentence: item.sentence || `这是“${char}”字。`,
        sentencePinyin: item.sentencePinyin || '',
        sentenceEnglish: item.sentenceEnglish || `This is the character for ${String(meanings).split(',')[0]}.`,
        culturalNote: item.radical ? `Radical: ${item.radical}` : 'Standard HSK vocabulary word.',
      };
    });

    combinedRaw = [...combinedRaw, ...formatted];
  });

  return combinedRaw;
}