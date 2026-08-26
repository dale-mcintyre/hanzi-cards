import { useEffect } from 'react';
import { ColorPinyin } from '../utils/pinyinColor';

// Matches the CSS animation duration in App.css exactly - the animation
// itself handles the full enter-hold-exit lifecycle, this timer just
// unmounts the component right as the fade-out finishes.
const DISPLAY_MS = 2200;

export default function MasteryCelebration({ character, pinyin, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="mastery-celebration">
      <div className="mastery-celebration-card">
        <span className="mastery-celebration-trophy">🏆</span>
        <span className="mastery-celebration-char">{character}</span>
        <span className="mastery-celebration-pinyin"><ColorPinyin pinyin={pinyin} /></span>
        <span className="mastery-celebration-label">Mastered!</span>
      </div>
    </div>
  );
}
