function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * One HSK tier (or "non-HSK") as a square of 米字格 practice paper that
 * fills with ink from the bottom as its characters become Known (see
 * utils/charProgress.js). The slice gained in the last 7 days sits on top
 * in vermilion, so a level that only rises a sliver a week still shows the
 * week's work, while the square as a whole tracks months. Known and Can
 * Write counts are printed underneath.
 *
 * Still a <button>: tapping toggles the tier in the active study filter.
 */
export default function TierRingTile({
  label,
  total,
  introduced,
  known,
  canWrite,
  knownThisWeek,
  active,
  size = 72,
  onClick,
}) {
  const frac = (n) => (total > 0 ? Math.min(1, n / total) : 0);
  const knownBefore = frac(known - knownThisWeek);
  const knownNow = frac(known);

  return (
    <button
      type="button"
      className={`tier-tile ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${known} of ${total} characters known (${pct(known, total)}%), ${canWrite} can write, ${introduced} introduced. ${knownThisWeek} newly known this week. ${active ? 'Included' : 'Excluded'} in study. Tap to toggle.`}
    >
      <span className="tier-tile-square" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
        <span className="tier-tile-ink" style={{ height: `${knownBefore * 100}%` }} />
        {knownThisWeek > 0 && (
          <span
            className="tier-tile-gain"
            style={{ bottom: `${knownBefore * 100}%`, height: `max(2px, ${(knownNow - knownBefore) * 100}%)` }}
          />
        )}
        <svg className="tier-tile-grid" viewBox="0 0 100 100">
          <line x1="50" y1="0" x2="50" y2="100" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
          <line x1="0" y1="50" x2="100" y2="50" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
          <line x1="0" y1="0" x2="100" y2="100" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
          <line x1="100" y1="0" x2="0" y2="100" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
        </svg>
      </span>
      <span className="tier-tile-label">{label}</span>
      <span className="tier-tile-count">{known}/{total}</span>
      <span className="tier-tile-write">write {canWrite}</span>
      <span className={`tier-tile-gain-label ${knownThisWeek > 0 ? '' : 'tier-tile-gain-label--none'}`}>
        {knownThisWeek > 0 ? `+${knownThisWeek} this week` : ' '}
      </span>
    </button>
  );
}
