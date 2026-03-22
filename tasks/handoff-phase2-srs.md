# Handoff: Phase 2 -- SRS Engine + Unlock System

## Status
Phase 1 (Schema + Seeding + Dead Code) is COMPLETE. Commit `1495e06`.
Next: Phase 2 -- SRS engine, unlock system, lessons, and query layer additions.

## What Phase 1 Delivered
- Migration v10: `language_items` table (30+ columns) + `language_review_log` table with indexes
- Runtime seeder loads 33k+ items from pre-built JSON (`public/data/language/*.json`) on first launch
- Query layer rewritten in `src/lib/db/queries/language.ts` for the new schema
- All Language views updated, 25+ dead files deleted, build passes clean

## Current State of the Codebase
- **language_items**: 33k+ rows across 5 content types, all at `srs_stage = 0` (locked)
- **language_review_log**: empty (no reviews yet)
- **Language Review view**: stubbed -- shows counts but says "SRS review engine coming in Phase 2"
- **No lesson system** exists yet
- **No unlock logic** exists yet -- all items locked at stage 0
- **Kanji section**: fully working, untouched by Phase 1

## Key Files to Read First
- `src/lib/srs/wanikani-srs.ts` -- THE pattern to follow. Has stage definitions, intervals, review logic, drop formula
- `src/lib/db/queries/language.ts` -- current query layer (already has `getLanguageItems`, `getDueLanguageItems`, `getNewLanguageItems`, `updateLanguageItemSrs`, `logLanguageReview`)
- `src/lib/db/migrations.ts` -- schema (language_items columns, SRS fields)
- `tasks/shimmying-pondering-sketch.md` lines 175-217 -- Phase 2 design spec

## Phase 2 Tasks

### 2.1 Language SRS Engine
Create `src/lib/srs/language-srs.ts`:
- Reuse stage definitions and intervals from `wanikani-srs.ts` (same Apprentice 1-4, Guru 1-2, Master, Enlightened, Burned)
- Same interval table (4h, 8h, 1d, 2d, 1w, 2w, 1mo, 4mo)
- Correct: stage += 1 (cap at 9/Burned)
- Incorrect: stage drops by `ceil(incorrectCount/2) * penalty` (penalty=2 for Guru+)
- Single review dimension (not meaning+reading split like kanji)
- Export `reviewLanguageItem(itemId, correct, durationMs)` that:
  1. Reads current item state
  2. Calculates new stage + next_review
  3. Updates language_items via `updateLanguageItemSrs()`
  4. Logs to language_review_log via `logLanguageReview()`
  5. Updates daily_stats

### 2.2 Unlock System
Create `src/lib/srs/language-unlock.ts`:
- **Kana**: unlock immediately on seed (set srs_stage = 1, unlocked_at = now, next_review = 2h from now) -- same pattern as kanji level 1 radicals
- **Vocabulary**: unlock when ALL kanji in `primary_text` are Guru+ (srs_stage >= 5) in `kanji_levels`. Kana-only words unlock immediately.
- **Grammar**: N5 items unlock first (sequential by frequency_rank within level). Higher levels gate behind majority of previous level being Guru+.
- **Sentences**: unlock when prerequisite grammar pattern is Guru+
- **Conjugation**: unlock when base verb is Apprentice 4+ (srs_stage >= 4)
- **JLPT gating**: N4+ content gated behind >80% of N(level-1) items being Guru+
- Populate `prerequisite_keys` column during unlock check (or at seed time)
- Export `checkAndUnlockItems()` that runs after each review session

### 2.3 Lesson System
Create `src/lib/srs/language-lessons.ts`:
- Available lessons = items where `srs_stage = 0` AND prerequisites met (unlocked)
- Actually, unlocked items have `srs_stage = 1` and `unlocked_at` set. Lessons are items that are unlocked (`srs_stage >= 1`) but `lesson_completed_at IS NULL`.
- Wait -- re-read the kanji pattern. In kanji, srs_stage 1 means unlocked + lesson not yet done. After lesson, stays at 1 but gets `lesson_completed_at` set and `next_review` scheduled.
- Follow same pattern: `getAvailableLessons(type?, limit=5)` returns unlocked items with no `lesson_completed_at`
- After lesson batch: set `lesson_completed_at = now`, schedule `next_review` at Apprentice 1 interval (4h, rounded to top of hour)
- Batch size: 5 items (matching WK)

### 2.4 Query Layer Additions
Add to `src/lib/db/queries/language.ts`:
- `getAvailableLessons(type?, limit)` -- srs_stage >= 1, lesson_completed_at IS NULL
- `getLanguageSrsSummary()` -- counts by content_type and srs_stage (for overview)
- `markLessonCompleted(id, nextReview)` -- sets lesson_completed_at and next_review
- `getLanguageItemsByKanji(character)` -- cross-reference: find vocab containing a kanji

### 2.5 Wire Into App
- Update `src/views/LanguageReview.svelte` to use the real SRS engine instead of the stub
- Call `checkAndUnlockItems()` after kanji reviews too (vocab unlocks depend on kanji progress)
- Call `checkAndUnlockItems()` on app startup (catch up on unlocks from kanji progress made offline)

## SRS Stage Reference (from wanikani-srs.ts)
| Stage | Name | Interval |
|-------|------|----------|
| 0 | Locked | -- |
| 1 | Apprentice 1 | 4 hours |
| 2 | Apprentice 2 | 8 hours |
| 3 | Apprentice 3 | 1 day |
| 4 | Apprentice 4 | 2 days |
| 5 | Guru 1 | 1 week |
| 6 | Guru 2 | 2 weeks |
| 7 | Master | 1 month |
| 8 | Enlightened | 4 months |
| 9 | Burned | -- (done) |

## After This Session
- Phase 3: UI rebuild (views rewritten for WK-style experience, lesson picker, review session)
- Phase 4: Polish (FTS5 search, stats page, performance)

## Lessons Learned from Phase 1
- When deleting modules, trace the FULL import chain before removing anything. The blast radius extends 2-3 levels deep.
- Tauri plugin-sql `execute().lastInsertId` is typed `number | undefined` -- use `?? 0` fallback.
- A dead import in App.svelte crashes the entire app, not just that route.
