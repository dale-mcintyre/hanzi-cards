export default function CompletionScreen({
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
        <h2>Session Recap</h2>
        {sessionResults.length > 0 && (
          <p className="session-stat-line">
            {nailedResults.length}/{sessionResults.length} recalled
          </p>
        )}

        {sessionResults.length > 0 && (
          <div className="session-recap">
            {nailedResults.length > 0 && (
              <div className="session-recap-group">
                <span className="box-section-label">Recalled · {nailedResults.length}</span>
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
                <span className="box-section-label">Missed · {struggledResults.length}</span>
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
              {visitGradeCount} cards reviewed this visit. Create an account
              to sync your progress across devices.
            </p>
            <button className="primary-launch-btn" onClick={onSignIn}>
              Sign In / Create Account
            </button>
          </div>
        ) : (
          <button className="primary-launch-btn" onClick={onContinue}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
