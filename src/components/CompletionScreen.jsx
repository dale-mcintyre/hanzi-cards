import { MILESTONES } from '../utils/charProgress';
import LongPressHanzi from './LongPressHanzi';

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

// What this session actually moved, in characters (see
// utils/charProgress.js's diffCharacterProgress) - "slipped back" is shown
// too, since a recap that only ever counts up isn't one to trust. Crossing
// a milestone gets its own line.
function ProgressChangeLine({ change, knownCount }) {
  if (!change) return null;
  const parts = [];
  if (change.introduced > 0) parts.push(`+${change.introduced} introduced`);
  if (change.becameKnown > 0) parts.push(`${change.becameKnown} became known`);
  if (change.canNowWrite > 0) parts.push(`${change.canNowWrite} can now write`);
  if (change.slippedBack > 0) parts.push(`${change.slippedBack} slipped back`);
  if (parts.length === 0) return null;

  const before = knownCount - change.becameKnown + change.slippedBack;
  const milestone = MILESTONES.find((m) => before < m && knownCount >= m);

  return (
    <>
      <p className="session-stat-line">{parts.join(' · ')}</p>
      {milestone && (
        <p className="session-milestone-line">
          <img src="/seals/seal-xue.png" alt="" className="session-milestone-seal" />
          {milestone} characters known
        </p>
      )}
    </>
  );
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
  // A finished lesson gets the 好 ("well done") seal pressed above its
  // title - a teacher's mark, kept for the lesson, not every session.
  showSeal = false,
  progressChange,
  knownCount,
}) {
  const cardResults = mergeResultsByCard(sessionResults);
  const nailedResults = cardResults.filter((r) => r.isSuccess);
  const struggledResults = cardResults.filter((r) => !r.isSuccess);

  return (
    <div className="card victory-card">
      <div className="victory-content">
        {showSeal && <img src="/seals/seal-hao.png" alt="好 - well done" className="completion-seal" />}
        <h2>{title}</h2>
        {summaryLine && <p className="session-stat-line">{summaryLine}</p>}
        <ProgressChangeLine change={progressChange} knownCount={knownCount} />
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
                    <LongPressHanzi
                      as="button"
                      key={r.id}
                      type="button"
                      className="mastery-chip mastery-chip--know"
                      entry={r}
                      onClick={() => onInspectCard(r)}
                    >
                      <span className="chip-char">{r.character}</span>
                      <span className="chip-py">{r.pinyin}</span>
                    </LongPressHanzi>
                  ))}
                </div>
              </div>
            )}

            {struggledResults.length > 0 && (
              <div className="session-recap-group">
                <span className="box-section-label">Missed · {struggledResults.length}</span>
                <div className="mastery-grid-chips">
                  {struggledResults.map((r) => (
                    <LongPressHanzi
                      as="button"
                      key={r.id}
                      type="button"
                      className="mastery-chip mastery-chip--again"
                      entry={r}
                      onClick={() => onInspectCard(r)}
                    >
                      <span className="chip-char">{r.character}</span>
                      <span className="chip-py">{r.pinyin}</span>
                    </LongPressHanzi>
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
