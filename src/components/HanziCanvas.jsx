import { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

export default function HanziCanvas({ character, mode = 'view', width = 220, height = 220 }) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !character) return;

    containerRef.current.innerHTML = '';

    try {
      const writer = HanziWriter.create(containerRef.current, character, {
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
      });

      writerRef.current = writer;

      if (mode === 'animate') {
        writer.animateCharacter();
      }
    } catch (e) {
      console.error('HanziWriter mount failed:', e);
    }
  }, [character, mode, width, height]);

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
        }}
      >
        <rect x="1" y="1" width="98" height="98" fill="none" stroke="#334155" strokeWidth="1.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
      </svg>
      
      {/* HanziWriter Mount Container */}
      <div 
        ref={containerRef} 
        style={{ width: `${width}px`, height: `${height}px`, position: 'relative', zIndex: 2 }}
      />
    </div>
  );
}