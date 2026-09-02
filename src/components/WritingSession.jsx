import { useEffect, useState } from 'react';
import Countdown from './Countdown';
import HanziCanvas from './HanziCanvas';
import { ColorPinyin } from '../utils/pinyinColor';

// Fixed sizing ladder for Writing Recall Mode's grid boxes - independent
// of HanziCanvas's default ladder (used by the reading-mode StudySession
// card), per the spec: 1 char = 180px, 2 = 120px, 3-4 = 84px.
const WRITING_SIZE_LADDER = { 1: 180, 2: 120, 3: 84, 4: 84 };

const GRADE_OPTIONS = [
  { quality: 1, key: '1', label: 'Amnesia', hint: "Couldn't recall it" },
  { quality: 2, key: '2', label: 'Hesitated', hint: 'Got there, but slowly' },
  { quality: 3, key: '3', label: 'Spontaneous', hint: 'Wrote it instantly' },
];

export default function WritingSession({ appState, countdownNum, card, onGrade, onCantWriteNow, progressPercent }) {
  const [revealed, setRevealed] = useState(false);

  // New prompt - reset to the hidden state. Also covers leaving 'studying'
  // (e.g. mid-countdown for the next session) so a stale reveal from a
  // previous card can't linger into the next one.
  useEffect(() => {
    setRevealed(false);
  }, [card]);

  useEffect(() => {
    if (appState !== 'studying' || !card) return;

    function handleKeydown(e) {
      if (!revealed) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      const option = GRADE_OPTIONS.find((o) => o.key === e.key);
      if (option) onGrade(option.quality);
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [appState, card, revealed, onGrade]);

  return (
    <>
      {appState === 'studying' && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {appState === 'countdown' && <Countdown countdownNum={countdownNum} />}

      {appState === 'studying' && card && (
        <div className="card card--writing">
          <span className="box-section-label">Write this character from memory</span>

          <div className="writing-prompt-meta">
            <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
            <p className="meaning-primary">{typeof card.meaning === 'string' ? card.meaning.split(';')[0].trim() : card.meaning}</p>
          </div>

          <div
            className="canvas-frame writing-canvas-frame"
            onClick={() => { if (!revealed) setRevealed(true); }}
          >
            <HanziCanvas
              character={card.character}
              mode={revealed ? 'animate' : 'hidden'}
              sequential
              sizeByLength={WRITING_SIZE_LADDER}
            />
            {!revealed && <p className="writing-reveal-hint">Tap or press Space to reveal</p>}
          </div>

          {revealed && (
            <div className="writing-grade-row">
              {GRADE_OPTIONS.map((option) => (
                <button
                  key={option.quality}
                  type="button"
                  className={`writing-grade-btn writing-grade-btn--${option.quality}`}
                  onClick={() => onGrade(option.quality)}
                >
                  <span className="writing-grade-key">{option.key}</span>
                  <span className="writing-grade-label">{option.label}</span>
                  <span className="writing-grade-hint">{option.hint}</span>
                </button>
              ))}
            </div>
          )}

          {/* The "on my commute, no pen handy" escape hatch - swaps this
              same card to a multiple-choice prompt in place. Not a grade:
              no stats are touched, so this must never read as an Amnesia
              writing attempt. */}
          <button type="button" className="writing-cant-write-btn" onClick={onCantWriteNow}>
            Can't write right now
          </button>
        </div>
      )}
    </>
  );
}
