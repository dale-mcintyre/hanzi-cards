import { useState, useRef } from 'react';

export default function useSwipeGesture({ onSwipeLeft, onSwipeRight, onSwipeUp, onTap }) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    if (e.target.closest('#canvas-box') || e.target.closest('button')) return;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const diffX = e.clientX - startPosRef.current.x;
    const diffY = e.clientY - startPosRef.current.y;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      setDragX(diffX);
    } else if (diffY < 0) {
      setDragY(diffY);
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragX > 90 && onSwipeRight) onSwipeRight();
    else if (dragX < -90 && onSwipeLeft) onSwipeLeft();
    else if (dragY < -60 && onSwipeUp) onSwipeUp();
    else if (Math.abs(dragX) < 10 && Math.abs(dragY) < 10 && onTap) onTap();

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
    },
  };
}