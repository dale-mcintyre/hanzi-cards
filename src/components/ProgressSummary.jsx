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
        <div className="progress-milestone">
          {/* 學 ("learning") marks a milestone reached - shown once there
              is one behind you. */}
          {previous > 0 && <img src="/seals/seal-xue.png" alt={`學 seal - ${previous} characters`} className="progress-milestone-seal" />}
          <div className="progress-milestone-body">
            <p className="progress-subline">
              {previous > 0 && <><strong>{previous}</strong> reached · </>}
              <strong>{next - totals.known}</strong> to go until {next}
            </p>
            <div className="milestone-track" aria-hidden="true">
              <div className="milestone-fill" style={{ width: `${Math.round(milestoneFill * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      {coverage !== null && totals.known > 0 && (
        <p className="progress-subline">
          These make up <strong>~{percent(coverage)}</strong> of the characters in everyday Chinese text.
        </p>
      )}

      <div className="tier-tile-grid-layout">{renderTierTiles(64)}</div>

      <div className="tier-tile-legend">
        <span><span className="tier-tile-legend-swatch" style={{ background: 'var(--accent-primary)' }} />Known</span>
        <span><span className="tier-tile-legend-swatch" style={{ background: 'var(--accent-secondary)' }} />This week</span>
      </div>

      <p className="progress-subline">{filterHint}</p>

      <button type="button" className="progress-pace-trigger-btn" onClick={onOpenDetails}>
        Weekly progress, pace &amp; goal
      </button>
    </div>
  );
}
