import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

export default function HanziCanvas({ character, mode = 'view', width = 220, height = 220 }) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);
  const [writerLoaded, setWriterLoaded] = useState(false);

  const charStr = typeof character === 'string' ? character : String(character || '');

  useEffect(() => {
    if (!containerRef.current || !charStr) return;

    containerRef.current.innerHTML = '';
    setWriterLoaded(false);

    try {
      const writer = HanziWriter.create(containerRef.current, charStr, {
        width,
        height,
        padding: 15,
        strokeColor: '#f8fafc',
        radicalColor: '#38bdf8',
        outlineColor: '#334155',
        showOutline: true,
        showCharacter: true,
        delayBetweenStrokes: 50,
        strokeAnimationSpeed: 1.25,
        onLoadCharDataSuccess: () => setWriterLoaded(true),
        onLoadCharDataError: (err) => console.warn('HanziWriter stroke data load notice:', err),
      });

      writerRef.current = writer;

      if (mode === 'animate') {
        writer.animateCharacter();
      }
    } catch (e) {
      console.error('HanziWriter creation error:', e);
    }
  }, [charStr, mode, width, height]);

  return (
    <div 
      className="tianzige-container" 
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1120',
        borderRadius: '20px',
        border: '1px solid #1e293b',
        overflow: 'hidden'
      }}
    >
      {/* Tianzige SVG Background Grid */}
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

      {/* Guaranteed Text Render (Displays immediately) */}
      <span 
        style={{ 
          position: 'absolute',
          fontSize: '110px', 
          color: '#f8fafc', 
          zIndex: writerLoaded ? 1 : 2,
          opacity: writerLoaded ? 0 : 1,
          transition: 'opacity 0.2s ease',
          fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
          lineHeight: 1,
          userSelect: 'none'
        }}
      >
        {charStr || '字'}
      </span>
      
      {/* HanziWriter Mount Container */}
      <div 
        ref={containerRef} 
        style={{ 
          width: `${width}px`, 
          height: `${height}px`, 
          position: 'relative', 
          zIndex: 3 
        }}
      />
    </div>
  );
}