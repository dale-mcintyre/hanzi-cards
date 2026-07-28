import { useEffect, useState } from 'react';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress } from './utils/storage';
import { speakText } from './utils/tts';

const HSK_RAW_CDN = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/json/';

export default function App() {
  const [selectedLevels, setSelectedLevels] = useState(['3']);
  const [showSettings, setShowSettings] = useState(false);
  const [batchSize, setBatchSize] = useState(20);

  const [rawDeck, setRawDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [canvasMode, setCanvasMode] = useState('view');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSelectedLevels() {
      setIsLoading(true);
      try {
        let combinedWords = [];
        for (const level of selectedLevels) {
          const res = await fetch(`${HSK_RAW_CDN}hsk${level}.json`);
          const data = await res.json();
          const formatted = data.map((item, idx) => ({
            id: `hsk${level}_${idx}_${item.hanzi || item.simplified}`,
            character: item.hanzi || item.simplified || item.character,
            pinyin: item.pinyin,
            meaning: Array.isArray(item.translations) ? item.translations.join(', ') : item.translations || item.meaning,
            hskLevel: `HSK ${level}`,
            sentence: item.example?.hanzi || `这是“${item.hanzi || item.simplified}”字。`,
            sentencePinyin: item.example?.pinyin || '',
            sentenceEnglish: item.example?.translation || `This is the character for ${item.meaning || 'it'}.`,
            culturalNote: item.radical ? `Radical: ${item.radical} (${item.strokes || '?'} strokes)` : 'Common HSK vocabulary word.'
          }));
          combinedWords = [...combinedWords, ...formatted];
        }

        const savedProgress = getProgress();
        const merged = combinedWords.map((card) => ({
          ...card,
          stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
        }));

        setRawDeck(merged.slice(0, batchSize));
        setCurrentIndex(0);
      } catch (err) {
        console.error('Error fetching vocabulary:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (selectedLevels.length > 0) {
      loadSelectedLevels();
    }
  }, [selectedLevels, batchSize]);

  const card = rawDeck[currentIndex];

  const handleNextCard = (quality) => {
    if (!card) return;

    const newStats = calculateSM2(
      quality,
      card.stats.repetitions,
      card.stats.interval,
      card.stats.easeFactor
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

  return (
    <div className="app-container">
      <div className="stage">
        
        {/* Minimalist Header */}
        <div className="header-bar">
          <div className="level-pills">
            {selectedLevels.map((lvl) => (
              <span key={lvl} className="level-pill">HSK {lvl}</span>
            ))}
          </div>
          <button className="gear-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {/* Card State */}
        {isLoading ? (
          <div className="card loading-card">Loading Deck...</div>
        ) : !card ? (
          <div className="card loading-card">No cards available.</div>
        ) : (
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
              /* FRONT: 100% CLEAN CHARACTER */
              <div className="front-layout">
                <div className="canvas-wrapper">
                  <HanziCanvas character={card.character} mode="view" />
                </div>
                <span className="tap-hint">Tap card for details ↺</span>
              </div>
            ) : (
              /* REVERSE SIDE */
              <div className="back-layout">
                <div className="back-header">
                  <div>
                    <h1 className="pinyin-title">{card.pinyin}</h1>
                    <p className="meaning-title">{card.meaning}</p>
                  </div>
                  <button className="icon-btn" onClick={(e) => { e.stopPropagation(); speakText(card.character); }}>
                    🔊
                  </button>
                </div>

                <div className="writing-controls" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`mode-btn ${canvasMode === 'animate' ? 'active' : ''}`}
                    onClick={() => setCanvasMode(canvasMode === 'animate' ? 'view' : 'animate')}
                  >
                    🎬 Stroke Order
                  </button>
                  <button
                    className={`mode-btn ${canvasMode === 'practice' ? 'active' : ''}`}
                    onClick={() => setCanvasMode(canvasMode === 'practice' ? 'view' : 'practice')}
                  >
                    ✍️ Practice Writing
                  </button>
                </div>

                {canvasMode !== 'view' && (
                  <div className="reverse-canvas-box" onClick={(e) => e.stopPropagation()}>
                    <HanziCanvas character={card.character} mode={canvasMode} />
                  </div>
                )}

                <button className="drawer-trigger-btn" onClick={(e) => { e.stopPropagation(); setShowDrawer(true); }}>
                  Usage & Example Sentences ↑
                </button>

                <div className="grading-row" onClick={(e) => e.stopPropagation()}>
                  <button className="grade-btn grade-btn--hard" onClick={() => handleNextCard(1)}>
                    ← Hard
                  </button>
                  <button className="grade-btn grade-btn--easy" onClick={() => handleNextCard(5)}>
                    Easy →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS DRAWER */}
        {showSettings && (
          <div className="drawer-overlay" onClick={() => setShowSettings(false)}>
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