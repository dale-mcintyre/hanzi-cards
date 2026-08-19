export default function CompletionScreen({
  score,
  maxCombo,
  visitGradeCount,
  isSoftWallGated,
  sessionResults,
  onInspectCard,
  onSignIn,
  onContinue,
}) {
  const nailedResults = sessionResults.filter((r) => r.isSuccess);
  const struggledResults = sessionResults.filter((r) => !r.isSuccess);

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

        {sessionResults.length > 0 && (
          <div className="session-recap">
            {nailedResults.length > 0 && (
              <div className="session-recap-group">
                <span className="box-section-label">Nailed it · {nailedResults.length}</span>
                <div className="mastery-grid-chips">
                  {nailedResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="mastery-chip mastery-chip--know"
                      onClick={() => onInspectCard(r)}
                    >
                      <span className="chip-char">{r.character}</span>
                      <span className="chip-py">{r.pinyin}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {struggledResults.length > 0 && (
              <div className="session-recap-group">
                <span className="box-section-label">Needs practice · {struggledResults.length}</span>
                <div className="mastery-grid-chips">
                  {struggledResults.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="mastery-chip mastery-chip--again"
                      onClick={() => onInspectCard(r)}
                    >
                      <span className="chip-char">{r.character}</span>
                      <span className="chip-py">{r.pinyin}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
