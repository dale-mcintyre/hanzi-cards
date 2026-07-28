import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './App.css';

import { LEVELS, loadDeck } from './data/hskData';
import { getSentencesFor } from './data/sentenceSource';
import { loadProgress, saveProgress, cardKey } from './utils/storage';
import { createInitialSm2State, nextSm2State, isDue } from './utils/sm2';
import { speakMandarin, isSpeechSupported } from './utils/tts';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import HanziCanvas from './components/HanziCanvas';

const POS_LABELS = {
  n: 'noun', v: 'verb', a: 'adjective', ad: 'adjective (adverbial)',
  d: 'adverb', r: 'pronoun', m: 'numeral', q: 'classifier',
  c: 'conjunction', p: 'preposition', u: 'auxiliary', t: 'time word',
  s: 'space word', y: 'modal particle', e: 'interjection', i: 'idiom',
  ns: 'place name', nt: 'organization', nz: 'proper noun', o: 'onomatopoeia',
};

function posLabel(code) {
  return POS_LABELS[code] || code;
}

export default function App() {
  const [level, setLevel] = useState(3);
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [progress, setProgress] = useState(() => loadProgress());
  const [queue, setQueue] = useState([]);
  const [pos, setPos] = useState(0);

  const [flipped, setFlipped] = useState(false);
  const [charMode, setCharMode] = useState('view'); // 'view' | 'demo' | 'practice'
  const [replayToken, setReplayToken] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [glow, setGlow] = useState(null); // 'hard' | 'easy' | null

  // { [simplifiedWord]: { sentence, pinyin, english } | null | undefined }
  // undefined = not looked up yet, null = looked up, no match found.
  const [sentences, setSentences] = useState({});

  const glowTimeout = useRef(null);

  // ---- Load the deck whenever the level changes ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFlipped(false);
    setCharMode('view');
    setSheetOpen(false);

    loadDeck(level).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError(result.error);
        setDeck([]);
      } else {
        setDeck(result.words);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  // ---- Build a study queue once the deck is in: due/new cards first ----
  useEffect(() => {
    if (deck.length === 0) {
      setQueue([]);
      setPos(0);
      return;
    }
    const due = [];
    const fresh = [];
    const later = [];

    for (let i = 0; i < deck.length; i++) {
      const key = cardKey(level, deck[i].simplified);
      const state = progress[key];
      if (!state || !state.lastReviewed) fresh.push(i);
      else if (isDue(state)) due.push(i);
      else later.push(i);
    }

    const built = [...due, ...fresh];
    setQueue(built.length > 0 ? built : later.length > 0 ? later : deck.map((_, i) => i));
    setPos(0);
    // progress intentionally excluded — this queue should only rebuild on deck/level change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, level]);

  // ---- Look up example sentences for this deck in the background. Cards
  // render immediately from vocab data; sentences fill in as they resolve. ----
  useEffect(() => {
    if (deck.length === 0) return;
    let cancelled = false;
    const words = deck.map((w) => w.simplified);

    getSentencesFor(words).then((result) => {
      if (cancelled) return;
      setSentences((prev) => ({ ...prev, ...result }));
    });

    return () => {
      cancelled = true;
    };
  }, [deck]);

  const currentWord = useMemo(() => {
    if (queue.length === 0 || pos >= queue.length) return null;
    const idx = queue[pos];
    return deck[idx] || null;
  }, [queue, pos, deck]);

  const sessionDone = queue.length > 0 && pos >= queue.length;

  const currentSentenceEntry = currentWord ? sentences[currentWord.simplified] : undefined;
  const sentenceStillLoading = currentWord && currentSentenceEntry === undefined;

  const resetCardUiState = useCallback(() => {
    setFlipped(false);
    setCharMode('view');
    setSheetOpen(false);
  }, []);

  const commitGrade = useCallback(
    (grade) => {
      if (!currentWord) return;
      const key = cardKey(level, currentWord.simplified);
      setProgress((prev) => {
        const nextState = nextSm2State(prev[key] || createInitialSm2State(), grade);
        const merged = { ...prev, [key]: nextState };
        saveProgress(merged);
        return merged;
      });

      setGlow(grade);
      clearTimeout(glowTimeout.current);
      glowTimeout.current = setTimeout(() => {
        setGlow(null);
        setPos((p) => p + 1);
        resetCardUiState();
      }, 220);
    },
    [currentWord, level, resetCardUiState]
  );

  const { drag, handlers } = useSwipeGesture({
    disabled: !currentWord || sheetOpen,
    onSwipeLeft: () => commitGrade('hard'),
    onSwipeRight: () => commitGrade('easy'),
    onSwipeUp: () => setSheetOpen(true),
    onTap: () => setFlipped((f) => !f),
  });

  const cardStyle = {
    transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 22}deg)`,
    transition: drag.active ? 'none' : 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
  };

  const handlePlayAudio = (e) => {
    e.stopPropagation();
    if (currentWord?.simplified) speakMandarin(currentWord.simplified);
  };

  const handleShowStrokeOrder = (e) => {
    e.stopPropagation();
    setCharMode((m) => {
      if (m === 'demo') {
        setReplayToken((t) => t + 1); // already showing demo — tap again to replay
        return m;
      }
      return 'demo';
    });
  };

  const handleTogglePractice = (e) => {
    e.stopPropagation();
    setCharMode((m) => (m === 'practice' ? 'view' : 'practice'));
  };

  const handleRestartSession = () => {
    setQueue(deck.map((_, i) => i));
    setPos(0);
    resetCardUiState();
  };

  const progressPct = queue.length > 0 ? Math.min(100, (pos / queue.length) * 100) : 0;

  return (
    <div className="hc-app">
      <div className="hc-topbar">
        <div className="hc-levels" role="tablist" aria-label="HSK level">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              role="tab"
              aria-selected={level === l.level}
              data-active={level === l.level}
              className="hc-level-btn"
              onClick={() => setLevel(l.level)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="hc-progress-track">
          <div className="hc-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="hc-stage">
        {loading && (
          <div className="hc-state">
            <div className="hc-spinner" />
            <div className="hc-state__title">Loading HSK {level} deck…</div>
          </div>
        )}

        {!loading && error && (
          <div className="hc-state">
            <div className="hc-state__title">Couldn't load this deck</div>
            <div className="hc-state__body">{error}</div>
            <button className="hc-retry-btn" onClick={() => setLevel((l) => l)}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && deck.length > 0 && sessionDone && (
          <div className="hc-state">
            <div className="hc-state__title">Session complete 🎉</div>
            <div className="hc-state__body">
              You reviewed {queue.length} {queue.length === 1 ? 'card' : 'cards'} from HSK {level}.
            </div>
            <button className="hc-retry-btn" onClick={handleRestartSession}>
              Study again
            </button>
          </div>
        )}

        {!loading && !error && currentWord && !sessionDone && (
          <div className="hc-card" style={cardStyle} {...handlers}>
            <div className="hc-glow" data-show={glow || undefined} />

            <div className="hc-card__badge-row">
              <span className="hc-badge">HSK {level}</span>
              {currentWord.frequency != null && (
                <span className="hc-freq">#{currentWord.frequency} freq</span>
              )}
            </div>

            {!flipped ? (
              <>
                <div
                  className="hc-canvas-wrap"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                >
                  <HanziCanvas
                    character={currentWord.simplified}
                    mode={charMode}
                    replayToken={replayToken}
                  />
                </div>

                <div className="hc-mode-row">
                  <button
                    className="hc-practice-toggle"
                    data-on={charMode === 'demo'}
                    onClick={handleShowStrokeOrder}
                  >
                    {charMode === 'demo' ? '↺ Replay' : '▶ Stroke order'}
                  </button>
                  <button
                    className="hc-practice-toggle"
                    data-on={charMode === 'practice'}
                    onClick={handleTogglePractice}
                  >
                    {charMode === 'practice' ? '✕ Exit practice' : '✏️ Practice writing'}
                  </button>
                </div>

                <div className={`hc-sentence ${!currentSentenceEntry ? 'hc-sentence--empty' : ''}`}>
                  {sentenceStillLoading
                    ? 'Finding an example sentence…'
                    : currentSentenceEntry
                    ? currentSentenceEntry.sentence
                    : 'No example sentence found for this word yet'}
                </div>
              </>
            ) : (
              <div className="hc-back">
                <div className="hc-pinyin">
                  {currentWord.pinyin || currentWord.numericPinyin || '—'}
                </div>
                <ul className="hc-meanings">
                  {currentWord.meanings.length > 0 ? (
                    currentWord.meanings.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)
                  ) : (
                    <li>No definition available for this word.</li>
                  )}
                </ul>
                {isSpeechSupported() && (
                  <button className="hc-audio-btn" onClick={handlePlayAudio}>
                    🔊 Play pronunciation
                  </button>
                )}
              </div>
            )}

            <div className="hc-controls">
              <button
                className="hc-grade-btn hc-grade-btn--hard"
                onClick={(e) => {
                  e.stopPropagation();
                  commitGrade('hard');
                }}
              >
                ✕ Hard
              </button>
              <button
                className="hc-detail-btn"
                aria-label="Deep dive"
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetOpen(true);
                }}
              >
                ▲
              </button>
              <button
                className="hc-grade-btn hc-grade-btn--easy"
                onClick={(e) => {
                  e.stopPropagation();
                  commitGrade('easy');
                }}
              >
                ✓ Easy
              </button>
            </div>
            <div className="hc-hint">Tap to flip · swipe left/right to grade · swipe up for details</div>
          </div>
        )}

        {!loading && !error && deck.length === 0 && !sessionDone && (
          <div className="hc-state">
            <div className="hc-state__title">No words to show</div>
            <div className="hc-state__body">This deck came back empty. Try another level.</div>
          </div>
        )}

        <div
          className="hc-sheet-backdrop"
          data-open={sheetOpen}
          onClick={() => setSheetOpen(false)}
        />
        <div className="hc-sheet" data-open={sheetOpen}>
          <div className="hc-sheet__handle" />
          {currentWord && (
            <>
              <div className="hc-sheet__title">
                <span className="hc-sheet__hanzi">{currentWord.simplified}</span>
                <span className="hc-sheet__pinyin">
                  {currentWord.pinyin || currentWord.numericPinyin || '—'}
                </span>
              </div>

              <div>
                <p className="hc-sheet__section-label">Character breakdown</p>
                <div className="hc-chip-row">
                  {currentWord.radical && <span className="hc-chip">Radical {currentWord.radical}</span>}
                  {currentWord.traditional !== currentWord.simplified && (
                    <span className="hc-chip">Traditional {currentWord.traditional}</span>
                  )}
                  {currentWord.pos.map((p) => (
                    <span className="hc-chip" key={p}>
                      {posLabel(p)}
                    </span>
                  ))}
                  {currentWord.classifiers.map((c) => (
                    <span className="hc-chip" key={c}>
                      Classifier {c}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="hc-sheet__section-label">Full sentence</p>
                {sentenceStillLoading ? (
                  <p className="hc-sheet__body-text hc-sheet__body-text--empty">
                    Finding an example sentence…
                  </p>
                ) : currentSentenceEntry ? (
                  <>
                    <p className="hc-sheet__body-text" style={{ color: 'var(--ink)', fontSize: 16 }}>
                      {currentSentenceEntry.sentence}
                    </p>
                    <p className="hc-sheet__body-text" style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-data)', fontSize: 13 }}>
                      {currentSentenceEntry.pinyin}
                    </p>
                    <p className="hc-sheet__body-text">{currentSentenceEntry.english}</p>
                    <p className="hc-sheet__body-text hc-sheet__body-text--empty" style={{ fontSize: 11, marginTop: 4 }}>
                      Sentence from Tatoeba; English translation is machine-translated, not
                      human-verified.
                    </p>
                  </>
                ) : (
                  <p className="hc-sheet__body-text hc-sheet__body-text--empty">
                    No example sentence found containing this word.
                  </p>
                )}
              </div>

              <div>
                <p className="hc-sheet__section-label">Usage &amp; cultural notes</p>
                <p className="hc-sheet__body-text hc-sheet__body-text--empty">
                  No usage notes are available for this word yet.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
