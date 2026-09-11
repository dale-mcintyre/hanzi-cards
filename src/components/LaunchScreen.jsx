import MarketingLanding from './MarketingLanding';

export default function LaunchScreen({
  showMarketing,
  revisionLevels,
  isLoadingDeck,
  cardCount,
  dueCount,
  selfStudyEstMinutes,
  penAndPaperNewCount,
  penAndPaperReviewCount,
  penAndPaperTotal,
  penAndPaperEstMinutes,
  onLaunchSelfStudy,
  onLaunchPenAndPaper,
  onLaunchWarmup,
  onSignIn,
  renderTierTiles,
}) {
  if (showMarketing) {
    return (
      <MarketingLanding
        revisionLevels={revisionLevels}
        isLoadingDeck={isLoadingDeck}
        cardCount={cardCount}
        // Free Self-Study is pure review now (see sessionQueue.js) - a
        // brand new anonymous visitor has nothing due yet, so the trial
        // launches Warmup instead, which always has new characters to
        // introduce regardless of history.
        onStart={() => onLaunchWarmup(20)}
        onSignIn={onSignIn}
      />
    );
  }

  const selfStudySubLabel = dueCount > 0
    ? `${dueCount} Due · ~${selfStudyEstMinutes} min`
    : 'Nothing due right now';

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
            className="primary-launch-btn launch-btn--stacked"
            disabled={isLoadingDeck || cardCount === 0}
            onClick={() => onLaunchSelfStudy()}
          >
            <span className="launch-btn-title">{isLoadingDeck ? 'Preparing Deck...' : 'Free Self-Study'}</span>
            {!isLoadingDeck && <span className="launch-btn-sub">{selfStudySubLabel}</span>}
          </button>

          {penAndPaperTotal > 0 && (
            <button className="secondary-launch-btn launch-btn--stacked" onClick={onLaunchPenAndPaper}>
              <span className="launch-btn-title">Pen &amp; Paper</span>
              <span className="launch-btn-sub">
                {penAndPaperNewCount} new, {penAndPaperReviewCount} review · ~{penAndPaperEstMinutes} min
              </span>
            </button>
          )}

          {cardCount > 0 && (
            <button className="tertiary-launch-btn launch-btn--stacked" onClick={() => onLaunchWarmup()}>
              <span className="launch-btn-title">Warmup</span>
              <span className="launch-btn-sub">Rapid recognition · 4-choice drill</span>
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
