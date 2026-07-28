import { useEffect, useState, useMemo } from 'react';
import './App.css';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress } from './utils/storage';
import { speakText } from './utils/tts';
import { ColorPinyin } from './utils/pinyinColor';
import { getHardwiredDeck } from './data/hskLoader';

// Utility to highlight the target Chinese character in example sentences
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
  const [batchSize, setBatchSize] = useState(5); // Default to 5-card quick session

  const [rawDeck, setRawDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [cardsReviewedInSession, setCardsReviewedInSession] = useState(0);

  const [isFlipped, setIsFlipped] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // --- STREAK TRACKING LOGIC (EMBEDDED) ---
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastActive = localStorage.getItem('hz_last_active_date');
      const savedCount = parseInt(localStorage.getItem('hz_streak_count') || '1', 10);

      if (!lastActive) {
        localStorage.setItem('hz_last_active_date', today);
        localStorage.setItem('hz_streak_count', '1');
        setStreak(1);
      } else if (lastActive === today) {
        setStreak(savedCount || 1);
      } else {
        const lastDate = new Date(lastActive);
        const nowDate = new Date(today);
        const diffDays = Math.round((nowDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          setStreak(savedCount || 1);
        } else if (diffDays > 1) {
          localStorage.setItem('hz_streak_count', '1');
          localStorage.setItem('hz_last_active_date', today);
          setStreak(1);
        }
      }
    } catch (e) {
      console.warn('Streak storage notice:', e);
      setStreak(1);
    }
  }, []);

  const recordActivity = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastActive = localStorage.getItem('hz_last_active_date');
      let currentStreak = parseInt(localStorage.getItem('hz_streak_count') || '1', 10);

      if (lastActive !== today) {
        const lastDate = lastActive ? new Date(lastActive) : null;
        const nowDate = new Date(today);

        if (lastDate) {
          const diffDays = Math.round((nowDate - lastDate) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak += 1;
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }

        localStorage.setItem('hz_last_active_date', today);
        localStorage.setItem('hz_streak_count', String(currentStreak));
        setStreak(currentStreak);
      }
    } catch (e) {
      console.warn('Streak write error:', e);
    }
  };

  // Load Deck
  const loadSessionDeck = () => {
    const localWords = getHardwiredDeck(selectedLevels);
    const savedProgress = getProgress();

    const merged = localWords.map((card) => ({
      ...card,
      stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
    }));

    const shuffled = [...merged].sort(() => 0.5 - Math.random());
    setRawDeck(shuffled.slice(0, batchSize));
    setCurrentIndex(0);
    setCardsReviewedInSession(0);
    setSessionCompleted(false);
    setIsFlipped(false);
  };

  useEffect(() => {
    loadSessionDeck();
  }, [selectedLevels, batchSize]);

  const card = rawDeck[currentIndex];

  // Auto-TTS on Flip
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
    recordActivity();

    const nextReviewed = cardsReviewedInSession + 1;
    setCardsReviewedInSession(nextReviewed);

    if (nextReviewed >= rawDeck.length) {
      setSessionCompleted(true);
    } else {
      setIsFlipped(false);
      setShowDrawer(false);
      setCurrentIndex((prev) => prev + 1);
    }
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
        
        {/* HEADER BAR: STREAK BADGE & HSK LEVEL PILLS */}
        <div className="header-bar">
          <div className="header-left">
            <div className="streak-badge">
              🔥 {streak} {streak === 1 ? 'Day' : 'Days'}
            </div>
            <div className="level-pills">
              {selectedLevels.map((lvl) => (
                <span key={lvl} className="level-pill">HSK {lvl}</span>
              ))}
            </div>
          </div>
          <button className="gear-btn" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>

        {/* SESSION PROGRESS BAR */}
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${(cardsReviewedInSession / (batchSize || 1)) * 100}%` }}
          />
        </div>

        {/* SESSION COMPLETION SCREEN */}
        {sessionCompleted ? (
          <div className="card completion-card">
            <div className="completion-content">
              <span className="celebration-emoji">🎉</span>
              <h2>Session Complete!</h2>
              <p>You reviewed <strong>{batchSize}</strong> cards and extended your <strong>{streak} day streak</strong>!</p>
              
              <div className="completion-actions">
                <button className="action-btn primary" onClick={loadSessionDeck}>
                  ⚡ Start Another 5 Cards
                </button>
                <button className="action-btn secondary" onClick={() => setShowSettings(true)}>
                  ⚙️ Adjust Settings
                </button>
              </div>
            </div>
          </div>
        ) : !card ? (
          <div className="card loading-card">Loading session...</div>
        ) : (
          /* MAIN FLASHCARD STAGE */
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
              /* FRONT LAYOUT */
              <div className="front-layout">
                <div className="card-top-controls">
                  <button 
                    className="audio-circle-btn" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      speakText(card.character); 
                    }}
                    title="Listen"
                  >
                    🔊
                  </button>
                </div>

                <div className="canvas-inset-box">
                  <HanziCanvas character={card.character} mode="view" />
                </div>

                <span className="tap-hint">Tap card to reveal definition ↺</span>
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
                    className="audio-circle-btn" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      speakText(card.character); 
                    }}
                  >
                    🔊
                  </button>
                </div>

                <div className="back-center-stage">
                  <button 
                    className="drawer-trigger-btn" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setShowDrawer(true); 
                    }}
                  >
                    Context & Example Sentence ↑
                  </button>
                </div>

                {/* Grading Row */}
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
        )}

        {/* SETTINGS DRAWER */}
        {showSettings && (
          <div 
            className="drawer-overlay" 
            onClick={() => setShowSettings(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <div className="drawer-header">
                <h2>Daily Habit & Decks</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
              </div>

              <div className="settings-group">
                <label className="settings-label">Active HSK Decks</label>
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
                <label className="settings-label">Micro-Session Goal</label>
                <select 
                  value={batchSize} 
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="clean-select"
                >
                  <option value={5}>⚡ 5 Cards (Quick Blitz)</option>
                  <option value={10}>🎯 10 Cards (Standard)</option>
                  <option value={20}>🔥 20 Cards (Deep Focus)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* EXAMPLE SENTENCE DRAWER */}
        {showDrawer && card && (
          <div 
            className="drawer-overlay" 
            onClick={() => setShowDrawer(false)}
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
                <h3>Contextual Example</h3>
                <div className="sentence-card">
                  <div className="sentence-row">
                    <p className="chinese">
                      <HighlightedSentence sentence={card.sentence} targetChar={card.character} />
                    </p>
                    <button 
                      className="audio-circle-btn" 
                      onClick={(e) => { e.stopPropagation(); speakText(card.sentence); }}
                    >
                      🔊
                    </button>
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