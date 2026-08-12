const VIEWBOX = 100;
const CENTER = 50;
const R_OUTER = 42;
const R_INNER = 29;
const SW_OUTER = 9;
const SW_INNER = 9;
const C_OUTER = 2 * Math.PI * R_OUTER;
const C_INNER = 2 * Math.PI * R_INNER;

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * A single HSK-tier (or "non-HSK") tile: two concentric SVG progress rings
 * - outer = % of the tier seen (repetitions > 0), inner = % mastered
 * (interval >= 21 days) - wrapped in a real <button> so tapping it toggles
 * that tier in the active study filter. Reused at two sizes (~72px in the
 * Settings drawer, ~48px on the dashboard) via the `size` prop rather than
 * two separate components.
 *
 * Percentages aren't rendered as SVG text - at 48-72px there's no room for
 * two numbers plus a label without becoming illegible - they're carried in
 * the native `title` tooltip and `aria-label` instead. The center glyph is
 * just the tier's short code so it reads at a glance.
 */
export default function TierRingTile({ tierKey, label, total, seen, mastered, active, size = 64, onClick }) {
  const seenPct = pct(seen, total);
  const masteredPct = pct(mastered, total);
  const centerGlyph = tierKey === 'non-hsk' ? '+' : tierKey;

  return (
    <button
      type="button"
      className={`tier-ring-tile ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${seenPct}% seen, ${masteredPct}% mastered. ${active ? 'Included' : 'Excluded'} in active study filter. Tap to toggle.`}
      title={`${label}: ${seen}/${total} seen (${seenPct}%), ${mastered}/${total} mastered (${masteredPct}%)`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="tier-ring-svg">
        <circle cx={CENTER} cy={CENTER} r={R_OUTER} fill="none" stroke="var(--surface-line)" strokeWidth={SW_OUTER} />
        <circle cx={CENTER} cy={CENTER} r={R_INNER} fill="none" stroke="var(--surface-line)" strokeWidth={SW_INNER} />

        <circle
          cx={CENTER}
          cy={CENTER}
          r={R_OUTER}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth={SW_OUTER}
          strokeLinecap="round"
          strokeDasharray={`${C_OUTER} ${C_OUTER}`}
          strokeDashoffset={C_OUTER * (1 - seenPct / 100)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />

        <circle
          cx={CENTER}
          cy={CENTER}
          r={R_INNER}
          fill="none"
          stroke="var(--easy)"
          strokeWidth={SW_INNER}
          strokeLinecap="round"
          strokeDasharray={`${C_INNER} ${C_INNER}`}
          strokeDashoffset={C_INNER * (1 - masteredPct / 100)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />

        <text x={CENTER} y={CENTER + 8} textAnchor="middle" className="tier-ring-center-text">
          {centerGlyph}
        </text>
      </svg>
      <span className="tier-ring-label">{label}</span>
    </button>
  );
}
