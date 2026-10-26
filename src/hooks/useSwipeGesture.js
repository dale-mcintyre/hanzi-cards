import { useState, useRef } from 'react';
import { LONG_PRESS_MS } from './useLongPress';

// Same drift allowance as a tap - a press that moves further is a swipe.
const LONG_PRESS_TOLERANCE_PX = 10;

export default function useSwipeGesture({ onSwipeLeft, onSwipeRight, onSwipeUp, onTap, onLongPress }) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Raw pointermove can fire far faster than the display refreshes (120Hz+
  // on some trackpads/touchscreens); calling setDragX/setDragY straight
  // from the handler re-renders the whole card once per event instead of
  // once per frame, which is what made swipes feel sluggish - especially
  // right after a card change, when HanziCanvas's HanziWriter init is also
  // competing for the main thread (see HanziCanvas.jsx). Buffering the
  // latest values in a ref and flushing them via requestAnimationFrame
  // caps re-renders to the display's actual frame rate.
  const pendingRef = useRef(null);
  const rafRef = useRef(null);
  // A held, still press (onLongPress) ends the gesture there and then, so
  // releasing afterwards is neither a tap nor a swipe.
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const flushPending = () => {
    rafRef.current = null;
    if (!pendingRef.current) return;
    const { x, y } = pendingRef.current;
    pendingRef.current = null;
    setDragX(x);
    setDragY(y);
  };

  const handlePointerDown = (e) => {
    // 🛡️ IGNORE clicks/swipes originating from buttons, drawers, or interactive elements
    if (
      e.target.closest('button') ||
      e.target.closest('.drawer-sheet') ||
      e.target.closest('.drawer-overlay') ||
      e.target.closest('.writing-controls') ||
      e.target.closest('#canvas-box')
    ) {
      return;
    }

    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };

    longPressFiredRef.current = false;
    cancelLongPress();
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressFiredRef.current = true;
        pendingRef.current = null;
        setIsDragging(false);
        setDragX(0);
        setDragY(0);
        onLongPress();
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const diffX = e.clientX - startPosRef.current.x;
    const diffY = e.clientY - startPosRef.current.y;
    if (Math.hypot(diffX, diffY) > LONG_PRESS_TOLERANCE_PX) cancelLongPress();

    const next = { x: dragX, y: dragY };
    if (Math.abs(diffX) > Math.abs(diffY)) {
      next.x = diffX;
    } else if (diffY < 0) {
      next.y = diffY;
    }
    pendingRef.current = next;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPending);
    }
  };

  const handlePointerUp = () => {
    cancelLongPress();
    if (longPressFiredRef.current || !isDragging) return;

    // A pending frame's values haven't landed in state yet - use whatever
    // was last queued (falling back to current state) so the swipe-vs-tap
    // decision below sees the real final position, not a stale one from
    // before the last unflushed move.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const finalX = pendingRef.current?.x ?? dragX;
    const finalY = pendingRef.current?.y ?? dragY;
    pendingRef.current = null;

    setIsDragging(false);

    if (finalX > 90 && onSwipeRight) {
      onSwipeRight();
    } else if (finalX < -90 && onSwipeLeft) {
      onSwipeLeft();
    } else if (finalY < -60 && onSwipeUp) {
      onSwipeUp();
    } else if (Math.abs(finalX) < 10 && Math.abs(finalY) < 10 && onTap) {
      onTap();
    }

    setDragX(0);
    setDragY(0);
  };

  return {
    dragX,
    dragY,
    isDragging,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      // Keeps the browser's own long-press menu out of the way.
      onContextMenu: onLongPress ? (e) => e.preventDefault() : undefined,
    },
  };
}
