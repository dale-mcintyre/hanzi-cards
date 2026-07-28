import { useEffect, useState, useMemo } from 'react';
import './App.css';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress } from './utils/storage';
import { speakText } from './utils/tts';
import { ColorPinyin } from './utils/pinyinColor';
import { getHardwiredDeck } from './data/hskLoader';

function HighlightedSentence({ sentence, targetChar }) {
  if (!sentence || !targetChar) return <span>{sentence}</span>;
  const parts = sentence.split(targetChar);
  if (parts.length === 1) return <span>{sentence}</span>;

  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="sentence-highlight">{targetChar}</mark>
          )}
        </span>
      ))}
    </span>
  );
}

export default function App() {
  const [selectedLevels, setSelectedLevels] = useState(['3']);
  const [showSettings, setShowSettings] = useState(false);

  // Experience States: 'launch' | 'studying' | 'completed'
  const [appState, setAppState] = useState('launch');

  const [rawDeck, setRawDeck] = useState([]);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isFlipped, setIsFlipped] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [streak, setStreak] = useState(1);

  // Load Decks & Streak
  useEffect(() => {
    const localWords = getHardwiredDeck(selectedLevels);
    const savedProgress = getProgress();

    const merged = localWords.map((card) => ({
      ...card,
      stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
    }));

    setRawDeck(merged);

    // Streak initialization
    try {
      const savedCount = parseInt(localStorage.getItem('hz_streak_count') || '1', 10);
      setStreak(savedCount);
    } catch (e) {
      setStreak(1);
    }
  }, [selectedLevels]);

  const weakCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0 && c.stats.interval <= 2), [rawDeck]);

  // Session Launcher
  const launchSession = (count = 5, mode = 'all') => {
    let pool = [...rawDeck];
    if (mode === 'weak' && weakCards.length > 0) pool = weakCards;

    const queue = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
    setSessionQueue(queue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setAppState('studying');
  };

  const card = sessionQueue[currentIndex];

  const handleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (nextFlipped && card?.character) {
      speakText(card.character);
    }
  };

  const handleNextCard = (quality) => {
    if (!card) return;

    const newStats = calculateSM2(
      quality,
      card.stats?.repetitions || 0,
      card.stats?.interval || 1,
      card.stats?.easeFactor || 2.5
    );

    saveCardProgress(card.id, newStats);

    if (currentIndex + 1 >= sessionQueue.length) {
      setAppState('completed');
    } else {
      setIsFlipped(false);
      setShowDrawer(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const { dragX, dragY, isDragging, pointerHandlers } = useSwipeGesture({
    onSwipeLeft: () => handleNextCard(1),
    onSwipeRight: () => handleNextCard(5),
    onSwipeUp: () => { if (isFlipped) setShowDrawer(true); },
    onTap: handleFlip
  });

  const meaningList = useMemo(() => {
    if (!card?.meaning) return ['meaning'];
    return typeof card.meaning === 'string' ? card.meaning.split(',') : [card.meaning];
  }, [card]);

  const primaryMeaning = meaningList[0]?.trim();
  const secondaryMeanings = meaningList.slice(1).join(', ').trim();

  const nextHardInterval = card ? calculateSM2(1, card.stats?.repetitions || 0, card.stats?.interval || 1, card.stats?.easeFactor || 2.5).interval : 1;
  const nextEasyInterval = card ? calculateSM2(5, card.stats?.repetitions || 0, card.stats?.interval || 1, card.stats?.easeFactor || 2.5).interval : 4;

  return (
    <div className="app-container">
      <div className="stage">
        
        {/* Header Bar */}
        <div className="header-bar">
          <div className="streak-badge">🔥 {streak} Day Streak</div>
          <button className="gear-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {/* 1. LAUNCH SCREEN: TACTILE STACKED DECK */}
        {appState === 'launch' && (
          <div className="launch-deck-container">
            {/* Background stacked card layers for 3D depth */}
            <div className="deck-layer deck-layer-3" />
            <div className="deck-layer deck-layer-2" />
            
            {/* Top Deck Card */}
            <div className="card launch-card">
              <div className="launch-card-header">
                <span className="deck-level-pill">HSK {selectedLevels.join(', ')}</span>
                <span className="deck-ready-tag">5 Cards Ready</span>
              </div>

              <div className="launch-card-body">
                <h1 className="launch-title">Daily Practice</h1>
                <p className="launch-subtitle">5 cards · estimated 90 seconds</p>
              </div>

              <div className="launch-card-actions">
                <button className="primary-launch-btn" onClick={() => launchSession(5, 'all')}>
                  Start Session ⚡
                </button>

                {weakCards.length > 0 && (
                  <button className="secondary-launch-btn" onClick={() => launchSession(5, 'weak')}>
                    🎯 Practice {weakCards.length} Weak Spots
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. ACTIVE FLASHCARD SESSION */}
        {appState === 'studying' && card && (
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
              <div className="front-layout">
                <button className="audio-icon-btn" onClick={(e) => { e.stopPropagation(); speakText(card.character); }}>
                  🔊
                </button>

                <div className="canvas-frame">
                  <HanziCanvas character={card.character} mode="view" />
                </div>

                <span className="tap-prompt">Tap card to flip ↺</span>
              </div>
            ) : (
              <div className="back-layout">
                <div className="back-header">
                  <div>
                    <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
                    <p className="meaning-primary">{primaryMeaning}</p>
                    {secondaryMeanings && <p className="meaning-secondary">{secondaryMeanings}</p>}
                  </div>
                  <button className="audio-icon-btn" onClick={(e) => { e.stopPropagation(); speakText(card.character); }}>
                    🔊
                  </button>
                </div>

                <button className="drawer-pill-btn" onClick={(e) => { e.stopPropagation(); setShowDrawer(true); }}>
                  Context & Example Sentence ↑
                </button>

                <div className="grading-row" onClick={(e) => e.stopPropagation()}>
                  <button className="grade-btn grade-btn--hard" onClick={() => handleNextCard(1)}>
                    ← Hard ({nextHardInterval}d)
                  </button>
                  <button className="grade-btn grade-btn--easy" onClick={() => handleNextCard(5)}>
                    Easy ({nextEasyInterval}d) →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. SESSION COMPLETED CELEBRATION */}
        {appState === 'completed' && (
          <div className="card completion-card">
            <span className="celebration-emoji">🎉</span>
            <h2>Session Complete!</h2>
            <p>You maintained your <strong>{streak} day streak</strong>.</p>
            <button className="primary-launch-btn" onClick={() => setAppState('launch')}>
              Back to Deck Desk 🏠
            </button>
          </div>
        )}

        {/* DRAWER: EXAMPLE SENTENCE */}
        {showDrawer && card && (
          <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <h3>Context Example</h3>
              <p style={{ fontSize: '18px', fontWeight: '600' }}>
                <HighlightedSentence sentence={card.sentence} targetChar={card.character} />
              </p>
              <p><ColorPinyin pinyin={card.sentencePinyin} /></p>
              <p style={{ color: '#94a3b8' }}>{card.sentenceEnglish}</p>
            </div>
          </div>
        )}

        {/* DRAWER: SETTINGS */}
        {showSettings && (
          <div className="drawer-overlay" onClick={() => setShowSettings(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <h3>Select HSK Deck</h3>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {['1', '2', '3', '4', '5', '6'].map((lvl) => (
                  <button
                    key={lvl}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      background: selectedLevels.includes(lvl) ? '#38bdf8' : '#1e293b',
                      color: selectedLevels.includes(lvl) ? '#000' : '#fff',
                      border: 'none',
                      fontWeight: '700'
                    }}
                    onClick={() => setSelectedLevels([lvl])}
                  >
                    HSK {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}