# Code Review Fixes: 3 Critical, 7 Warnings, 9 Suggestions

## Context

Full code review of the Janki codebase identified 19 findings. After verification, Warning 5 (level-up race) is a false alarm (design is correct). The remaining 18 findings are real and should be fixed. Organized by file to minimize touches.

## Fix List

### Fix 1: `src/lib/db/seed/kanji-data.ts` (Critical 1, Warning 6, Suggestion 17)

**Critical 1 (line 208-221):** Replace manual first-review date math with `computeFirstReviewTime(1)` from `$lib/db/queries/kanji`. Import it at the top. Delete the 6 lines of manual Date manipulation.

**Warning 6 + Suggestion 17 (lines 115-205):** Wrap each insert loop (radicals, kanji, vocab) in `BEGIN`/`COMMIT`/`ROLLBACK` transactions. Same pattern as `language-data.ts` seed function. Also wrap the backfill function's insert loop (lines 284-321).

### Fix 2: `src/lib/components/kanji/KanjiLessonSession.svelte` (Critical 2)

**Lines 119-154:** Delete `getMeanings`, `getReadingsDisplay`, `getUserSynonyms` functions. Replace with imports:
- `parseJsonArray` from `$lib/utils/kanji-validation`
- Use `parseJsonArray(item.meanings)` instead of `getMeanings(item)`
- Use `{ on: parseJsonArray(item.readings_on), kun: parseJsonArray(item.readings_kun) }` for readings
- Use `parseJsonArray(item.user_synonyms)` for synonyms

### Fix 3: `src/lib/components/language/LanguageReviewSession.svelte` (Critical 3)

**Lines 235-265:** Create `undoLanguageReview()` in `$lib/srs/language-srs.ts` that:
1. Reverts SRS state via `updateLanguageItemSrs`
2. Decrements daily stats via `updateDailyStats` (negative duration)
3. Deletes the forward review log entry (add `deleteLatestLanguageReview(itemId)` to `$lib/db/queries/language.ts`)
4. Invalidates cache with `invalidateCache("contentTypeCounts")`

Add `durationMs` to the UndoEntry interface so it can be stored when the forward review happens. Update the component to call `undoLanguageReview()` instead of `updateLanguageItemSrs` directly. Remove the direct import of `updateLanguageItemSrs`.

### Fix 4: `src/lib/srs/language-unlock.ts` (Warning 4)

**Line 24:** Delete the local `KANJI_REGEX`. Export a global-flag version from `src/lib/utils/japanese.ts` (add `export const KANJI_REGEX_GLOBAL = /[\u4E00-\u9FAF]/g;`). Import and use it in language-unlock.ts.

### Fix 5: `src/lib/db/queries/stats.ts` (Warning 7)

Replace all `CASE WHEN NOT lr.correct` with `CASE WHEN lr.correct = 0` and all `CASE WHEN lr.correct` with `CASE WHEN lr.correct = 1` for explicit integer comparison. Check all occurrences in the file.

### Fix 6: `src/lib/backup/backup.ts` (Warning 8)

**Line 54:** Add `await exists(dbPath)` check before the pre-restore copy. Skip the safety backup if no DB exists yet (first launch). Import `exists` from `@tauri-apps/plugin-fs` (already imported in the file for autoBackup).

### Fix 7: `src/lib/utils/answer-validation.ts` (Warning 9)

**Lines 14-20:** Add a comment documenting the intended tolerance policy. Tighten substring threshold from 0.6 to 0.75 to reduce false acceptances. This means a user must type at least 75% of the answer length for substring matching to accept.

### Fix 8: `src/views/Stats.svelte` (Warning 10)

**Lines 301, 315, 342:** Replace inline `style="background: {color}"` with a utility function that maps color hex values to Tailwind bg classes. Create a helper `getColorClass(hex: string): string` that returns the closest Tailwind class. For the dynamic width bar (line 342), keep the `style="width: {barWidth}%"` (Tailwind can't do dynamic widths) but replace the background color with a Tailwind class.

### Fix 9: `src/lib/utils/kanji.ts` (Suggestion 11)

**Lines 18-24:** Replace `parseMeanings` implementation with `safeParseJson<string[]>(json, [json])` from `$lib/utils/common`. Keep the function name as a convenience wrapper for call sites.

### Fix 10: `src/lib/db/database.ts` (Suggestion 13)

**Lines 20-21:** Add a guard to `sqlPlaceholders`: if `count <= 0`, throw an Error. This makes the contract explicit and prevents invalid SQL.

### Fix 11: `src/lib/utils/common.ts` + two views (Suggestion 15)

Extract `formatTime(ms: number): string` to `src/lib/utils/common.ts`. Remove the duplicate from `src/views/KanjiReview.svelte` and `src/views/LanguageReview.svelte`. Import from common.

### Fix 12: `src/lib/srs/srs-common.ts` (Suggestion 14)

**Lines 37-44:** Add a comment explaining the off-by-one guard: "After zeroing minutes/seconds, the result may be in the past (top of current hour). Add 1 hour to ensure the review is always in the future."

### Fix 13: `src/lib/components/language/PitchAccentDisplay.svelte` (Suggestion 16)

**Line 22:** Add a comment above the `<style>` block explaining the exception: "Style block required: Tailwind can't target OJAD pitch table HTML injected via {@html}."

### Fix 14: `src/lib/utils/japanese.ts` (Suggestion 12)

Add unit tests for `simpleFurigana` edge cases in a new or existing test file. Test the known limitation where the same kana appears in both reading and trailing kana. Add a guard in the function to return whole-word furigana when a segment produces an empty reading.

### Fix 15: `src/lib/utils/romaji-to-hiragana.ts` (Suggestion 18)

Add a test case for `"nn"` at end of input producing `んん`. Verify and document this is correct behavior.

### Fix 16: Missing test coverage (Suggestion 19)

Add test files for:
- `src/lib/utils/kanji-validation.test.ts` -- test `getAcceptedMeanings`, `getAcceptedReadings`, `parseJsonArray`, `isKunReadingForKanji`
- `src/lib/srs/language-unlock.test.ts` -- test unlock gating logic (mock DB calls)
- `src/lib/backup/backup.test.ts` -- test backup path logic (mock Tauri FS)

These are the highest-risk untested modules.

## Files to Modify

| File | Fixes |
|------|-------|
| `src/lib/db/seed/kanji-data.ts` | 1 (Critical 1 + Warning 6 + Suggestion 17) |
| `src/lib/components/kanji/KanjiLessonSession.svelte` | 2 (Critical 2) |
| `src/lib/components/language/LanguageReviewSession.svelte` | 3 (Critical 3) |
| `src/lib/srs/language-srs.ts` | 3 (new undoLanguageReview function) |
| `src/lib/db/queries/language.ts` | 3 (new deleteLatestLanguageReview) |
| `src/lib/srs/language-unlock.ts` | 4 (remove local KANJI_REGEX) |
| `src/lib/utils/japanese.ts` | 4 (export KANJI_REGEX_GLOBAL) |
| `src/lib/db/queries/stats.ts` | 5 |
| `src/lib/backup/backup.ts` | 6 |
| `src/lib/utils/answer-validation.ts` | 7 |
| `src/views/Stats.svelte` | 8 |
| `src/lib/utils/kanji.ts` | 9 |
| `src/lib/db/database.ts` | 10 |
| `src/lib/utils/common.ts` | 11 |
| `src/views/KanjiReview.svelte` | 11 |
| `src/views/LanguageReview.svelte` | 11 |
| `src/lib/srs/srs-common.ts` | 12 |
| `src/lib/components/language/PitchAccentDisplay.svelte` | 13 |
| `src/lib/utils/japanese.ts` (tests) | 14 |
| `src/lib/utils/romaji-to-hiragana.ts` (tests) | 15 |
| New test files (3) | 16 |

## Verification

1. Run `npx vitest run` to verify all existing tests pass and new tests work
2. Launch the app (`npm run tauri dev`), complete a kanji review and undo it, complete a language review and undo it
3. Verify daily stats decrement correctly on undo
4. Verify kanji seed still works (delete DB, restart app)
5. Test backup import on a fresh install (no existing DB)
