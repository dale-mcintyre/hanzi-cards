import React from 'react';

const TONE_1 = /[āēīōūǖĀĒĪŌŪǕ]/;
const TONE_2 = /[áéíóúǘÁÉÍÓÚǗ]/;
const TONE_3 = /[ǎěǐǒǔǚǍĚǏǑǓǙ]/;
const TONE_4 = /[àèìòùǜÀÈÌÒÙǛ]/;

export function getToneClass(syllable) {
  if (TONE_1.test(syllable)) return 'tone-1';
  if (TONE_2.test(syllable)) return 'tone-2';
  if (TONE_3.test(syllable)) return 'tone-3';
  if (TONE_4.test(syllable)) return 'tone-4';
  return 'tone-neutral';
}

/**
 * Parses pinyin text and returns color-coded JSX elements per syllable
 */
export function ColorPinyin({ pinyin = '' }) {
  if (!pinyin) return null;

  const syllables = pinyin.split(' ');

  return (
    <span className="color-pinyin">
      {syllables.map((syllable, index) => {
        const toneClass = getToneClass(syllable);
        return (
          <span key={index} className={`pinyin-syllable ${toneClass}`}>
            {syllable}{' '}
          </span>
        );
      })}
    </span>
  );
}