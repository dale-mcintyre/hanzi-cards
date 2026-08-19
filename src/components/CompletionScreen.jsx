export default function CompletionScreen({
  score,
  maxCombo,
  visitGradeCount,
  isSoftWallGated,
  onSignIn,
  onContinue,
}) {
  return (
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

        {isSoftWallGated ? (
          <div className="soft-wall-gate">
            <p className="soft-wall-message">
              Great work! You've reviewed {visitGradeCount} cards this visit. Create a
              free account to save your results and keep your streak going.
            </p>
            <button className="primary-launch-btn" onClick={onSignIn}>
              Sign In / Create Account
            </button>
          </div>
        ) : (
          <button className="primary-launch-btn" onClick={onContinue}>
            Continue ⚡
          </button>
        )}
      </div>
    </div>
  );
}
