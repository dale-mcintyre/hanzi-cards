import { useEffect, useRef, useState } from 'react';

const BASE_SIZE = 260;

/**
 * Handles single characters AND multi-character words seamlessly.
 * If passed "准", it renders 1 large 260px canvas.
 * If passed "准备", it renders 2 side-by-side 140px canvases.
 */
export default function HanziCanvas({ character, mode, replayToken }) {
  if (!character) return null;

  // Split string into individual characters (e.g. "准备" -> ["准", "备"])
  const charArray = character.split('');
  const isMulti = charArray.length > 1;

  // Automatically scale down canvas size for multi-character words so they fit on screen
  const dynamicSize = isMulti ? Math.max(120, Math.floor(BASE_SIZE / charArray.length)) : BASE_SIZE;

  return (
    <div 
      className="hanzi-canvas-container" 
      style={{ 
        display: 'flex', 
        gap: isMulti ? '8px' : '0px', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexWrap: 'nowrap'
      }}
    >
      {charArray.map((singleChar, index) => (
        <SingleHanziCanvas
          key={`${singleChar}_${index}_${mode}`}
          character={singleChar}
          mode={mode}
          size={dynamicSize}
          replayToken={replayToken}
        />
      ))}
    </div>
  );
}

/** Renders an individual character box (either static text or HanziWriter instance) */
function SingleHanziCanvas({ character, mode, size, replayToken }) {
  if (mode === 'view' || !mode) {
    return (
      <div 
        className="hanzi-canvas hanzi-canvas--static" 
        style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span className="hanzi-canvas__glyph" style={{ fontSize: `${size * 0.65}px` }}>
          {character}
        </span>
      </div>
    );
  }

  return <HanziWriterCanvas character={character} mode={mode} size={size} replayToken={replayToken} />;
}

/** Isolated HanziWriter instance per character */
function HanziWriterCanvas({ character, mode, size, replayToken }) {
  const targetRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'failed'

  useEffect(() => {
    if (!targetRef.current || !character) return;
    setStatus('loading');
    targetRef.current.innerHTML = '';

    let cancelled = false;
    let animateTimeout = null;

    import('hanzi-writer')
      .then(({ default: HanziWriter }) => {
        if (cancelled || !targetRef.current) return;

        const writer = HanziWriter.create(targetRef.current, character, {
          width: size,
          height: size,
          padding: Math.floor(size * 0.08),
          strokeColor: '#ffffff',
          radicalColor: '#38bdf8',
          outlineColor: '#64748b',
          drawingColor: '#22d3ee',
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 150,
          showOutline: true,
          showCharacter: mode !== 'practice',
        });

        setStatus('ready');

        if (mode === 'practice') {
          writer.quiz({ onMistake: () => {}, onCorrectStroke: () => {}, onComplete: () => {} });
        } else {
          animateTimeout = setTimeout(() => {
            if (!cancelled) writer.animateCharacter();
          }, 150);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
      clearTimeout(animateTimeout);
    };
  }, [character, mode, size, replayToken]);

  if (status === 'failed') {
    return (
      <div className="hanzi-canvas hanzi-canvas--fallback" style={{ width: size, height: size }}>
        <span className="hanzi-canvas__fallback-char" style={{ fontSize: `${size * 0.6}px` }}>{character}</span>
        <span className="hanzi-canvas__fallback-note">Offline</span>
      </div>
    );
  }

  return (
    <div className="hanzi-canvas-stack" style={{ width: size, height: size, position: 'relative' }}>
      {status === 'loading' && (
        <div 
          className="hanzi-canvas hanzi-canvas--static hanzi-canvas--dim" 
          style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className="hanzi-canvas__glyph" style={{ fontSize: `${size * 0.65}px` }}>
            {character}
          </span>
        </div>
      )}
      <div
        ref={targetRef}
        className="hanzi-canvas"
        style={{ width: size, height: size, display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}