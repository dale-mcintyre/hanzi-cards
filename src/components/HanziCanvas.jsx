import React, { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

// Single Character Box with its own Tianzige Grid
function SingleHanziBox({ char, mode, size = 160 }) {
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
        padding: 10,
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
      className="tianzige-container"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1120',
        borderRadius: '16px',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Dedicated Tianzige SVG Grid */}
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
          opacity: 0.4,
          zIndex: 1,
        }}
      >
        <rect x="1" y="1" width="98" height="98" fill="none" stroke="#334155" strokeWidth="1.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
      </svg>

      {/* Immediate Native Text Fallback */}
      <span
        style={{
          position: 'absolute',
          fontSize: `${size * 0.55}px`,
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

      {/* HanziWriter SVG Mount Point */}
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

// Parent Wrapper: Automatically splits string into individual Tianzige character boxes
export default function HanziCanvas({ character, mode = 'view' }) {
  const charString = typeof character === 'string' ? character : String(character || '');
  const charArray = Array.from(charString.trim());

  // Scale box size depending on single vs multi-character words
  let boxSize = 200;
  if (charArray.length === 2) boxSize = 135;
  if (charArray.length >= 3) boxSize = 100;

  return (
    <div
      className="multi-hanzi-wrapper"
      style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '100%',
        padding: '10px 0',
      }}
    >
      {charArray.map((char, index) => (
        <SingleHanziBox key={`${char}_${index}`} char={char} mode={mode} size={boxSize} />
      ))}
    </div>
  );
}