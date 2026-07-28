import { useRef, useState, useCallback } from 'react';

const SWIPE_X_THRESHOLD = 90;
const SWIPE_UP_THRESHOLD = 70;
const TAP_MAX_MOVEMENT = 8;

/**
 * Drives the card's drag transform + commits a gesture on release.
 *
 * onSwipeLeft / onSwipeRight — SM-2 grading
 * onSwipeUp — open the deep-dive sheet
 * onTap — flip the card (fires only if the pointer barely moved)
 */
export function useSwipeGesture({ onSwipeLeft, onSwipeRight, onSwipeUp, onTap, disabled }) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const pointerStart = useRef(null);
  const moved = useRef(false);

  const handlePointerDown = useCallback(
    (e) => {
      if (disabled) return;
      pointerStart.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
      setDrag({ x: 0, y: 0, active: true });
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!pointerStart.current || disabled) return;
      const dx = e.clientX - pointerStart.current.x;
      const dy = e.clientY - pointerStart.current.y;
      if (Math.abs(dx) > TAP_MAX_MOVEMENT || Math.abs(dy) > TAP_MAX_MOVEMENT) {
        moved.current = true;
      }
      setDrag({ x: dx, y: Math.min(dy, 0), active: true });
    },
    [disabled]
  );

  const handlePointerUp = useCallback(() => {
    if (!pointerStart.current || disabled) {
      setDrag({ x: 0, y: 0, active: false });
      pointerStart.current = null;
      return;
    }

    const { x, y } = drag;

    if (!moved.current) {
      onTap?.();
    } else if (y <= -SWIPE_UP_THRESHOLD && Math.abs(y) > Math.abs(x)) {
      onSwipeUp?.();
    } else if (x >= SWIPE_X_THRESHOLD) {
      onSwipeRight?.();
    } else if (x <= -SWIPE_X_THRESHOLD) {
      onSwipeLeft?.();
    }

    pointerStart.current = null;
    setDrag({ x: 0, y: 0, active: false });
  }, [drag, disabled, onSwipeLeft, onSwipeRight, onSwipeUp, onTap]);

  return {
    drag,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
