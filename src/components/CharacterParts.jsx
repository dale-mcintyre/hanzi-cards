import { describeCharacter } from '../data/charParts';

/**
 * The parts each character of a word is built from, plus a one-line note
 * on how it's formed - shown while Priming a new character, so it's
 * learned as meaningful pieces rather than a shape to memorize. Renders
 * nothing when the parts data hasn't loaded or knows nothing useful.
 */
export default function CharacterParts({ word, charParts }) {
  if (!charParts || !word) return null;

  const breakdowns = [...word].map((c) => describeCharacter(c, charParts)).filter(Boolean);
  if (breakdowns.length === 0) return null;

  return (
    <div className="char-parts">
      {breakdowns.map((b) => (
        <div key={b.char} className="char-parts-row">
          {b.components.length > 0 && (
            <div className="char-parts-equation">
              <span className="char-parts-whole">{b.char}</span>
              <span className="char-parts-op">=</span>
              {b.components.map((p, i) => (
                <span key={`${p.char}-${i}`} className="char-parts-piece">
                  {i > 0 && <span className="char-parts-op">+</span>}
                  <span className="char-parts-part">
                    <span className="char-parts-part-char">{p.char}</span>
                    {(p.meaning || p.role) && (
                      <span className="char-parts-part-label">
                        {p.role === 'sound' ? `sound ${p.pinyin || ''}`.trim() : p.meaning}
                      </span>
                    )}
                  </span>
                </span>
              ))}
            </div>
          )}
          {b.note && (
            <p className="char-parts-note">
              {b.components.length === 0 && <span className="char-parts-whole-inline">{b.char} </span>}
              {b.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
