import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

// Single Character Tianzige Cell
function SingleHanziBox({ char, mode, size }) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);
  const [writerLoaded, setWriterLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !char) return;

    containerRef.current.innerHTML = '';
    setWriterLoaded(false);

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

      if (mode === 'animate') {
        writer.animateCharacter();
      }
    } catch (e) {
      console.warn('HanziWriter fallback:', e);
    }
  }, [char, mode, size]);

  return (
    <div
      className="tianzige-cell"
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
    </div>
  );
}

// Parent Wrapper (Maintains Card Container Integrity)
export default function HanziCanvas({ character, mode = 'view' }) {
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

  // Strict sizing calculation to fit inside the card padding (Max width ~310px)
  let boxSize = 210;
  if (charArray.length === 2) boxSize = 135;
  if (charArray.length === 3) boxSize = 92;
  if (charArray.length >= 4) boxSize = 72;

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
        <SingleHanziBox key={`${char}_${index}`} char={char} mode={mode} size={boxSize} />
      ))}
    </div>
  );
}