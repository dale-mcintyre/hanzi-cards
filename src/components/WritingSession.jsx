import { useEffect, useMemo, useState } from 'react';
import HanziCanvas from './HanziCanvas';
import { ColorPinyin } from '../utils/pinyinColor';
import { speakText } from '../utils/tts';
import { calculateWritingSchedule } from '../utils/writingSchedule';
import { SpeakerIcon } from './icons';

// Fixed sizing ladder for Writing Recall Mode's grid boxes - independent
// of HanziCanvas's default ladder (used by the reading-mode StudySession
// card), per the spec: 1 char = 180px, 2 = 120px, 3-4 = 84px.
const WRITING_SIZE_LADDER = { 1: 180, 2: 120, 3: 84, 4: 84 };

// How long the "Phase 2: Blind Recall" beat sits on screen between
// Priming ending and Recall actually starting - just long enough to
// register as a deliberate transition, not a delay.
const PHASE_TRANSITION_MS = 1000;

const GRADE_OPTIONS = [
  { quality: 1, key: '1', label: 'Missed' },
  { quality: 2, key: '2', label: 'Hesitated' },
  { quality: 3, key: '3', label: 'Clean' },
];

function firstMeaning(meaning) {
  return typeof meaning === 'string' ? meaning.split(';')[0].trim() : meaning;
}

// Splits a Cloze sentence around the target word, the same way
// StudySession's HighlightedSentence does, but with a fill-in-the-blank
// state for Recall - unrevealed renders a fixed-width blank (sized to the
// target's own character count so nothing reflows on reveal), revealed
// renders the target itself, accented. If the target word isn't found
// verbatim in the sentence (shouldn't happen given how these are
// generated, but data is data), the sentence renders untouched rather
// than silently dropping content.
function renderClozeSentence(sentenceCn, targetChar, isRevealed) {
  if (!sentenceCn || !targetChar) return sentenceCn;
  const parts = sentenceCn.split(targetChar);
  if (parts.length === 1) return sentenceCn;

  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && (
        isRevealed ? (
          <span className="cloze-target-revealed">{targetChar}</span>
        ) : (
          <span className="cloze-blank" style={{ minWidth: `${targetChar.length}em` }}>____</span>
        )
      )}
    </span>
  ));
}

// Cloze sentence card shown beneath the Tianzige grid in both phases.
// Priming always shows the target plainly and its pinyin (it's actively
// teaching); Recall blanks the target and withholds pinyin until the
// card is revealed, so neither gives away the answer early. Renders
// nothing - not even the container - for a card with no example_sentence
// yet, since enrichment is still rolling out across the deck.
function SentenceContext({ exampleSentence, targetChar, isRevealed, showPinyin }) {
  if (!exampleSentence) return null;
  return (
    <div className="sentence-context-card">
      <p className="cloze-sentence-zh">{renderClozeSentence(exampleSentence.cn, targetChar, isRevealed)}</p>
      {showPinyin && <p className="sentence-pinyin">{exampleSentence.pinyin}</p>}
      <p className="sentence-en">{exampleSentence.en}</p>
    </div>
  );
}

/**
 * Two-phase pen-and-paper session: Priming (watch the still-learning
 * cards get demonstrated, no grading) then Blind Recall (test every card
 * in the batch from memory, graded). `batch` is the full recall queue and
 * `primeQueue` the (already-computed, by buildPenAndPaperQueue) subset
 * that needs priming - unlike the other session components, this one
 * needs whole arrays up front (not just the current `card`) so Priming
 * can walk through its own subset independently of App.jsx's
 * currentIndex/handleNextCard pipeline, which only ever advances once
 * Recall actually starts grading.
 *
 * No `appState`/countdown handling here - App.jsx only ever mounts this
 * component while appState === 'pen-and-paper'.
 */
export default function WritingSession({ batch, primeQueue, card, onGrade, progressPercent }) {
  const [phase, setPhase] = useState(() => (primeQueue.length === 0 ? 'recall' : 'priming'));
  const [primeIndex, setPrimeIndex] = useState(0);
  // Which card's answer is currently revealed, by id - not a bare boolean.
  // A boolean reset via a useEffect keyed on `card` is one render behind:
  // the new card's data lands on the same render its `mode` prop is
  // computed, but the effect that would reset a boolean back to false
  // only runs after that render commits - which briefly showed the
  // *next* card's character/strokes in `animate` mode before the reset
  // caught up. Deriving `revealed` from an id comparison is correct on
  // the very first render of a new card, no effect needed.
  const [revealedCardId, setRevealedCardId] = useState(null);
  const revealed = !!card && revealedCardId === card.id;

  // A brand new batch (new session launch) always restarts - `batch`/
  // `primeQueue` keep the same array references for the whole session, so
  // this only fires on an actual new session. Starts straight in Recall
  // if nothing in this particular batch needs priming.
  useEffect(() => {
    setPhase(primeQueue.length === 0 ? 'recall' : 'priming');
    setPrimeIndex(0);
    setRevealedCardId(null);
  }, [batch, primeQueue]);

  // The transition beat is a fixed-length, non-interactive pause between
  // Priming ending and Recall actually starting - it always resolves on
  // its own, never on user input.
  useEffect(() => {
    if (phase !== 'transition') return;
    const timer = setTimeout(() => setPhase('recall'), PHASE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const primeCard = primeQueue[primeIndex];

  // Demonstrates pronunciation immediately (not delayed, unlike
  // StudySession's flip reveal) - Priming is actively teaching the card,
  // not testing recall, so there's no reason to withhold it.
  useEffect(() => {
    if (phase === 'priming' && primeCard) {
      speakText(primeCard.character);
    }
  }, [phase, primeCard]);

  // Interval transparency, same idea as StudySession's Again/Good preview
  // - Missed/Hesitated are fixed by calculateWritingSchedule regardless of
  // history, but Clean's interval grows with the card's own writing reps,
  // so it's computed fresh per card rather than assumed.
  const gradePreview = useMemo(() => {
    if (!card) return {};
    return {
      1: calculateWritingSchedule(1, card.stats).writingIntervalDays,
      2: calculateWritingSchedule(2, card.stats).writingIntervalDays,
      3: calculateWritingSchedule(3, card.stats).writingIntervalDays,
    };
  }, [card]);

  function advancePriming() {
    if (primeIndex + 1 >= primeQueue.length) {
      setPhase('transition');
    } else {
      setPrimeIndex((i) => i + 1);
    }
  }

  useEffect(() => {
    function handleKeydown(e) {
      if (phase === 'priming') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          advancePriming();
        }
        return;
      }
      if (phase === 'transition') return;
      if (!card) return;
      if (!revealed) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          setRevealedCardId(card.id);
        }
        return;
      }
      const option = GRADE_OPTIONS.find((o) => o.key === e.key);
      if (option) onGrade(option.quality);
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealed, card, primeIndex, primeQueue, onGrade]);

  const recallPosition = card ? batch.indexOf(card) + 1 : 0;

  if (phase === 'priming' && !primeCard) return null;
  if (phase === 'recall' && !card) return null;

  return (
    <>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {phase === 'priming' && (
        <div className="card card--writing">
          <span className="box-section-label">Priming · {primeIndex + 1} of {primeQueue.length}</span>

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
            <SpeakerIcon />
          </button>

          <div className="canvas-frame writing-canvas-frame">
            <HanziCanvas
              character={primeCard.character}
              mode="animate"
              sequential
              sizeByLength={WRITING_SIZE_LADDER}
            />
          </div>

          <p className="writing-instruction-cue">Observe stroke order &amp; copy 1× to your notebook</p>

          <SentenceContext
            exampleSentence={primeCard.example_sentence}
            targetChar={primeCard.character}
            isRevealed
            showPinyin
          />

          <button type="button" className="primary-launch-btn" onClick={advancePriming}>
            Next <span className="writing-key-hint">[Space]</span>
          </button>
        </div>
      )}

      {phase === 'transition' && (
        <div className="card card--writing writing-phase-transition">
          <p className="phase-transition-title">Phase 2: Blind Recall</p>
          <p className="phase-transition-sub">Write from memory</p>
        </div>
      )}

      {phase === 'recall' && (
        <div className="card card--writing">
          <span className="box-section-label">Recall · {recallPosition} of {batch.length}</span>

          <div className="writing-prompt-meta">
            <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
            <p className="meaning-primary">{firstMeaning(card.meaning)}</p>
          </div>

          <div
            className="canvas-frame writing-canvas-frame"
            onClick={() => { if (!revealed) setRevealedCardId(card.id); }}
          >
            <HanziCanvas
              character={card.character}
              mode={revealed ? 'animate' : 'hidden'}
              sequential
              sizeByLength={WRITING_SIZE_LADDER}
            />
            {!revealed && (
              <p className="writing-reveal-hint">Write from memory in your notebook</p>
            )}
          </div>

          <SentenceContext
            exampleSentence={card.example_sentence}
            targetChar={card.character}
            isRevealed={revealed}
            showPinyin={revealed}
          />

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
                  <span className="writing-grade-interval">{gradePreview[option.quality]}d</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
