import { useEffect, useMemo, useRef, useState } from 'react';
import Countdown from './Countdown';
import { speakText } from '../utils/tts';
import { fitScaleForLength } from '../utils/textFit';

// Correct-and-fast vs. correct-but-hesitant map to different SM-2 qualities
// (5 vs 4) so the schedule reflects genuine confidence, not just right/wrong.
const FAST_ANSWER_MS = 3000;
const REVEAL_DELAY_MS = 1200;
const QUESTION_BASE_FONT_PX = 26;

export default function QuizSession({ appState, countdownNum, card, onAnswer, progressPercent }) {
  const [selected, setSelected] = useState(null);
  const questionShownAt = useRef(Date.now());
  const advanceTimerRef = useRef(null);

  // New question - reset the reveal state and restart the response-time
  // clock. Also covers leaving 'studying' (e.g. mid-countdown for the next
  // session) so a stale timer from a previous question can't fire late.
  useEffect(() => {
    setSelected(null);
    questionShownAt.current = Date.now();
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [card]);

  const primaryMeaning = useMemo(() => {
    if (!card?.meaning) return '';
    const first = typeof card.meaning === 'string' ? card.meaning.split(';')[0] : card.meaning;
    return first?.trim() || '';
  }, [card]);

  // Some dictionary definitions run 80+ characters - at a fixed large font
  // that would overflow the quiz card, which (unlike the study card's back
  // face) has no scroll region of its own. Shrink proportionally instead.
  const questionFontSize = QUESTION_BASE_FONT_PX * fitScaleForLength(primaryMeaning.length);

  function handleSelect(optionChar) {
    if (selected || !card) return; // first tap wins - no changing your answer
    setSelected(optionChar);

    const isCorrect = optionChar === card.character;
    const elapsed = Date.now() - questionShownAt.current;
    const quality = isCorrect ? (elapsed < FAST_ANSWER_MS ? 5 : 4) : 1;

    speakText(card.character);
    advanceTimerRef.current = setTimeout(() => onAnswer(quality), REVEAL_DELAY_MS);
  }

  return (
    <>
      {appState === 'studying' && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {appState === 'countdown' && <Countdown countdownNum={countdownNum} />}

      {appState === 'studying' && card && (
        <div className="card quiz-card">
          <span className="box-section-label">Which character means this?</span>
          <p className="quiz-question-english" style={{ fontSize: `${questionFontSize}px` }}>{primaryMeaning}</p>

          <div className="quiz-options-grid">
            {card.quizOptions.map((optionChar) => {
              const isCorrectOption = optionChar === card.character;
              const showResult = selected !== null;
              const isWrongPick = showResult && selected === optionChar && !isCorrectOption;

              let className = 'quiz-option-btn';
              if (showResult && isCorrectOption) className += ' quiz-option-btn--correct';
              else if (isWrongPick) className += ' quiz-option-btn--incorrect';

              return (
                <button
                  key={optionChar}
                  type="button"
                  className={className}
                  disabled={selected !== null}
                  onClick={() => handleSelect(optionChar)}
                >
                  {optionChar}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
