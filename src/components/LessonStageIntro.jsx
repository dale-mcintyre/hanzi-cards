import { useEffect, useState } from 'react';

// A short list gets the full 10 reps each; a long one 5, so the step
// doesn't swallow the rest of the session. Either way the learner can
// switch before starting.
const MANY_CARDS_FOR_FULL_REPS = 5;

// The guided lesson's sections, in order - a stage's `section` (see
// lessonQueue.js) is one of these, and several stages can share one.
const SECTIONS = ['Warm up', 'Review', 'Learn new', 'Use it', 'Close the loop'];

/**
 * The beat between two steps of the guided lesson: where the learner is
 * (a five-section stepper), what's next and why, and how many cards it
 * holds - started explicitly with Begin rather than on a timer, so the
 * learner sets the pace between steps the way they would with a tutor.
 *
 * A stage with `repsOptions` (Write Them Out) also offers a choice of how
 * many times to write each card, passed to `onBegin(reps)`.
 */
export default function LessonStageIntro({ stage, cardCount, elapsedMinutes, onBegin, onEnd }) {
  const activeSection = SECTIONS.indexOf(stage.section);
  const repsOptions = stage.repsOptions;
  const [reps, setReps] = useState(() => {
    if (!repsOptions) return null;
    return cardCount <= MANY_CARDS_FOR_FULL_REPS ? Math.max(...repsOptions) : Math.min(...repsOptions);
  });

  useEffect(() => {
    function handleKeydown(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onBegin(reps);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onBegin, reps]);

  return (
    <div className="card lesson-intro-card">
      <ol className="lesson-stepper" aria-label="Lesson progress">
        {SECTIONS.map((section, i) => (
          <li
            key={section}
            className={`lesson-step ${i < activeSection ? 'lesson-step--done' : ''} ${i === activeSection ? 'lesson-step--active' : ''}`}
            aria-current={i === activeSection ? 'step' : undefined}
          >
            <span className="lesson-step-dot" />
            <span className="lesson-step-label">{section}</span>
          </li>
        ))}
      </ol>

      <div className="lesson-intro-body">
        <span className="box-section-label">
          Step {activeSection + 1} of {SECTIONS.length}
          {elapsedMinutes > 0 && ` · ${elapsedMinutes} min in`}
        </span>
        <h2 className="lesson-intro-title">{stage.title}</h2>
        <p className="lesson-intro-text">{stage.intro}</p>
        <p className="lesson-intro-count">
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
          {stage.practiceOnly && ' · practice only, won’t change your schedule'}
        </p>

        {repsOptions && (
          <div className="commitment-pill-row lesson-reps-row" role="group" aria-label="Times to write each one">
            {repsOptions.map((n) => (
              <button
                key={n}
                type="button"
                className={`commitment-pill ${reps === n ? 'active' : ''}`}
                aria-pressed={reps === n}
                onClick={() => setReps(n)}
              >
                {n}× each
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="primary-launch-btn" onClick={() => onBegin(reps)}>
        Begin <span className="writing-key-hint">[Space]</span>
      </button>
      <button type="button" className="auth-toggle-link lesson-end-link" onClick={onEnd}>
        End lesson here
      </button>
    </div>
  );
}
