import MarketingLanding from './MarketingLanding';

export default function LaunchScreen({
  showMarketing,
  revisionLevels,
  isLoadingDeck,
  cardCount,
  weakCardsCount,
  seenCardsCount,
  launchArcadeSession,
  launchHardModeSession,
  launchQuizSession,
  onSignIn,
  renderTierTiles,
}) {
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
            disabled={isLoadingDeck || cardCount === 0}
            onClick={() => launchArcadeSession(20, 'all')}
          >
            {isLoadingDeck ? 'Preparing Deck...' : 'Learn ⚡'}
          </button>

          <button className="hard-mode-btn" onClick={launchHardModeSession}>
            🔥 Hard Mode (Targeted Mistake Blitz)
          </button>

          {weakCardsCount > 0 && (
            <button className="secondary-launch-btn" onClick={() => launchArcadeSession(20, 'weak')}>
              🎯 Review {weakCardsCount} Weak Cards
            </button>
          )}

          {seenCardsCount > 0 && (
            <button className="secondary-launch-btn" onClick={() => launchArcadeSession(seenCardsCount, 'seen')}>
              📖 Review All {seenCardsCount} Seen Cards
            </button>
          )}

          {seenCardsCount > 0 && (
            <button className="secondary-launch-btn" onClick={launchQuizSession}>
              🧠 Quiz Mode (Multiple Choice)
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
