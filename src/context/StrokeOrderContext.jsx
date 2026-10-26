import { createContext, useCallback, useContext, useState } from 'react';
import HanziCanvas from '../components/HanziCanvas';
import { ColorPinyin } from '../utils/pinyinColor';

const StrokeOrderContext = createContext(() => {});

// Same grid sizes as the writing screens.
const SHEET_SIZE_LADDER = { 1: 200, 2: 130, 3: 92, 4: 72 };

function firstMeaning(meaning) {
  return typeof meaning === 'string' ? meaning.split(';')[0].trim() : '';
}

/**
 * One app-wide "how is this written?" sheet: long-press any character
 * (see LongPressHanzi, or useSwipeGesture's onLongPress on the study
 * card) and it opens here, animating the strokes on mizige paper one
 * character at a time. Tap the grid or Replay to watch again.
 */
export function StrokeOrderProvider({ children }) {
  const [entry, setEntry] = useState(null);
  const [replayKey, setReplayKey] = useState(0);

  // `entry` is { character, pinyin?, meaning? } - pinyin and meaning are
  // shown when the caller has them (a vocab card), omitted for a bare
  // component like 亻.
  const show = useCallback((next) => {
    setEntry(typeof next === 'string' ? { character: next } : next);
    setReplayKey((k) => k + 1);
  }, []);

  return (
    <StrokeOrderContext.Provider value={show}>
      {children}
      {entry && (
        <div className="drawer-overlay" onClick={() => setEntry(null)}>
          <div
            className="drawer-sheet stroke-order-sheet"
            role="dialog"
            aria-label={`Stroke order for ${entry.character}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-handle" />
            <span className="box-section-label">Stroke order</span>
            {entry.pinyin && (
              <p className="stroke-order-pinyin"><ColorPinyin pinyin={entry.pinyin} /></p>
            )}
            {entry.meaning && <p className="stroke-order-meaning">{firstMeaning(entry.meaning)}</p>}

            <div className="stroke-order-canvas">
              <HanziCanvas
                key={replayKey}
                character={entry.character}
                mode="animate"
                sequential
                sizeByLength={SHEET_SIZE_LADDER}
              />
            </div>

            <div className="stroke-order-actions">
              <button type="button" className="tertiary-launch-btn" onClick={() => setReplayKey((k) => k + 1)}>
                Replay
              </button>
              <button type="button" className="primary-launch-btn" onClick={() => setEntry(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </StrokeOrderContext.Provider>
  );
}

/** Returns `show(entry)`, which opens the stroke-order sheet - colocated
 * with its Provider, same as useAuth. */
export function useStrokeOrder() { // oxlint-disable-line react/only-export-components
  return useContext(StrokeOrderContext);
}
