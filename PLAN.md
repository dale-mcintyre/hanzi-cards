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

## Phase 4 — Rebrand + auth-split landing (shipped)
- Renamed "Hanzi Cards"/"Hanzi Blitz" to **Learn Hanzi** throughout (title,
  package name, docs, in-app header).
- Split the entry screen by auth state: logged-out visitors see a value-prop
  marketing page (`src/components/MarketingLanding.jsx`) explaining the
  frequency-data + HSK-milestones pitch, with a direct "Start Learning" CTA
  that still launches a real session with no sign-up required; logged-in
  visitors go straight to the existing action-first dashboard unchanged.

## Phase 5 — Growth infrastructure + correctness hardening (shipped)
- Migrated card IDs from position-based (`vocab_<index>_<char>`) to stable
  `character`-based keys, fixing progress that broke across filter changes;
  added dual-ring per-tier progress tiles (seen % / mastered %).
- **Soft-wall sign-up flow**: anonymous users get a dismissible nudge at 5
  graded cards in a visit, then every session-completion screen becomes a
  mandatory sign-in gate for the rest of that visit - a deliberate, explicit
  departure from "accounts are always optional."
- Beta-testing banner + in-app feedback drawer (`beta_feedback` table);
  About/Philosophy drawer with author credit and a Buy Me a Coffee link.
- **Real correctness fix**: cross-device progress sync was only reconciling
  once per device, ever (gated behind a permanent flag) - devices silently
  drifted apart after that. Now re-pulls and merges on every app load.
- Decomposed `App.jsx` (761 lines) into `LaunchScreen`/`StudySession`/
  `CompletionScreen`, all state/handlers staying in `App.jsx`; added Vite
  vendor chunking to resolve the bundle-size warning; wired the previously
  dead `entitlement.js` paywall check into a real (currently invisible)
  banner instead of leaving it unread; added a sync-status dot to the nav
  (green/amber-pending/offline).

## Phase 6 — Session polish + user control (shipped)
- Per-card review-history pill ("Seen N×" / "Mastered", reusing the existing
  21-day-interval mastery threshold) and a post-session recap grouping
  graded cards into nailed vs. needs-practice, tap-to-inspect a definition.
- **Offline Mode (Local Only)** toggle in Settings: a per-device opt-out of
  all sync (no pulls, no pushes, no queue flushing) until turned back off -
  verified live via network-request interception, not just code review.
- **Privacy fix**: signing out now clears locally cached progress/prefs/
  streak instead of leaving them visible to the next person on a shared
  device; also closed a latent bug where a stale sync queue could have
  flushed one account's grades onto whichever account signs in next.
- Delayed auto-pronunciation (1.5s after a card appears, unless flipped
  first) with a worded "Sound"/"Muted" toggle in the nav bar (moved off the
  study card itself after it visually collided with the existing per-card
  play button).
- Safe-area-inset fix so top-of-page content can't render underneath a
  phone's notch/collapsing address bar.

## Later / unscheduled
- **Monetization**: `entitlement.js`'s remote paywall flag is now read (Phase
  5) but nothing is actually gated yet - no pricing, no payment processor, no
  decision on what's free vs. paid.
- **Native app vs. web-first**: open question, current lean is to stay
  web-first (PWA as a middle step) given the App Store/Play Store IAP cut
  versus a paywall that doesn't exist yet, and the soft-wall funnel's
  dependence on zero-install trial.
- HSK 4-6 have no dedicated example sentences (only HSK 1-3 do); higher
  levels fall back to a general Tatoeba corpus scan.
- No automated test suite - verification is manual lint/build + live
  Playwright checks before each push.
- OAuth providers (Google, Apple) beyond email/password, if requested.
- Admin review queue for mistake reports and beta feedback (both currently
  just accumulate in Supabase tables, triaged by hand).
