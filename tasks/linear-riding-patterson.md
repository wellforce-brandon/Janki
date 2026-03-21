# Add Streak Tracking and WaniKani-style Progression Section

## Context

The progression section on item detail pages doesn't show streak data. WaniKani shows "Name/Meaning Answered Correct" with Current Streak and Longest Streak counters, plus Next Review and Unlocked Date. We need to add streak tracking and update the progression UI to match.

## Approach: Cached Columns (not derived from review log)

Add streak columns directly to `kanji_levels` and update them during each review. This is simpler and faster than deriving streaks from `kanji_review_log` queries.

## Changes

### 1. New Migration (v8) -- Add streak columns

**File: `src/lib/db/migrations.ts`**

```sql
ALTER TABLE kanji_levels ADD COLUMN meaning_current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kanji_levels ADD COLUMN meaning_max_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kanji_levels ADD COLUMN reading_current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kanji_levels ADD COLUMN reading_max_streak INTEGER NOT NULL DEFAULT 0;
```

### 2. Update streak on review completion

**File: `src/lib/db/queries/kanji.ts`** -- `updateKanjiSrsState()`

Currently this function receives `correctDelta` and `incorrectDelta` (aggregated). It needs to also receive `meaningIncorrect` and `readingIncorrect` counts to know which streaks to update.

Logic:
- If `meaningIncorrect === 0` (meaning was correct): increment `meaning_current_streak`, update `meaning_max_streak = MAX(meaning_max_streak, meaning_current_streak)`
- If `meaningIncorrect > 0`: reset `meaning_current_streak = 0`
- Same for reading (radicals skip reading)

### 3. Pass meaning/reading results through the review chain

**File: `src/lib/srs/wanikani-srs.ts`** -- `reviewKanjiItem()`

Currently calls `updateKanjiSrsState(id, newStage, nextReview, correctDelta, incorrectDelta)`. Need to also pass `meaningIncorrect` and `readingIncorrect` so the streak update knows which question types were correct.

### 4. Update ItemProgression UI

**File: `src/lib/components/kanji/detail/ItemProgression.svelte`**

Redesign to match WaniKani layout:
- **Title row:** "Your Progression" with SRS stage badge (top-right)
- **Meaning/Name Answered Correct:** Current Streak, Longest Streak, accuracy bar (0 to total count)
- **Reading Answered Correct:** (kanji/vocab only) same layout
- **Next Review:** formatted date or "Available Now"
- **Unlocked Date:** formatted date

### 5. Add streak fields to KanjiLevelItem interface

**File: `src/lib/db/queries/kanji.ts`** -- `KanjiLevelItem` interface

Add: `meaning_current_streak`, `meaning_max_streak`, `reading_current_streak`, `reading_max_streak`

## Critical Files

- `src/lib/db/migrations.ts` -- new migration v8
- `src/lib/db/queries/kanji.ts` -- updateKanjiSrsState signature, KanjiLevelItem interface
- `src/lib/srs/wanikani-srs.ts` -- pass meaning/reading incorrect through reviewKanjiItem
- `src/lib/components/kanji/detail/ItemProgression.svelte` -- UI redesign

## Verification

1. Delete DB, relaunch
2. Complete a lesson quiz for level 1 radicals
3. Check progression section shows "Current Streak: 1, Longest Streak: 1" after correct review
4. Get one wrong, verify current streak resets to 0 but longest stays
5. Verify reading streaks appear for kanji/vocab but not radicals
