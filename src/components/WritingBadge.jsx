import { MASTERED_INTERVAL_DAYS } from '../utils/storage';

// Small mount-on-a-chip indicator of a card's Writing Recall Mode progress,
// independent of its reading-mode mastery. Four states:
//   - not eligible yet (reading interval hasn't reached MASTERED_INTERVAL_DAYS)
//     or eligible but never attempted -> renders nothing.
//   - writingLevel 0/1 (Amnesia/Hesitated) -> amber outline, still struggling.
//   - writingLevel 2 (Spontaneous) -> solid cyan, building toward Reflexive.
//   - writingLevel 3 (Reflexive) -> glowing cyan ring, fully overlearned.
export default function WritingBadge({ stats }) {
  const readingInterval = stats?.interval || 0;
  const writingLevel = stats?.writingLevel || 0;
  const everWritten = Boolean(stats?.lastWrittenAt);

  if (readingInterval < MASTERED_INTERVAL_DAYS || !everWritten) return null;

  let className = 'writing-badge';
  if (writingLevel >= 3) className += ' writing-badge--reflexive';
  else if (writingLevel === 2) className += ' writing-badge--spontaneous';
  else className += ' writing-badge--struggling';

  return <span className={className} aria-label="Writing practice progress" title="Writing practice progress" />;
}
