# Learn Hanzi — Roadmap

Informal phase tracking, reconstructed from commit history + ongoing work. Not
exhaustive — a summary of what shipped in each phase, for context in future
sessions.

## Phase 1 — Core flashcard experience
Tianzige grid rendering, pinyin tone-color coding, SM-2 spaced repetition,
swipe gestures, HanziWriter stroke practice, dark theme, HSK 1-6 dataset
wired in directly.

## Phase 2 — Content quality + session design
1-to-1 HSK 1-3 example-sentence dictionaries, frequency-ranked deck sorting,
streak tracking, session gateway (Quick Review / Fix Weak Spots / Unseen
Words), XP/combo session loop, mastery dashboard, multiple-choice + hard-mode
confusable cards, unified vocab dataset rebuilt from scratch with an
LLM-audited definition pipeline (`build-vocab.py`).

## Phase 3 — Accounts + cross-device sync (shipped)
- **Report-a-mistake flag**: lets a learner flag a vocab entry (wrong pinyin/
  definition/reading) directly from the card. Reports are tied to the signed-in
  user and stored in Supabase so they're reviewable later, instead of vanishing
  into a local-only console log.
- **Login + cross-device progress sync**: accounts via Supabase Auth
  (email/password to start). SM-2 progress, streaks, and mastery stats currently
  live only in `localStorage` (`src/utils/storage.js`) — Phase 3 adds a Postgres
  backing store behind the same interface, syncing on login and merging
  anonymous local progress into the account the first time someone signs in on
  a device that already has data.
- Backend: Supabase (managed Postgres + Auth + row-level security), chosen for
  the free tier and minimal setup versus a hand-rolled backend.

## Phase 4 — Rebrand + auth-split landing (in progress)
- Renamed "Hanzi Cards"/"Hanzi Blitz" to **Learn Hanzi** throughout (title,
  package name, docs, in-app header).
- Split the entry screen by auth state: logged-out visitors see a value-prop
  marketing page (`src/components/MarketingLanding.jsx`) explaining the
  frequency-data + HSK-milestones pitch, with a direct "Start Learning" CTA
  that still launches a real session with no sign-up required; logged-in
  visitors go straight to the existing action-first dashboard unchanged.

## Later / unscheduled
- OAuth providers (Google, Apple) beyond email/password, if requested.
- Admin review queue for mistake reports.
