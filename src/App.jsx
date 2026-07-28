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

  // App State: 'home' (session selector) | 'studying' | 'completed'
  const [appState, setAppState] = useState('home');

  const [rawDeck, setRawDeck] = useState([]);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsReviewedInSession, setCardsReviewedInSession] = useState(0);

  const [isFlipped, setIsFlipped] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  // Streak Tracking
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

  // Load All Decks with Progress
  useEffect(() => {
    const localWords = getHardwiredDeck(selectedLevels);
    const savedProgress = getProgress();

    const merged = localWords.map((card) => ({
      ...card,
      stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
    }));

    setRawDeck(merged);
  }, [selectedLevels]);

  // Filters & Deck Counters
  const unseenCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions === 0), [rawDeck]);
  const weakCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0 && c.stats.interval <= 2), [rawDeck]);

  // Session Launchers
  const startSession = (mode, count = 5) => {
    let selected = [];

    if (mode === 'unseen') {
      selected = unseenCards.length > 0 ? unseenCards : rawDeck;
    } else if (mode === 'weak') {
      selected = weakCards.length > 0 ? weakCards : rawDeck;
    } else {
      selected = [...rawDeck].sort(() => 0.5 - Math.random());
    }

    const queue = [...selected].sort(() => 0.5 - Math.random()).slice(0, count);

    setSessionQueue(queue);
    setCurrentIndex(0);
    setCardsReviewedInSession(0);
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
    recordActivity();

    const nextReviewed = cardsReviewedInSession + 1;
    setCardsReviewedInSession(nextReviewed);

    if (nextReviewed >= sessionQueue.length) {
      setAppState('completed');
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
        
        {/* Header Bar */}
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

        {/* Progress Bar (Only during studying) */}
        {appState === 'studying' && (
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${(cardsReviewedInSession / (sessionQueue.length || 1)) * 100}%` }}
            />
          </div>
        )}

        {/* 1. HOME SESSION LAUNCHPAD */}
        {appState === 'home' && (
          <div className="card launchpad-card">
            <div className="launchpad-content">
              <h2>Select Today's Focus</h2>
              <p className="launchpad-sub">Choose a session tailored to your time and focus:</p>

              <div className="session-grid">
                <button className="session-option-btn primary" onClick={() => startSession('all', 5)}>
                  <div className="option-icon">⚡</div>
                  <div className="option-info">
                    <h3>Quick Review</h3>
                    <p>5 random cards (Under 2 mins)</p>
                  </div>
                </button>

                <button 
                  className="session-option-btn weak-mode" 
                  onClick={() => startSession('weak', 10)}
                >
                  <div className="option-icon">🎯</div>
                  <div className="option-info">
                    <h3>Fix Weak Spots</h3>
                    <p>{weakCards.length > 0 ? `${weakCards.length} cards need practice` : 'Review cards you got wrong'}</p>
                  </div>
                </button>

                <button 
                  className="session-option-btn unseen-mode" 
                  onClick={() => startSession('unseen', 5)}
                >
                  <div className="option-icon">✨</div>
                  <div className="option-info">
                    <h3>New Words First</h3>
                    <p>{unseenCards.length} unseen characters remaining</p>
                  </div>
                </button>

                <button className="session-option-btn deep-mode" onClick={() => startSession('all', 20)}>
                  <div className="option-icon">🔥</div>
                  <div className="option-info">
                    <h3>Deep Focus</h3>
                    <p>20 cards thorough review session</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. FLASHCARD STUDY STAGE */}
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

        {/* 3. SESSION COMPLETED CELEBRATION */}
        {appState === 'completed' && (
          <div className="card completion-card">
            <div className="completion-content">
              <span className="celebration-emoji">🎉</span>
              <h2>Session Complete!</h2>
              <p>You maintained your <strong>{streak} day streak</strong>!</p>
              
              <div className="completion-actions">
                <button className="action-btn primary" onClick={() => setAppState('home')}>
                  🏠 Back to Session Launcher
                </button>
              </div>
            </div>
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
                <h2>Deck Focus</h2>
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