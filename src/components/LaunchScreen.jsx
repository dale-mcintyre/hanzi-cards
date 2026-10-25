import { useState } from 'react';
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
  superchargeNewCount,
  superchargeReviewCount,
  superchargeTotal,
  superchargeEstMinutes,
  lessonReviewCount,
  lessonNewCount,
  lessonEstMinutes,
  hasLessonContent,
  onLaunchLesson,
  onLaunchSelfStudy,
  onLaunchPenAndPaper,
  onLaunchSupercharge,
  onLaunchWarmup,
  onSignIn,
  knownCount,
  knownThisWeek,
  daysThisWeek,
}) {
  // The single-purpose modes are still here, just one tap further away -
  // the guided lesson is the default way to study now.
  const [showPracticeModes, setShowPracticeModes] = useState(false);

  if (showMarketing) {
    return (
      <MarketingLanding
        revisionLevels={revisionLevels}
        isLoadingDeck={isLoadingDeck}
        cardCount={cardCount}
        // The guided lesson works with zero history - a brand new visitor
        // has nothing to review, so it's just Learn New, its quiz, and
        // Close the Loop (see buildLessonPlan).
        onStart={onLaunchLesson}
        onSignIn={onSignIn}
      />
    );
  }

  const selfStudySubLabel = dueCount > 0
    ? `${dueCount} Due · ~${selfStudyEstMinutes} min`
    : 'Nothing due right now';

  const lessonSubLabel = `${lessonReviewCount} review, ${lessonNewCount} new · ~${lessonEstMinutes} min`;

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
          <p className="launch-subtitle">Warm up, review, learn new, use it, close the loop</p>
        </div>

        <div className="launch-card-actions">
          <button
            className="primary-launch-btn launch-btn--stacked"
            disabled={isLoadingDeck || !hasLessonContent}
            onClick={onLaunchLesson}
          >
            <span className="launch-btn-title">{isLoadingDeck ? 'Preparing Deck...' : "Start today's lesson"}</span>
            {!isLoadingDeck && <span className="launch-btn-sub">{lessonSubLabel}</span>}
          </button>

          {/* The one progress line the home screen keeps - the full picture
              (HSK rings, pace, goal) lives in Settings. */}
          {!isLoadingDeck && (
            <p className="launch-progress-line">
              <strong>{knownCount}</strong> known
              {knownThisWeek > 0 && <> · <strong>+{knownThisWeek}</strong> this week</>}
              {' '}· <strong>{daysThisWeek}</strong> of 7 days
            </p>
          )}

          <button
            type="button"
            className="auth-toggle-link practice-more-toggle"
            aria-expanded={showPracticeModes}
            onClick={() => setShowPracticeModes((v) => !v)}
          >
            {showPracticeModes ? 'Hide practice modes' : 'Practice more'}
          </button>

          {showPracticeModes && (
            <>
              <button
                className="secondary-launch-btn launch-btn--stacked"
                disabled={isLoadingDeck || cardCount === 0}
                onClick={() => onLaunchSelfStudy()}
              >
                <span className="launch-btn-title">Free Self-Study</span>
                <span className="launch-btn-sub">{selfStudySubLabel}</span>
              </button>

              {penAndPaperTotal > 0 && (
                <button className="secondary-launch-btn launch-btn--stacked" onClick={onLaunchPenAndPaper}>
                  <span className="launch-btn-title">Pen &amp; Paper</span>
                  <span className="launch-btn-sub">
                    {penAndPaperNewCount} new, {penAndPaperReviewCount} review · ~{penAndPaperEstMinutes} min
                  </span>
                </button>
              )}

              {/* Same Priming -> Recall -> Sentence format as Pen & Paper above,
                  just double the batch (see writingQueue.js's
                  buildSuperchargeQueue) - its own bold identity so it reads as
                  "the bigger version of that", not a fourth unrelated mode. */}
              {superchargeTotal > 0 && (
                <button className="supercharge-launch-btn launch-btn--stacked" onClick={onLaunchSupercharge}>
                  <span className="launch-btn-title">⚡ Supercharge</span>
                  <span className="launch-btn-sub">
                    {superchargeNewCount} new, {superchargeReviewCount} review · ~{superchargeEstMinutes} min
                  </span>
                </button>
              )}

              {cardCount > 0 && (
                <button className="tertiary-launch-btn launch-btn--stacked" onClick={() => onLaunchWarmup()}>
                  <span className="launch-btn-title">Warmup</span>
                  <span className="launch-btn-sub">Rapid recognition · 4-choice drill</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </>
  );
}
