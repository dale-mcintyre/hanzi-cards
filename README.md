# Learn Hanzi

Minimalist Chinese character flashcards for HSK 3 learners — dark, high-contrast,
zero clutter.

## Run it

```bash
npm install
npm run dev
```

## What's inside

- `src/App.jsx` — all app state: deck loading, session queue, SM-2 grading, gestures
- `src/App.css` — obsidian-slate visual system
- `src/data/hskData.js` — fetches + normalizes vocab from the drkameleon/complete-hsk-vocabulary
  GitHub CDN, with localStorage caching and defensive fallbacks
- `src/utils/sm2.js` — SuperMemo-2 spaced repetition (Hard/Easy two-button variant)
- `src/utils/storage.js` — localStorage read/write helpers (`hanzi_deck_progress`)
- `src/utils/tts.js` — Web Speech API (`zh-CN`) pronunciation
- `src/hooks/useSwipeGesture.js` — pointer-based swipe (left/right to grade, up for details, tap to flip)
- `src/components/HanziCanvas.jsx` — HanziWriter wrapper (animated demo + practice quiz mode)

## Note on the data sources

**Vocabulary** — I checked the actual repo layout — the file pattern in the
original spec (`hsk{level}.json`) doesn't exist. The real per-level files live at
`wordlists/{exclusive|inclusive}/new/{level}.json`, which is what the code fetches
(exclusive first, inclusive as a fallback).

**Example sentences** (`src/data/sentenceSource.js`) — the vocab dataset has no
sentences, so these come from a second source: `krmanik/Chinese-Example-Sentences`
on GitHub, 63k sentences derived from Tatoeba. That file has no per-word index, so
the app fetches it once per browser tab session, does a single pass to find the
*shortest* sentence containing each word (simplest = most useful for a learner),
and caches only that small derived `{ word: sentence }` map in localStorage —
not the ~6.5MB source file. Cards render immediately from vocab data; sentences
fill in a moment later as they resolve, so it never blocks the "instant loading"
feel.

One honest caveat, also shown in the app itself: the English side of those
sentences is machine-translated (Google Translate), not the original human
Tatoeba translations, so quality is more variable than the vocab definitions.
