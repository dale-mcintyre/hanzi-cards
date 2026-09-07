const VIEWBOX = 100;
const CENTER = 50;
const R_OUTER = 42;
const R_MID = 30;
const R_INNER = 18;
const SW_OUTER = 8;
const SW_MID = 8;
const SW_INNER = 8;
const C_OUTER = 2 * Math.PI * R_OUTER;
const C_MID = 2 * Math.PI * R_MID;
const C_INNER = 2 * Math.PI * R_INNER;

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * A single HSK-tier (or "non-HSK") tile: three concentric SVG progress
 * rings - outer = % of the tier seen (repetitions > 0), middle = %
 * read-mastered (interval >= 21 days), inner = % writing-mastered
 * (Writing Recall Mode's "Reflexive" level) - wrapped in a real <button>
 * so tapping it toggles that tier in the active study filter. Reused at
 * two sizes (~72px in the Settings drawer, ~48px on the dashboard) via
 * the `size` prop rather than two separate components.
 *
 * Percentages aren't rendered as SVG text - at 48-72px there's no room for
 * three numbers plus a label without becoming illegible - they're carried
 * in the native `title` tooltip and `aria-label` instead. The center
 * glyph is just the tier's short code so it reads at a glance.
 */
export default function TierRingTile({ tierKey, label, total, seen, mastered, writingMastered, active, size = 64, onClick }) {
  const seenPct = pct(seen, total);
  const masteredPct = pct(mastered, total);
  const writingMasteredPct = pct(writingMastered, total);
  const centerGlyph = tierKey === 'non-hsk' ? '+' : tierKey;

  return (
    <button
      type="button"
      className={`tier-ring-tile ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${seenPct}% seen, ${masteredPct}% mastered, ${writingMasteredPct}% writing-mastered. ${active ? 'Included' : 'Excluded'} in active study filter. Tap to toggle.`}
      title={`${label}: ${seen}/${total} seen (${seenPct}%), ${mastered}/${total} mastered (${masteredPct}%), ${writingMastered}/${total} writing-mastered (${writingMasteredPct}%)`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="tier-ring-svg">
        <circle cx={CENTER} cy={CENTER} r={R_OUTER} fill="none" stroke="var(--surface-line)" strokeWidth={SW_OUTER} />
        <circle cx={CENTER} cy={CENTER} r={R_MID} fill="none" stroke="var(--surface-line)" strokeWidth={SW_MID} />
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
          r={R_MID}
          fill="none"
          stroke="var(--easy)"
          strokeWidth={SW_MID}
          strokeLinecap="round"
          strokeDasharray={`${C_MID} ${C_MID}`}
          strokeDashoffset={C_MID * (1 - masteredPct / 100)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />

        <circle
          cx={CENTER}
          cy={CENTER}
          r={R_INNER}
          fill="none"
          stroke="var(--hard)"
          strokeWidth={SW_INNER}
          strokeLinecap="round"
          strokeDasharray={`${C_INNER} ${C_INNER}`}
          strokeDashoffset={C_INNER * (1 - writingMasteredPct / 100)}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />

        <text x={CENTER} y={CENTER + 7} textAnchor="middle" className="tier-ring-center-text">
          {centerGlyph}
        </text>
      </svg>
      <span className="tier-ring-label">{label}</span>
    </button>
  );
}
