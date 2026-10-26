import { useState } from 'react';
import MarketingLanding from './MarketingLanding';

// Each day's 習 stamp lands at a slightly different angle, as a real hand
// stamping a log would - fixed per weekday so it doesn't jitter between
// renders.
const STAMP_TILTS = [-4, 3, -2, 5, -3, 2, -5];

/**
 * The home screen, set like the contents page of a study book: today's
 * lesson as its five numbered steps (一-五) with how many cards each
 * holds, one Begin button, then this week's study log - a row of seven
 * squares, each stamped 習 ("practise") on a day studied - and the known-
 * characters line. The single-purpose modes sit behind "Practice more".
 */
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
  lessonSections,
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
  studyWeek,
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

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="home">
      <p className="home-date">{today}</p>
      <h1 className="home-title">Today’s lesson</h1>
      <p className="home-summary">
        {isLoadingDeck
          ? 'Preparing your deck…'
          : `${lessonReviewCount} to review, ${lessonNewCount} new · about ${lessonEstMinutes} minutes`}
      </p>

      <ol className="home-contents">
        {lessonSections.map((s) => (
          <li key={s.label} className="home-contents-row">
            <span className="home-contents-numeral" aria-hidden="true">{s.numeral}</span>
            <span className="home-contents-label">{s.label}</span>
            <span className="home-contents-count">{s.count ?? '—'}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="primary-launch-btn home-begin"
        disabled={isLoadingDeck || !hasLessonContent}
        onClick={onLaunchLesson}
      >
        {isLoadingDeck ? 'Preparing…' : 'Begin lesson'}
      </button>

      <div className="home-week">
        <div className="home-week-header">
          <span className="home-caption">this week</span>
          <span className="home-week-count">{daysThisWeek} of 7 days</span>
        </div>
        <ol className="home-week-days">
          {studyWeek.map((d, i) => (
            <li key={d.day} className="home-week-day">
              <span className={`home-week-square ${d.isToday ? 'home-week-square--today' : ''}`}>
                {d.studied && (
                  <img
                    src="/seals/seal-xi.png"
                    alt="Studied"
                    className="home-week-stamp"
                    style={{ transform: `rotate(${STAMP_TILTS[i]}deg)` }}
                  />
                )}
              </span>
              <span className={`home-week-label ${d.isToday ? 'home-week-label--today' : ''}`}>{d.label}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="home-known">
        <span className="home-known-number">{knownCount}</span> characters known
        {knownThisWeek > 0 && <> · <span className="home-known-gain">+{knownThisWeek}</span> this week</>}
      </p>

      <button
        type="button"
        className="auth-toggle-link practice-more-toggle"
        aria-expanded={showPracticeModes}
        onClick={() => setShowPracticeModes((v) => !v)}
      >
        {showPracticeModes ? 'Hide practice modes' : 'Practice more'}
      </button>

      {showPracticeModes && (
        <div className="home-practice">
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
              buildSuperchargeQueue). */}
          {superchargeTotal > 0 && (
            <button className="secondary-launch-btn launch-btn--stacked" onClick={onLaunchSupercharge}>
              <span className="launch-btn-title">Supercharge</span>
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
        </div>
      )}
    </div>
  );
}
