import { useEffect, useState, useMemo } from 'react';
import './App.css';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress } from './utils/storage';
import { speakText } from './utils/tts';
import { ColorPinyin } from './utils/pinyinColor';
import { getHardwiredDeck } from './data/hskLoader';

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

export default function App() {
  const [selectedLevels, setSelectedLevels] = useState(['3']);
  const [showSettings, setShowSettings] = useState(false);

  const [appState, setAppState] = useState('launch');
  const [countdownNum, setCountdownNum] = useState(3);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [floatingPopups, setFloatingPopups] = useState([]);

  const [rawDeck, setRawDeck] = useState([]);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isFlipped, setIsFlipped] = useState(false);
  const [streak, setStreak] = useState(1);

  useEffect(() => {
    const localWords = getHardwiredDeck(selectedLevels, 'frequency');
    const savedProgress = getProgress();

    const merged = localWords.map((card) => ({
      ...card,
      stats: savedProgress[card.id] || { repetitions: 0, interval: 1, easeFactor: 2.5 },
    }));

    setRawDeck(merged);

    try {
      const savedCount = parseInt(localStorage.getItem('hz_streak_count') || '1', 10);
      setStreak(savedCount);
    } catch (e) {
      setStreak(1);
    }
  }, [selectedLevels]);

  const weakCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0 && c.stats.interval <= 2), [rawDeck]);

  const launchArcadeSession = (count = 5, mode = 'all') => {
    let pool = [...rawDeck];
    if (mode === 'weak' && weakCards.length > 0) pool = weakCards;

    const queue = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);
    setSessionQueue(queue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);

    setAppState('countdown');
    setCountdownNum(3);
  };

  useEffect(() => {
    if (appState !== 'countdown') return;

    if (countdownNum > 0) {
      const timer = setTimeout(() => setCountdownNum(countdownNum - 1), 600);
      return () => clearTimeout(timer);
    } else {
      setAppState('studying');
    }
  }, [appState, countdownNum]);

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

    const isSuccess = quality >= 4;
    let newCombo = isSuccess ? combo + 1 : 0;
    setCombo(newCombo);
    if (newCombo > maxCombo) setMaxCombo(newCombo);

    const points = isSuccess ? 100 * Math.max(1, newCombo) : 0;
    setScore((prev) => prev + points);

    if (isSuccess) {
      const newPopup = { id: Date.now(), text: `+${points} XP! ${newCombo > 1 ? `🔥 ${newCombo}x` : ''}` };
      setFloatingPopups((prev) => [...prev, newPopup]);
      setTimeout(() => {
        setFloatingPopups((prev) => prev.filter((p) => p.id !== newPopup.id));
      }, 1000);
    }

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
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const { dragX, dragY, isDragging, pointerHandlers } = useSwipeGesture({
    onSwipeLeft: () => handleNextCard(1),
    onSwipeRight: () => handleNextCard(5),
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
      {/* Top Navbar: Safely separated from the card interaction zone */}
      <nav className="top-nav-bar">
        <div className="nav-left">
          <span className="streak-badge">🔥 {streak}d</span>
          {appState === 'studying' && (
            <span className="xp-pill">⚡ {score} XP</span>
          )}
        </div>
        <div className="nav-right">
          <button className="settings-trigger-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            ⚙️ HSK {selectedLevels.join(',')}
          </button>
        </div>
      </nav>

      <div className="stage">
        {/* Progress Bar */}
        {appState === 'studying' && (
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${((currentIndex) / (sessionQueue.length || 1)) * 100}%` }}
            />
          </div>
        )}

        <div className="floating-popups-container">
          {floatingPopups.map((p) => (
            <div key={p.id} className="arcade-popup">{p.text}</div>
          ))}
        </div>

        {/* 1. LAUNCH SCREEN */}
        {appState === 'launch' && (
          <div className="launch-deck-container">
            <div className="card launch-card">
              <div className="launch-card-header">
                <span className="deck-level-pill">HSK Level {selectedLevels.join(', ')}</span>
                <span className="deck-ready-tag">{rawDeck.length} Cards Loaded</span>
              </div>

              <div className="launch-card-body">
                <h1 className="launch-title">Hanzi Blitz</h1>
                <p className="launch-subtitle">Frequency-ranked study session</p>
              </div>

              <div className="launch-card-actions">
                <button className="primary-launch-btn" onClick={() => launchArcadeSession(10, 'all')}>
                  Start Session ⚡
                </button>

                {weakCards.length > 0 && (
                  <button className="secondary-launch-btn" onClick={() => launchArcadeSession(10, 'weak')}>
                    🎯 Review {weakCards.length} Weak Cards
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. COUNTDOWN */}
        {appState === 'countdown' && (
          <div className="card countdown-card">
            <div className="countdown-overlay">
              <span className="countdown-number">{countdownNum > 0 ? countdownNum : 'GO!'}</span>
            </div>
          </div>
        )}

        {/* 3. STUDYING SESSION */}
        {appState === 'studying' && card && (
          <div
            className={`card ${isFlipped ? 'card--flipped' : ''}`}
            style={{
              transform: `translateX(${dragX}px) translateY(${dragY}px) rotate(${dragX * 0.03}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
            {...pointerHandlers}
          >
            {dragX > 30 && <div className="badge badge--know">KNOW</div>}
            {dragX < -30 && <div className="badge badge--again">AGAIN</div>}

            {!isFlipped ? (
              /* FRONT FACE */
              <div className="card-face front-face">
                <button className="audio-icon-btn" onClick={(e) => { e.stopPropagation(); speakText(card.character); }}>
                  🔊
                </button>

                <div className="canvas-frame">
                  <HanziCanvas character={card.character} mode="view" />
                </div>

                {card.sentence && (
                  <div className="front-context-container">
                    <p className="front-context-text">
                      <HighlightedSentence sentence={card.sentence} targetChar={card.character} muted={true} />
                    </p>
                  </div>
                )}

                <span className="tap-prompt">Tap to flip card</span>
              </div>
            ) : (
              /* BACK FACE - Fully contained within card bounds */
              <div className="card-face back-face" onClick={(e) => e.stopPropagation()}>
                <div className="back-scrollable-content">
                  <div className="back-header-group">
                    <div>
                      <h1 className="pinyin-title"><ColorPinyin pinyin={card.pinyin} /></h1>
                      <p className="meaning-primary">{primaryMeaning}</p>
                      {secondaryMeanings && <p className="meaning-secondary">{secondaryMeanings}</p>}
                    </div>
                    <button className="audio-icon-btn" onClick={() => speakText(card.character)}>
                      🔊
                    </button>
                  </div>

                  <div className="card-internal-divider" />

                  {/* Integrated Sentence Context Box */}
                  <div className="card-sentence-box">
                    <span className="box-section-label">Context Example</span>
                    <p className="sentence-zh">
                      <HighlightedSentence sentence={card.sentence} targetChar={card.character} muted={false} />
                    </p>
                    <p className="sentence-py"><ColorPinyin pinyin={card.sentencePinyin} /></p>
                    <p className="sentence-en">{card.sentenceEnglish}</p>
                  </div>
                </div>

                {/* Fixed Grading Action Bar at bottom of card */}
                <div className="grading-row">
                  <button className="grade-btn grade-btn--hard" onClick={() => handleNextCard(1)}>
                    Hard ({nextHardInterval}d)
                  </button>
                  <button className="grade-btn grade-btn--easy" onClick={() => handleNextCard(5)}>
                    Easy ({nextEasyInterval}d)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. COMPLETED SCREEN */}
        {appState === 'completed' && (
          <div className="card victory-card">
            <div className="victory-content">
              <span className="victory-emoji">🏆</span>
              <h2>Session Complete!</h2>
              <div className="stats-summary-grid">
                <div className="stat-box">
                  <span className="stat-label">Earned XP</span>
                  <span className="stat-value">+{score}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Max Combo</span>
                  <span className="stat-value">🔥 {maxCombo}x</span>
                </div>
              </div>
              <button className="primary-launch-btn" onClick={() => setAppState('launch')}>
                Continue ⚡
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS DRAWER */}
        {showSettings && (
          <div className="drawer-overlay" onClick={() => setShowSettings(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <h3>Select HSK Levels</h3>
              <div className="settings-level-grid">
                {['1', '2', '3'].map((lvl) => (
                  <button
                    key={lvl}
                    className={`level-toggle-btn ${selectedLevels.includes(lvl) ? 'active' : ''}`}
                    onClick={() => {
                      if (selectedLevels.includes(lvl) && selectedLevels.length > 1) {
                        setSelectedLevels(selectedLevels.filter(l => l !== lvl));
                      } else if (!selectedLevels.includes(lvl)) {
                        setSelectedLevels([...selectedLevels, lvl]);
                      }
                    }}
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