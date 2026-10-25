// One entry per card, recalled only if every attempt at it was - the
// guided lesson grades a card more than once (e.g. a new character's
// writing recall, its quiz, then Close the Loop), and a card missed once
// along the way belongs in Missed even if it came good later. Other
// session types grade each card once, so this changes nothing for them.
function mergeResultsByCard(sessionResults) {
  const byId = new Map();
  for (const r of sessionResults) {
    const prev = byId.get(r.id);
    byId.set(r.id, prev ? { ...prev, isSuccess: prev.isSuccess && r.isSuccess } : r);
  }
  return [...byId.values()];
}

export default function CompletionScreen({
  visitGradeCount,
  isSoftWallGated,
  sessionResults,
  onInspectCard,
  onSignIn,
  onContinue,
  title = 'Session Recap',
  summaryLine,
}) {
  const cardResults = mergeResultsByCard(sessionResults);
  const nailedResults = cardResults.filter((r) => r.isSuccess);
  const struggledResults = cardResults.filter((r) => !r.isSuccess);

  return (
    <div className="card victory-card">
      <div className="victory-content">
        <h2>{title}</h2>
        {summaryLine && <p className="session-stat-line">{summaryLine}</p>}
        {cardResults.length > 0 && (
          <p className="session-stat-line">
            {nailedResults.length}/{cardResults.length} recalled
          </p>
        )}

        {cardResults.length > 0 && (
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
