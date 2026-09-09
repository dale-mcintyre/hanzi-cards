import { useEffect, useMemo, useRef, useState } from 'react';
import { speakText } from '../utils/tts';
import { ColorPinyin } from '../utils/pinyinColor';
import { fitScaleForLength } from '../utils/textFit';

// Correct-and-fast vs. correct-but-hesitant map to different SM-2 qualities
// (5 vs 4) so the schedule reflects genuine confidence, not just right/wrong.
const FAST_ANSWER_MS = 3000;
// Reveal window before auto-advancing - pinyin appears on all 4 options for
// this long, not just the correct one, so even a wrong guess is a quick
// lesson on the other 3 characters shown that round. Deliberately snappier
// than the old 1500ms - Warmup is a rapid-fire on-ramp, not the primary
// study mode, so it shouldn't dwell.
const REVEAL_DELAY_MS = 700;
const QUESTION_BASE_FONT_PX = 26;

// No `appState`/countdown handling here - App.jsx only ever mounts this
// component while appState === 'warmup', so the component existing in the
// tree at all is already the "actively studying" signal; there's no
// separate sub-phase to distinguish anymore now that the countdown screen
// is gone entirely.
export default function WarmupSession({ card, onAnswer, progressPercent }) {
  const [selected, setSelected] = useState(null);
  const questionShownAt = useRef(Date.now());
  const advanceTimerRef = useRef(null);

  // New question - reset the reveal state and restart the response-time
  // clock.
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

  useEffect(() => {
    if (!card || selected) return;

    function handleKeydown(e) {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < card.quizOptions.length) {
        handleSelect(card.quizOptions[index].character);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, selected]);

  if (!card) return null;

  return (
    <>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

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
    </>
  );
}
