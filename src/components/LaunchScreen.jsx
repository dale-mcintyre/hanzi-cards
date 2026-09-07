import MarketingLanding from './MarketingLanding';

export default function LaunchScreen({
  showMarketing,
  revisionLevels,
  isLoadingDeck,
  cardCount,
  dueCount,
  seenCardsCount,
  writingEligibleCount,
  launchArcadeSession,
  launchQuizSession,
  launchWritingSession,
  onSignIn,
  renderTierTiles,
}) {
  if (showMarketing) {
    return (
      <MarketingLanding
        revisionLevels={revisionLevels}
        isLoadingDeck={isLoadingDeck}
        cardCount={cardCount}
        onStart={() => launchArcadeSession(20)}
        onSignIn={onSignIn}
      />
    );
  }

  const writingWordCount = Math.min(writingEligibleCount, 6);

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
          <button
            className="primary-launch-btn"
            disabled={isLoadingDeck || seenCardsCount === 0}
            onClick={launchQuizSession}
          >
            {isLoadingDeck ? (
              'Preparing Deck...'
            ) : (
              <>
                Study Session
                {dueCount > 0 && <span className="due-count"> ({dueCount} Due)</span>}
              </>
            )}
          </button>

          {writingEligibleCount > 0 && (
            <button className="secondary-launch-btn" onClick={launchWritingSession}>
              ✍️ Pen &amp; Paper ({writingWordCount} Words)
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-tier-strip">
        <div className="tier-ring-strip-scroll">{renderTierTiles(48)}</div>
      </div>
    </>
  );
}
