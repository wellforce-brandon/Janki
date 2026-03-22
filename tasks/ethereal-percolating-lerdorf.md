# Code Review Fix Plan -- 20 Issues

## Context

A full code review identified 5 critical, 9 warning, and 8 suggestion-level issues across the Janki codebase. Two reported issues were dropped after investigation (search.ts double-escape is actually correct; dual `normalizeAnswer` is intentional separation). This plan addresses all remaining 20 issues in 5 waves, ordered to avoid stepping on toes -- each wave builds on the previous one.

**Dropped issues (no fix needed):**
- Issue #22: `highlightMatch` in search.ts -- both text and query are escaped once; no double-encoding occurs
- Issue #7: ORDER BY in language.ts -- safe due to union type constraint (comment-only)

---

## Wave 1: Infrastructure Helpers (zero behavioral change)

Creates shared utilities that later waves depend on.

### 1a. New file: `src/lib/utils/common.ts`

Extract two generic utilities currently buried in kanji-specific code:

- `safeParseJson<T>(json: string | null, fallback: T): T` -- copy from `src/lib/utils/kanji.ts:46-53`
- `fisherYatesShuffle<T>(arr: T[]): T[]` -- copy from `src/lib/utils/kanji.ts:112-119`

### 1b. Update `src/lib/utils/kanji.ts`

- Remove local bodies of `safeParseJson` (lines 46-53) and `fisherYatesShuffle` (lines 112-119)
- Import from `./common` and re-export so all existing importers keep working

### 1c. Add `sqlPlaceholders` helper to `src/lib/db/database.ts`

```ts
export function sqlPlaceholders(count: number): string {
    return Array(count).fill("?").join(",");
}
```

Place after `safeQuery` (after line 18). Used by Waves 4-5 to replace the 10+ repeated `ids.map(() => "?").join(",")` patterns.

---

## Wave 2: Critical Fixes

### 2a. `closeDb()` reset -- `src/lib/db/database.ts:32-37` (Critical #1 + #14)

**Problem:** `closeDb()` sets `db = null` but not `dbInitPromise`. Next `getDb()` returns stale resolved promise. Compounds with backup restore (backup.ts calls `closeDb()` then expects fresh DB).

**Fix:** Add `dbInitPromise = null;` after `db = null;` on line 35.

### 2b. Migration runner -- `src/lib/db/database.ts:56-59` + `src/lib/db/migrations.ts` (Warning #6)

**Problem:** `migration.up.split(";")` is fragile with FTS5, multi-line, or semicolons in string literals.

**Fix:**
- Update `Migration` type to accept `up: string | string[]`
- Convert all 11 migration `up` fields from single strings to `string[]` (one element per SQL statement)
- Update runner (lines 56-59) to use `Array.isArray(migration.up) ? migration.up : migration.up.split(";")` for backward compat

### 2c. JSON.parse safety -- `src/lib/db/queries/kanji.ts:288` (Critical #2)

**Problem:** `JSON.parse(v.component_ids)` in `checkAndUnlockLevel` -- one corrupted row kills all unlocking.

**Fix:** `import { safeParseJson } from "$lib/utils/common"` and replace with `safeParseJson<number[]>(v.component_ids, [])`.

### 2d. JSON.parse safety -- `src/lib/srs/language-unlock.ts:133,171` (Critical #3)

**Problem:** `JSON.parse(item.prerequisite_keys)` in `unlockSentences()` (line 133) and `unlockConjugations()` (line 171) -- one bad seed record blocks all unlocking.

**Fix:** `import { safeParseJson } from "$lib/utils/common"` and replace both with `safeParseJson<string[]>(item.prerequisite_keys, [])`.

### 2e. Silent unlock failure -- `src/lib/srs/wanikani-srs.ts:120-125` (Warning #12)

**Problem:** `checkAndUnlockLevel` errors silently swallowed. User could get stuck at a level.

**Fix:** Add else branch: `else { console.error("[WK-SRS] Unlock cascade failed:", unlockResult.error); }`

---

## Wave 3: Dead Code + SRS Logic

### 3a. Dead `isReadingInput` code -- `src/lib/components/language/LanguageReviewSession.svelte` (Critical #4)

**Problem:** Lines 73-76: `isReadingInput` hardcoded false, `displayValue` computed but unused, `romajiToHiragana` imported but never called.

**Fix:** Remove:
- `import { romajiToHiragana }` (line 9)
- `isReadingInput` derived (lines 73-75)
- `displayValue` derived (line 76)

### 3b. Remove stub functions -- `src/lib/db/queries/stats.ts` (Critical #5)

**Problem:** Three functions with zero callers return empty data: `getCardStateDistribution` (lines 95-98), `getStatsByDeck` (lines 128-134), `getBuiltinStateDistribution` (lines 136-139).

**Fix:** Remove all three functions and the `CardStateCount` interface (lines 90-93, only used by deleted code). Verify with grep that nothing imports them.

### 3c. `isNew` stats logic -- `src/lib/srs/language-srs.ts:93` (Warning #8)

**Problem:** `const isNew = currentStage <= 1 && item.lesson_completed_at !== null` -- every review on Apprentice 1 items counts as "new" in daily stats, including re-reviews after mistakes.

**Fix:** Change to `const isNew = item.correct_count === 0 && item.incorrect_count === 0 && item.lesson_completed_at !== null;` -- this correctly identifies first-ever review.

### 3d. Undo captures stale `next_review` -- `src/lib/components/language/LanguageReviewSession.svelte` (Suggestion #21)

**Problem:** Undo calls `updateLanguageItemSrs(..., entry.item.next_review, ...)` but `entry.item` is a reference to the queue item, not a snapshot. The `next_review` value was already overwritten by `reviewLanguageItem`.

**Fix:**
- Add `prevNextReview: string | null` to `UndoEntry` interface (line 63)
- Capture `current.next_review` in both undo entry creation blocks (lines 195-203 and 216-224) **before** calling `reviewLanguageItem` -- move undo entry creation above the review call, or capture `next_review` into a local variable before the await
- In `undoLast()` (line 271): change `entry.item.next_review` to `entry.prevNextReview`

**Important sequencing note:** The undo entries at lines 195 and 216 are created *after* `reviewLanguageItem` returns. By that point, `current.next_review` in the queue still holds the old value (the queue item isn't mutated by the DB update). However, `current` is a derived reference into `queue[currentIndex]` -- if anything re-renders and refetches, it could change. The safest fix is to capture `next_review` into a local const before the await:

```ts
const prevNextReview = current.next_review;
const result = await reviewLanguageItem(current.id, true, durationMs);
// ... then in undo entry:
prevNextReview,
```

---

## Wave 4: Naming + Code Quality

### 4a. Rename `srsStage_before` -- `src/lib/db/queries/language.ts:244` (Warning #11)

Rename to `srsStageBefore`. This is a positional parameter so no caller changes needed.

### 4b. Rename "shuffled" order key -- multiple files (Suggestion #15)

**Files:**
- `src/lib/db/queries/kanji.ts:92-95` -- change type and key from `"shuffled"` to `"due-first"`
- `src/lib/stores/app-settings.svelte.ts:3` -- update `KanjiReviewOrder` type
- `src/lib/stores/app-settings.svelte.ts:32` -- update default value
- `src/views/Settings.svelte` -- update option value and label

**Migration safety:** Users with `"shuffled"` stored in DB will get an unknown string. The `ORDER_CLAUSES` lookup returns `undefined`, which falls through to the `?? "next_review ASC"` fallback on line 100 of kanji.ts -- same behavior as before. Safe without a data migration.

### 4c. Deduplicate shuffle -- `src/lib/components/language/LanguageReviewSession.svelte` (Suggestion #16)

Remove local `shuffle<T>` function (lines 25-32). Import `fisherYatesShuffle` from `$lib/utils/common`. Update call site on line 34.

### 4d. Rename `normalizeAnswer` functions -- (Suggestion #18)

- `src/lib/utils/answer-validation.ts`: rename to `normalizeLanguageAnswer`, add re-export as `normalizeAnswer` for backward compat
- `src/lib/utils/kanji-validation.ts`: rename to `normalizeKanjiAnswer`
- Update kanji-side importers: `KanjiReviewSession.svelte`, `KanjiLessonSession.svelte`

### 4e. Replace placeholder pattern -- `src/lib/db/queries/kanji.ts`, `src/lib/db/queries/language.ts` (Suggestion #19)

Replace all `ids.map(() => "?").join(",")` with `sqlPlaceholders(ids.length)`. ~10 occurrences across both files.

### 4f. Bulk lesson completion -- `src/lib/srs/language-lessons.ts:55-58` + `src/lib/db/queries/language.ts` (Suggestion #20)

Add `markLessonsBatchCompleted(ids: number[], nextReview: string)` to `language.ts` using a single `UPDATE ... WHERE id IN (...)`. Update `language-lessons.ts` to call the batch version instead of the sequential loop.

---

## Wave 5: UI + Documentation

### 5a. System theme listener -- `src/lib/stores/app-settings.svelte.ts` (Warning #10)

**Problem:** "system" theme checked once on load, doesn't respond to OS dark mode changes at runtime.

**Fix:**
- Add module-level `let mediaQuery: MediaQueryList | null = null;`
- In `applyTheme()`: remove previous listener if any, then if theme is `"system"`, register `change` event listener that toggles `dark` class
- In `resetAllSettings()`: clean up listener

### 5b. Document `simpleFurigana` limitation -- `src/lib/utils/japanese.ts` (Warning #13)

Add comment above the function documenting the repeated-kana edge case and that a robust fix requires a morphological tokenizer.

### 5c. TODO: per-item KanjiReview saving -- `src/lib/components/kanji/KanjiReviewSession.svelte` (Warning #9)

**Deferred.** The current `processResults()` pattern is deeply intertwined with the unlock cascade and practice mode. Add a TODO comment above `processResults()` documenting the mid-session data loss risk.

### 5d. Comment: `getTileClasses` coupling -- `src/lib/utils/kanji.ts` (Suggestion #17)

Add comment noting the SRS business logic / CSS class coupling for future refactor.

### 5e. Comment: ORDER BY safety -- `src/lib/db/queries/kanji.ts` (Issue #7)

Add comment above `ORDER_CLAUSES` documenting that values are safe because keys are constrained by union type.

---

## Files Modified (summary)

| File | Waves | Type |
|------|-------|------|
| `src/lib/utils/common.ts` **(NEW)** | 1 | Extract shared utils |
| `src/lib/utils/kanji.ts` | 1, 5d | Re-export, comments |
| `src/lib/db/database.ts` | 1c, 2a, 2b | Helper, closeDb fix, migration runner |
| `src/lib/db/migrations.ts` | 2b | Convert up strings to arrays |
| `src/lib/db/queries/kanji.ts` | 2c, 4b, 4e, 5e | safeParseJson, rename, placeholders, comment |
| `src/lib/db/queries/language.ts` | 4a, 4e, 4f | Rename param, placeholders, batch func |
| `src/lib/db/queries/stats.ts` | 3b | Remove 3 stubs + interface |
| `src/lib/srs/language-unlock.ts` | 2d | safeParseJson |
| `src/lib/srs/wanikani-srs.ts` | 2e | Error logging |
| `src/lib/srs/language-srs.ts` | 3c | isNew logic fix |
| `src/lib/srs/language-lessons.ts` | 4f | Batch lesson completion |
| `src/lib/components/language/LanguageReviewSession.svelte` | 3a, 3d, 4c | Dead code, undo fix, dedup shuffle |
| `src/lib/components/kanji/KanjiReviewSession.svelte` | 4d, 5c | Rename import, TODO comment |
| `src/lib/components/kanji/KanjiLessonSession.svelte` | 4d | Rename import |
| `src/lib/stores/app-settings.svelte.ts` | 4b, 5a | Rename type, theme listener |
| `src/views/Settings.svelte` | 4b | Rename option |
| `src/lib/utils/answer-validation.ts` | 4d | Rename function |
| `src/lib/utils/kanji-validation.ts` | 4d | Rename function |
| `src/lib/utils/japanese.ts` | 5b | Documentation comment |

## Verification

1. **Build check:** `npm run build` -- must compile cleanly after each wave
2. **Tests:** `npm run test` -- existing tests must pass (answer-validation.test.ts covers normalizeAnswer)
3. **Manual testing:**
   - Backup/restore: import a backup, verify DB operations work after
   - Language review: complete a review session, verify undo works correctly
   - Kanji review: verify unlock cascade works with safeParseJson
   - Settings: toggle theme to "system", change OS dark mode, verify app follows
   - Language lessons: complete a batch, verify all items marked completed
4. **Grep verification:** After removing stubs (3b), grep for the function names to confirm zero remaining references

## Lessons Learned / Gotchas

(To be filled after implementation)
