# Code Review -- Full Codebase Findings

## Context

Full code review of the Janki codebase to identify correctness, safety, and maintainability issues. The review covered 65+ source files across TypeScript, Svelte, and Rust.

**Totals:** 4 Critical, 9 Warning, 11 Suggestion

---

## Critical (4)

### C1. Non-atomic reset functions
**Files:** `src/lib/db/queries/kanji.ts:688-700`, `src/lib/db/queries/language.ts:686-701`
`resetAllKanjiProgress` and `resetAllLanguageProgress` issue multiple DELETEs/UPDATEs without BEGIN/COMMIT. A crash between statements leaves the DB half-reset.
**Fix:** Wrap each reset in an explicit transaction with ROLLBACK on error.

### C2. Non-atomic review writes
**Files:** `src/lib/srs/language-srs.ts:49-58`, `src/lib/srs/wanikani-srs.ts:62-72`
`reviewLanguageItem` and kanji review call SRS update, log, and stats as three independent awaits. If any intermediate call fails, data diverges.
**Fix:** Wrap each review path in a DB transaction.

### C3. N+1 queries in lesson completion
**File:** `src/lib/srs/language-lessons.ts:75-85`
`completeLessonBatch` re-fetches each item by ID individually to read its level. For 20+ items this is visible latency.
**Fix:** Accept the full `LanguageItem[]` already in memory, or add a bulk `WHERE id IN (...)` query.

### C4. Unsafe backup import
**File:** `src/lib/backup/backup.ts:42-66`
`importBackup` closes DB then copies file. If copy fails midway, the DB file is corrupted with no rollback.
**Fix:** Copy to temp path first, verify valid SQLite, then atomic rename. Only then close/reopen DB.

---

## Warnings (9)

### W1. SQL string interpolation in `getDueKanjiReviews`
**File:** `src/lib/db/queries/kanji.ts:88-108`
`ORDER BY ${orderBy}` uses allowlist validation but string interpolation pattern is fragile.

### W2. Multiple sequential DB round-trips per review in unlock check
**File:** `src/lib/srs/language-unlock.ts:33-82`
3+ sequential queries after every review answer. Combine into one SQL query.

### W3. Asymmetric fuzzy match accepts superset answers
**File:** `src/lib/utils/answer-validation.ts:24-35`
User typing "eat food now" for expected "eat food" passes via substring containment.

### W4. JSON type mismatch in component query
**File:** `src/lib/db/queries/kanji.ts:726`
`json_each().value` returns text but compared to JS number without explicit CAST.

### W5. Dashboard unlock check only verifies current level
**File:** `src/views/Dashboard.svelte:82-84`
If lower levels have pending unlocks, they're missed.

### W6. Duplicate theme logic across two settings files
**Files:** `src/lib/stores/settings.svelte.ts`, `src/lib/stores/app-settings.svelte.ts`
Overlapping `setTheme`/`applyTheme` implementations. One appears to be a leftover stub.

### W7. Search debounce timer not aborted on component teardown
**File:** `src/views/Search.svelte:45`
In-flight async search can resolve after component destruction.

### W8. Bare `$effect` for initial data loading
**Files:** `KanjiLessons.svelte`, `KanjiReview.svelte`, `LanguageReview.svelte`
Pattern is fragile -- works only because `loading` flag prevents re-entry. Risk of infinite loop if reactive dependencies change.

### W9. `searchKanjiItems` silently swallows all FTS errors
**File:** `src/lib/db/queries/kanji.ts:759-790`
Catch block suppresses all exceptions, not just FTS-specific ones.

---

## Suggestions (11)

1. **Approximate furigana indicator** -- `japanese.ts:49` silently falls back; return `approximate: boolean`
2. **Cache key string literals** -- `query-cache.ts` keys used as bare strings; use `CACHE_KEYS.*` constants
3. **SRS interval +1h compounding** -- `srs-common.ts:43-45` always adds 1h due to minute zeroing
4. **Duplicate JSON parsing** -- `ItemTypeBrowser.svelte` and `KanjiLessonPicker.svelte` duplicate `parseReadings`/`parseMeanings`
5. **Extract `getSrsCategory`** -- `kanji.ts:90-96` couples SRS classification with CSS classes
6. **Dashboard `fetchId` scope** -- module-level `let` shared across HMR instances
7. **Backup timestamp in UTC** -- confusing for users in non-UTC timezones
8. **Missing tests** -- `romaji-to-hiragana.ts`, `kanji-validation.ts`, `srs-common.ts` have no test files
9. **Toast timer leak** -- `dismissLatest` doesn't cancel auto-dismiss timer
10. **Hyphen handling in answer normalization** -- verify dataset doesn't have edge cases
11. **`getTileClasses` tech debt** -- comment acknowledges needed refactor

---

## Recommended Fix Order

1. **Phase 1 -- Critical safety** (C1, C2, C4): Transaction wrapping and safe backup import
2. **Phase 2 -- Performance** (C3, W2): N+1 fix and unlock query consolidation
3. **Phase 3 -- Correctness** (W3, W4, W5, W6, W9): Answer validation, type safety, dedup
4. **Phase 4 -- Robustness** (W7, W8, remaining suggestions): Component lifecycle, test coverage

## Verification

- Run `npx svelte-check` after each phase -- zero errors required
- Run `npm test` (Vitest) after each phase
- Manual test: complete a review session, reset progress, import a backup, search for kanji
- Verify backup import with a simulated failure (e.g., read-only target path)

## Lessons Learned / Gotchas

_(To be filled after implementation)_
