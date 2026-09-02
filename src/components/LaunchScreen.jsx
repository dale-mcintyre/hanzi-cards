import { useEffect, useState } from 'react';
import MarketingLanding from './MarketingLanding';

const MODES = [
  { key: 'learn', label: 'Learn' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'writing', label: 'Write' },
];

export default function LaunchScreen({
  showMarketing,
  revisionLevels,
  isLoadingDeck,
  cardCount,
  dueCount,
  weakCardsCount,
  seenCardsCount,
  writingEligibleCount,
  launchArcadeSession,
  launchHardModeSession,
  launchQuizSession,
  launchWritingSession,
  onSignIn,
  renderTierTiles,
}) {
  const [selectedMode, setSelectedMode] = useState('learn');

  const quizAvailable = seenCardsCount > 0;
  const writingAvailable = writingEligibleCount > 0;

  // If the currently-selected mode's prerequisite cards disappear (e.g.
  // right after a session that was the only source of quiz-eligible or
  // writing-eligible cards), fall back to Learn rather than leaving the
  // switch pointed at a segment that's now disabled.
  useEffect(() => {
    if (selectedMode === 'quiz' && !quizAvailable) setSelectedMode('learn');
    if (selectedMode === 'writing' && !writingAvailable) setSelectedMode('learn');
  }, [selectedMode, quizAvailable, writingAvailable]);

  if (showMarketing) {
    return (
      <MarketingLanding
        revisionLevels={revisionLevels}
        isLoadingDeck={isLoadingDeck}
        cardCount={cardCount}
        onStart={() => launchArcadeSession(20, 'all')}
        onSignIn={onSignIn}
      />
    );
  }

  const writingWordCount = Math.min(writingEligibleCount, 6);

  let primaryLabel = 'Start Study';
  let primaryDisabled = cardCount === 0;
  let onPrimaryClick = () => launchArcadeSession(20, 'all');

  if (selectedMode === 'quiz') {
    primaryLabel = 'Start Quiz';
    onPrimaryClick = launchQuizSession;
    primaryDisabled = !quizAvailable;
  } else if (selectedMode === 'writing') {
    primaryLabel = `Start Writing Drill (${writingWordCount} Words)`;
    onPrimaryClick = launchWritingSession;
    primaryDisabled = !writingAvailable;
  } else if (dueCount > 0) {
    primaryLabel = `Review Due (${dueCount})`;
  }

  if (isLoadingDeck) primaryLabel = 'Preparing Deck...';

  return (
    <>
      <div className="card launch-card">
        <div className="launch-card-header">
          <span className="deck-level-pill">
            {revisionLevels.length > 0 ? `Revising HSK ${revisionLevels.join(', ')}` : 'All Levels'}
          </span>
          <span className="deck-ready-tag">
            {isLoadingDeck ? 'Loading database...' : `${cardCount} Cards Loaded`}
          </span>
        </div>

        <div className="launch-card-body">
          <h1 className="launch-title">Learn Hanzi</h1>
          <p className="launch-subtitle">Unified frequency & HSK dataset</p>
        </div>

        <div className="launch-card-actions">
          <div className="mode-switch" role="tablist" aria-label="Study mode">
            {MODES.map(({ key, label }) => {
              const disabled = key === 'quiz' ? !quizAvailable : key === 'writing' ? !writingAvailable : false;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selectedMode === key}
                  className={`mode-switch-btn ${selectedMode === key ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => setSelectedMode(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            className="primary-launch-btn"
            disabled={isLoadingDeck || primaryDisabled}
            onClick={onPrimaryClick}
          >
            {primaryLabel}
          </button>

          {(weakCardsCount > 0 || seenCardsCount > 0) && (
            <div className="secondary-chip-row">
              {weakCardsCount > 0 && (
                <button className="secondary-chip" onClick={() => launchArcadeSession(20, 'weak')}>
                  {weakCardsCount} Weak Cards
                </button>
              )}
              {seenCardsCount > 0 && (
                <button className="secondary-chip" onClick={() => launchArcadeSession(seenCardsCount, 'seen')}>
                  {seenCardsCount} Seen Cards
                </button>
              )}
              {weakCardsCount > 0 && (
                <button className="secondary-chip" onClick={launchHardModeSession}>
                  Mistake Blitz
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-tier-strip">
        <div className="tier-ring-strip-scroll">{renderTierTiles(48)}</div>
      </div>
    </>
  );
}
