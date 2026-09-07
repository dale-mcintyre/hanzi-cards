import { useEffect, useState } from 'react';
import Countdown from './Countdown';
import HanziCanvas from './HanziCanvas';
import { ColorPinyin } from '../utils/pinyinColor';
import { speakText } from '../utils/tts';

// Fixed sizing ladder for Writing Recall Mode's grid boxes - independent
// of HanziCanvas's default ladder (used by the reading-mode StudySession
// card), per the spec: 1 char = 180px, 2 = 120px, 3-4 = 84px.
const WRITING_SIZE_LADDER = { 1: 180, 2: 120, 3: 84, 4: 84 };

const GRADE_OPTIONS = [
  { quality: 1, key: '1', label: 'Missed', hint: "Couldn't recall it" },
  { quality: 2, key: '2', label: 'Hesitated', hint: 'Got there, but slowly' },
  { quality: 3, key: '3', label: 'Clean', hint: 'Wrote it instantly' },
];

function firstMeaning(meaning) {
  return typeof meaning === 'string' ? meaning.split(';')[0].trim() : meaning;
}

/**
 * Two-phase pen-and-paper session: Priming (watch the whole batch get
 * demonstrated, no grading) then Blind Recall (re-run the same batch from
 * memory, graded). `batch` is the full session queue - unlike the other
 * session components, this one needs the whole array up front (not just
 * the current `card`) so Priming can walk through it independently of
 * App.jsx's currentIndex/handleNextCard pipeline, which only ever
 * advances once Recall actually starts grading.
 */
export default function WritingSession({ appState, countdownNum, batch, card, onGrade, progressPercent }) {
  const [phase, setPhase] = useState('priming');
  const [primeIndex, setPrimeIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // A brand new batch (new session launch) always restarts at the
  // beginning of Priming - `batch` keeps the same array reference for the
  // whole session, so this only fires on an actual new session.
  useEffect(() => {
    setPhase('priming');
    setPrimeIndex(0);
    setRevealed(false);
  }, [batch]);

  // Recall's reveal state resets per card, same as before.
  useEffect(() => {
    if (phase === 'recall') setRevealed(false);
  }, [card, phase]);

  const primeCard = batch[primeIndex];

  // Demonstrates pronunciation immediately (not delayed, unlike
  // StudySession's flip reveal) - Priming is actively teaching the card,
  // not testing recall, so there's no reason to withhold it.
  useEffect(() => {
    if (appState === 'studying' && phase === 'priming' && primeCard) {
      speakText(primeCard.character);
    }
  }, [appState, phase, primeCard]);

  function advancePriming() {
    if (primeIndex + 1 >= batch.length) {
      setPhase('recall');
    } else {
      setPrimeIndex((i) => i + 1);
    }
  }

  useEffect(() => {
    if (appState !== 'studying') return;

    function handleKeydown(e) {
      if (phase === 'priming') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          advancePriming();
        }
        return;
      }
      if (!card) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, phase, revealed, card, primeIndex, batch, onGrade]);

  const recallPosition = card ? batch.indexOf(card) + 1 : 0;

  return (
    <>
      {appState === 'studying' && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {appState === 'countdown' && <Countdown countdownNum={countdownNum} />}

      {appState === 'studying' && phase === 'priming' && primeCard && (
        <div className="card card--writing">
          <span className="box-section-label">Priming {primeIndex + 1} / {batch.length}</span>

          <div className="writing-prompt-meta">
            <h1 className="pinyin-title"><ColorPinyin pinyin={primeCard.pinyin} /></h1>
            <p className="meaning-primary">{firstMeaning(primeCard.meaning)}</p>
          </div>

          <button
            type="button"
            className="audio-icon-btn"
            onClick={(e) => { e.stopPropagation(); speakText(primeCard.character); }}
            aria-label="Play pronunciation"
          >
            🔊
          </button>

          <div className="canvas-frame writing-canvas-frame">
            <HanziCanvas
              character={primeCard.character}
              mode="animate"
              sequential
              sizeByLength={WRITING_SIZE_LADDER}
            />
          </div>

          <p className="writing-instruction-cue">Watch stroke order &amp; copy 1× to notebook</p>

          <button type="button" className="primary-launch-btn" onClick={advancePriming}>
            Next <span className="writing-key-hint">[Space/Enter]</span>
          </button>
        </div>
      )}

      {appState === 'studying' && phase === 'recall' && card && (
        <div className="card card--writing">
          <span className="box-section-label">Recall {recallPosition} / {batch.length}</span>

          <div className="writing-prompt-meta">
            <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
            <p className="meaning-primary">{firstMeaning(card.meaning)}</p>
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
            {!revealed && (
              <p className="writing-reveal-hint">Write from memory in notebook · tap or press Space to reveal</p>
            )}
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
        </div>
      )}
    </>
  );
}
