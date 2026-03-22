# Code Review Round 2 -- Fix All Findings

## Context

Second code review after fixing 27 findings from round 1. This round found 4 critical, 11 warning, and 9 suggestion-level issues. This plan addresses all of them.

## Critical Fixes (4)

### C1. ReviewSession isProcessing race condition
**File:** `src/lib/components/language/LanguageReviewSession.svelte:139-213`
**Problem:** `isProcessing` is set false in both the `finally` block (line 198) AND in `advanceToNext()` (line 213). On the correct path, `submitAnswer` completes, `finally` sets `isProcessing = false`, then 1200ms later `advanceToNext` sets it false again (harmless double-set). But on the incorrect path, user presses Enter to dismiss, `dismissIncorrect` -> `advanceToNext` sets `isProcessing = false` while the `finally` from the original `submitAnswer` has already run. The real risk: if `reviewLanguageItem` is slow and the user dismisses the incorrect feedback before the await resolves, `advanceToNext` runs while the DB write is still in flight.
**Fix:** Remove `isProcessing = false` from `advanceToNext()`. The `finally` block in `submitAnswer` is the single source of truth. For the correct path where `advanceToNext` runs via setTimeout after `submitAnswer` has already completed (and `finally` already ran), `isProcessing` is already false -- removing the redundant reset is safe.

### C2. LessonSession quiz completion logic
**File:** `src/lib/components/language/LanguageLessonSession.svelte:186-209`
**Problem:** When a quiz answer is wrong (line 182-189), the failed question is spliced out of its current position and appended at the end of `quizQueue`. The queue length stays the same. `dismissIncorrect` does NOT increment `quizIndex`, so the user continues to the next item at the same index. The re-queued item appears later. After reviewing, the actual flow is: the re-queued item must be answered correctly before `quizIndex` can reach `quizQueue.length`. The `completeLesson` guard (`isCompleting`) also prevents double-invocation.

However, there IS a subtle bug: `dismissIncorrect` (line 202-209) checks `quizIndex >= quizQueue.length` without incrementing first. Since the wrong answer was spliced out and re-appended, the queue shifted but `quizIndex` didn't move. If the failed item was the LAST item in the queue, after splice: `quizQueue` still has the same length (item removed from end, re-appended at end -- net zero). `quizIndex` is at the last position. `dismissIncorrect` checks `quizIndex >= quizQueue.length` -- this is false because `quizIndex` equals `quizQueue.length - 1`. So the user gets the re-queued item. This is actually correct.

**Actual fix needed:** The quiz completion condition should be more explicit. Replace `quizIndex >= quizQueue.length` with `quizQueue.every((q) => q.answered && q.correct)` in both `advanceQuiz` and `dismissIncorrect`. This makes the intent clear and prevents edge cases where queue manipulation could cause premature completion.

### C3. DB init promise never cleared on error
**File:** `src/lib/db/database.ts:24-34`
**Problem:** If `Database.load()` or `runMigrations()` throws, `dbInitPromise` stores the rejected promise. All subsequent `getDb()` calls return this rejected promise, permanently breaking the app.
**Fix:** Wrap the async IIFE in a `.catch` that clears `dbInitPromise` before rethrowing:
```typescript
dbInitPromise = (async () => {
    const instance = await Database.load("sqlite:janki.db");
    await runMigrations(instance);
    db = instance;
    return instance;
})().catch((e) => {
    dbInitPromise = null;
    throw e;
});
```

### C4. Seed totalInserted counter wrong on rollback
**File:** `src/lib/db/seed/language-data.ts:165-179`
**Problem:** `totalInserted += batch.length` at line 173 is inside the loop, before COMMIT. If ROLLBACK occurs, the count is inflated.
**Fix:** Move `totalInserted` increment after COMMIT:
```typescript
await db.execute("BEGIN");
try {
    let batchCount = 0;
    for (...) { batchCount += batch.length; }
    await db.execute("COMMIT");
    totalInserted += batchCount;
} catch (e) {
    await db.execute("ROLLBACK").catch(() => {});
    console.error(`[Seed] Failed to seed ${contentType}:`, e);
}
```
Also change from `throw e` to logging + continue so one failed content type doesn't abort the entire seed.

## Warning Fixes (11)

### W1. Vocab unlock fetch multiplier cap
**File:** `src/lib/srs/language-unlock.ts:130`
**Fix:** Cap fetch at `Math.min(remaining * 3, 50)`. Add comment explaining the multiplier.

### W2. Undo doesn't invalidate srsSummary cache
**File:** `src/lib/components/language/LanguageReviewSession.svelte:236`
**Fix:** Change `invalidateCache("contentTypeCounts")` to `invalidateCache()` (full clear) after undo.

### W3. getJlptLevelProgress / getKanaGroupProgress / getJlptLevelProgressByType return rows[0] without fallback
**File:** `src/lib/db/queries/language.ts:508,549,661`
**Fix:** Change `return rows[0]` to `return rows[0] ?? { total: 0, guru_plus: 0 }` (or `at_apprentice4_plus: 0` for kana).

### W4. kanji.ts getLevelProgress / getDueKanjiCount / getAvailableLessonCount null checks
**File:** `src/lib/db/queries/kanji.ts:145,412,438`
**Fix:** Add null guards: `rows[0] ?? { total: 0, ... }` for getLevelProgress, `rows[0]?.count ?? 0` for count queries.

### W5. checkAndUnlockItems re-entrancy guard
**File:** `src/lib/srs/language-unlock.ts:41`
**Fix:** Add module-level `let unlockRunning = false`. At top of `checkAndUnlockItems`, check and return early if already running. Set true on entry, false in finally.

### W6. n5Data JSON import -- no runtime validation
**File:** `src/views/Search.svelte:14`
**Fix:** Low risk -- n5Data is a checked-in static file, not user-supplied. Add a `console.warn` if `!Array.isArray(n5Data)` rather than a full Zod schema. Minimal change.

### W7. Migration version ordering validation
**File:** `src/lib/db/database.ts` (in `runMigrations`)
**Fix:** Add assertion before the migration loop:
```typescript
for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version <= migrations[i - 1].version) {
        throw new Error(`Migration versions out of order: ${migrations[i - 1].version} -> ${migrations[i].version}`);
    }
}
```

### W8. getLanguageSrsDistribution has no caching
**File:** `src/lib/db/queries/language.ts:285`
**Fix:** Add cache using existing `CACHE_KEYS.srsSummary`:
```typescript
const cached = getCached<...>(CACHE_KEYS.srsSummary);
if (cached) return { ok: true, data: cached };
// ... query ...
setCache(CACHE_KEYS.srsSummary, data, 30_000);
```

### W9. Picker mode fetches 200 items to filter by IDs
**File:** `src/views/LanguageLessons.svelte:25-32`
**Fix:** Add `getLanguageItemsByIds(ids: number[])` query to `language.ts` using `WHERE id IN (${placeholders})`. Use it in picker mode instead of `getAvailableLessons(undefined, 200)`.

### W10. hasLockedItemsForJlptLevel uses COUNT with LIMIT 1
**File:** `src/lib/db/queries/language.ts:690-695`
**Fix:** Change to `SELECT 1 FROM language_items WHERE ... LIMIT 1` and return `rows.length > 0`.

### W11. (Merged -- undo cache is W2)

## Suggestion Fixes (9)

### S1. computeFirstReviewTime duplication in kanji.ts
**File:** `src/lib/db/queries/kanji.ts:5-15`
**Fix:** Import `calculateNextReview` from `$lib/srs/srs-common` and use it instead of the hand-rolled function. Pass `ACCELERATED_INTERVALS` for levels 1-2, `STANDARD_INTERVALS` otherwise.

### S2. Migration string splitter -- require array format
**File:** `src/lib/db/database.ts:61-64`
**Fix:** Add `console.warn` if migration.up is a string (not array). All current migrations already use arrays or semicolon-delimited strings that work. Low priority -- just a safety net.

### S3. Svelte 4 idiom in LessonSession
**File:** `src/lib/components/language/LanguageLessonSession.svelte`
**Fix:** Find `{#each [...] as examples}` pattern and replace with `{@const}`. Grep first to confirm the exact location.

### S4. Settings loaded one-by-one triggering re-renders
**File:** `src/lib/stores/app-settings.svelte.ts:62-78`
**Fix:** Build a temp object, then assign once: collect all parsed values in a plain object, then `settings = { ...settings, ...parsed }` at the end.

### S5. prevView in App.svelte unnecessarily reactive
**File:** `src/App.svelte:34-44`
**Fix:** Change `let prevView = $state(...)` to plain `let prevView = currentView()`.

### S6. Hardcoded zoom 1.5 with no user setting
**File:** `src/main.ts:27`
**Fix:** Add `uiZoom` to AppSettings (default 1.5). Use it in `init()`. Add UI control in Settings page. This is a small feature addition.

### S7. markLessonsBatchCompleted documentation
**File:** `src/lib/db/queries/language.ts:380`
**Fix:** Add JSDoc comment clarifying that `lesson_completed_at IS NOT NULL` is the "lesson done" flag and `srs_stage = 1` means "available for first review."

### S8. hasLockedItemsForJlptLevel redundant LIMIT
(Merged into W10)

### S9. fuzzyMatch kana false positive
**File:** `src/lib/utils/answer-validation.ts`
**Fix:** Already gated with 60% length ratio check from round 1. Kana review uses exact match (not fuzzyMatch). No further change needed -- document this in a comment.

## Critical Files

| File | Fixes |
|---|---|
| `src/lib/components/language/LanguageReviewSession.svelte` | C1, W2 |
| `src/lib/components/language/LanguageLessonSession.svelte` | C2, S3 |
| `src/lib/db/database.ts` | C3, W7, S2 |
| `src/lib/db/seed/language-data.ts` | C4 |
| `src/lib/srs/language-unlock.ts` | W1, W5 |
| `src/lib/db/queries/language.ts` | W3, W8, W9, W10, S7 |
| `src/lib/db/queries/kanji.ts` | W4, S1 |
| `src/views/Search.svelte` | W6 |
| `src/views/LanguageLessons.svelte` | W9 |
| `src/lib/stores/app-settings.svelte.ts` | S4, S6 |
| `src/App.svelte` | S5 |
| `src/main.ts` | S6 |
| `src/views/Settings.svelte` | S6 |

## Execution Order

1. **Database layer:** database.ts (C3, W7, S2), language.ts (W3, W8, W9, W10, S7), kanji.ts (W4, S1)
2. **Seed:** language-data.ts (C4)
3. **Unlock:** language-unlock.ts (W1, W5)
4. **Components:** ReviewSession (C1, W2), LessonSession (C2, S3)
5. **Views:** Search (W6), LanguageLessons (W9)
6. **Settings + App:** app-settings (S4, S6), App.svelte (S5), main.ts (S6), Settings.svelte (S6)

## Verification

1. `npx vite build` -- no compilation errors
2. `npx vitest run` -- all tests pass
3. Manual: Delete DB, restart -- app initializes without hanging (C3 test)
4. Manual: Lesson quiz with wrong answer on last item -- re-queued item must be answered correctly before session completes (C2)
5. Manual: Review session rapid Enter after wrong answer -- no UI glitch (C1)
6. Manual: Undo in review -- dashboard SRS chart updates immediately (W2)

## Lessons Learned / Gotchas

(To be filled after implementation)
