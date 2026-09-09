import { useEffect, useMemo, useRef } from 'react';
import HanziCanvas from './HanziCanvas';
import useSwipeGesture from '../hooks/useSwipeGesture';
import { speakText, getSoundEnabled } from '../utils/tts';
import { ColorPinyin } from '../utils/pinyinColor';
import { MASTERED_INTERVAL_DAYS } from '../utils/storage';
import { calculateSM2 } from '../utils/sm2';
import { fitScaleForLength } from '../utils/textFit';
import { SpeakerIcon, FlagIcon } from './icons';

const AUTO_PLAY_DELAY_MS = 1500;
const MEANING_BASE_FONT_PX = 19;

function HighlightedSentence({ sentence, targetChar, muted = false }) {
  if (!sentence || !targetChar) return <span>{sentence}</span>;
  const parts = sentence.split(targetChar);
  if (parts.length === 1) return <span>{sentence}</span>;

  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className={muted ? "char-highlight-muted" : "char-highlight"}>
              {targetChar}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

// No `appState`/countdown handling here - App.jsx only ever mounts this
// component while appState === 'self-study', so the component existing in
// the tree at all is already the "actively studying" signal.
export default function StudySession({
  card,
  isFlipped,
  onFlip,
  onGrade,
  onReportMistake,
  progressPercent,
}) {
  const { dragX, dragY, isDragging, pointerHandlers } = useSwipeGesture({
    onSwipeLeft: () => onGrade(5),
    onSwipeRight: () => onGrade(1),
    onTap: onFlip,
  });

  // Tracks which card.id has already had its pronunciation resolved (either
  // the delayed auto-play fired, or the user flipped before it did) so
  // neither path double-speaks and flipping back and forth on the same card
  // doesn't replay it. Reset implicitly whenever `card` changes - a stale
  // id just never matches the new card.
  const autoPlayedRef = useRef(null);

  useEffect(() => {
    if (!card) return;

    if (isFlipped) {
      // Flipped (tap, swipe-tap, or the flip-hint button) before the delay
      // elapsed - speak immediately instead of waiting out the timer.
      if (autoPlayedRef.current !== card.id) {
        // Only mark resolved if sound was actually on - otherwise a card
        // whose auto-play window passed while muted would stay silently
        // "resolved" forever, even after the user unmutes.
        if (getSoundEnabled()) autoPlayedRef.current = card.id;
        speakText(card.character);
      }
      return;
    }

    if (autoPlayedRef.current === card.id) return;

    const timer = setTimeout(() => {
      if (getSoundEnabled()) autoPlayedRef.current = card.id;
      speakText(card.character);
    }, AUTO_PLAY_DELAY_MS);
    // Cleared whenever `card`/`isFlipped` change before the delay elapses -
    // a new card or an early flip both cancel the pending auto-play so it
    // can't fire out of sequence.
    return () => clearTimeout(timer);
  }, [card, isFlipped]);

  // Space flips (matches tap), 1/2 grade (matches swipe left/right) once
  // the back face is actually showing - grading a still-hidden card
  // wouldn't mean anything.
  useEffect(() => {
    if (!card) return;

    function handleKeydown(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        onFlip();
        return;
      }
      if (!isFlipped) return;
      if (e.key === '1') onGrade(1);
      else if (e.key === '2') onGrade(5);
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [card, isFlipped, onFlip, onGrade]);

  const meaningList = useMemo(() => {
    if (!card?.meaning) return ['meaning'];
    return typeof card.meaning === 'string' ? card.meaning.split(';') : [card.meaning];
  }, [card]);

  const primaryMeaning = meaningList[0]?.trim();
  // Some definitions run 80+ characters - shrink proportionally so a long
  // one doesn't dominate the card (the back face itself already scrolls,
  // this just keeps a long definition from looking oversized/awkward).
  const meaningFontSize = MEANING_BASE_FONT_PX * fitScaleForLength(primaryMeaning?.length || 0);
  const secondaryMeanings = meaningList.slice(1).join('; ').trim();

  // Quiet review-history indicator - nothing for a never-studied card (no
  // history to report), "Mastered" once the SM-2 interval crosses the same
  // threshold the Settings drawer's mastery matrix uses, otherwise a plain
  // seen-count. Deliberately the unstyled `.meta-pill` (no color variant)
  // to stay the quietest pill on the card.
  const repetitions = card?.stats?.repetitions || 0;
  const interval = card?.stats?.interval || 0;
  const historyLabel =
    repetitions === 0 ? null : interval >= MASTERED_INTERVAL_DAYS ? 'Mastered' : `Seen ${repetitions}×`;

  // Interval transparency: what grading Again/Good would actually do to
  // this card's schedule, computed fresh per card rather than assumed -
  // Again always lands on 1 day today (SM-2's quality<3 branch always
  // resets to 1), but computing it live means this never silently drifts
  // out of sync with sm2.js's actual behavior.
  const gradePreview = useMemo(() => {
    const prevReps = card?.stats?.repetitions || 0;
    const prevInterval = card?.stats?.interval || 1;
    const prevEase = card?.stats?.easeFactor || 2.5;
    return {
      again: calculateSM2(1, prevReps, prevInterval, prevEase).interval,
      good: calculateSM2(5, prevReps, prevInterval, prevEase).interval,
    };
  }, [card]);

  if (!card) return null;

  return (
    <>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div
        className="card card--study"
        style={{
          transform: `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragX * 0.03}deg)`,
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        {...pointerHandlers}
      >
        {dragX < -30 && <div className="badge badge--know">GOOD</div>}
        {dragX > 30 && <div className="badge badge--again">AGAIN</div>}

        <div className={`card-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
          <div className="card-face front-face">
            <button
              className="audio-icon-btn"
              onClick={(e) => { e.stopPropagation(); speakText(card.character); }}
              aria-label="Play pronunciation"
            >
              <SpeakerIcon />
            </button>

            <div className="canvas-frame">
              <HanziCanvas character={card.character} mode="view" />
            </div>

            <button
              className="flip-hint-btn"
              onClick={(e) => { e.stopPropagation(); onFlip(); }}
              aria-label="Flip card"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          </div>

          <div className="card-face back-face">
            <div className="back-scrollable-content">
              <div className="back-header-group">
                <div>
                  <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
                  <p className="meaning-primary" style={{ fontSize: `${meaningFontSize}px` }}>{primaryMeaning}</p>
                  {secondaryMeanings && <p className="meaning-secondary">{secondaryMeanings}</p>}
                </div>
                <div className="back-header-actions">
                  <button className="audio-icon-btn" onClick={() => speakText(card.character)} aria-label="Play pronunciation">
                    <SpeakerIcon />
                  </button>
                  <button
                    className="report-mistake-btn"
                    onClick={(e) => { e.stopPropagation(); onReportMistake(); }}
                    aria-label="Report an issue with this card"
                  >
                    <FlagIcon />
                  </button>
                </div>
              </div>

              <div className="card-meta-row">
                {card.level && <span className="meta-pill meta-pill--hsk">HSK {card.level}</span>}
                {card.frequency && <span className="meta-pill meta-pill--freq">Freq #{card.frequency}</span>}
                {historyLabel && <span className="meta-pill">{historyLabel}</span>}
              </div>

              <div className="card-internal-divider" />

              <div className="card-sentence-box">
                <span className="box-section-label">Context Example</span>
                <p className="sentence-zh">
                  <HighlightedSentence sentence={card.sentence} targetChar={card.character} muted={false} />
                </p>
                <p className="sentence-py"><ColorPinyin pinyin={card.sentencePinyin} /></p>
                <p className="sentence-en">{card.sentenceEnglish}</p>
              </div>
            </div>

            <div className="study-grade-row">
              <button
                type="button"
                className="study-grade-btn study-grade-btn--again"
                onClick={(e) => { e.stopPropagation(); onGrade(1); }}
              >
                <span className="study-grade-key">1</span>
                <span className="study-grade-label">Again</span>
                <span className="study-grade-interval">{gradePreview.again}d</span>
              </button>
              <button
                type="button"
                className="study-grade-btn study-grade-btn--good"
                onClick={(e) => { e.stopPropagation(); onGrade(5); }}
              >
                <span className="study-grade-key">2</span>
                <span className="study-grade-label">Good</span>
                <span className="study-grade-interval">{gradePreview.good}d</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
