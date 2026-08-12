export default function MarketingLanding({ revisionLevels, isLoadingDeck, cardCount, onStart, onSignIn }) {
  return (
    <div className="card launch-card marketing-card">
      <div className="launch-card-header">
        <span className="deck-level-pill">
          {revisionLevels.length > 0 ? `Revising HSK ${revisionLevels.join(', ')}` : 'All Levels'}
        </span>
        <span className="deck-ready-tag">
          {isLoadingDeck ? 'Loading database...' : `${cardCount} Cards Loaded`}
        </span>
      </div>

      <div className="marketing-card-body">
        <h1 className="launch-title">Learn Hanzi</h1>
        <p className="marketing-subtitle">
          Real-world frequency data meets structured HSK milestones, so every card you study actually counts.
        </p>
        <ul className="marketing-feature-list">
          <li className="marketing-feature-item">📊 Frequency-first: learn the characters people actually use, not textbook order.</li>
          <li className="marketing-feature-item">🎯 HSK milestones: track real progress from HSK 1 through 6.</li>
          <li className="marketing-feature-item">🧠 Smart spaced repetition: an SM-2 algorithm resurfaces cards right before you'd forget them.</li>
        </ul>
      </div>

      <div className="marketing-card-actions">
        <button className="primary-launch-btn" disabled={isLoadingDeck || cardCount === 0} onClick={onStart}>
          {isLoadingDeck ? 'Preparing Deck...' : 'Start Learning ⚡'}
        </button>
        <p className="marketing-trial-note">
          Try it now, no account needed. You'll be asked to sign in after your first session.
        </p>
        <button className="marketing-signin-link" onClick={onSignIn}>
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
