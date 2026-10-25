const VIEWBOX = 100;
const CENTER = 50;
const R_OUTER = 40;
const R_INNER = 27;
const STROKE = 9;

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// One arc of a ring, from `from` to `to` (fractions 0-1 of the circle,
// clockwise from 12 o'clock). Butt-capped so adjacent arcs meet cleanly
// instead of rounded caps overlapping.
function Arc({ r, from, to, color }) {
  if (to <= from) return null;
  const circumference = 2 * Math.PI * r;
  return (
    <circle
      cx={CENTER}
      cy={CENTER}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeDasharray={`${circumference * (to - from)} ${circumference}`}
      transform={`rotate(${-90 + 360 * from} ${CENTER} ${CENTER})`}
    />
  );
}

/**
 * One HSK tier (or "non-HSK") as two concentric rings, counted in
 * characters (see utils/charProgress.js):
 *  - outer: Known (recognized after a real gap), with Introduced-but-not-
 *    yet-Known as a faint tint ahead of it, so early work is visible
 *    without counting as known
 *  - inner: Can Write
 * The part of each ring gained in the last 7 days is drawn in the accent
 * gold, so a ring that only grows a sliver a week still shows the week's
 * win, while the ring as a whole tracks months. The Known count is printed
 * under the ring rather than hidden in a tooltip (phones don't have one).
 *
 * Still a <button>: tapping toggles the tier in the active study filter.
 */
export default function TierRingTile({
  tierKey,
  label,
  total,
  introduced,
  known,
  canWrite,
  knownThisWeek,
  canWriteThisWeek,
  active,
  size = 72,
  onClick,
}) {
  const frac = (n) => (total > 0 ? Math.min(1, n / total) : 0);
  const centerGlyph = tierKey === 'non-hsk' ? '+' : tierKey;

  return (
    <button
      type="button"
      className={`tier-ring-tile ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${known} of ${total} characters known (${pct(known, total)}%), ${canWrite} can write. ${knownThisWeek} newly known this week. ${active ? 'Included' : 'Excluded'} in study. Tap to toggle.`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="tier-ring-svg" aria-hidden="true">
        <circle cx={CENTER} cy={CENTER} r={R_OUTER} fill="none" stroke="var(--surface-line)" strokeWidth={STROKE} />
        <circle cx={CENTER} cy={CENTER} r={R_INNER} fill="none" stroke="var(--surface-line)" strokeWidth={STROKE} />

        <Arc r={R_OUTER} from={0} to={frac(introduced)} color="var(--accent-primary-dim)" />
        <Arc r={R_OUTER} from={0} to={frac(known - knownThisWeek)} color="var(--accent-primary)" />
        <Arc r={R_OUTER} from={frac(known - knownThisWeek)} to={frac(known)} color="var(--accent-secondary)" />

        <Arc r={R_INNER} from={0} to={frac(canWrite - canWriteThisWeek)} color="var(--easy)" />
        <Arc r={R_INNER} from={frac(canWrite - canWriteThisWeek)} to={frac(canWrite)} color="var(--accent-secondary)" />

        <text x={CENTER} y={CENTER + 6} textAnchor="middle" className="tier-ring-center-text">
          {centerGlyph}
        </text>
      </svg>
      <span className="tier-ring-label">{label}</span>
      <span className="tier-ring-count">{known}/{total}</span>
      <span className={`tier-ring-gain ${knownThisWeek > 0 ? '' : 'tier-ring-gain--none'}`}>
        {knownThisWeek > 0 ? `+${knownThisWeek} this week` : ' '}
      </span>
    </button>
  );
}
