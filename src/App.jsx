import { useEffect, useState } from 'react';
import './App.css';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress } from './utils/storage';
import { speakText } from './utils/tts';
import { ColorPinyin } from './utils/pinyinColor';
import { getHardwiredDeck } from './data/hskLoader';

export default function App() {
  const [selectedLevels, setSelectedLevels] = useState(['3']);
  const [showSettings, setShowSettings] = useState(false);
  const [batchSize, setBatchSize] = useState(20);

  const [rawDeck, setRawDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [canvasMode, setCanvasMode] = useState('view');

  useEffect(() => {
    const localWords = getHardwiredDeck(selectedLevels);
    const savedProgress = getProgress();

    const merged = localWords.map((card) => ({
      ...card,
      stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
    }));

    setRawDeck(merged.slice(0, batchSize));
    setCurrentIndex(0);
  }, [selectedLevels, batchSize]);

  const card = rawDeck[currentIndex];

  const handleNextCard = (quality) => {
    if (!card) return;

    const newStats = calculateSM2(
      quality,
      card.stats?.repetitions || 0,
      card.stats?.interval || 1,
      card.stats?.easeFactor || 2.5
    );

    saveCardProgress(card.id, newStats);

    setIsFlipped(false);
    setShowDrawer(false);
    setCanvasMode('view');
    setCurrentIndex((prev) => (prev + 1) % rawDeck.length);
  };

  const toggleLevel = (levelStr) => {
    if (selectedLevels.includes(levelStr)) {
      if (selectedLevels.length === 1) return;
      setSelectedLevels(selectedLevels.filter((l) => l !== levelStr));
    } else {
      setSelectedLevels([...selectedLevels, levelStr]);
    }
  };

  const { dragX, dragY, isDragging, pointerHandlers } = useSwipeGesture({
    onSwipeLeft: () => handleNextCard(1),
    onSwipeRight: () => handleNextCard(5),
    onSwipeUp: () => { if (isFlipped) setShowDrawer(true); },
    onTap: () => {
      setIsFlipped(!isFlipped);
      setCanvasMode('view');
    }
  });

  if (!card) {
    return (
      <div className="app-container">
        <div className="card loading-card">Loading deck...</div>
      </div>
    );
  }

  // Parse meanings hierarchy (Primary vs Secondary)
  const meaningList = typeof card.meaning === 'string' ? card.meaning.split(',') : [card.meaning];
  const primaryMeaning = meaningList[0]?.trim();
  const secondaryMeanings = meaningList.slice(1).join(', ').trim();

  // SM-2 Intervals for Button Labels
  const nextHardInterval = calculateSM2(1, card.stats?.repetitions || 0, card.stats?.interval || 1, card.stats?.easeFactor || 2.5).interval;
  const nextEasyInterval = calculateSM2(5, card.stats?.repetitions || 0, card.stats?.interval || 1, card.stats?.easeFactor || 2.5).interval;

  return (
    <div className="app-container">
      <div className="stage">
        
        {/* Top Header Bar (Deck Info outside the card) */}
        <div className="header-bar">
          <div className="level-pills">
            {selectedLevels.map((lvl) => (
              <span key={lvl} className="level-pill">HSK {lvl}</span>
            ))}
          </div>
          <button className="gear-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {/* Main Card Stage */}
        <div
          className={`card ${isFlipped ? 'card--flipped' : ''}`}
          style={{
            transform: `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragX * 0.05}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          {...pointerHandlers}
        >
          {dragX > 30 && <div className="badge badge--know">KNOW IT</div>}
          {dragX < -30 && <div className="badge badge--again">AGAIN</div>}

          {!isFlipped ? (
            /* CLEAN FRONT LAYOUT */
            <div className="front-layout">
              <div className="canvas-frame">
                {/* Floating Audio Button */}
                <button 
                  className="floating-audio-btn" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    speakText(card.character); 
                  }}
                  title="Listen"
                >
                  🔊
                </button>

                {/* Tianzige Grid Canvas */}
                <HanziCanvas character={card.character} mode="view" />

                {/* Floating Radical Chip */}
                {card.culturalNote && card.culturalNote.includes('Radical') && (
                  <span className="floating-radical">
                    {card.culturalNote.replace('Radical:', '部首')}
                  </span>
                )}
              </div>

              <span className="tap-hint">Tap card for details ↺</span>
            </div>
          ) : (
            /* REVERSE LAYOUT */
            <div className="back-layout">
              <div className="back-header">
                <div>
                  <h1 className="pinyin-title">
                    <ColorPinyin pinyin={card.pinyin} />
                  </h1>
                  <p className="meaning-primary">{primaryMeaning}</p>
                  {secondaryMeanings && (
                    <p className="meaning-secondary">{secondaryMeanings}</p>
                  )}
                </div>
                <button 
                  className="icon-btn" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    speakText(card.character); 
                  }}
                >
                  🔊
                </button>
              </div>

              {/* Stroke Control Toggle */}
              <div className="writing-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`mode-btn ${canvasMode === 'animate' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasMode(canvasMode === 'animate' ? 'view' : 'animate');
                  }}
                >
                  🎬 Watch Stroke Order
                </button>
              </div>

              {canvasMode !== 'view' && (
                <div className="reverse-canvas-box" onClick={(e) => e.stopPropagation()}>
                  <HanziCanvas character={card.character} mode={canvasMode} />
                </div>
              )}

              {/* Usage Drawer Trigger */}
              <button 
                className="drawer-trigger-btn" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowDrawer(true); 
                }}
              >
                Usage & Example Sentences ↑
              </button>

              {/* Sleek Single-Line Grading Buttons */}
              <div className="grading-row" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="grade-btn grade-btn--hard" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleNextCard(1); 
                  }}
                >
                  ← Hard ({nextHardInterval}d)
                </button>
                <button 
                  className="grade-btn grade-btn--easy" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleNextCard(5); 
                  }}
                >
                  Easy ({nextEasyInterval}d) →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SETTINGS DRAWER */}
        {showSettings && (
          <div 
            className="drawer-overlay" 
            onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <div className="drawer-header">
                <h2>Deck Focus & Settings</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
              </div>

              <div className="settings-group">
                <label className="settings-label">Active HSK Levels</label>
                <div className="pill-grid">
                  {['1', '2', '3', '4', '5', '6'].map((lvl) => (
                    <button
                      key={lvl}
                      className={`pill-btn ${selectedLevels.includes(lvl) ? 'active' : ''}`}
                      onClick={() => toggleLevel(lvl)}
                    >
                      HSK {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">Session Size</label>
                <select 
                  value={batchSize} 
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="clean-select"
                >
                  <option value={10}>10 Cards per Session</option>
                  <option value={20}>20 Cards per Session</option>
                  <option value={50}>50 Cards per Session</option>
                </select>
              </div>

              <button className="action-btn" onClick={() => setShowSettings(false)}>
                Save & Continue
              </button>
            </div>
          </div>
        )}

        {/* CULTURAL & SENTENCE DRAWER */}
        {showDrawer && (
          <div 
            className="drawer-overlay" 
            onClick={(e) => { e.stopPropagation(); setShowDrawer(false); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <div className="drawer-header">
                <div>
                  <h2>{card.character} (<ColorPinyin pinyin={card.pinyin} />)</h2>
                  <p>{card.meaning}</p>
                </div>
                <button className="close-btn" onClick={() => setShowDrawer(false)}>✕</button>
              </div>

              <div className="drawer-body">
                <h3>Example Sentence</h3>
                <div className="sentence-card">
                  <div className="sentence-row">
                    <p className="chinese">{card.sentence}</p>
                    <button onClick={(e) => { e.stopPropagation(); speakText(card.sentence); }}>🔊</button>
                  </div>
                  <p className="pinyin"><ColorPinyin pinyin={card.sentencePinyin} /></p>
                  <p className="english">{card.sentenceEnglish}</p>
                </div>

                <h3>Notes</h3>
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