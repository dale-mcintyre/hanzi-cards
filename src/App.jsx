import { useEffect, useState } from 'react';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress } from './utils/storage';
import { speakText } from './utils/tts';
import { HSK_DECK } from './data/hskData';
import './App.css'; // <--- Make sure this line exists!

export default function App() {
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [canvasMode, setCanvasMode] = useState('view'); // 'view' | 'animate' | 'practice'

  // Load progress safely
  useEffect(() => {
    const savedProgress = getProgress();
    const merged = HSK_DECK.map((card) => ({
      ...card,
      stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
    }));
    setDeck(merged);
  }, []);

  const card = deck[currentIndex];

  const handleNextCard = (quality) => {
    if (!card) return;

    const newStats = calculateSM2(
      quality,
      card.stats.repetitions,
      card.stats.interval,
      card.stats.easeFactor
    );

    saveCardProgress(card.id, newStats);

    const updated = [...deck];
    updated[currentIndex].stats = newStats;
    setDeck(updated);

    // Reset card state for next item
    setIsFlipped(false);
    setShowDrawer(false);
    setCanvasMode('view');
    setCurrentIndex((prev) => (prev + 1) % deck.length);
  };

  const { dragX, dragY, isDragging, pointerHandlers } = useSwipeGesture({
    onSwipeLeft: () => handleNextCard(1),  // Hard / Again
    onSwipeRight: () => handleNextCard(5), // Easy / Know It
    onSwipeUp: () => {
      if (isFlipped) setShowDrawer(true);
    },
    onTap: () => {
      setIsFlipped(!isFlipped);
      setCanvasMode('view');
    }
  });

  if (!card) return <div className="loading-state">Loading cards...</div>;

  return (
    <div className="app-container">
      <div className="stage">
        
        {/* Main Card */}
        <div
          className={`card ${isFlipped ? 'card--flipped' : ''}`}
          style={{
            transform: `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragX * 0.05}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          {...pointerHandlers}
        >
          {/* Swipe Badges */}
          {dragX > 30 && <div className="badge badge--know">KNOW IT</div>}
          {dragX < -30 && <div className="badge badge--again">AGAIN</div>}

          {!isFlipped ? (
            /* FRONT: 100% DISTRACTION FREE — JUST THE CHARACTER */
            <div className="front-layout">
              <div className="canvas-wrapper">
                <HanziCanvas character={card.character} mode="view" />
              </div>
              <span className="tap-hint">Tap to flip ↺</span>
            </div>
          ) : (
            /* REVERSE SIDE: PINYIN, DEFINITION, AUDIO & WRITING TOOLS */
            <div className="back-layout">
              <div className="back-header">
                <div>
                  <h1 className="pinyin-title">{card.pinyin}</h1>
                  <p className="meaning-title">{card.meaning}</p>
                </div>
                {/* Working Audio Button */}
                <button 
                  className="icon-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    speakText(card.character);
                  }}
                  title="Listen Pronunciation"
                >
                  🔊
                </button>
              </div>

              {/* Stroke Practice & Animation Mode Selectors */}
              <div className="writing-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`mode-btn ${canvasMode === 'animate' ? 'active' : ''}`}
                  onClick={() => setCanvasMode(canvasMode === 'animate' ? 'view' : 'animate')}
                >
                  🎬 Watch Stroke Order
                </button>
                <button
                  className={`mode-btn ${canvasMode === 'practice' ? 'active' : ''}`}
                  onClick={() => setCanvasMode(canvasMode === 'practice' ? 'view' : 'practice')}
                >
                  ✍️ Practice Writing
                </button>
              </div>

              {/* Practice Canvas embedded on Reverse Side */}
              {canvasMode !== 'view' && (
                <div className="reverse-canvas-box" onClick={(e) => e.stopPropagation()}>
                  <HanziCanvas character={card.character} mode={canvasMode} />
                </div>
              )}

              {/* Cultural Drawer Trigger */}
              <button 
                className="drawer-trigger-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDrawer(true);
                }}
              >
                Cultural Notes & Examples ↑
              </button>

              {/* Grading Action Buttons */}
              <div className="grading-row" onClick={(e) => e.stopPropagation()}>
                <button className="grade-btn grade-btn--hard" onClick={() => handleNextCard(1)}>
                  ← Hard (Again)
                </button>
                <button className="grade-btn grade-btn--easy" onClick={() => handleNextCard(5)}>
                  Easy (Know It) →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SWIPE-UP CULTURAL DRAWER */}
        {showDrawer && (
          <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              
              <div className="drawer-header">
                <div>
                  <h2>{card.character} ({card.pinyin})</h2>
                  <p>{card.meaning}</p>
                </div>
                <button className="close-btn" onClick={() => setShowDrawer(false)}>✕</button>
              </div>

              <div className="drawer-body">
                <h3>Example Sentence</h3>
                <div className="sentence-card">
                  <div className="sentence-row">
                    <p className="chinese">{card.sentence}</p>
                    <button onClick={() => speakText(card.sentence)}>🔊</button>
                  </div>
                  <p className="pinyin">{card.sentencePinyin}</p>
                  <p className="english">{card.sentenceEnglish}</p>
                </div>

                <h3>Cultural Context</h3>
                <div className="culture-card">
                  <p>💡 {card.culturalNote}</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}