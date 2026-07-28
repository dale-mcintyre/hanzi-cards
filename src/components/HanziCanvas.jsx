import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';

export default function HanziCanvas({ character, mode = 'view', width = 220, height = 220 }) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);
  const [renderFailed, setRenderFailed] = useState(false);

  // Ensure character is strictly a string
  const charString = typeof character === 'string' ? character : String(character || '字');

  useEffect(() => {
    if (!containerRef.current || !charString) return;

    containerRef.current.innerHTML = '';
    setRenderFailed(false);

    try {
      const writer = HanziWriter.create(containerRef.current, charString, {
        width,
        height,
        padding: 15,
        strokeColor: '#f8fafc',      // Main character color
        radicalColor: '#38bdf8',     // Radical highlight
        outlineColor: '#334155',     // Background character outline
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
      console.warn('HanziWriter render notice:', e);
      setRenderFailed(true);
    }
  }, [charString, mode, width, height]);

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
          opacity: 0.5,
        }}
      >
        <rect x="1" y="1" width="98" height="98" fill="none" stroke="#334155" strokeWidth="1.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
      </svg>
      
      {/* HanziWriter Mount Container */}
      {!renderFailed ? (
        <div 
          ref={containerRef} 
          style={{ width: `${width}px`, height: `${height}px`, position: 'relative', zIndex: 2 }}
        />
      ) : (
        /* Fallback if HanziWriter SVG fails */
        <span 
          style={{ 
            fontSize: '110px', 
            color: '#f8fafc', 
            position: 'relative', 
            zIndex: 2,
            fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
          }}
        >
          {charString}
        </span>
      )}
    </div>
  );
}