import { useEffect, useMemo, useRef, useState } from 'react';
import Countdown from './Countdown';
import { speakText } from '../utils/tts';
import { ColorPinyin } from '../utils/pinyinColor';
import { fitScaleForLength } from '../utils/textFit';

// Correct-and-fast vs. correct-but-hesitant map to different SM-2 qualities
// (5 vs 4) so the schedule reflects genuine confidence, not just right/wrong.
const FAST_ANSWER_MS = 3000;
// Reveal window before auto-advancing - pinyin appears on all 6 options for
// this long, not just the correct one, so even a wrong guess is a quick
// lesson on the other 5 characters shown that round.
const REVEAL_DELAY_MS = 1500;
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
            {card.quizOptions.map((option) => {
              const isCorrectOption = option.character === card.character;
              const showResult = selected !== null;
              const isWrongPick = showResult && selected === option.character && !isCorrectOption;

              let className = 'quiz-option-btn';
              if (showResult && isCorrectOption) className += ' quiz-option-btn--correct';
              else if (isWrongPick) className += ' quiz-option-btn--incorrect';

              return (
                <button
                  key={option.character}
                  type="button"
                  className={className}
                  disabled={selected !== null}
                  onClick={() => handleSelect(option.character)}
                >
                  <span className="quiz-option-char">{option.character}</span>
                  {/* Always rendered (never conditionally mounted) so its
                      height is reserved from the first frame - otherwise
                      revealing it on answer would resize every button and
                      reflow the whole grid. visibility (not display) keeps
                      the space without showing the content early. */}
                  <span className={`quiz-option-pinyin ${showResult ? '' : 'quiz-option-pinyin--hidden'}`}>
                    <ColorPinyin pinyin={option.pinyin} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
