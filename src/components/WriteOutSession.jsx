import { useEffect, useState } from 'react';
import HanziCanvas from './HanziCanvas';
import CharacterParts from './CharacterParts';
import { ColorPinyin } from '../utils/pinyinColor';
import { speakText } from '../utils/tts';
import { SpeakerIcon } from './icons';

// Same sizing ladder as WritingSession's grid boxes.
const WRITING_SIZE_LADDER = { 1: 180, 2: 120, 3: 84, 4: 84 };

function firstMeaning(meaning) {
  return typeof meaning === 'string' ? meaning.split(';')[0].trim() : meaning;
}

/**
 * The lesson's last step: every card missed or hesitated on today, one at
 * a time, to be copied out `reps` times by hand. Nothing is graded - this
 * is repetition, not a test - so it walks its own `cards` and calls
 * `onDone` at the end rather than going through App.jsx's grading
 * pipeline. Tapping the character replays its strokes (HanziCanvas).
 */
export default function WriteOutSession({ cards, reps, charParts, onDone }) {
  const [index, setIndex] = useState(0);
  const card = cards[index];

  useEffect(() => {
    if (card) speakText(card.character);
  }, [card]);

  function advance() {
    if (index + 1 >= cards.length) onDone();
    else setIndex((i) => i + 1);
  }

  useEffect(() => {
    function handleKeydown(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, cards, onDone]);

  if (!card) return null;

  return (
    <>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>

      <div className="card card--writing">
        <span className="box-section-label">Write out · {index + 1} of {cards.length}</span>

        <div className="writing-prompt-meta">
          <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
          <p className="meaning-primary">{firstMeaning(card.meaning)}</p>
        </div>

        <button
          type="button"
          className="audio-icon-btn"
          onClick={(e) => { e.stopPropagation(); speakText(card.character); }}
          aria-label="Play pronunciation"
        >
          <SpeakerIcon />
        </button>

        <div className="canvas-frame writing-canvas-frame">
          <HanziCanvas character={card.character} mode="animate" sequential sizeByLength={WRITING_SIZE_LADDER} />
        </div>

        <CharacterParts word={card.character} charParts={charParts} />

        <p className="writing-instruction-cue">Write it out {reps}× in your notebook · tap to replay strokes</p>

        <button type="button" className="primary-launch-btn" onClick={advance}>
          {index + 1 >= cards.length ? 'Finish' : 'Next'} <span className="writing-key-hint">[Space]</span>
        </button>
      </div>
    </>
  );
}
