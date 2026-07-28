import { useEffect, useRef } from 'react';
import HanziWriter from 'hanzi-writer';

export default function HanziCanvas({ character, mode = 'view', width = 220, height = 220 }) {
  const containerRef = useRef(null);
  const writerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !character) return;

    containerRef.current.innerHTML = '';

    const writer = HanziWriter.create(containerRef.current, character, {
      width,
      height,
      padding: 15,
      strokeColor: '#f8fafc',      // Bright main character stroke
      radicalColor: '#38bdf8',     // Highlighting radical in cyan
      outlineColor: '#334155',     // Soft guide outline
      showOutline: true,
      showCharacter: true,
      delayBetweenStrokes: 50,
      strokeAnimationSpeed: 1.25,
    });

    writerRef.current = writer;

    if (mode === 'animate') {
      writer.animateCharacter();
    }
  }, [character, mode, width, height]);

  return (
    <div className="tianzige-container" style={{ width: `${width}px`, height: `${height}px` }}>
      {/* Tianzige 田字格 SVG Background Grid */}
      <svg className="tianzige-grid" viewBox="0 0 100 100">
        <rect x="1" y="1" width="98" height="98" fill="none" stroke="#334155" strokeWidth="1.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="0" y1="0" x2="100" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />
      </svg>
      
      {/* Hanzi Writer Mount */}
      <div ref={containerRef} className="hanzi-writer-box" />
    </div>
  );
}