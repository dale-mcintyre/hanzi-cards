import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import './App.css';
import { calculateSM2 } from './utils/sm2';
import { getProgress, saveCardProgress, saveWritingProgress, getCardMasteryStats, getPrefs, savePrefs, getCommitment, saveCommitment, clearCommitment, getCommitmentStatus, getOfflineMode, setOfflineMode, getActiveSyncUser, MASTERED_INTERVAL_DAYS } from './utils/storage';
import { getSoundEnabled, setSoundEnabled, cancelSpeech } from './utils/tts';
import { playCorrectFeedback, playIncorrectFeedback, playMasteryFeedback } from './utils/feedback';
import { getFilteredDeck, fetchUnifiedVocab } from './data/vocabLoader';
import { fetchCharParts } from './data/charParts';
import { fetchCharFrequency } from './data/charFrequency';
import { getCharacterProgress, getCharacterPace, textCoverage, diffCharacterProgress, isReadKnown, canWrite } from './utils/charProgress';
import { recordStudy, getStudyDays, summarizeStudyDays, syncStudyDays } from './utils/studyDays';
import { buildSelfStudyQueue, getDueCount } from './utils/sessionQueue';
import { buildWarmupQueue } from './utils/warmupQueue';
import { buildPenAndPaperQueue, buildSuperchargeQueue } from './utils/writingQueue';
import { buildLessonPlan, resolveStageCards, estimateLessonMinutes, MAX_RECHECK_ATTEMPTS } from './utils/lessonQueue';
import { calculateWritingSchedule, WRITING_MASTERED_LEVEL } from './utils/writingSchedule';
import { getEntitlement } from './utils/entitlement';
import { useAuth } from './context/AuthContext';
import LaunchScreen from './components/LaunchScreen';
import StudySession from './components/StudySession';
import WarmupSession from './components/WarmupSession';
import WritingSession from './components/WritingSession';
import WritingBadge from './components/WritingBadge';
import CompletionScreen from './components/CompletionScreen';
import LessonStageIntro from './components/LessonStageIntro';
import CardInspectDrawer from './components/CardInspectDrawer';
import MasteryCelebration from './components/MasteryCelebration';
import SyncStatusDot from './components/SyncStatusDot';
import AccountDrawer from './components/AccountDrawer';
import MistakeReportDrawer from './components/MistakeReportDrawer';
import BetaFeedbackDrawer from './components/BetaFeedbackDrawer';
import AboutDrawer from './components/AboutDrawer';
import ProgressDrawer from './components/ProgressDrawer';
import ProgressSummary from './components/ProgressSummary';
import TierRingTile from './components/TierRingTile';
import { PersonIcon, GearIcon } from './components/icons';

const ALL_HSK_LEVELS = ['1', '2', '3', '4', '5', '6'];

// Cards graded (across the whole visit, any session type) before an
// anonymous user sees the one-time dismissible sign-up nudge mid-session -
// and, from that point on, before any session's completion screen gates on
// sign-in instead of offering a "Continue" escape.
const SOFT_WALL_THRESHOLD = 5;

// Self-Study's card-flip mechanic rotates the flip-back over 0.55s
// (App.css's `.card-flip-inner` transition) - advancing `currentIndex`
// (and thus the back face's content) in the same tick as `setIsFlipped
// (false)` would swap in the next card's data while that rotation is
// still visually in flight, flashing its definition before it turns out
// of view. Delaying the advance until just after the rotation finishes
// keeps the content swap hidden behind the card's edge-on moment. A small
// buffer over the CSS's 550ms guards against timer/paint jitter.
const STUDY_FLIP_BACK_MS = 560;

// Which screen each non-lesson appState runs on - the guided lesson
// instead takes it from its current stage's `kind` (see lessonQueue.js),
// since one lesson moves through all three.
const SESSION_KIND_BY_APP_STATE = {
  'self-study': 'flashcard',
  'pen-and-paper': 'writing',
  supercharge: 'writing',
  warmup: 'quiz',
};

// A stable empty array for WritingSession's queue props during the
// lesson - a fresh `[]` each render would look like a new session to its
// reset effect (see the penAndPaperRecallQueue note below).
const EMPTY_QUEUE = [];

export default function App() {
  // Empty = no filter, learn from the full frequency-ranked deck. A
  // non-empty selection (set from Settings) narrows to specific HSK levels
  // for targeted revision. Initialized from localStorage (not a hardcoded
  // default) so a saved filter survives a page reload.
  const [revisionLevels, setRevisionLevels] = useState(() => getPrefs().revisionLevels);
  const [includeNonHsk, setIncludeNonHsk] = useState(() => getPrefs().includeNonHsk);
  // Deliberately local-only (see storage.js's getOfflineMode/setOfflineMode) -
  // never part of the synced revisionLevels/includeNonHsk prefs blob, since a
  // flag that turns off syncing can't itself be synced without propagating
  // to every other device too.
  const [offlineMode, setOfflineModeState] = useState(() => getOfflineMode());
  // Lives here (not in StudySession) so the toggle can sit in the persistent
  // nav bar and work from every screen, not just mid-session. speakText
  // itself gates on this internally, so nothing downstream needs to know
  // about it beyond rendering the toggle's own icon/label.
  const [soundEnabled, setSoundEnabledState] = useState(() => getSoundEnabled());
  const [showSettings, setShowSettings] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showMistakeReport, setShowMistakeReport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [activeMasteryTab, setActiveMasteryTab] = useState('new');
  // The user's own "finish HSK X in N weeks" goal, if they've set one -
  // read once at mount (see storage.js's getCommitment for why this is
  // local-only, unlike revisionLevels/includeNonHsk above) and updated
  // straight from the setter/clearer handlers below rather than re-read
  // on every render.
  const [commitment, setCommitment] = useState(() => getCommitment());

  const { user, isAuthReady, syncVersion } = useAuth();

  // Defaults to the dashboard (false) during the brief pre-isAuthReady gap
  // rather than flashing marketing copy at a logged-in user - the dashboard
  // is a strict subset of the marketing view (same header, same primary
  // CTA, just no persuasive copy), so the worst case for a logged-out
  // visitor is a sub-frame of the leaner view before this flips true.
  const showMarketing = isAuthReady && !user;

  // Single source of truth for "what screen is showing": 'dashboard',
  // 'lesson', 'self-study', 'pen-and-paper', 'supercharge', 'warmup', or
  // 'completion'. Replaces the old two-axis appState+sessionMode pair
  // (which only ever had 4 valid combinations) and the 3-2-1 countdown
  // step entirely - clicking a launch button sets this straight to its
  // target mode, no intermediate state, no delay. 'supercharge' is
  // otherwise identical to 'pen-and-paper' (same WritingSession UI, same
  // grading rules) - it exists as its own state only so a mid-session
  // reload/inspection can tell which batch size the user actually
  // launched.
  const [appState, setAppState] = useState('dashboard');

  // The nav bar (and its sign-out control) is reachable from every screen,
  // but the marketing/dashboard switch only lives in the 'dashboard' state -
  // without this, signing out mid-session left the studying screen up
  // indefinitely even though the user was already signed out. Only fires
  // on a real sign-out transition (user: object -> null); on initial
  // mount user is already null and appState is already 'dashboard', so
  // this is a harmless no-op then, and it doesn't fire on sign-in at all.
  useEffect(() => {
    if (!user) setAppState('dashboard');
  }, [user]);

  // Per-card outcomes for the session currently in progress (or just
  // finished) - feeds the post-session recap on CompletionScreen. Reset
  // at the start of every session, appended to in handleNextCard.
  // inspectedResult drives the tap-to-inspect drawer from that recap.
  const [sessionResults, setSessionResults] = useState([]);
  const [inspectedResult, setInspectedResult] = useState(null);

  // Drives the full-screen celebration when a grade pushes a card's SM-2
  // interval past MASTERED_INTERVAL_DAYS - set in handleNextCard, cleared
  // by MasteryCelebration itself once its display timer elapses.
  const [masteredCelebration, setMasteredCelebration] = useState(null);
  // Stable reference (not an inline arrow in JSX) - MasteryCelebration's
  // own dismiss-timer effect depends on this prop, so a fresh function
  // identity on every unrelated App.jsx re-render would otherwise restart
  // its 2.2s timer indefinitely instead of ever actually firing.
  const dismissMasteryCelebration = useCallback(() => setMasteredCelebration(null), []);

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

  // How each character is built (see data/charParts.js) - feeds Priming's
  // parts breakdown and the quizzes' look-alike wrong answers. Null until
  // loaded; everything that uses it works without it in the meantime.
  const [charParts, setCharParts] = useState(null);
  useEffect(() => {
    fetchCharParts().then(setCharParts);
  }, []);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Pen & Paper's Priming-phase subset, computed once by
  // buildPenAndPaperQueue at launch time - WritingSession no longer
  // derives this itself.
  const [primeQueue, setPrimeQueue] = useState([]);
  // Pen & Paper's Recall (Phase 2) and Sentence Writing (Phase 3)
  // subsets - both appended together into sessionQueue itself (so
  // currentIndex/handleNextCard need no phase awareness at all), but
  // also kept here as their own state so WritingSession can compute each
  // phase's own position/total rather than one spanning both segments.
  // Deliberately real state, not a `sessionQueue.slice(...)` derived
  // inline on every render - a fresh slice() is a new array reference
  // each time, which would make WritingSession's session-reset effect
  // (keyed on these arrays) think a new session started on every render.
  const [penAndPaperRecallQueue, setPenAndPaperRecallQueue] = useState([]);
  const [sentenceQueue, setSentenceQueue] = useState([]);

  // The guided lesson (see lessonQueue.js): its stages, which one is
  // running, and whether that stage's intro card is showing.
  // sessionQueue/currentIndex/handleNextCard run each stage's cards exactly
  // as they run any other session - these only decide what comes next.
  const [lessonStages, setLessonStages] = useState([]);
  const [lessonStageIndex, setLessonStageIndex] = useState(0);
  const [isLessonIntro, setIsLessonIntro] = useState(false);
  const [lessonElapsedMinutes, setLessonElapsedMinutes] = useState(0);
  // Set when a lesson finishes, for CompletionScreen's lesson title and
  // summary line; cleared by every other kind of launch.
  const [lessonSummary, setLessonSummary] = useState(null);
  // Refs, not state: written and read within the same handleNextCard
  // call, where a state update wouldn't be visible yet.
  const lessonStartedAtRef = useRef(0);
  const stageStartedAtRef = useRef(0);
  const lessonNewTaughtRef = useRef(0);
  // Cards graded wrong in the lesson's graded stages, by id - what Close
  // the Loop re-tests (see resolveStageCards).
  const lessonMissesRef = useRef({ reading: new Map(), writing: new Map() });
  // Misses per card within Close the Loop, capped at MAX_RECHECK_ATTEMPTS.
  const recheckAttemptsRef = useRef(new Map());

  const [isFlipped, setIsFlipped] = useState(false);
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
          // Defaults merged underneath (not a bare `||` fallback) so a
          // card saved before Writing Recall Mode shipped - which has
          // reading fields but no writing ones yet - still gets the
          // writing defaults filled in, rather than leaving them undefined.
          stats: {
            repetitions: 0,
            interval: 1,
            easeFactor: 2.5,
            lastReviewed: null,
            writingLevel: 0,
            writingReps: 0,
            writingIntervalDays: 0,
            writingNextDue: null,
            lastWrittenAt: null,
            ...savedProgress[cardId],
          },
        };
      });

      setRawDeck(merged);
      setIsLoadingDeck(false);
    }

    loadDeck();
    // syncVersion isn't read above - it's a signal, not data. It bumps
    // after AuthContext hydrates localStorage from a signed-in account's
    // remote progress OR remote settings, so this effect re-runs and
    // rawDeck picks up the merged stats even when revisionLevels/
    // includeNonHsk haven't themselves changed by reference.
  }, [revisionLevels, includeNonHsk, syncVersion]);

  // revisionLevels/includeNonHsk/commitment are plain useState, read from
  // localStorage once at mount - unlike getProgress() (read fresh every
  // loadDeck run), they don't automatically pick up a post-sign-in remote
  // hydration on their own, so this explicitly re-reads them whenever
  // syncVersion bumps (either a progress sync or a settings sync). A
  // no-op re-read after a progress-only bump is harmless.
  useEffect(() => {
    const fresh = getPrefs();
    setRevisionLevels(fresh.revisionLevels);
    setIncludeNonHsk(fresh.includeNonHsk);
    setCommitment(getCommitment());
  }, [syncVersion]);

  // Drives the LaunchScreen "Self-Study (N Due)" label.
  const dueCount = useMemo(() => getDueCount(rawDeck), [rawDeck]);

  // A simple heuristic (12 seconds/card, rounded up, minimum 1) for the
  // "~N min" sub-label - not a measured estimate, just a reasonable guess
  // at session length.
  const selfStudyEstMinutes = Math.max(1, Math.round((dueCount * 12) / 60));

  // Every card the user has graded at least once, regardless of how it's
  // currently doing on the SM-2 curve - a free-form review pool distinct
  // from "weak" (struggling specifically) or the mastery matrix tabs.
  // Gated on lastReviewed, not repetitions - SM-2 resets repetitions to 0
  // on a wrong answer, which would otherwise drop a struggling card out
  // of the seen pool entirely (and back into Warmup's "New Character"
  // reveal treatment) the moment it's missed once, instead of actually
  // reviewing it.
  const seenCards = useMemo(() => rawDeck.filter((c) => c.stats.lastReviewed), [rawDeck]);

  const mastery = useMemo(() => {
    return getCardMasteryStats(rawDeck);
  }, [rawDeck]);

  // Priming (watch + copy, only the never-written cards) runs slower than
  // Recall (write from memory, the whole batch); Sentence Writing (read a
  // sentence, write the missing word) runs slower still. ~25s/15s/30s per
  // card respectively is a rough split, not a measured average. Shared by
  // Pen & Paper and Supercharge - both are the same three phases at the
  // same per-card pace, just a different batch size.
  function estimateWritingMinutes(preview) {
    return Math.max(
      1,
      Math.round(
        (preview.primeQueue.length * 25 + preview.recallQueue.length * 15 + preview.sentenceQueue.length * 30) / 60
      )
    );
  }

  // Same calls the actual launches will make - previewing them here
  // (rather than an unbounded/Infinity variant) gives the dashboard's "2
  // new, 6 review" sub-labels the exact counts a real launch would
  // produce, since the thin-review boost and batch-size floor/ceiling are
  // already baked into buildWritingBatch itself.
  const penAndPaperPreview = useMemo(() => buildPenAndPaperQueue(rawDeck), [rawDeck]);
  const penAndPaperEstMinutes = estimateWritingMinutes(penAndPaperPreview);

  const superchargePreview = useMemo(() => buildSuperchargeQueue(rawDeck), [rawDeck]);
  const superchargeEstMinutes = estimateWritingMinutes(superchargePreview);

  // Same call launchLesson makes, for the dashboard's "N review, M new"
  // label - the shuffles inside differ run to run, but the counts don't.
  const lessonPreview = useMemo(() => {
    const stages = buildLessonPlan(rawDeck, charParts);
    const countFor = (key) => stages.find((s) => s.key === key)?.cards.length || 0;
    return {
      reviewCount: countFor('review-reading') + countFor('review-writing'),
      newCount: countFor('learn-new'),
      estMinutes: estimateLessonMinutes(stages),
      hasContent: stages.some((s) => !s.dynamic),
    };
  }, [rawDeck, charParts]);

  // Independent of the current HSK/non-HSK filter - rawDeck only contains
  // whatever tiers are currently selected, but the tier tiles need stats
  // for every tier including ones not currently active. fetchUnifiedVocab
  // caches internally, so this only ever does real work once per session.
  const [fullVocab, setFullVocab] = useState([]);
  useEffect(() => {
    fetchUnifiedVocab().then(setFullVocab);
  }, []);

  // Character-level progress (see utils/charProgress.js) - behind the
  // home screen's progress line, the Settings rings, the Progress drawer
  // and the session recap. rawDeck/syncVersion are cheap "something
  // changed" triggers, not the data source - getProgress() is re-read
  // fresh each time, matching how getCardMasteryStats already re-reads
  // progress rather than trusting a stale closure. Keeping them as deps
  // is intentional (removing them would make this go stale after every
  // grade/sync), so the exhaustive-deps warning is a false positive.
  const charProgress = useMemo(
    () => getCharacterProgress(fullVocab, getProgress()),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [fullVocab, rawDeck, syncVersion]
  );

  // Per-tier pace in Known characters, for the Progress drawer's level
  // rows and the HSK goal.
  const charPace = useMemo(() => getCharacterPace(charProgress), [charProgress]);

  // How often each character shows up in real text (see
  // build-char-frequency.py) - for "these make up ~N% of everyday text".
  const [charFreq, setCharFreq] = useState(null);
  useEffect(() => {
    fetchCharFrequency().then(setCharFreq);
  }, []);
  const coverage = useMemo(() => textCoverage(charProgress.knownChars, charFreq), [charProgress, charFreq]);

  // Days studied and review accuracy (see utils/studyDays.js) - re-read
  // after every grade (rawDeck) and every sync (syncVersion), same
  // invalidation-trigger convention as charProgress above.
  const studySummary = useMemo(
    () => summarizeStudyDays(getStudyDays()),
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [rawDeck, syncVersion]
  );

  // Recombines the saved goal (if any) with the same pace numbers the
  // plain per-tier rows use, so "are you on track" always agrees with
  // whatever pace those rows are showing right now - see
  // getCommitmentStatus for the actual on-track math.
  const commitmentStatus = useMemo(
    () => getCommitmentStatus(commitment, charPace),
    [commitment, charPace]
  );

  // The Known/Can Write/Introduced picture when the current session
  // started, so its recap can say what actually changed (see
  // diffCharacterProgress). Set by every launch.
  const [sessionStartProgress, setSessionStartProgress] = useState(null);

  // Push this device's study-day counts once a session ends, so another
  // signed-in device sees today as studied.
  useEffect(() => {
    if (appState !== 'completion') return;
    const userId = getActiveSyncUser();
    if (userId) syncStudyDays(userId);
  }, [appState]);

  const handleSetCommitment = (tier, weeks) => {
    setCommitment(saveCommitment(tier, weeks));
  };

  const handleClearCommitment = () => {
    clearCommitment();
    setCommitment(null);
  };

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

  // A full reload (mirrors the same pattern signOut already uses) is the
  // simplest way to guarantee AuthContext's mount-time logic picks up the
  // new flag correctly in both directions - skip everything if now on, or
  // immediately resume migration/settings-sync/queue-flush if now off -
  // without needing separate reactive re-sync plumbing for the "turn back
  // on" case.
  const toggleOfflineMode = () => {
    const next = !offlineMode;
    setOfflineModeState(next);
    setOfflineMode(next);
    window.location.reload();
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEnabled(next);
  };

  function renderTierTiles(size) {
    return (
      <>
        {ALL_HSK_LEVELS.map((lvl) => (
          <TierRingTile
            key={lvl}
            tierKey={lvl}
            label={`HSK ${lvl}`}
            {...charProgress.tiers[lvl]}
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
          {...charProgress.tiers['non-hsk']}
          active={includeNonHsk}
          size={size}
          onClick={toggleNonHsk}
        />
      </>
    );
  }

  // Primary dashboard action - also used by the anonymous marketing
  // page's one-time trial CTA (see LaunchScreen.jsx), which is why it
  // takes a count instead of always using the dashboard's own default -
  // both land in the same 'self-study' screen, so there's no reason for
  // two near-duplicate launch functions.
  const launchSelfStudy = (count = 20) => {
    // Due-for-review cards first (most overdue first), then never-studied
    // cards introduced in frequency order - not a flat random shuffle.
    const queue = buildSelfStudyQueue(rawDeck, count);
    if (queue.length === 0) return;

    setSessionQueue(queue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionResults([]);
    setLessonSummary(null);
    setSessionStartProgress(charProgress);
    setAppState('self-study');
  };

  // Dashboard's secondary action: a dedicated pen-and-paper session -
  // Priming walks primeQueue (up to 2 never-written cards), Recall tests
  // the whole shuffled batch, then Sentence Writing tests up to 2 more
  // already-learned cards in a full-sentence Cloze context. sentenceQueue
  // is appended after recallQueue directly into sessionQueue - App.jsx's
  // generic currentIndex/handleNextCard pipeline (shared with every other
  // mode) just walks through both segments in order with no phase
  // awareness needed; only WritingSession itself distinguishes them (via
  // the separate recallQueue/sentenceQueue arrays passed below). Only
  // ever offered on characters already read-mastered.
  //
  // Shared with Supercharge Mode below - the only difference between the
  // two is which queue-builder gets called (buildPenAndPaperQueue vs
  // buildSuperchargeQueue) and which appState the batch lands in;
  // everything about starting the session itself is identical.
  const startWritingSession = (buildQueue, targetAppState) => {
    const { primeQueue: primed, recallQueue, sentenceQueue: sentenced } = buildQueue(rawDeck);
    if (recallQueue.length === 0) return;

    setSessionQueue([...recallQueue, ...sentenced]);
    setPrimeQueue(primed);
    setPenAndPaperRecallQueue(recallQueue);
    setSentenceQueue(sentenced);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionResults([]);
    setLessonSummary(null);
    setSessionStartProgress(charProgress);
    setAppState(targetAppState);
  };

  const launchPenAndPaper = () => startWritingSession(buildPenAndPaperQueue, 'pen-and-paper');

  // Same Priming -> Blind Recall -> Sentence Writing format as Pen & Paper,
  // just fed buildSuperchargeQueue's doubled batch (see writingQueue.js)
  // for a user who wants to push through more new material per sitting.
  const launchSupercharge = () => startWritingSession(buildSuperchargeQueue, 'supercharge');

  // A rapid, thumb-only 4-choice recognition drill - one of the app's two
  // new-character intake points (alongside Pen & Paper's Priming) now
  // that Free Self-Study is pure review: draws from already-seen cards
  // first, then fills any remainder with never-seen ones (each getting an
  // ungraded reveal before its quiz question - see WarmupSession). Also
  // the anonymous marketing trial's entry point (see MarketingLanding's
  // onStart below) - unlike Free Self-Study, it always has something to
  // show a brand new visitor with zero history.
  const launchWarmup = (count = 10) => {
    const warmupQueue = buildWarmupQueue(seenCards, rawDeck, count, charParts);
    if (warmupQueue.length === 0) return;

    setSessionQueue(warmupQueue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionResults([]);
    setLessonSummary(null);
    setSessionStartProgress(charProgress);
    setAppState('warmup');
  };

  const finishLesson = () => {
    setLessonSummary({
      minutes: Math.max(1, Math.round((Date.now() - lessonStartedAtRef.current) / 60000)),
      newCount: lessonNewTaughtRef.current,
    });
    setAppState('completion');
  };

  // Moves to the first stage at or after `fromIndex` that has anything to
  // show, resolving its cards against what the lesson has seen so far
  // (`results` passed in explicitly - when called from handleNextCard,
  // sessionResults state doesn't include the grade just made yet), and
  // shows that stage's intro. Ends the lesson once no stage is left.
  const enterLessonStage = (stages, fromIndex, results) => {
    for (let i = fromIndex; i < stages.length; i++) {
      const cards = resolveStageCards(stages[i], stages, lessonMissesRef.current, results);
      if (cards.length === 0) continue;

      const resolved = { ...stages[i], cards };
      if (resolved.primeQueue) {
        const ids = new Set(cards.map((c) => c.id));
        resolved.primeQueue = resolved.primeQueue.filter((c) => ids.has(c.id));
      }
      setLessonStages(stages.map((s, j) => (j === i ? resolved : s)));
      setLessonStageIndex(i);
      setLessonElapsedMinutes(Math.floor((Date.now() - lessonStartedAtRef.current) / 60000));
      setIsLessonIntro(true);
      return;
    }
    finishLesson();
  };

  // The dashboard's primary action: one guided ~20 minute lesson that runs
  // the quiz, flashcard and writing screens in a tutor's order - see
  // buildLessonPlan for the steps and why.
  const launchLesson = () => {
    const stages = buildLessonPlan(rawDeck, charParts);
    if (!stages.some((s) => !s.dynamic)) return;

    lessonMissesRef.current = { reading: new Map(), writing: new Map() };
    recheckAttemptsRef.current = new Map();
    lessonNewTaughtRef.current = 0;
    lessonStartedAtRef.current = Date.now();
    setSessionResults([]);
    setLessonSummary(null);
    setSessionStartProgress(charProgress);
    setAppState('lesson');
    enterLessonStage(stages, 0, []);
  };

  const beginLessonStage = () => {
    const stage = lessonStages[lessonStageIndex];
    if (stage.key === 'learn-new') lessonNewTaughtRef.current = stage.cards.length;
    setSessionQueue(stage.cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    stageStartedAtRef.current = Date.now();
    setIsLessonIntro(false);
  };

  const card = sessionQueue[currentIndex];
  const lessonStage = appState === 'lesson' ? lessonStages[lessonStageIndex] : null;
  const sessionKind = lessonStage ? lessonStage.kind : SESSION_KIND_BY_APP_STATE[appState];

  // Speaking on flip is StudySession's job now (it also owns the delayed
  // auto-play timer and needs to dedupe against it - see its
  // card/isFlipped effect) - this just toggles the visual state.
  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  // Blocks re-entry while a graded Self-Study card's flip-back animation
  // is still finishing - see STUDY_FLIP_BACK_MS. Without this, a fast
  // double-tap/swipe during that window could grade the same card twice
  // before its content actually changes.
  const isAdvancingRef = useRef(false);

  const handleNextCard = (quality) => {
    if (!card || isAdvancingRef.current) return;

    // Grading means the user is done with this card's pronunciation too -
    // if the flip's delayed auto-play timer fired right around the same
    // moment (StudySession's AUTO_PLAY_DELAY_MS is 1.5s, well within
    // normal read-then-grade timing), letting speechSynthesis keep
    // talking while the grading tone below starts can make two separate
    // OS audio pipelines open at once, which is a known source of an
    // audible click/pop on several mobile browsers - cutting it off first
    // avoids that overlap entirely.
    cancelSpeech();

    // Writing grades (1/2/3 - Missed/Hesitated/Clean) and reading grades
    // (SM-2's 1-5 quality scale) don't share a "success" threshold -
    // Clean (3) is writing's best outcome, but on the reading scale 3 is a
    // middling grade. isSuccess drives the correct/incorrect chime, the
    // session recap grouping, and the soft-wall counter below regardless
    // of session type - only this threshold and the stats-calculation/
    // persistence step (right below) branch on it.
    const isWritingCard = sessionKind === 'writing';
    const isSuccess = isWritingCard ? quality >= 3 : quality >= 4;
    // The lesson's Close the Loop steps re-test cards already graded once
    // this lesson - that first grade is what the schedule keeps (see
    // buildLessonPlan), so these only give feedback.
    const isPracticeOnly = !!lessonStage?.practiceOnly;

    let newStats = null;
    let justMastered = false;
    let masteryLabel;

    if (isPracticeOnly) {
      // Feedback chime only - no schedule change.
    } else if (isWritingCard) {
      const wasReflexive = (card.stats?.writingLevel || 0) >= WRITING_MASTERED_LEVEL;
      const newWritingStats = calculateWritingSchedule(quality, card.stats);
      // When this grade first makes the card Can Write - see
      // utils/charProgress.js, which counts "this week" from it.
      if (!canWrite(card.stats) && canWrite({ ...card.stats, ...newWritingStats, lastWrittenAt: Date.now() })) {
        newWritingStats.canWriteAt = Date.now();
      }
      justMastered = !wasReflexive && newWritingStats.writingLevel >= WRITING_MASTERED_LEVEL;
      masteryLabel = 'Reflexive';
      newStats = saveWritingProgress(card.id, newWritingStats);
    } else {
      const wasAlreadyMastered = (card.stats?.interval || 1) >= MASTERED_INTERVAL_DAYS;
      const computedStats = calculateSM2(
        quality,
        card.stats?.repetitions || 0,
        card.stats?.interval || 1,
        card.stats?.easeFactor || 2.5
      );
      justMastered = !wasAlreadyMastered && computedStats.interval >= MASTERED_INTERVAL_DAYS;
      // Same for becoming Known.
      if (!isReadKnown(card.stats) && isReadKnown({ ...card.stats, ...computedStats, lastReviewed: Date.now() })) {
        computedStats.knownAt = Date.now();
      }
      masteryLabel = 'Mastered';
      newStats = saveCardProgress(card.id, computedStats);
    }

    // A mastery moment supersedes the routine correct/incorrect chime
    // rather than playing both - it's a bigger, distinct event. Reaching
    // Writing Level 3 (Reflexive) reuses this same celebration as reaching
    // a 21-day reading interval - both are comparably significant
    // "you've truly got this" milestones, distinguished by their label.
    if (justMastered) {
      playMasteryFeedback();
      setMasteredCelebration({ character: card.character, pinyin: card.pinyin, label: masteryLabel });
    } else if (isSuccess) {
      playCorrectFeedback();
    } else {
      playIncorrectFeedback();
    }

    // Keep rawDeck in sync so a subsequent session (built from rawDeck)
    // sees this card's real stats - otherwise it'd still look stale until
    // the next full deck reload. Merged onto the existing stats (not
    // replaced) since newStats here only ever carries the half (reading or
    // writing) this grade just touched - saveCardProgress/
    // saveWritingProgress already return the full merged-with-localStorage
    // object, but rawDeck's copy of this card may be a render or two
    // behind that, so merging here too keeps it correct regardless.
    if (newStats) {
      setRawDeck((prev) => prev.map((c) => (c.id === card.id ? { ...c, stats: { ...c.stats, ...newStats } } : c)));
    }

    // Feeds the post-session recap on CompletionScreen - a lightweight
    // per-card log distinct from rawDeck (which only ever holds each
    // card's latest stats, not a history of this session's grades).
    // Built locally too, so a lesson stage ending on this grade can pass
    // it straight to enterLessonStage below.
    const nextResults = [
      ...sessionResults,
      { id: card.id, character: card.character, pinyin: card.pinyin, meaning: card.meaning, isSuccess },
    ];
    setSessionResults(nextResults);

    // Every grade marks today as studied; only a real review (a card
    // already studied in this skill, graded for the schedule) counts
    // toward the "remembered N% of reviews" figure.
    const wasStudiedBefore = isWritingCard ? !!card.stats?.lastWrittenAt : !!card.stats?.lastReviewed;
    recordStudy({ isReview: !isPracticeOnly && wasStudiedBefore, isSuccess });

    // Warm Up is practice-only but still feeds Close the Loop's misses -
    // only Close the Loop's own re-tests are excluded.
    if (lessonStage && !lessonStage.retryMisses && !isSuccess) {
      lessonMissesRef.current[isWritingCard ? 'writing' : 'reading'].set(card.id, card);
    }

    // Close the Loop: a miss goes back on the end of the queue as a fresh
    // copy (WritingSession tracks its reveal by object, so a same-id copy
    // starts hidden), until MAX_RECHECK_ATTEMPTS misses.
    let queueLength = sessionQueue.length;
    if (lessonStage?.retryMisses && !isSuccess) {
      const attemptKey = `${lessonStage.key}:${card.id}`;
      const misses = (recheckAttemptsRef.current.get(attemptKey) || 0) + 1;
      recheckAttemptsRef.current.set(attemptKey, misses);
      if (misses < MAX_RECHECK_ATTEMPTS) {
        setSessionQueue((prev) => [...prev, { ...card }]);
        queueLength += 1;
      }
    }

    // A lesson stage's time box only ever cuts it short between cards,
    // never mid-card.
    const isStageOutOfTime = !!lessonStage?.budgetMs && Date.now() - stageStartedAtRef.current >= lessonStage.budgetMs;

    // Computed as local values, not read back from state this same tick -
    // the setters below wouldn't be visible yet if we read the state
    // directly further down.
    const newVisitGradeCount = !user ? visitGradeCount + 1 : visitGradeCount;
    if (!user) setVisitGradeCount(newVisitGradeCount);

    const justCrossedSoftWall = !user && !hasCrossedSoftWall && newVisitGradeCount >= SOFT_WALL_THRESHOLD;
    if (justCrossedSoftWall) setHasCrossedSoftWall(true);

    if (currentIndex + 1 >= queueLength || isStageOutOfTime) {
      // No separate action needed for gating here - the completed screen
      // derives its gated/ungated variant from (!user && hasCrossedSoftWall)
      // at render time, and hasCrossedSoftWall was just set above if this
      // very card is the one that crossed the threshold - so even a first
      // session that crosses 5 on its last card correctly renders gated.
      if (lessonStage) {
        enterLessonStage(lessonStages, lessonStageIndex + 1, nextResults);
      } else {
        setAppState('completion');
      }
    } else {
      setIsFlipped(false);

      const advance = () => {
        isAdvancingRef.current = false;
        setCurrentIndex((prev) => prev + 1);
        // Dismissible, non-interrupting: currentIndex has already advanced
        // above, so the card behind this overlay is already the next one -
        // dismissing just reveals it, no re-showing the card just graded.
        if (justCrossedSoftWall) setShowSoftWallOverlay(true);
      };

      // Only Self-Study uses the 3D flip - delaying the content swap until
      // its rotation finishes is what hides the flash (see
      // STUDY_FLIP_BACK_MS). Warmup/Pen & Paper don't flip, so they advance
      // immediately as before.
      if (sessionKind === 'flashcard') {
        isAdvancingRef.current = true;
        setTimeout(advance, STUDY_FLIP_BACK_MS);
      } else {
        advance();
      }
    }
  };

  const progressPercent = ((currentIndex) / (sessionQueue.length || 1)) * 100;

  // Once an anonymous user has crossed SOFT_WALL_THRESHOLD for this visit,
  // every subsequent session-completion screen gates on sign-in - no
  // "Continue" escape - instead of the normal one. See handleNextCard for
  // where hasCrossedSoftWall flips true and the accompanying dismissible
  // mid-session overlay (that one never blocks the current session).
  const isSoftWallGated = !user && hasCrossedSoftWall;

  // During a lesson, the stage's intro card replaces the session screen
  // until Begin.
  const isSessionScreenShowing = appState !== 'lesson' || !isLessonIntro;

  // Pen & Paper/Supercharge keep their own queue state; a lesson writing
  // stage is either recall (its cards, plus Priming for Learn New) or
  // sentences, never both - sessionQueue itself is the live list, so Close
  // the Loop's re-queued copies show up in WritingSession's "N of M".
  const writingQueues = lessonStage
    ? {
        primeQueue: lessonStage.primeQueue || EMPTY_QUEUE,
        recallQueue: lessonStage.isSentence ? EMPTY_QUEUE : sessionQueue,
        sentenceQueue: lessonStage.isSentence ? sessionQueue : EMPTY_QUEUE,
      }
    : { primeQueue, recallQueue: penAndPaperRecallQueue, sentenceQueue };

  return (
    <div className="app-container">
      {entitlement.paywalled && (
        <div className="paywall-banner">
          {entitlement.message || 'This app now requires an active subscription.'}
        </div>
      )}

      {/* Top Navbar */}
      <nav className="top-nav-bar">
        <div className="nav-left">
          {/* Days studied in the last 7, not an all-or-nothing streak -
              one missed day doesn't wipe it back to zero. */}
          <span className="streak-badge" title={`${studySummary.daysLast30} of the last 30 days`}>
            {studySummary.daysThisWeek} of 7 days
          </span>
          <button
            type="button"
            className="beta-feedback-pill"
            onClick={() => setShowFeedback(true)}
            aria-label="Send beta feedback"
          >
            <span className="beta-feedback-dot" />
            Beta Feedback
          </button>
        </div>
        <div className="nav-right">
          <div className="account-trigger-wrap">
            <button className="account-trigger-btn" onClick={() => setShowAccount(true)} aria-label="Account">
              <PersonIcon />
              {!user && <span>Sign in</span>}
            </button>
            <SyncStatusDot />
          </div>
          {/* Icon-only at rest, matching the account button's own
              "nothing extra to say" default - only expands to show the
              active filter when one is actually narrowed down. */}
          <button className="settings-trigger-btn" onClick={() => setShowSettings(true)} aria-label="Settings">
            <GearIcon />
            {revisionLevels.length > 0 && <span>HSK {revisionLevels.join(',')}</span>}
          </button>
        </div>
      </nav>

      <div className="stage">
        {/* DASHBOARD - marketing pitch for logged-out visitors,
               action-first dashboard for everyone else */}
        {appState === 'dashboard' && (
          <LaunchScreen
            showMarketing={showMarketing}
            revisionLevels={revisionLevels}
            isLoadingDeck={isLoadingDeck}
            cardCount={rawDeck.length}
            dueCount={dueCount}
            selfStudyEstMinutes={selfStudyEstMinutes}
            penAndPaperNewCount={penAndPaperPreview.primeQueue.length}
            penAndPaperReviewCount={penAndPaperPreview.recallQueue.length - penAndPaperPreview.primeQueue.length}
            penAndPaperTotal={penAndPaperPreview.recallQueue.length}
            penAndPaperEstMinutes={penAndPaperEstMinutes}
            superchargeNewCount={superchargePreview.primeQueue.length}
            superchargeReviewCount={superchargePreview.recallQueue.length - superchargePreview.primeQueue.length}
            superchargeTotal={superchargePreview.recallQueue.length}
            superchargeEstMinutes={superchargeEstMinutes}
            lessonReviewCount={lessonPreview.reviewCount}
            lessonNewCount={lessonPreview.newCount}
            lessonEstMinutes={lessonPreview.estMinutes}
            hasLessonContent={lessonPreview.hasContent}
            onLaunchLesson={launchLesson}
            onLaunchSelfStudy={launchSelfStudy}
            onLaunchPenAndPaper={launchPenAndPaper}
            onLaunchSupercharge={launchSupercharge}
            onLaunchWarmup={launchWarmup}
            onSignIn={() => setShowAccount(true)}
            knownCount={charProgress.totals.known}
            knownThisWeek={charProgress.knownThisWeek}
            daysThisWeek={studySummary.daysThisWeek}
          />
        )}

        {appState === 'lesson' && isLessonIntro && lessonStage && (
          <LessonStageIntro
            stage={lessonStage}
            cardCount={lessonStage.cards.length}
            elapsedMinutes={lessonElapsedMinutes}
            onBegin={beginLessonStage}
            onEnd={finishLesson}
          />
        )}

        {isSessionScreenShowing && sessionKind === 'flashcard' && (
          <StudySession
            card={card}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            onGrade={handleNextCard}
            onReportMistake={() => setShowMistakeReport(true)}
            progressPercent={progressPercent}
            showIntervals={!lessonStage?.practiceOnly}
          />
        )}

        {isSessionScreenShowing && sessionKind === 'writing' && (
          <WritingSession
            {...writingQueues}
            card={card}
            onGrade={handleNextCard}
            progressPercent={progressPercent}
            phaseBanners={!lessonStage}
            showIntervals={!lessonStage?.practiceOnly}
            charParts={charParts}
          />
        )}

        {isSessionScreenShowing && sessionKind === 'quiz' && (
          <WarmupSession
            card={card}
            onAnswer={handleNextCard}
            progressPercent={progressPercent}
          />
        )}

        {appState === 'completion' && (
          <CompletionScreen
            visitGradeCount={visitGradeCount}
            isSoftWallGated={isSoftWallGated}
            sessionResults={sessionResults}
            onInspectCard={setInspectedResult}
            onSignIn={() => setShowAccount(true)}
            onContinue={() => setAppState('dashboard')}
            progressChange={sessionStartProgress ? diffCharacterProgress(sessionStartProgress, charProgress) : null}
            knownCount={charProgress.totals.known}
            title={lessonSummary ? 'Lesson complete' : undefined}
            summaryLine={lessonSummary
              ? `${lessonSummary.minutes} min · ${lessonSummary.newCount} new ${lessonSummary.newCount === 1 ? 'character' : 'characters'}`
              : undefined}
          />
        )}

        {/* SETTINGS DRAWER */}
        {showSettings && (
          <div className="drawer-overlay" onClick={() => setShowSettings(false)}>
            <div className="drawer-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-handle" />
              <h3>Settings & Character Mastery</h3>

              <div style={{ marginTop: '12px' }}>
                <ProgressSummary
                  charProgress={charProgress}
                  coverage={coverage}
                  filterHint={revisionLevels.length === 0 && includeNonHsk
                    ? 'Tap a level to study only some levels.'
                    : 'Studying only the highlighted levels. Tap to add more, or clear all HSK levels to include every level again.'}
                  renderTierTiles={renderTierTiles}
                  onOpenDetails={() => { setShowSettings(false); setShowProgress(true); }}
                />
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
                    New ({mastery.new.length})
                  </button>
                  <button
                    className={`level-toggle-btn ${activeMasteryTab === 'learning' ? 'active' : ''}`}
                    onClick={() => setActiveMasteryTab('learning')}
                    style={{ fontSize: '12px', padding: '8px' }}
                  >
                    Learning ({mastery.learning.length})
                  </button>
                  <button
                    className={`level-toggle-btn ${activeMasteryTab === 'mastered' ? 'active' : ''}`}
                    onClick={() => setActiveMasteryTab('mastered')}
                    style={{ fontSize: '12px', padding: '8px' }}
                  >
                    Mastered ({mastery.mastered.length})
                  </button>
                </div>

                <div className="mastery-list-box">
                  {mastery[activeMasteryTab].length === 0 ? (
                    <p className="empty-mastery-text">No characters in this category yet!</p>
                  ) : (
                    <div className="mastery-grid-chips">
                      {mastery[activeMasteryTab].map((c) => (
                        <div key={c.id} className="mastery-chip" title={`${c.pinyin} - ${c.meaning}`}>
                          <WritingBadge stats={c.stats} />
                          <span className="chip-char">{c.character}</span>
                          <span className="chip-py">{c.pinyin}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card-internal-divider" />

              <div className="settings-toggle-row">
                <div>
                  <label className="box-section-label" style={{ marginBottom: '2px' }}>Sound</label>
                  <p style={{ fontSize: '12px', color: 'var(--ink-faint)', margin: 0 }}>
                    Pronunciation playback and grading feedback chimes.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  aria-label="Sound"
                  className={`settings-toggle-track ${soundEnabled ? 'active' : ''}`}
                  onClick={toggleSound}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>

              <div className="card-internal-divider" />

              <div className="settings-toggle-row">
                <div>
                  <label className="box-section-label" style={{ marginBottom: '2px' }}>Offline Mode (Local Only)</label>
                  <p style={{ fontSize: '12px', color: 'var(--ink-faint)', margin: 0 }}>
                    Nothing syncs to or from your account while this is on - progress stays on this device only.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={offlineMode}
                  aria-label="Offline Mode (Local Only)"
                  className={`settings-toggle-track ${offlineMode ? 'active' : ''}`}
                  onClick={toggleOfflineMode}
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>

              <div className="card-internal-divider" />

              <button
                type="button"
                className="auth-toggle-link"
                style={{ margin: '4px auto 0' }}
                onClick={() => { setShowSettings(false); setShowAbout(true); }}
              >
                About Learn Hanzi
              </button>

            </div>
          </div>
        )}

        {showAccount && <AccountDrawer onClose={() => setShowAccount(false)} />}

        {showFeedback && <BetaFeedbackDrawer onClose={() => setShowFeedback(false)} />}

        {showAbout && <AboutDrawer onClose={() => setShowAbout(false)} />}

        {showProgress && (
          <ProgressDrawer
            pace={charPace}
            weekly={charProgress.weekly}
            studySummary={studySummary}
            commitment={commitment}
            commitmentStatus={commitmentStatus}
            isSignedIn={!!user}
            onSetCommitment={handleSetCommitment}
            onClearCommitment={handleClearCommitment}
            onClose={() => setShowProgress(false)}
          />
        )}

        {inspectedResult && (
          <CardInspectDrawer result={inspectedResult} onClose={() => setInspectedResult(null)} />
        )}

        {masteredCelebration && (
          <MasteryCelebration
            character={masteredCelebration.character}
            pinyin={masteredCelebration.pinyin}
            label={masteredCelebration.label}
            onDone={dismissMasteryCelebration}
          />
        )}

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
              <h3>{visitGradeCount} cards reviewed</h3>
              <p className="soft-wall-message" style={{ marginTop: '10px' }}>
                Create an account to sync your progress across devices.
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