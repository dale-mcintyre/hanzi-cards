import { useEffect, useState, useMemo } from 'react';
import './App.css';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress, getCardMasteryStats, getPrefs, savePrefs, getTierStats } from './utils/storage';
import { speakText } from './utils/tts';
import { getFilteredDeck, fetchUnifiedVocab } from './data/vocabLoader';
import { getHardModeDeck } from './data/hskLoader';
import { buildLearnQueue } from './utils/sessionQueue';
import { getEntitlement } from './utils/entitlement';
import { useAuth } from './context/AuthContext';
import LaunchScreen from './components/LaunchScreen';
import StudySession from './components/StudySession';
import CompletionScreen from './components/CompletionScreen';
import SyncStatusDot from './components/SyncStatusDot';
import AccountDrawer from './components/AccountDrawer';
import MistakeReportDrawer from './components/MistakeReportDrawer';
import BetaFeedbackDrawer from './components/BetaFeedbackDrawer';
import AboutDrawer from './components/AboutDrawer';
import TierRingTile from './components/TierRingTile';

const ALL_HSK_LEVELS = ['1', '2', '3', '4', '5', '6'];

// Cards graded (across the whole visit, any session type) before an
// anonymous user sees the one-time dismissible sign-up nudge mid-session -
// and, from that point on, before any session's completion screen gates on
// sign-in instead of offering a "Continue" escape.
const SOFT_WALL_THRESHOLD = 5;

export default function App() {
  // Empty = no filter, learn from the full frequency-ranked deck. A
  // non-empty selection (set from Settings) narrows to specific HSK levels
  // for targeted revision. Initialized from localStorage (not a hardcoded
  // default) so a saved filter survives a page reload.
  const [revisionLevels, setRevisionLevels] = useState(() => getPrefs().revisionLevels);
  const [includeNonHsk, setIncludeNonHsk] = useState(() => getPrefs().includeNonHsk);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showMistakeReport, setShowMistakeReport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
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

  // The nav bar (and its sign-out control) is reachable from every screen,
  // but the marketing/dashboard switch only lives in the 'launch' state -
  // without this, signing out mid-session left the studying screen up
  // indefinitely even though the user was already signed out. Only fires
  // on a real sign-out transition (user: object -> null); on initial
  // mount user is already null and appState is already 'launch', so this
  // is a harmless no-op then, and it doesn't fire on sign-in at all.
  useEffect(() => {
    if (!user) setAppState('launch');
  }, [user]);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [floatingPopups, setFloatingPopups] = useState([]);

  // Visit-level (not per-session-queue) grade count for the anonymous
  // sign-up flow - accumulates across however many mini-sessions happen in
  // this visit, resets only on a full page reload. hasCrossedSoftWall
  // flips true (permanently, for the rest of the visit) the moment it's
  // reached: that same grade shows a one-time dismissible overlay without
  // interrupting the current session, and from then on every session's
  // completion screen gates on sign-in instead of offering a plain
  // "Continue" escape (see the completed-screen JSX below).
  const [visitGradeCount, setVisitGradeCount] = useState(0);
  const [hasCrossedSoftWall, setHasCrossedSoftWall] = useState(false);
  const [showSoftWallOverlay, setShowSoftWallOverlay] = useState(false);

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
      const localWords = await getFilteredDeck(revisionLevels, includeNonHsk);

      const savedProgress = getProgress();

      const merged = localWords.map((card) => {
        const cardId = card.id || card.character;
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
    } catch {
      setStreak(1);
    }
    // syncVersion isn't read above - it's a signal, not data. It bumps
    // after AuthContext hydrates localStorage from a signed-in account's
    // remote progress OR remote settings, so this effect re-runs and
    // rawDeck picks up the merged stats even when revisionLevels/
    // includeNonHsk haven't themselves changed by reference.
  }, [revisionLevels, includeNonHsk, syncVersion]);

  // revisionLevels/includeNonHsk are plain useState, read from localStorage
  // once at mount - unlike getProgress() (read fresh every loadDeck run),
  // they don't automatically pick up a post-sign-in remote hydration on
  // their own, so this explicitly re-reads them whenever syncVersion bumps
  // (either a progress sync or a settings sync). A no-op re-read after a
  // progress-only bump is harmless.
  useEffect(() => {
    const fresh = getPrefs();
    setRevisionLevels(fresh.revisionLevels);
    setIncludeNonHsk(fresh.includeNonHsk);
  }, [syncVersion]);

  const weakCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0 && c.stats.interval <= 2), [rawDeck]);

  // Every card the user has graded at least once, regardless of how it's
  // currently doing on the SM-2 curve - a free-form review pool distinct
  // from "weak" (struggling specifically) or the mastery matrix tabs.
  const seenCards = useMemo(() => rawDeck.filter((c) => c.stats.repetitions > 0), [rawDeck]);

  const mastery = useMemo(() => {
    return getCardMasteryStats(rawDeck);
  }, [rawDeck]);

  // Independent of the current HSK/non-HSK filter - rawDeck only contains
  // whatever tiers are currently selected, but the tier tiles need stats
  // for every tier including ones not currently active. fetchUnifiedVocab
  // caches internally, so this only ever does real work once per session.
  const [fullVocab, setFullVocab] = useState([]);
  useEffect(() => {
    fetchUnifiedVocab().then(setFullVocab);
  }, []);

  const tierStats = useMemo(
    () => getTierStats(fullVocab, getProgress()),
    // rawDeck/syncVersion are cheap "something changed" triggers, not the
    // data source - getProgress() is re-read fresh each time, matching how
    // getCardMasteryStats already re-reads progress rather than trusting a
    // stale closure. Keeping them as deps is intentional (removing them
    // would make tierStats go stale after every grade/sync), so the
    // exhaustive-deps warning here is a false positive, not a real issue.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [fullVocab, rawDeck, syncVersion]
  );

  const toggleLevel = (lvl) => {
    // An empty revisionLevels means "every level active" (see
    // getFilteredDeck), so tapping one tile from that state should read as
    // "turn off just this one" - populate every OTHER level explicitly,
    // rather than naively adding lvl to an empty array (which would jump
    // to "only this level", turning every other tier off too).
    let next;
    if (revisionLevels.length === 0) {
      next = ALL_HSK_LEVELS.filter((l) => l !== lvl);
    } else if (revisionLevels.includes(lvl)) {
      next = revisionLevels.filter((l) => l !== lvl);
    } else {
      next = [...revisionLevels, lvl];
    }
    // Re-selecting every level by hand collapses back to [] ("no filter") -
    // functionally identical, but keeps state canonical so the nav pill's
    // "All Levels" label (which checks length === 0) stays accurate.
    if (next.length === ALL_HSK_LEVELS.length) next = [];

    setRevisionLevels(next);
    savePrefs({ revisionLevels: next, includeNonHsk });
  };

  const toggleNonHsk = () => {
    const next = !includeNonHsk;
    setIncludeNonHsk(next);
    savePrefs({ revisionLevels, includeNonHsk: next });
  };

  function renderTierTiles(size) {
    return (
      <>
        {ALL_HSK_LEVELS.map((lvl) => (
          <TierRingTile
            key={lvl}
            tierKey={lvl}
            label={`HSK ${lvl}`}
            total={tierStats[lvl].total}
            seen={tierStats[lvl].seen}
            mastered={tierStats[lvl].mastered}
            // An empty revisionLevels means "no filter - every level
            // included" (see loadDeck/getFilteredDeck), not "nothing
            // selected" - so every HSK tile should read as active then,
            // not just whichever's literally in the array.
            active={revisionLevels.length === 0 || revisionLevels.includes(lvl)}
            size={size}
            onClick={() => toggleLevel(lvl)}
          />
        ))}
        <TierRingTile
          tierKey="non-hsk"
          label="Non-HSK"
          total={tierStats['non-hsk'].total}
          seen={tierStats['non-hsk'].seen}
          mastered={tierStats['non-hsk'].mastered}
          active={includeNonHsk}
          size={size}
          onClick={toggleNonHsk}
        />
      </>
    );
  }

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

    // Computed as local values, not read back from state this same tick -
    // the setters below wouldn't be visible yet if we read the state
    // directly further down.
    const newVisitGradeCount = !user ? visitGradeCount + 1 : visitGradeCount;
    if (!user) setVisitGradeCount(newVisitGradeCount);

    const justCrossedSoftWall = !user && !hasCrossedSoftWall && newVisitGradeCount >= SOFT_WALL_THRESHOLD;
    if (justCrossedSoftWall) setHasCrossedSoftWall(true);

    if (currentIndex + 1 >= sessionQueue.length) {
      // No separate action needed for gating here - the completed screen
      // derives its gated/ungated variant from (!user && hasCrossedSoftWall)
      // at render time, and hasCrossedSoftWall was just set above if this
      // very card is the one that crossed the threshold - so even a first
      // session that crosses 5 on its last card correctly renders gated.
      setAppState('completed');
    } else {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
      // Dismissible, non-interrupting: currentIndex has already advanced
      // above, so the card behind this overlay is already the next one -
      // dismissing just reveals it, no re-showing the card just graded.
      if (justCrossedSoftWall) setShowSoftWallOverlay(true);
    }
  };

  const progressPercent = ((currentIndex) / (sessionQueue.length || 1)) * 100;

  // Once an anonymous user has crossed SOFT_WALL_THRESHOLD for this visit,
  // every subsequent session-completion screen gates on sign-in - no
  // "Continue" escape - instead of the normal one. See handleNextCard for
  // where hasCrossedSoftWall flips true and the accompanying dismissible
  // mid-session overlay (that one never blocks the current session).
  const isSoftWallGated = !user && hasCrossedSoftWall;

  return (
    <div className="app-container">
      <button type="button" className="beta-banner" onClick={() => setShowFeedback(true)}>
        <span className="beta-banner-tag">BETA TESTING.</span>
        <span className="beta-banner-cta">Click here to provide feedback.</span>
      </button>

      {entitlement.paywalled && (
        <div className="paywall-banner">
          {entitlement.message || 'This app now requires an active subscription.'}
        </div>
      )}

      {/* Top Navbar */}
      <nav className="top-nav-bar">
        <div className="nav-left">
          <button className="about-trigger-btn" onClick={() => setShowAbout(true)} aria-label="About Learn Hanzi">
            ℹ️
          </button>
          <span className="streak-badge">🔥 {streak}d</span>
          {appState === 'studying' && (
            <span className="xp-pill">⚡ {score} XP</span>
          )}
        </div>
        <div className="nav-right">
          <div className="account-trigger-wrap">
            <button className="account-trigger-btn" onClick={() => setShowAccount(true)} aria-label="Account">
              {user ? '👤' : '👤 Sign in'}
            </button>
            <SyncStatusDot />
          </div>
          <button className="settings-trigger-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            ⚙️ {revisionLevels.length > 0 ? `HSK ${revisionLevels.join(',')}` : 'Settings'}
          </button>
        </div>
      </nav>

      <div className="stage">
        <div className="floating-popups-container">
          {floatingPopups.map((p) => (
            <div key={p.id} className="arcade-popup">{p.text}</div>
          ))}
        </div>

        {/* 1. LAUNCH SCREEN - marketing pitch for logged-out visitors,
               action-first dashboard for everyone else */}
        {appState === 'launch' && (
          <LaunchScreen
            showMarketing={showMarketing}
            revisionLevels={revisionLevels}
            isLoadingDeck={isLoadingDeck}
            cardCount={rawDeck.length}
            weakCardsCount={weakCards.length}
            seenCardsCount={seenCards.length}
            launchArcadeSession={launchArcadeSession}
            launchHardModeSession={launchHardModeSession}
            onSignIn={() => setShowAccount(true)}
            renderTierTiles={renderTierTiles}
          />
        )}

        {/* 2 & 3. COUNTDOWN + STUDYING SESSION */}
        {(appState === 'countdown' || appState === 'studying') && (
          <StudySession
            appState={appState}
            countdownNum={countdownNum}
            card={card}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onGrade={handleNextCard}
            onReportMistake={() => setShowMistakeReport(true)}
            progressPercent={progressPercent}
          />
        )}

        {/* 4. COMPLETED SCREEN */}
        {appState === 'completed' && (
          <CompletionScreen
            score={score}
            maxCombo={maxCombo}
            visitGradeCount={visitGradeCount}
            isSoftWallGated={isSoftWallGated}
            onSignIn={() => setShowAccount(true)}
            onContinue={() => setAppState('launch')}
          />
        )}

        {/* SETTINGS DRAWER */}
        {showSettings && (
          <div className="drawer-overlay" onClick={() => setShowSettings(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <h3>Settings & Character Mastery</h3>

              <div style={{ marginTop: '12px' }}>
                <label className="box-section-label">Study Tiers: tap to include/exclude</label>
                <p style={{ fontSize: '12px', color: 'var(--ink-faint)', margin: '4px 0 0' }}>
                  {revisionLevels.length === 0 && includeNonHsk
                    ? 'Learning from every tier. Tap a tile to focus on specific ones.'
                    : 'Only reviewing the highlighted tiers below. Tap to add more, or clear all HSK tiles to include every level again.'}
                </p>
                <div className="tier-ring-grid">{renderTierTiles(72)}</div>
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

              <div className="card-internal-divider" />

              <button
                type="button"
                className="auth-toggle-link"
                style={{ margin: '4px auto 0' }}
                onClick={() => { setShowSettings(false); setShowAbout(true); }}
              >
                ℹ️ About Learn Hanzi
              </button>

            </div>
          </div>
        )}

        {showAccount && <AccountDrawer onClose={() => setShowAccount(false)} />}

        {showFeedback && <BetaFeedbackDrawer onClose={() => setShowFeedback(false)} />}

        {showAbout && <AboutDrawer onClose={() => setShowAbout(false)} />}

        {showMistakeReport && card && (
          <MistakeReportDrawer
            card={card}
            onClose={() => setShowMistakeReport(false)}
            onRequestSignIn={() => { setShowMistakeReport(false); setShowAccount(true); }}
          />
        )}

        {/* Dismissible mid-session nudge - does NOT end or interrupt the
            session; currentIndex has already advanced by the time this
            shows, so dismissing (including clicking the backdrop) just
            reveals the next card exactly as if this hadn't appeared. */}
        {showSoftWallOverlay && (
          <div className="drawer-overlay" onClick={() => setShowSoftWallOverlay(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <h3>Nice progress! 🎉</h3>
              <p className="soft-wall-message" style={{ marginTop: '10px' }}>
                You've reviewed {visitGradeCount} cards. Sign in to save your results, sync
                across your devices, and keep your learning streak.
              </p>
              <button
                className="primary-launch-btn"
                style={{ marginTop: '16px' }}
                onClick={() => { setShowSoftWallOverlay(false); setShowAccount(true); }}
              >
                Sign In / Create Account
              </button>
              <button
                className="auth-toggle-link"
                style={{ marginTop: '8px' }}
                onClick={() => setShowSoftWallOverlay(false)}
              >
                Continue Studying
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}