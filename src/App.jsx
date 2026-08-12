import { useEffect, useState, useMemo } from 'react';
import './App.css';
import HanziCanvas from './components/HanziCanvas';
import useSwipeGesture from './hooks/useSwipeGesture';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress, getCardMasteryStats } from './utils/storage';
import { speakText } from './utils/tts';
import { ColorPinyin } from './utils/pinyinColor';
import { getFilteredDeck } from './data/vocabLoader';
import { getHardModeDeck } from './data/hskLoader';
import { buildLearnQueue } from './utils/sessionQueue';
import { getEntitlement } from './utils/entitlement';
import { useAuth } from './context/AuthContext';
import MarketingLanding from './components/MarketingLanding';
import AccountDrawer from './components/AccountDrawer';
import MistakeReportDrawer from './components/MistakeReportDrawer';

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
  // Empty = no filter, learn from the full frequency-ranked deck. A
  // non-empty selection (set from Settings) narrows to specific HSK levels
  // for targeted revision.
  const [revisionLevels, setRevisionLevels] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showMistakeReport, setShowMistakeReport] = useState(false);
  const [activeMasteryTab, setActiveMasteryTab] = useState('new');

  const { user, isAuthReady, syncVersion } = useAuth();

  // Defaults to the dashboard (false) during the brief pre-isAuthReady gap
  // rather than flashing marketing copy at a logged-in user - the dashboard
  // is a strict subset of the marketing view (same header, same primary
  // CTA, just no persuasive copy), so the worst case for a logged-out
  // visitor is a sub-frame of the leaner view before this flips true.
  const showMarketing = isAuthReady && !user;

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
  const [isLoadingDeck, setIsLoadingDeck] = useState(true);

  // Everything is free today - this just establishes the check-in so a
  // paywall can be turned on later (see utils/entitlement.js) without
  // requiring already-installed copies to update first. Not gated on
  // anything yet; nothing reads this state below.
  const [entitlement, setEntitlement] = useState({ paywalled: false, message: '' });
  useEffect(() => {
    getEntitlement().then(setEntitlement);
  }, []);

  // Load deck asynchronously from unified_vocab.json whenever revisionLevels change
  useEffect(() => {
    async function loadDeck() {
      setIsLoadingDeck(true);
      const localWords = await getFilteredDeck(revisionLevels);
      
      const savedProgress = getProgress();

      const merged = localWords.map((card, index) => {
        const cardId = card.id || `vocab_${index}_${card.character}`;
        return {
          ...card,
          id: cardId,
          stats: savedProgress[cardId] || { repetitions: 0, interval: 1, easeFactor: 2.5, lastReviewed: null },
        };
      });

      setRawDeck(merged);
      setIsLoadingDeck(false);
    }

    loadDeck();

    try {
      const savedCount = parseInt(localStorage.getItem('hz_streak_count') || '1', 10);
      setStreak(savedCount);
    } catch (e) {
      setStreak(1);
    }
    // syncVersion isn't read above - it's a signal, not data. It bumps once
    // after AuthContext hydrates localStorage from a signed-in account's
    // remote progress, so this effect re-runs and rawDeck picks up the
    // merged stats (sign-in doesn't otherwise change revisionLevels).
  }, [revisionLevels, syncVersion]);

  const weakCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0 && c.stats.interval <= 2), [rawDeck]);

  // Every card the user has graded at least once, regardless of how it's
  // currently doing on the SM-2 curve - a free-form review pool distinct
  // from "weak" (struggling specifically) or the mastery matrix tabs.
  const seenCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0), [rawDeck]);

  const mastery = useMemo(() => {
    return getCardMasteryStats(rawDeck);
  }, [rawDeck]);

  const launchArcadeSession = (count = 20, mode = 'all') => {
    let queue;
    if (mode === 'weak' && weakCards.length > 0) {
      queue = [...weakCards].sort(() => 0.5 - Math.random()).slice(0, count);
    } else if (mode === 'seen') {
      // "At their own leisure" - review every seen card in one sitting,
      // not a fixed-size sample like the other modes.
      queue = [...seenCards].sort(() => 0.5 - Math.random());
    } else {
      // Due-for-review cards first (most overdue first), then never-studied
      // cards introduced in frequency order - not a flat random shuffle.
      queue = buildLearnQueue(rawDeck, count);
    }
    setSessionQueue(queue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);

    setAppState('countdown');
    setCountdownNum(3);
  };

  const launchHardModeSession = () => {
    const savedProgress = getProgress();
    const hardQueue = getHardModeDeck(rawDeck, savedProgress);
    
    if (hardQueue.length === 0) return;

    setSessionQueue(hardQueue);
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

    const stamped = saveCardProgress(card.id, newStats);
    // Keep rawDeck in sync so a subsequent session (built from rawDeck)
    // sees this card's real lastReviewed/interval - otherwise it'd still
    // look "never studied" until the next full deck reload.
    setRawDeck((prev) => prev.map((c) => (c.id === card.id ? { ...c, stats: stamped } : c)));

    if (currentIndex + 1 >= sessionQueue.length) {
      setAppState('completed');
    } else {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const { dragX, dragY, isDragging, pointerHandlers } = useSwipeGesture({
    onSwipeLeft: () => handleNextCard(5),
    onSwipeRight: () => handleNextCard(1),
    onTap: handleFlip
  });

  const meaningList = useMemo(() => {
    if (!card?.meaning) return ['meaning'];
    return typeof card.meaning === 'string' ? card.meaning.split(';') : [card.meaning];
  }, [card]);

  const primaryMeaning = meaningList[0]?.trim();
  const secondaryMeanings = meaningList.slice(1).join('; ').trim();

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <nav className="top-nav-bar">
        <div className="nav-left">
          <span className="streak-badge">🔥 {streak}d</span>
          {appState === 'studying' && (
            <span className="xp-pill">⚡ {score} XP</span>
          )}
        </div>
        <div className="nav-right">
          <button className="account-trigger-btn" onClick={() => setShowAccount(true)} aria-label="Account">
            {user ? '👤' : '👤 Sign in'}
          </button>
          <button className="settings-trigger-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            ⚙️ {revisionLevels.length > 0 ? `HSK ${revisionLevels.join(',')}` : 'Settings'}
          </button>
        </div>
      </nav>

      <div className="stage">
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

        {/* 1. LAUNCH SCREEN - marketing pitch for logged-out visitors,
               action-first dashboard for everyone else */}
        {appState === 'launch' && (
          showMarketing ? (
            <MarketingLanding
              revisionLevels={revisionLevels}
              isLoadingDeck={isLoadingDeck}
              cardCount={rawDeck.length}
              onStart={() => launchArcadeSession(20, 'all')}
              onSignIn={() => setShowAccount(true)}
            />
          ) : (
            <div className="card launch-card">
              <div className="launch-card-header">
                <span className="deck-level-pill">
                  {revisionLevels.length > 0 ? `Revising HSK ${revisionLevels.join(', ')}` : 'All Levels'}
                </span>
                <span className="deck-ready-tag">
                  {isLoadingDeck ? 'Loading database...' : `${rawDeck.length} Cards Loaded`}
                </span>
              </div>

              <div className="launch-card-body">
                <h1 className="launch-title">Learn Hanzi</h1>
                <p className="launch-subtitle">Unified frequency & HSK dataset</p>
              </div>

              <div className="launch-card-actions">
                <button
                  className="primary-launch-btn"
                  disabled={isLoadingDeck || rawDeck.length === 0}
                  onClick={() => launchArcadeSession(20, 'all')}
                >
                  {isLoadingDeck ? 'Preparing Deck...' : 'Learn ⚡'}
                </button>

                <button className="hard-mode-btn" onClick={launchHardModeSession}>
                  🔥 Hard Mode (Targeted Mistake Blitz)
                </button>

                {weakCards.length > 0 && (
                  <button className="secondary-launch-btn" onClick={() => launchArcadeSession(20, 'weak')}>
                    🎯 Review {weakCards.length} Weak Cards
                  </button>
                )}

                {seenCards.length > 0 && (
                  <button className="secondary-launch-btn" onClick={() => launchArcadeSession(seenCards.length, 'seen')}>
                    📖 Review All {seenCards.length} Seen Cards
                  </button>
                )}
              </div>
            </div>
          )
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
                  onClick={(e) => { e.stopPropagation(); handleFlip(); }}
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
                        onClick={(e) => { e.stopPropagation(); setShowMistakeReport(true); }}
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
              <h3>Settings & Character Mastery</h3>

              <div style={{ marginTop: '12px' }}>
                <label className="box-section-label">Revision: Filter by HSK Level</label>
                <p style={{ fontSize: '12px', color: 'var(--ink-faint)', margin: '4px 0 0' }}>
                  {revisionLevels.length === 0
                    ? 'Learning from all levels. Select levels below to revise a specific one.'
                    : `Only reviewing HSK ${revisionLevels.join(', ')}. Deselect all to go back to learning from every level.`}
                </p>
                <div className="settings-level-grid">
                  {['1', '2', '3', '4', '5', '6'].map((lvl) => (
                    <button
                      key={lvl}
                      className={`level-toggle-btn ${revisionLevels.includes(lvl) ? 'active' : ''}`}
                      onClick={() => {
                        if (revisionLevels.includes(lvl)) {
                          setRevisionLevels(revisionLevels.filter(l => l !== lvl));
                        } else {
                          setRevisionLevels([...revisionLevels, lvl]);
                        }
                      }}
                    >
                      HSK {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card-internal-divider" />

              <div>
                <label className="box-section-label">Character Mastery Matrix</label>
                
                <div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
                  <button
                    className={`level-toggle-btn ${activeMasteryTab === 'new' ? 'active' : ''}`}
                    onClick={() => setActiveMasteryTab('new')}
                    style={{ fontSize: '12px', padding: '8px' }}
                  >
                    🆕 New ({mastery.new.length})
                  </button>
                  <button
                    className={`level-toggle-btn ${activeMasteryTab === 'learning' ? 'active' : ''}`}
                    onClick={() => setActiveMasteryTab('learning')}
                    style={{ fontSize: '12px', padding: '8px' }}
                  >
                    📖 Learning ({mastery.learning.length})
                  </button>
                  <button
                    className={`level-toggle-btn ${activeMasteryTab === 'mastered' ? 'active' : ''}`}
                    onClick={() => setActiveMasteryTab('mastered')}
                    style={{ fontSize: '12px', padding: '8px' }}
                  >
                    🏆 Mastered ({mastery.mastered.length})
                  </button>
                </div>

                <div className="mastery-list-box">
                  {mastery[activeMasteryTab].length === 0 ? (
                    <p className="empty-mastery-text">No characters in this category yet!</p>
                  ) : (
                    <div className="mastery-grid-chips">
                      {mastery[activeMasteryTab].map((c) => (
                        <div key={c.id} className="mastery-chip" title={`${c.pinyin} - ${c.meaning}`}>
                          <span className="chip-char">{c.character}</span>
                          <span className="chip-py">{c.pinyin}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {showAccount && <AccountDrawer onClose={() => setShowAccount(false)} />}

        {showMistakeReport && card && (
          <MistakeReportDrawer
            card={card}
            onClose={() => setShowMistakeReport(false)}
            onRequestSignIn={() => { setShowMistakeReport(false); setShowAccount(true); }}
          />
        )}

      </div>
    </div>
  );
}