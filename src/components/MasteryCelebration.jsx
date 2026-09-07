import { useEffect } from 'react';
import { ColorPinyin } from '../utils/pinyinColor';

// Matches the CSS animation duration in App.css exactly - the animation
// itself handles the full enter-hold-exit lifecycle, this timer just
// unmounts the component right as the fade-out finishes.
const DISPLAY_MS = 2200;

// A real, earned milestone - kept, but without the trophy/confetti/
// dimmed-backdrop/scale-bounce treatment. `label` distinguishes reading
// mastery ("Mastered") from Writing Recall Mode's "Reflexive" level,
// both of which fire this same quiet moment.
export default function MasteryCelebration({ character, pinyin, label, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="mastery-celebration">
      <div className="mastery-celebration-card">
        <span className="mastery-celebration-char">{character}</span>
        <span className="mastery-celebration-pinyin"><ColorPinyin pinyin={pinyin} /></span>
        <span className="mastery-celebration-label">{label}</span>
      </div>
    </div>
  );
}
