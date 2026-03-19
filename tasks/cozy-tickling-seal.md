# Janki Restructure: Grouped Navigation + Kanji System Expansion

## Context

Janki has a flat sidebar with 9 peer-level items. As the kanji system expands (lessons, reviews, dashboard), this flat model won't scale. The user wants logical grouping: Decks together, Kanji together, Grammar/Reading together.

The kanji subsystem is 80% built but 0% usable -- SRS engine, due queries, unlock logic, and 60 levels of data all exist, but there's no lesson UI, no review session UI, and the unlock cascade is never triggered. This plan builds the missing pieces modeled after WaniKani's proven learning flow (lessons -> reviews -> progression), using WaniKani's API docs as design reference only (no API integration).

## Design Decisions

- **Review answer mode:** Type everything (exactly like WaniKani). English typing for meanings, **romaji-to-hiragana converter** in the input field for readings (user types "ichi", field shows "いち"). No Japanese IME needed.
- **Sidebar section name:** Grammar + Reading grouped under **"Language"**
- **Stats:** Unified Stats page with tabs/filters for Decks, Kanji, Grammar (not split into sub-pages)
- **Lesson gate:** Mandatory (like WaniKani) -- items must go through lesson flow before appearing in reviews
- **UX:** Match WaniKani exactly -- blue header with character, tabbed lesson cards, green/red answer feedback bars, batch thumbnails, user notes + synonyms

---

## Phase 1: Foundation -- Navigation Restructure

**Goal:** Transform flat nav into grouped sections. No new features, just reorganization.

### 1.1 Extend View type and add section helpers

**File:** `src/lib/stores/navigation.svelte.ts`

New View type:
```
dashboard
decks | deck-browse | deck-review | deck-stats
kanji-dashboard | kanji-map | kanji-detail | kanji-lessons | kanji-review
grammar | reading
search | stats | settings
```

Renames: `"review"` -> `"deck-review"`, `"kanji"` -> `"kanji-map"`

Add `SECTION_ROOTS` map and `navigateBack()` helper so sub-views can return to their section root without hardcoding targets.

### 1.2 Restructure Sidebar into grouped sections

**File:** `src/lib/components/layout/Sidebar.svelte`

Replace flat `navItems` array with grouped structure:
- **Dashboard** (top, no section header)
- **Decks** section: All Decks, Review
- **Kanji** section: Overview, Kanji Map, Lessons, Reviews
- **Language** section: Grammar, Reading
- **Tools** (bottom, no section header): Stats, Search, Settings

Section labels rendered as small uppercase dividers. Active state highlights both the item and checks sub-views (e.g., `deck-browse` highlights "All Decks").

### 1.3 Update App.svelte view dispatch

**File:** `src/App.svelte`

Update the if/else chain for new view names. Import stub components for new views (KanjiDashboard, KanjiLessons, KanjiReview -- empty placeholders initially). Update keyboard shortcuts.

### 1.4 Update all navigate() call sites

~10 files need `navigate("review")` -> `navigate("deck-review")` and `navigate("kanji")` -> `navigate("kanji-map")`. Must be atomic -- all renames in one commit.

**Files:** Dashboard, Review, KanjiMap, KanjiDetail, Decks, DeckBrowse, Search, ReviewSummary component, any others found by grep.

### 1.5 Stub new view files

Create minimal placeholder components for:
- `src/views/KanjiDashboard.svelte` (just heading + "coming soon")
- `src/views/KanjiLessons.svelte` (just heading + "coming soon")
- `src/views/KanjiReview.svelte` (just heading + "coming soon")

---

## Phase 2: Core -- Kanji Review Session

**Goal:** Build a working kanji review UI. Connect existing `reviewKanjiItem()` and `getDueKanjiReviews()` to a user-facing session.

### 2.1 Database migration v3

**File:** `src/lib/db/migrations.ts`

Add `kanji_review_log` table:
```sql
CREATE TABLE kanji_review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kanji_level_id INTEGER NOT NULL REFERENCES kanji_levels(id),
  correct INTEGER NOT NULL,
  srs_stage_before INTEGER NOT NULL,
  srs_stage_after INTEGER NOT NULL,
  duration_ms INTEGER,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_kanji_review_log_item ON kanji_review_log(kanji_level_id);
CREATE INDEX idx_kanji_review_log_date ON kanji_review_log(reviewed_at);
```

Add columns to `kanji_levels`:
```sql
ALTER TABLE kanji_levels ADD COLUMN lesson_completed_at TEXT;
ALTER TABLE kanji_levels ADD COLUMN user_notes TEXT;
ALTER TABLE kanji_levels ADD COLUMN user_synonyms TEXT;
```

Backfill: items with `srs_stage > 0` get `lesson_completed_at = unlocked_at` (treat existing unlocked items as already learned).

### 2.2 Kanji review log queries

**New file:** `src/lib/db/queries/kanji-reviews.ts`

- `logKanjiReview(kanjiLevelId, correct, stageBefore, stageAfter, durationMs)`
- `getTodayKanjiReviewCount()`
- `getKanjiReviewStats(days)` -- aggregate stats for charts
- `updateUserNotes(id, notes)` -- save user notes for an item
- `updateUserSynonyms(id, synonyms)` -- save user synonyms (accepted as correct answers)

### 2.3 Wire up reviewKanjiItem + unlock cascade

**File:** `src/lib/srs/wanikani-srs.ts`

After updating SRS state:
1. Log review to `kanji_review_log`
2. Call `checkAndUnlockLevel(level)` when item is promoted
3. Return newly unlocked items (if any) so the UI can show a celebration

### 2.4 Build KanjiReviewSession component

**New file:** `src/lib/components/kanji/KanjiReviewSession.svelte`

Exact WaniKani-style review flow:

**Layout:** Blue header area with character displayed large. Below: prompt label (e.g., "Radical **Name**", "Kanji **Meaning**", "Kanji **Reading**"). Text input field. Three utility buttons (retry, peek item info, audio/TTS).

**Per item:**
1. Show character on blue background
2. **Meaning question** -- prompt: "Radical Name" / "Kanji Meaning" / "Vocabulary Meaning". Text input, user types English. Match against meanings array (case-insensitive, trimmed). Shake animation on close-but-wrong. Green bar on correct, red bar on incorrect with correct answer shown.
3. **Reading question** (kanji + vocab only, not radicals) -- prompt: "Kanji Reading" / "Vocabulary Reading". Text input with **romaji-to-hiragana converter** (user types "ichi", field auto-converts to "いち"). Match against readings_on/readings_kun arrays.
4. Item is correct only if ALL questions for that item are answered correctly.
5. Call `reviewKanjiItem()` with result, track duration per item.
6. Review counter in top-right decrements as items complete.

**New utility:** `src/lib/utils/romaji-to-hiragana.ts` (~60 lines) -- converts romaji input to hiragana in real-time. Maps standard romaji syllables (ka->か, shi->し, tsu->つ, etc.) including double consonants (kk->っk) and n-before-consonant (n+consonant->ん).

**End of session:** Summary screen -- items reviewed, accuracy %, items leveled up, newly unlocked items (if checkAndUnlockLevel triggered).

### 2.5 Build KanjiReview view (replace stub)

**File:** `src/views/KanjiReview.svelte`

- Load due count on mount via `getDueKanjiReviews()`
- Gate: only show items where `lesson_completed_at IS NOT NULL`
- "Start Reviews (N)" button -> renders KanjiReviewSession
- "All caught up" empty state when nothing is due
- Toast on session completion

---

## Phase 3: Core -- Kanji Lessons + Dashboard

**Goal:** Build the lesson teaching flow and kanji overview dashboard.

### 3.1 Lesson queries

**File:** `src/lib/db/queries/kanji.ts` (extend)

- `getAvailableLessons(limit)` -- items where `srs_stage >= 1 AND lesson_completed_at IS NULL`, ordered by level, then item_type (radicals -> kanji -> vocab)
- `getAvailableLessonCount()`
- `markLessonCompleted(ids)` -- set `lesson_completed_at = datetime('now')`, `next_review = datetime('now', '+4 hours')`

Update `getDueKanjiReviews()` to filter: `lesson_completed_at IS NOT NULL`

### 3.2 Build KanjiLessonSession component

**New file:** `src/lib/components/kanji/KanjiLessonSession.svelte`

Exact WaniKani-style lesson flow in batches of 5:

**Teaching phase (per item):**
- Blue header with character displayed large + meaning below
- Tabbed content area:
  - **Name/Meaning tab**: Mnemonic text, character/stroke image, "Name Notes" (user can add), "User Synonyms" (user can add)
  - **Examples tab** (radicals): Shows kanji that use this radical with colored badges
  - **Reading tab** (kanji only): Reading mnemonic, on'yomi/kun'yomi display
- Bottom bar: 5-item batch thumbnails showing progress through the batch
- Left/right arrows or click thumbnails to navigate between items
- **"Quiz →"** button (always visible) transitions to quiz phase

**Quiz phase:**
- Same UI as review: character on blue bg, prompt label, text input
- Type meaning for all items, type reading (romaji->hiragana) for kanji/vocab
- Must get all 5 correct. Incorrect items shuffle back into the queue.
- On completion: call `markLessonCompleted()` for the batch.

**New DB columns for user personalization:**
- Add `user_notes TEXT` and `user_synonyms TEXT` (JSON array) to `kanji_levels` table in migration v3. User synonyms are accepted as correct answers during review.

### 3.3 Build KanjiLessons view (replace stub)

**File:** `src/views/KanjiLessons.svelte`

- Show available lesson count
- "Start Lessons (N)" button loads batch of 5
- Renders KanjiLessonSession
- Completion message with option to start another batch

### 3.4 Build KanjiDashboard view (replace stub)

**File:** `src/views/KanjiDashboard.svelte`

Modeled after WaniKani's dashboard widget layout:

**Row 1: Core Actions**
- **Lessons widget** (pink accent) -- "Today's Lessons [N]", "Start Lessons" button, "Advanced" link to lesson picker
- **Reviews widget** (blue accent) -- "Reviews [N]", "Start Reviews" button (or "No reviews" message)
- **Forecast widget** -- "Next 24 Hours: +N Items", bar chart of upcoming reviews by hour

**Row 2: Progress**
- **Level Progress** -- "Level N", breakdown by type (Radicals: X/Y guru'd, Kanji: X/Y, Vocabulary: X/Y), "Guru N more kanji to level up" message, visual progress bar
- **Item Spread** -- SRS stage breakdown table (rows: Apprentice/Guru/Master/Enlightened/Burned, columns: Radicals/Kanji/Vocabulary/Total)

**Row 3: History**
- **Recently Unlocked** -- items unlocked recently
- **Critical Condition Items** -- items with low accuracy (high incorrect_count relative to correct_count)
- **Recent Mistakes** -- items answered incorrectly in recent reviews

**Queries needed:**
- `getUpcomingReviews(hours)` -- group due items by hour buckets for forecast
- `getSrsDistribution()` -- count items per stage per type
- `getCriticalItems(threshold)` -- items with accuracy below threshold
- `getRecentMistakes(limit)` -- recent incorrect reviews from kanji_review_log

### 3.5 Update main Dashboard with grouped sections

**File:** `src/views/Dashboard.svelte`

Reorganize into three visual sections:
- **Decks**: cards due, total cards, "Start Review" CTA
- **Kanji**: lessons available, reviews due, current level, "Go to Kanji" CTA
- **Language**: grammar/reading practice links

### 3.6 Initialize kanji progression for new users

Add `initializeKanjiProgression()`:
- Check if any items have `srs_stage > 0`
- If not, unlock all level 1 radicals (srs_stage=1, next_review=now)
- Called from KanjiDashboard on mount or via "Start Learning Kanji" button on empty state

---

## Phase 4: Polish + Ship

### 4.1 Extra Study modes

**New file:** `src/views/KanjiExtraStudy.svelte`

Three practice modes (like WaniKani):
- **Recent Lessons** -- re-quiz items from recent lesson batches
- **Recent Mistakes** -- re-quiz items answered incorrectly recently
- **Burned Items** -- review permanently learned items (no SRS impact)

These use the same KanjiReviewSession component but don't call `reviewKanjiItem()` (no SRS stage changes).

### 4.2 Lesson Picker (Advanced)

**New file:** `src/views/KanjiLessonPicker.svelte`

Advanced lesson selection:
- Grid of available lesson items grouped by level, then type
- Click to toggle selection (blue = selected)
- "Select All" per level and per type
- "Batch, Please" button auto-selects based on batch size setting
- "Interleave Lessons" checkbox to mix types
- Starts lesson session with selected items

### 4.3 Level Detail view

**New file:** `src/views/KanjiLevelDetail.svelte`

Replaces current KanjiMap's expand-level behavior with a full page (like WaniKani's `/level/N`):
- Header: "Level N -- Radicals, Kanji, & Vocabulary"
- Legend: Locked / In Lessons / In Reviews / Burned status indicators
- Filter tabs: All | Radicals | Kanji | Vocabulary
- Grid of item tiles color-coded by type (blue/pink/purple) with status indicators
- Click tile -> navigates to KanjiDetail

### 4.4 WaniKani-style kanji settings

Add to existing Settings.svelte under a "Kanji" section:
- **Preferred lesson batch size** -- dropdown (default: 5)
- **Maximum daily lessons** -- input (default: 15)
- **Review ordering** -- dropdown (Shuffled / Apprentice First / Lower SRS Stages First / Lower Levels First)
- **SRS update indicator** -- show stage change after each review item (Yes/No)
- **Autoplay audio in lessons/reviews** -- Yes/No

New settings keys in `app-settings.svelte.ts`:
- `kanjiBatchSize`, `kanjiMaxDailyLessons`, `kanjiReviewOrder`, `kanjiShowSrsIndicator`, `kanjiAutoplayAudio`

### 4.5 Kanji stats in Stats page
Add kanji review charts to `src/views/Stats.svelte` using `kanji_review_log` data:
- Kanji reviews per day chart
- Accuracy trend
- Level progression timeline
- SRS stage flow (items moving between stages over time)

### 4.6 Keyboard shortcuts update
Remap Ctrl+1-7 to match new navigation structure in App.svelte.

### 4.7 Toast feedback + level-up celebration
Toast messages for lesson completion, review completion, item unlocks.
Special celebration modal/animation when user levels up (all required kanji at Guru).

### 4.8 Accessibility
aria-labels on all new interactive elements, keyboard navigation in lesson/review sessions.

---

## Critical Files

| File | Changes |
|------|---------|
| `src/lib/stores/navigation.svelte.ts` | New View types, section roots, navigateBack() |
| `src/lib/components/layout/Sidebar.svelte` | Grouped section rendering |
| `src/App.svelte` | View dispatch, keyboard shortcuts, new imports |
| `src/lib/db/migrations.ts` | Migration v3: kanji_review_log, lesson_completed_at |
| `src/lib/db/queries/kanji.ts` | Lesson queries, updated review query |
| `src/lib/db/queries/kanji-reviews.ts` | NEW: review log queries |
| `src/lib/srs/wanikani-srs.ts` | Wire up review logging + unlock cascade |
| `src/views/KanjiDashboard.svelte` | NEW: kanji overview page |
| `src/views/KanjiLessons.svelte` | NEW: lesson session wrapper |
| `src/views/KanjiReview.svelte` | NEW: review session wrapper |
| `src/lib/components/kanji/KanjiReviewSession.svelte` | NEW: review quiz UI |
| `src/lib/components/kanji/KanjiLessonSession.svelte` | NEW: lesson teaching UI |
| `src/lib/utils/romaji-to-hiragana.ts` | NEW: romaji input converter for reading answers |
| `src/views/Dashboard.svelte` | Grouped sections |
| `src/views/KanjiExtraStudy.svelte` | NEW: extra study modes (Phase 4) |
| `src/views/KanjiLessonPicker.svelte` | NEW: advanced lesson selection (Phase 4) |
| `src/views/KanjiLevelDetail.svelte` | NEW: full level detail page (Phase 4) |
| `src/lib/stores/app-settings.svelte.ts` | Add kanji-specific settings |
| ~10 existing views | navigate() call renames |

## WaniKani Reference Data

Full site crawl available at `C:\Github\tech-assistant\site-crawl\wanikani\`. Load with `/add-dir` in future sessions. Key files:
- `SITE-MAP.md` -- complete page catalog, SRS stages, navigation structure
- `pages/01-dashboard.md` -- dashboard widget layout (the UX target for KanjiDashboard)
- `pages/07-settings-app.md` -- lesson/review/audio settings (the UX target for kanji settings)
- `screenshots/README.md` -- descriptions of all captured screenshots

## Reuse Existing

- `reviewKanjiItem()` from `src/lib/srs/wanikani-srs.ts` -- already handles stage progression
- `getDueKanjiReviews()` from `src/lib/db/queries/kanji.ts` -- fetches due items
- `checkAndUnlockLevel()` from `src/lib/db/queries/kanji.ts` -- cascading unlock logic
- `LevelProgressBar`, `SrsStageIndicator`, `StrokeOrder` components -- reuse in dashboard/lessons
- `LoadingState`, `EmptyState` from Phase 1-4 UX polish -- all new views use these
- `addToast()` from `src/lib/stores/toast.svelte` -- feedback on all actions

## Risks

1. **Navigation rename blast radius** -- ~10 files touched atomically. Grep all `navigate(` calls before committing.
2. **Lesson gate on reviews** -- Adding `lesson_completed_at IS NOT NULL` filter means existing unlocked items need backfill migration or they vanish from reviews.
3. **Romaji-to-hiragana edge cases** -- Double consonants (っ), n before vowels vs consonants (ん vs な), long vowels. Needs thorough test coverage.
4. **KanjiReviewSession vs ReviewSession** -- Different UX patterns (WaniKani typing vs FSRS flip-card). Do NOT try to share components.
5. **checkAndUnlockLevel cascade** -- Could unlock many items at once. Run async, show celebratory toast with count.

## Verification

After each phase:
1. `pnpm test` -- all tests pass
2. `pnpm lint` -- no errors
3. `pnpm build` -- Vite build succeeds
4. Manual smoke test via `pnpm tauri dev` (use PowerShell with Cargo PATH):
   - Phase 1: All sidebar sections render, all existing navigation still works, no broken links
   - Phase 2: Kanji review session loads due items, multi-choice works, SRS stage updates in DB, unlock cascade triggers
   - Phase 3: Lesson flow teaches batch of 5, quiz works, items appear in review queue after lesson, KanjiDashboard shows correct counts
   - Phase 4: Stats show kanji data, shortcuts work, toasts fire
