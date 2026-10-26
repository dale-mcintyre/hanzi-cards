import { useRef } from 'react';

// Long enough not to fire on an ordinary tap, short enough not to feel
// like waiting.
export const LONG_PRESS_MS = 450;
// A finger that drifts further than this is scrolling or swiping, not
// pressing.
const MOVE_TOLERANCE_PX = 10;

/**
 * Pointer handlers that call `onLongPress` after a held, still press.
 * When it fires, the click that follows the release is swallowed, so a
 * long-pressed button doesn't also do its normal tap action. Also stops
 * the browser's own long-press behaviour (context menu, text selection
 * callout on iOS) from competing.
 */
export default function useLongPress(onLongPress, { disabled = false } = {}) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const cancel = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  if (disabled) return {};

  return {
    onPointerDown: (e) => {
      firedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      cancel();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (!timerRef.current || !startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e) => {
      if (firedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        firedRef.current = false;
      }
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}
