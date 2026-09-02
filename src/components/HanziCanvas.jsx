import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

// Single Character Tianzige Cell
function SingleHanziBox({ char, mode, size, shouldAnimate, onComplete }) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);
  const [writerLoaded, setWriterLoaded] = useState(false);

  // 'hidden' mode (Writing Recall Mode's prompt state) never creates a
  // HanziWriter instance at all - just the tianzige grid lines below, no
  // glyph, no fallback span. Skipping instance creation entirely (rather
  // than creating one and hiding it) avoids wasted stroke-data fetches for
  // a card that might get graded before it's ever revealed.
  useEffect(() => {
    if (mode === 'hidden' || !containerRef.current || !char) return;

    containerRef.current.innerHTML = '';
    setWriterLoaded(false);

    // HanziWriter.create() synchronously builds a nontrivial number of SVG
    // elements from stroke path data - on the same tick as the swipe/tap
    // that just changed `char`, that competes with the browser processing
    // the very next pointer event, which is what made rapid swiping feel
    // laggy. Deferring it one frame gets it off that critical path (the
    // other half of this fix is useSwipeGesture.js's rAF-throttled drag
    // updates).
    const rafId = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      try {
        const writer = HanziWriter.create(containerRef.current, char, {
          width: size,
          height: size,
          padding: Math.max(6, Math.floor(size * 0.08)),
          strokeColor: '#f8fafc',
          radicalColor: '#38bdf8',
          outlineColor: '#334155',
          showOutline: true,
          showCharacter: true,
          delayBetweenStrokes: 50,
          strokeAnimationSpeed: 1.25,
          onLoadCharDataSuccess: () => setWriterLoaded(true),
          onLoadCharDataError: () => setWriterLoaded(false),
        });

        writerRef.current = writer;
      } catch (e) {
        console.warn('HanziWriter fallback:', e);
      }
    });

    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, mode, size]);

  // Triggers this box's animation exactly once per "turn": fires when
  // either the writer finishes loading (single-box / already-active box)
  // or shouldAnimate flips true later (a later box in a sequential
  // hand-off) - whichever happens last. Gating on writerLoaded here
  // (rather than calling animateCharacter unconditionally on mount, as
  // the pre-writing-mode version did) avoids double-firing: mount-time
  // creation and the load callback would otherwise both try to start it.
  useEffect(() => {
    if (mode !== 'animate' || !shouldAnimate || !writerLoaded) return;
    writerRef.current?.animateCharacter({ onComplete });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, writerLoaded]);

  // Tap-to-replay: once loaded, tapping this specific box replays just its
  // character - animateCharacter() cancels any in-flight quiz/animation and
  // redraws from scratch, so calling it again is safe without recreating
  // the writer instance.
  function handleTap() {
    if (mode === 'animate' && writerLoaded) writerRef.current?.animateCharacter();
  }

  return (
    <div
      className="tianzige-cell"
      onClick={handleTap}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#090d16',
        borderRadius: size > 150 ? '20px' : '14px',
        border: '1px solid #1e293b',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        flexShrink: 0,
        cursor: mode === 'animate' && writerLoaded ? 'pointer' : 'default',
      }}
    >
      {/* Tianzige SVG Grid */}
      <svg
        className="tianzige-grid"
        viewBox="0 0 100 100"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.35,
          zIndex: 1,
        }}
      >
        <rect x="1" y="1" width="98" height="98" fill="none" stroke="#334155" strokeWidth="1.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
      </svg>

      {mode !== 'hidden' && (
        <>
          {/* Immediate System Font Fallback */}
          <span
            style={{
              position: 'absolute',
              fontSize: `${size * 0.58}px`,
              color: '#f8fafc',
              zIndex: writerLoaded ? 1 : 2,
              opacity: writerLoaded ? 0 : 1,
              transition: 'opacity 0.2s ease',
              fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {char}
          </span>

          {/* HanziWriter Render Target */}
          <div
            ref={containerRef}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              position: 'relative',
              zIndex: 3,
            }}
          />
        </>
      )}
    </div>
  );
}

// Parent Wrapper (Maintains Card Container Integrity)
export default function HanziCanvas({ character, mode = 'view', sequential = false, onAllComplete, sizeByLength }) {
  // Tracks which box is currently animating when `sequential` is on -
  // reset to 0 whenever the character (or reveal state) changes so a new
  // prompt always starts its sequence from box 1.
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [character, mode]);

  // Guard clause: if character hasn't loaded yet, render an empty placeholder box
  if (!character) {
    return (
      <div className="card-canvas-stage" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
        <div style={{ color: '#64748b', fontSize: '14px' }}>Loading character...</div>
      </div>
    );
  }

  const charString = typeof character === 'string' ? character : String(character || '');
  const charArray = Array.from(charString.trim());

  // Strict sizing calculation to fit inside the card padding (Max width ~310px).
  // sizeByLength lets a caller (WritingSession) override this ladder
  // entirely; omitted, the original hardcoded values apply unchanged.
  const ladder = sizeByLength || { 1: 210, 2: 135, 3: 92, 4: 72 };
  const lengthKey = Math.min(charArray.length, 4); // 4 means "4 or more", matching the original ladder
  const boxSize = ladder[lengthKey] ?? ladder[1];

  const isSequential = mode === 'animate' && sequential && charArray.length > 1;

  function handleBoxComplete(index) {
    if (index + 1 < charArray.length) {
      setActiveIndex(index + 1);
    } else {
      onAllComplete?.();
    }
  }

  return (
    <div
      className="card-canvas-stage"
      style={{
        display: 'flex',
        gap: charArray.length > 2 ? '8px' : '12px',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {charArray.map((char, index) => (
        <SingleHanziBox
          key={`${char}_${index}`}
          char={char}
          mode={mode}
          size={boxSize}
          shouldAnimate={isSequential ? index === activeIndex : mode === 'animate'}
          onComplete={isSequential ? () => handleBoxComplete(index) : onAllComplete}
        />
      ))}
    </div>
  );
}
