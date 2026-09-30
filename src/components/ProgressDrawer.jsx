const TIER_ROWS = [
  { key: '1', label: 'HSK 1' },
  { key: '2', label: 'HSK 2' },
  { key: '3', label: 'HSK 3' },
  { key: '4', label: 'HSK 4' },
  { key: '5', label: 'HSK 5' },
  { key: '6', label: 'HSK 6' },
  { key: 'non-hsk', label: 'Non-HSK' },
];

function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// Mirrors storage.js's getLearningPace formula, applied to a summed-up
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
// to begin with (see getLearningPace's own caveat about lastReviewed
// being an approximation, not a true mastery-timestamp log).
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
  return `~${rounded} word${rounded === 1 ? '' : 's'}/week`;
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
        <span className="progress-tier-count">{mastered}/{total} mastered</span>
      </div>
      <div className="progress-tier-bar-track">
        <div className="progress-tier-bar-fill" style={{ width: `${masteredPct}%` }} />
      </div>
      <p className={`progress-tier-eta ${isComplete ? 'progress-tier-eta--complete' : ''}`}>
        {isComplete
          ? `Complete - all ${total} words mastered`
          : eta
            ? `${eta} left at your current pace (${pace})`
            : 'Not enough recent activity to estimate yet - keep studying to see a countdown here.'}
      </p>
    </div>
  );
}

/**
 * Settings' "how long until I finish this level" screen - one row per HSK
 * tier (plus Non-HSK) showing words mastered so far and a projected
 * time-to-completion at the user's recent pace, above a combined "all of
 * HSK" total. Pure presentation: all the actual pace math lives in
 * storage.js's getLearningPace, memoized once in App.jsx and passed down
 * here as `pace` so this component never has to touch localStorage
 * directly.
 */
export default function ProgressDrawer({ pace, onClose }) {
  const allHsk = sumTiers(pace, ['1', '2', '3', '4', '5', '6']);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-sheet about-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="about-drawer-header">
          <h3>Progress &amp; Pace</h3>
          <button className="about-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="progress-drawer-intro">
          Based on how many words you've mastered (a 21-day+ review interval) in
          the last two weeks. A rough estimate, not a promise - it moves with
          your actual study habits.
        </p>

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
