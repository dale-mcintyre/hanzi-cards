import MarketingLanding from './MarketingLanding';

export default function LaunchScreen({
  showMarketing,
  revisionLevels,
  isLoadingDeck,
  cardCount,
  dueCount,
  weakCardsCount,
  seenCardsCount,
  writingDueCount,
  includeWriting,
  onToggleIncludeWriting,
  launchArcadeSession,
  launchUnifiedSession,
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

  const primaryLabel = isLoadingDeck
    ? 'Preparing Deck...'
    : dueCount > 0
      ? `Start Session (${dueCount} Due)`
      : 'Start Session';

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
            onClick={launchUnifiedSession}
          >
            {primaryLabel}
          </button>

          <div className="writing-toggle-row">
            <span className="writing-toggle-label">
              Include Paper Writing
              {writingDueCount > 0 && <span className="writing-toggle-count"> ({writingDueCount} due)</span>}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={includeWriting}
              aria-label="Include Paper Writing"
              className={`settings-toggle-track ${includeWriting ? 'active' : ''}`}
              onClick={onToggleIncludeWriting}
            >
              <span className="settings-toggle-thumb" />
            </button>
          </div>

          {(weakCardsCount > 0 || seenCardsCount > 0) && (
            <div className="secondary-chip-row">
              {weakCardsCount > 0 && (
                <button className="secondary-chip" onClick={() => launchArcadeSession(20, 'weak')}>
                  🎯 {weakCardsCount} Weak Cards
                </button>
              )}
              {seenCardsCount > 0 && (
                <button className="secondary-chip" onClick={() => launchArcadeSession(seenCardsCount, 'seen')}>
                  📖 {seenCardsCount} Seen Cards
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
