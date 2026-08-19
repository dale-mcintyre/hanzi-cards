import { useMemo } from 'react';
import HanziCanvas from './HanziCanvas';
import useSwipeGesture from '../hooks/useSwipeGesture';
import { speakText } from '../utils/tts';
import { ColorPinyin } from '../utils/pinyinColor';

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

export default function StudySession({
  appState,
  countdownNum,
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

  const meaningList = useMemo(() => {
    if (!card?.meaning) return ['meaning'];
    return typeof card.meaning === 'string' ? card.meaning.split(';') : [card.meaning];
  }, [card]);

  const primaryMeaning = meaningList[0]?.trim();
  const secondaryMeanings = meaningList.slice(1).join('; ').trim();

  return (
    <>
      {appState === 'studying' && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {appState === 'countdown' && (
        <div className="card countdown-card">
          <div className="countdown-overlay">
            <span className="countdown-number">{countdownNum > 0 ? countdownNum : 'GO!'}</span>
          </div>
        </div>
      )}

      {appState === 'studying' && card && (
        <div
          className="card card--study"
          style={{
            transform: `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragX * 0.03}deg)`,
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
          {...pointerHandlers}
        >
          {dragX < -30 && <div className="badge badge--know">KNOW</div>}
          {dragX > 30 && <div className="badge badge--again">AGAIN</div>}

          <div className={`card-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
            <div className="card-face front-face">
              <button
                className="audio-icon-btn"
                onClick={(e) => { e.stopPropagation(); speakText(card.character); }}
                aria-label="Play pronunciation"
              >
                🔊
              </button>

              <div className="canvas-frame">
                <HanziCanvas character={card.character} mode="view" />
              </div>

              <button
                className="flip-hint-btn"
                onClick={(e) => { e.stopPropagation(); onFlip(); }}
                aria-label="Flip card"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <p className="meaning-primary">{primaryMeaning}</p>
                    {secondaryMeanings && <p className="meaning-secondary">{secondaryMeanings}</p>}
                  </div>
                  <div className="back-header-actions">
                    <button className="audio-icon-btn" onClick={() => speakText(card.character)} aria-label="Play pronunciation">
                      🔊
                    </button>
                    <button
                      className="report-mistake-btn"
                      onClick={(e) => { e.stopPropagation(); onReportMistake(); }}
                      aria-label="Report an issue with this card"
                    >
                      🚩
                    </button>
                  </div>
                </div>

                <div className="card-meta-row">
                  {card.level && <span className="meta-pill meta-pill--hsk">HSK {card.level}</span>}
                  {card.freq_rank && <span className="meta-pill meta-pill--freq">Freq #{card.freq_rank}</span>}
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
