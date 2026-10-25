import { nextMilestone, MILESTONES } from '../utils/charProgress';

function percent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * The top of Settings: how many characters are actually Known (see
 * utils/charProgress.js for what counts), how close the next milestone
 * is, how much everyday text that covers, and the HSK rings - which are
 * also still the study-tier filter, so the filter hint lives here too.
 */
export default function ProgressSummary({ charProgress, coverage, filterHint, renderTierTiles, onOpenDetails }) {
  const { totals, knownThisWeek, canWriteThisWeek } = charProgress;
  const next = nextMilestone(totals.known);
  const previous = [...MILESTONES].reverse().find((m) => m <= totals.known) || 0;
  const milestoneFill = next ? (totals.known - previous) / (next - previous) : 1;

  return (
    <div>
      <label className="box-section-label">Your progress</label>

      <div className="progress-headline">
        <span className="progress-headline-number">{totals.known}</span>
        <span className="progress-headline-label">characters known</span>
      </div>

      <p className="progress-subline">
        Can write <strong>{totals.canWrite}</strong>
        {(knownThisWeek > 0 || canWriteThisWeek > 0) && (
          <span className="progress-gain">
            {' '}· this week +{knownThisWeek} known{canWriteThisWeek > 0 && `, +${canWriteThisWeek} can write`}
          </span>
        )}
      </p>

      {next && (
        <>
          <div className="milestone-track" aria-hidden="true">
            <div className="milestone-fill" style={{ width: `${Math.round(milestoneFill * 100)}%` }} />
          </div>
          <p className="progress-subline">
            <strong>{next - totals.known}</strong> to go until {next}
          </p>
        </>
      )}

      {coverage !== null && totals.known > 0 && (
        <p className="progress-subline">
          These make up <strong>~{percent(coverage)}</strong> of the characters in everyday Chinese text.
        </p>
      )}

      <div className="tier-ring-grid">{renderTierTiles(84)}</div>

      <div className="tier-ring-legend">
        <span><span className="tier-ring-legend-swatch" style={{ background: 'var(--accent-primary)' }} />Known</span>
        <span><span className="tier-ring-legend-swatch" style={{ background: 'var(--easy)' }} />Can write</span>
        <span><span className="tier-ring-legend-swatch" style={{ background: 'var(--accent-secondary)' }} />This week</span>
        <span><span className="tier-ring-legend-swatch" style={{ background: 'var(--accent-primary-dim)' }} />Introduced</span>
      </div>

      <p className="progress-subline">{filterHint}</p>

      <button type="button" className="progress-pace-trigger-btn" onClick={onOpenDetails}>
        Weekly progress, pace &amp; goal
      </button>
    </div>
  );
}
