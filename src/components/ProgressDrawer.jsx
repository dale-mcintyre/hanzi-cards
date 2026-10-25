import { useState } from 'react';
import { CHART_WEEKS } from '../utils/charProgress';

const TIER_ROWS = [
  { key: '1', label: 'HSK 1' },
  { key: '2', label: 'HSK 2' },
  { key: '3', label: 'HSK 3' },
  { key: '4', label: 'HSK 4' },
  { key: '5', label: 'HSK 5' },
  { key: '6', label: 'HSK 6' },
  { key: 'non-hsk', label: 'Non-HSK' },
];

// Only real HSK levels are offered as commitment targets - "finish
// Non-HSK in 3 weeks" doesn't mean much against an open-ended frequency
// tail the way "finish HSK 2" means a fixed, known word list.
const GOAL_TIER_OPTIONS = ['1', '2', '3', '4', '5', '6'];
const GOAL_WEEK_OPTIONS = [1, 2, 3, 4, 6, 8, 12];

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// Mirrors charProgress.js's getCharacterPace formula, applied to a summed-up
// tier so the drawer can show one combined "all of HSK" countdown above
// the per-level breakdown, without storage.js needing to know this
// specific aggregate exists.
function sumTiers(tiers, keys) {
  const sum = { total: 0, mastered: 0, remaining: 0, perWeek: 0 };

  keys.forEach((key) => {
    const t = tiers[key];
    if (!t) return;
    sum.total += t.total;
    sum.mastered += t.mastered;
    sum.remaining += t.remaining;
    sum.perWeek += t.perWeek;
  });

  // Recombine from the summed rate rather than averaging each tier's own
  // etaDays - a level that's already complete (0 remaining, perWeek 0)
  // would otherwise drag a naive average down/up for no real reason.
  const perDay = sum.perWeek / 7;
  sum.etaDays = perDay > 0 ? sum.remaining / perDay : null;
  return sum;
}

// Turns a day count into the coarsest unit that still reads as "roughly
// right" - nobody needs "127 days" precision for an estimate this fuzzy
// to begin with.
function formatEta(days) {
  if (days == null || days <= 0) return null;
  if (days < 1) return 'less than a day';
  const roundedDays = Math.ceil(days);
  if (roundedDays < 14) return `${roundedDays} day${roundedDays === 1 ? '' : 's'}`;
  const weeks = Math.ceil(days / 7);
  if (weeks < 9) return `${weeks} weeks`;
  const months = Math.ceil(days / 30.4);
  return `${months} month${months === 1 ? '' : 's'}`;
}

function formatPace(perWeek) {
  if (perWeek <= 0) return null;
  const rounded = perWeek >= 10 ? Math.round(perWeek) : Math.round(perWeek * 10) / 10;
  return `~${rounded} character${rounded === 1 ? '' : 's'}/week`;
}

// Same rounding as formatPace, but never bails out to null - used inside
// commitment status sentences where "0 characters/week" is itself the
// meaningful (if discouraging) answer, not a "can't estimate" case.
function paceLabel(perWeek) {
  return formatPace(perWeek) || '0 characters/week';
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Past this, a projected date is more noise than information - "over 3
// years" says the same thing without a falsely precise day.
const MAX_ETA_DAYS = 3 * 365;

// A projected finish date - month and year, since a day-level date for an
// estimate this rough would overstate it.
function formatEtaDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function TierProgressRow({ label, stats }) {
  const { total, mastered, remaining } = stats;
  const masteredPct = pct(mastered, total);
  const isComplete = total > 0 && remaining <= 0;
  const eta = formatEta(stats.etaDays);
  const pace = formatPace(stats.perWeek);

  return (
    <div className="progress-tier-row">
      <div className="progress-tier-row-top">
        <span className="progress-tier-label">{label}</span>
        <span className="progress-tier-count">{mastered}/{total} known</span>
      </div>
      <div className="progress-tier-bar-track">
        <div className="progress-tier-bar-fill" style={{ width: `${masteredPct}%` }} />
      </div>
      <p className={`progress-tier-eta ${isComplete ? 'progress-tier-eta--complete' : ''}`}>
        {isComplete
          ? `Complete - all ${total} characters known`
          : eta
            ? stats.etaDays > MAX_ETA_DAYS
              ? `Over 3 years away at ${pace}`
              : `On course for ${formatEtaDate(Date.now() + stats.etaDays * 86400000)} at ${pace}`
            : 'Needs two weeks of study history to estimate.'}
      </p>
    </div>
  );
}

/** The goal-setting form - both the initial "make a commitment" prompt
 * (no `onCancel`, nothing to go back to) and the "change goal" flow
 * (pre-filled from the existing commitment, `onCancel` returns to the
 * status card without saving). Pure pill pickers, no free-typed number -
 * this is a rough weekly-granularity estimate either way (see
 * getCharacterPace's own caveats), so there's nothing a exact day count
 * would buy the user that 1/2/3/4/6/8/12-week presets don't already cover. */
function CommitmentForm({ pace, defaultTier, defaultWeeks, onSet, onCancel }) {
  const [tier, setTier] = useState(defaultTier || '1');
  const [weeks, setWeeks] = useState(defaultWeeks || 3);
  const tierStats = pace[tier];

  return (
    <div className="commitment-form">
      <label className="box-section-label">Which level?</label>
      <div className="commitment-pill-row">
        {GOAL_TIER_OPTIONS.map((key) => (
          <button
            key={key}
            type="button"
            className={`commitment-pill ${tier === key ? 'active' : ''}`}
            onClick={() => setTier(key)}
          >
            HSK {key}
          </button>
        ))}
      </div>

      <label className="box-section-label" style={{ marginTop: '12px' }}>In how many weeks?</label>
      <div className="commitment-pill-row">
        {GOAL_WEEK_OPTIONS.map((w) => (
          <button
            key={w}
            type="button"
            className={`commitment-pill ${weeks === w ? 'active' : ''}`}
            onClick={() => setWeeks(w)}
          >
            {w}w
          </button>
        ))}
      </div>

      {tierStats && (
        <p className="commitment-form-hint">
          {tierStats.remaining > 0
            ? `${tierStats.remaining} of ${tierStats.total} HSK ${tier} characters still to learn.`
            : `All ${tierStats.total} HSK ${tier} characters are already known!`}
        </p>
      )}

      <div className="commitment-form-actions">
        <button type="button" className="auth-submit-btn" onClick={() => onSet(tier, weeks)}>
          Set Goal
        </button>
        {onCancel && (
          <button type="button" className="auth-toggle-link" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/** The active-goal status card: progress bar toward that specific tier,
 * plus a plain-language verdict comparing the required pace (recomputed
 * live off the current remaining count - see getCommitmentStatus) against
 * the same last-14-day actual pace the plain per-tier rows already show. */
function CommitmentStatusCard({ status, onEdit, onClear }) {
  const { tier, weeks, daysRemaining, deadlineAt, total, mastered, requiredPerWeek, actualPerWeek, isComplete, isExpired, onTrack } = status;
  const masteredPct = pct(mastered, total);

  let statusLine;
  let statusClass;
  if (isComplete) {
    statusLine = `Goal complete - all ${total} HSK ${tier} characters known!`;
    statusClass = 'commitment-status--complete';
  } else if (isExpired) {
    statusLine = `Deadline passed with ${status.wordsRemaining} character${status.wordsRemaining === 1 ? '' : 's'} still to go.`;
    statusClass = 'commitment-status--behind';
  } else if (onTrack === null) {
    statusLine = "Just getting started - keep studying to see if you're on track.";
    statusClass = '';
  } else if (onTrack) {
    statusLine = `On track - averaging ${paceLabel(actualPerWeek)}, ${paceLabel(requiredPerWeek)} needed.`;
    statusClass = 'commitment-status--ontrack';
  } else {
    statusLine = `Behind pace - averaging ${paceLabel(actualPerWeek)}, but ${paceLabel(requiredPerWeek)} is needed to make it.`;
    statusClass = 'commitment-status--behind';
  }

  return (
    <div className="progress-tier-row">
      <div className="progress-tier-row-top">
        <span className="progress-tier-label">HSK {tier} in {weeks} week{weeks === 1 ? '' : 's'}</span>
        <span className="progress-tier-count">{mastered}/{total} known</span>
      </div>
      <div className="progress-tier-bar-track">
        <div className="progress-tier-bar-fill" style={{ width: `${masteredPct}%` }} />
      </div>
      <p className={`commitment-status-line ${statusClass}`}>{statusLine}</p>
      {!isComplete && (
        <p className="commitment-deadline-line">
          {isExpired
            ? `Deadline was ${formatDate(deadlineAt)}`
            : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left · deadline ${formatDate(deadlineAt)}`}
        </p>
      )}
      <div className="commitment-form-actions">
        <button type="button" className="auth-toggle-link" onClick={onEdit}>Change goal</button>
        <button type="button" className="auth-toggle-link" onClick={onClear}>Clear goal</button>
      </div>
    </div>
  );
}

// Characters that became Known each week, last CHART_WEEKS weeks - a
// picture of steady effort rather than one big remaining number.
function WeeklyChart({ weekly }) {
  const max = Math.max(1, ...weekly);
  return (
    <>
      <div className="weekly-chart" role="img" aria-label={`Characters newly known per week, oldest first: ${weekly.join(', ')}`}>
        {weekly.map((count, i) => (
          <div key={i} className={`weekly-chart-col ${i === CHART_WEEKS - 1 ? 'weekly-chart-col--current' : ''}`}>
            <span className="weekly-chart-value">{count > 0 ? count : ''}</span>
            <div className="weekly-chart-bar" style={{ height: `${(count / max) * 72}px` }} />
          </div>
        ))}
      </div>
      <div className="weekly-chart-axis" aria-hidden="true">
        {weekly.map((_, i) => (
          <span key={i}>{i === CHART_WEEKS - 1 ? 'Now' : `${CHART_WEEKS - 1 - i}w`}</span>
        ))}
      </div>
    </>
  );
}

/**
 * Settings' detailed progress screen: characters newly Known per week,
 * study consistency and review accuracy (from utils/studyDays.js), a
 * personal commitment (e.g. "HSK 2 in 3 weeks") with a live on-track/
 * behind verdict, then per-level rows. Counted in Known characters - see
 * utils/charProgress.js's getCharacterPace for the pace and why it waits
 * for two weeks of history. Pure presentation: App.jsx computes
 * everything and passes it down.
 */
export default function ProgressDrawer({ pace, weekly, studySummary, commitment, commitmentStatus, isSignedIn, onSetCommitment, onClearCommitment, onClose }) {
  const allHsk = sumTiers(pace, ['1', '2', '3', '4', '5', '6']);
  // Only relevant once a commitment already exists - toggles the status
  // card back to the editable form without discarding the saved goal
  // until "Set Goal" is actually pressed again.
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const handleSet = (tier, weeks) => {
    onSetCommitment(tier, weeks);
    setIsEditingGoal(false);
  };

  const showForm = !commitmentStatus || isEditingGoal;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet about-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="about-drawer-header">
          <h3>Progress &amp; Pace</h3>
          <button className="about-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="progress-drawer-intro">
          A character counts as known once you've recognized it again after a gap
          of about a week - and stops counting if you later forget it. Pace and
          dates are estimates from your last two weeks, not promises.
        </p>

        <div className="about-section">
          <h4>Newly known, by week</h4>
          <WeeklyChart weekly={weekly} />
        </div>

        <div className="about-section">
          <h4>Habit</h4>
          <div className="progress-stat-row">
            <div className="progress-stat">
              <div className="progress-stat-value">{studySummary.daysThisWeek} of 7</div>
              <div className="progress-stat-label">days studied this week · {studySummary.daysLast30} of the last 30</div>
            </div>
            <div className="progress-stat">
              <div className="progress-stat-value">
                {studySummary.retention === null ? '–' : `${Math.round(studySummary.retention * 100)}%`}
              </div>
              <div className="progress-stat-label">
                {studySummary.retention === null
                  ? 'of reviews remembered - shows after 20 reviews'
                  : `of ${studySummary.reviewsLast30} reviews remembered, last 30 days`}
              </div>
            </div>
          </div>
          {studySummary.retention !== null && studySummary.retention < 0.8 && (
            <p className="progress-subline">
              Below 80% usually means new characters are coming in faster than reviews can keep up - lessons add fewer automatically.
            </p>
          )}
        </div>

        <div className="about-section">
          <h4>Your Commitment</h4>
          {showForm ? (
            <CommitmentForm
              pace={pace}
              defaultTier={commitment?.tier}
              defaultWeeks={commitment?.weeks}
              onSet={handleSet}
              onCancel={commitmentStatus ? () => setIsEditingGoal(false) : null}
            />
          ) : (
            <CommitmentStatusCard
              status={commitmentStatus}
              onEdit={() => setIsEditingGoal(true)}
              onClear={onClearCommitment}
            />
          )}
          <p className="commitment-device-note">
            {isSignedIn
              ? 'Synced to your account - this goal will follow you to your other signed-in devices.'
              : 'Saved on this device only - sign in to have it follow you to another browser or phone.'}
          </p>
        </div>

        <div className="about-section">
          <h4>All of HSK</h4>
          <TierProgressRow label="HSK 1-6 combined" stats={allHsk} />
        </div>

        <div className="about-section">
          <h4>By Level</h4>
          <div className="progress-tier-list">
            {TIER_ROWS.map(({ key, label }) => (
              <TierProgressRow key={key} label={label} stats={pace[key]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
