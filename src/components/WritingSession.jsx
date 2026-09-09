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

// How long a phase-transition banner sits on screen before the next
// phase actually starts - just long enough to register as a deliberate
// beat, not a delay. Shared by both the Prime->Recall and Recall->
// Sentence handoffs.
const PHASE_TRANSITION_MS = 1000;
// Each transitional phase's fixed-length banner resolves into its real
// phase automatically, never on user input.
const TRANSITION_TARGETS = { transition: 'recall', 'sentence-transition': 'sentence' };

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
// state for Phase 3 - unrevealed renders a fixed-width blank (sized to
// the target's own character count so nothing reflows on reveal),
// revealed renders the target itself, accented. If the target word isn't
// found verbatim in the sentence (shouldn't happen given how these are
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

/**
 * Three-phase pen-and-paper session:
 *  1. Priming - watch the still-learning cards (primeQueue) get
 *     demonstrated, no grading.
 *  2. Blind Recall - test every card in recallQueue from memory, graded
 *     on the bare character (pinyin/meaning prompt only).
 *  3. Sentence Writing - a short coda testing up to 2 already-learned
 *     characters (sentenceQueue) in a full-sentence Cloze context: the
 *     prompt is the sentence itself (target blanked, English for
 *     context, pinyin withheld), not the bare word - a harder,
 *     production-in-context test. Graded the same way as Recall, into
 *     the same writing schedule.
 *
 * `primeQueue`/`recallQueue`/`sentenceQueue` are the whole
 * already-computed (by buildPenAndPaperQueue) arrays, not just the
 * current `card` - Priming needs to walk its own subset independently of
 * App.jsx's currentIndex/handleNextCard pipeline (which only advances
 * once Recall/Sentence actually start grading), and Recall/Sentence each
 * need their own array to compute this card's position within *their*
 * phase, not the combined batch.
 *
 * No `appState`/countdown handling here - App.jsx only ever mounts this
 * component while appState === 'pen-and-paper'.
 */
export default function WritingSession({ primeQueue, recallQueue, sentenceQueue, card, onGrade, progressPercent }) {
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

  // A brand new session (new array references from a fresh
  // buildPenAndPaperQueue call) always restarts. Starts straight in
  // Recall if nothing in this particular batch needs priming.
  useEffect(() => {
    setPhase(primeQueue.length === 0 ? 'recall' : 'priming');
    setPrimeIndex(0);
    setRevealedCardId(null);
  }, [primeQueue, recallQueue, sentenceQueue]);

  // Both transitional phases resolve into their real phase on their own,
  // after a fixed pause - never on user input.
  useEffect(() => {
    const target = TRANSITION_TARGETS[phase];
    if (!target) return;
    const timer = setTimeout(() => setPhase(target), PHASE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // App.jsx's sessionQueue (and so `card`) walks Recall's cards first,
  // then Sentence's - once `card` crosses into sentenceQueue, that's the
  // signal to hand off to the Phase 3 banner. Only fires once per
  // session: after the handoff, `phase` is never 'recall' again while
  // still looking at a sentenceQueue card, so this can't re-trigger on
  // every subsequent sentence card.
  useEffect(() => {
    if (phase !== 'recall' || !card) return;
    if (sentenceQueue.some((c) => c.id === card.id)) setPhase('sentence-transition');
  }, [card, phase, sentenceQueue]);

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

  // Recall and Sentence are both "testing" phases - same reveal/grade
  // interaction, just a different prompt underneath.
  const isTestingPhase = phase === 'recall' || phase === 'sentence';

  useEffect(() => {
    function handleKeydown(e) {
      if (phase === 'priming') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          advancePriming();
        }
        return;
      }
      if (!isTestingPhase || !card) return;
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
  }, [phase, isTestingPhase, revealed, card, primeIndex, primeQueue, onGrade]);

  const recallPosition = card ? recallQueue.indexOf(card) + 1 : 0;
  const sentencePosition = card ? sentenceQueue.indexOf(card) + 1 : 0;

  if (phase === 'priming' && !primeCard) return null;
  if (isTestingPhase && !card) return null;

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
          <span className="box-section-label">Recall · {recallPosition} of {recallQueue.length}</span>

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

      {phase === 'sentence-transition' && (
        <div className="card card--writing writing-phase-transition">
          <p className="phase-transition-title">Phase 3: Sentence Writing</p>
          <p className="phase-transition-sub">Write the missing word in context</p>
        </div>
      )}

      {phase === 'sentence' && (
        <div className="card card--writing">
          <span className="box-section-label">Sentence · {sentencePosition} of {sentenceQueue.length}</span>

          <div className="sentence-context-card">
            <p className="cloze-sentence-zh">
              {renderClozeSentence(card.example_sentence.cn, card.character, revealed)}
            </p>
            {revealed && <p className="sentence-pinyin">{card.example_sentence.pinyin}</p>}
            <p className="sentence-en">{card.example_sentence.en}</p>
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
              <p className="writing-reveal-hint">Write the missing word in your notebook</p>
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
