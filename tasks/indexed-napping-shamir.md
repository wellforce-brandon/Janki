# WaniKani Kanji System Parity Review

## Context

Janki v0.8.1.0 has a WaniKani-style kanji system that was built from documentation and general knowledge. A direct comparison against WaniKani's API (SRS system endpoint, subject data, knowledge base) reveals 10 mechanical discrepancies. This plan fixes the algorithmic/behavioral gaps so Janki's kanji system matches WK 1-to-1, using the WK API for verification only (not importing WK content).

## Discrepancy Summary

| # | Area | Severity | Janki | WaniKani |
|---|------|----------|-------|----------|
| 1 | SRS intervals | Medium | Stages 3-8 off by 1 hour each | 23h, 47h, 167h, 335h, 719h, 2879h |
| 2 | Drop formula | **Critical** | Fixed drop (stage-1 or stage-2) | `stage - ceil(wrongCount/2) * penaltyFactor` |
| 3 | Accelerated SRS | Medium | None | Halved intervals for levels 1-2 stages 1-4 |
| 4 | Reading validation | **Critical** | Accepts on+kun for kanji | Only on'yomi accepted; kun'yomi triggers shake |
| 5 | `!` prefix filtering | **Critical** | 1,821 non-accepted readings stored with `!` but never filtered | `!` prefix = not accepted in reviews |
| 6 | Incorrect count tracking | High | Boolean correct/incorrect per item | Counts total wrongs per item per session |
| 7 | Level-up calculation | High | MAX(level) WHERE unlocked | Lowest level where <90% kanji at Guru |
| 8 | Level progress display | Medium | Counts all item types | Only kanji count for level-up % |
| 9 | Next-level unlock | Medium | Missing | 90% kanji Guru -> unlock next level radicals |
| 10 | Review hour rounding | Low | Exact time scheduling | Rounds up to top of next hour |

Data gaps (documented, not fixed here): 68 missing kanji vs WK's 2094, 25 missing radicals vs WK's 503, 0 vocab vs WK's 6762.

---

## Phase 1: Core SRS Engine Fixes

All changes in `src/lib/srs/wanikani-srs.ts` and `src/lib/srs/wanikani-srs.test.ts`.

### 1.1 Fix SRS intervals

Update `STAGE_INTERVALS_HOURS` to match WK's exact seconds-to-hours values:

```
Stage 1: 4     (14400s)   -- unchanged
Stage 2: 8     (28800s)   -- unchanged
Stage 3: 23    (82800s)   -- was 24
Stage 4: 47    (169200s)  -- was 48
Stage 5: 167   (601200s)  -- was 168
Stage 6: 335   (1206000s) -- was 336
Stage 7: 719   (2588400s) -- was 720
Stage 8: 2879  (10364400s) -- was 2880
```

### 1.2 Add accelerated intervals for levels 1-2

New constant `ACCELERATED_INTERVALS_HOURS`:
```
Stage 1: 2, Stage 2: 4, Stage 3: 8, Stage 4: 23
Stages 5-8: same as normal
```

Update `calculateNextReview(stage)` -> `calculateNextReview(stage, level)` to use accelerated table when `level <= 2`.

### 1.3 Fix drop formula

Replace `calculateDrop(currentStage)` with the real WK formula:

```typescript
function calculateDrop(currentStage: number, incorrectCount: number): number {
  const penaltyFactor = currentStage >= 5 ? 2 : 1;
  const adjustment = Math.ceil(incorrectCount / 2) * penaltyFactor;
  return Math.max(1, currentStage - adjustment);
}
```

Update `reviewKanjiItem` signature: add `incorrectCount` parameter (default 1 for backward compat).

### 1.4 Round review times to top of hour

After computing `now + interval`, round up to next hour boundary:
```typescript
next.setMinutes(0, 0, 0);
if (next.getTime() <= Date.now()) {
  next.setTime(next.getTime() + 3600000);
}
```

### 1.5 Update tests

- Test corrected intervals (23h, 47h, etc.)
- Test drop formula: stage 8 + 3 wrong = stage 4, stage 3 + 1 wrong = stage 2, stage 1 + 5 wrong = stage 1
- Test accelerated intervals for level 1 items
- Test hour rounding behavior

**Files:** `src/lib/srs/wanikani-srs.ts`, `src/lib/srs/wanikani-srs.test.ts`

---

## Phase 2: Answer Validation Fixes

### 2.1 Filter `!` prefix readings

In `KanjiReviewSession.svelte` and `KanjiLessonSession.svelte`, update `getAcceptedReadings()`:
- Filter out readings starting with `!` from on/kun arrays
- The `!` prefix is already in the database from seeding (1,821 readings affected)

### 2.2 Kanji on'yomi-only validation with shake

For kanji items (not vocab, not radical), only on'yomi readings are accepted in reviews. When user enters a valid kun'yomi:
1. Do NOT mark incorrect
2. Shake input field (reuse existing shake animation)
3. Show message: "We're looking for the on'yomi reading"
4. Let user retry

Implementation: add `isKunReadingForKanji(item, answer)` check before the main validation logic.

### 2.3 Extract shared validation utility

Create `src/lib/utils/kanji-validation.ts` with:
- `getAcceptedMeanings(item): string[]` -- all meanings + user_synonyms
- `getAcceptedReadings(item): string[]` -- filtered by item_type and `!` prefix
- `getAllReadings(item): string[]` -- for display in lessons (includes non-accepted)
- `isKunReadingForKanji(item, answer): boolean` -- for shake behavior

Both `KanjiReviewSession.svelte` and `KanjiLessonSession.svelte` import from this shared utility.

**Files:** `src/lib/utils/kanji-validation.ts` (new), `src/lib/components/kanji/KanjiReviewSession.svelte`, `src/lib/components/kanji/KanjiLessonSession.svelte`

---

## Phase 3: Incorrect Count Tracking in Reviews

### 3.1 Track per-item incorrect counts

In `KanjiReviewSession.svelte`, change `ItemResult` type:

```typescript
type ItemResult = {
  meaningIncorrectCount: number;
  readingIncorrectCount: number;
  startTime: number;
};
```

Increment the relevant counter each time an answer is wrong. Total `incorrectCount = meaningIncorrectCount + readingIncorrectCount`.

### 3.2 Re-queue wrong items

WK behavior: when you get a question wrong, it goes back into the queue at a random later position. Both meaning and reading must be answered correctly for the item to be "done".

Current behavior already re-queues on incorrect (the code adds failed questions back near end of queue). Verify this matches WK and adjust position randomization if needed.

### 3.3 Pass incorrect count to SRS engine

In `processResults()`, when calling `reviewKanjiItem`:
- If `incorrectCount === 0`: `correct = true`, stage goes UP
- If `incorrectCount > 0`: `correct = false`, pass `incorrectCount` to determine drop depth

### 3.4 Enrich review log (migration v4)

Add to `kanji_review_log`:
```sql
ALTER TABLE kanji_review_log ADD COLUMN meaning_incorrect INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kanji_review_log ADD COLUMN reading_incorrect INTEGER NOT NULL DEFAULT 0;
```

Update `logKanjiReview` in `src/lib/db/queries/kanji-reviews.ts` to accept and store these counts.

**Files:** `src/lib/components/kanji/KanjiReviewSession.svelte`, `src/lib/srs/wanikani-srs.ts`, `src/lib/db/migrations.ts`, `src/lib/db/queries/kanji-reviews.ts`

---

## Phase 4: Level-Up Mechanics

### 4.1 Fix getUserLevel

Current: `MAX(level) WHERE srs_stage > 0` -- wrong.

WK: Your level = lowest level where you haven't guru'd 90% of kanji.

```sql
SELECT COALESCE(
  (SELECT MIN(level) FROM (
    SELECT level,
      COUNT(*) as total,
      COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru
    FROM kanji_levels
    WHERE item_type = 'kanji'
    GROUP BY level
  ) WHERE total > 0 AND (guru * 1.0 / total) < 0.9),
  60
) as current_level
```

### 4.2 Fix level progress to count kanji only

`getLevelProgress` currently counts all item types. Add a kanji-only variant or modify the existing query to return both:
- `total_items` / `guru_items` (all types, for display)
- `total_kanji` / `guru_kanji` (kanji only, for level-up calculation)

### 4.3 Unlock next-level radicals

In `checkAndUnlockLevel`, after detecting 90%+ kanji at Guru:
1. Unlock vocab for current level (existing)
2. **Also unlock radicals for `level + 1`** (new -- this is what triggers level progression in WK)

### 4.4 Update dashboard text

Change "Guru X more items to progress" to "Guru X more kanji to level up" using kanji-only counts.

**Files:** `src/lib/db/queries/kanji.ts`, `src/views/KanjiDashboard.svelte`

---

## Phase 5: Lesson Hour Rounding

### 5.1 Fix markLessonCompleted timing

`markLessonCompleted` in `kanji.ts` currently sets `next_review = datetime('now', '+4 hours')`. This should:
1. Use the accelerated interval if level <= 2 (2h instead of 4h)
2. Round to top of hour

Compute the rounded time in JS and pass as a parameter instead of using SQLite datetime arithmetic.

**Files:** `src/lib/db/queries/kanji.ts`

---

## Files Modified (summary)

| File | Phases |
|------|--------|
| `src/lib/srs/wanikani-srs.ts` | 1, 3 |
| `src/lib/srs/wanikani-srs.test.ts` | 1 |
| `src/lib/utils/kanji-validation.ts` (new) | 2 |
| `src/lib/components/kanji/KanjiReviewSession.svelte` | 2, 3 |
| `src/lib/components/kanji/KanjiLessonSession.svelte` | 2 |
| `src/lib/db/queries/kanji.ts` | 4, 5 |
| `src/lib/db/queries/kanji-reviews.ts` | 3 |
| `src/lib/db/migrations.ts` | 3 |
| `src/views/KanjiDashboard.svelte` | 4 |

---

## Verification

1. **Tests:** `npx vitest run` -- all pass including new SRS formula tests
2. **Lint:** `npx biome check src/`
3. **Manual verification against WK API:**
   - Stage 8 item + 3 wrong = drops to stage 4 (not 6)
   - Level 1 items get 2h first review interval (accelerated)
   - Typing kun'yomi for kanji reading -> shake, not wrong
   - Level-up requires 90% kanji at Guru (not 90% all items)
4. **Smoke test:** `pnpm tauri dev`
   - Complete a review session -- verify re-queuing of wrong items
   - Check that readings with `!` prefix are not accepted
   - Verify level display uses kanji-only calculation

## Scope Exclusions

- **Vocabulary data**: WK has 6,762 vocab items. Adding vocab is a separate feature, not a mechanical fix.
- **Auxiliary meanings**: kanji-data.json lacks WK's whitelist/blacklist data. Cannot implement "not quite right" messages.
- **Meaning/reading hints**: Not in data source.
- **Radical images**: WK custom radicals need image assets. Separate effort.
- **Missing kanji/radicals**: 68 kanji and 25 radicals missing from data source vs WK. Data source limitation.
