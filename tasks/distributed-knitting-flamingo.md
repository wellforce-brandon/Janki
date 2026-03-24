# Code Review Fixes -- All Issues

## Context

A comprehensive code review identified 5 critical, 8 warning, and 7 suggestion-level issues. After manual verification, 2 of the 5 criticals are **false positives** (see below). This plan addresses all real issues grouped by priority.

## False Positives (No Fix Needed)

1. **"Quiz freezes on dismissed incorrect item"** (LanguageLessonSession.svelte) -- Line 198 removes the current item from its position and appends a copy to the end, shifting the array. `quizIndex` naturally points to the next item after this splice, so `dismissIncorrect` correctly does NOT increment. No freeze scenario exists.

2. **"searchAborted never resets on remount"** (Search.svelte) -- In Svelte 5, the `<script>` block runs per component instance. When the component remounts, a fresh instance is created with `searchAborted = false`. This is instance-scoped, not module-scoped.

---

## Critical Fixes

### C1. `checkAndUnlockLevel` needs transaction wrapping
**File:** `src/lib/db/queries/kanji.ts:243-327`
**Problem:** Three sequential mutations (unlock kanji, unlock vocab, unlock next-level radicals) without a transaction. Partial failure corrupts learning progression.
**Fix:** Wrap the body in `withTransaction(async (db) => { ... })` -- import already exists. The outer `safeQuery` stays for error handling; the inner `withTransaction` provides atomicity.

### C2. `durationMs ?? null` is dead code
**File:** `src/lib/srs/language-srs.ts:27,62`
**Problem:** Default parameter is `0`, so `?? null` never triggers. Duration stored as `0` instead of `NULL` when unknown.
**Fix:** Change parameter default to `durationMs: number | null = null`. The `?? null` on line 62 then works as intended. Also check line 77 where `durationMs` feeds into `daily_stats.time_spent_ms` -- `0` is correct there for "no time", so use `durationMs ?? 0` on line 77.

### C3. Backup import validated only by file size
**File:** `src/lib/backup/backup.ts:56-60`
**Problem:** Any binary > 100 bytes passes validation and replaces the live database.
**Fix:** After the size check, read the first 16 bytes of the temp file via Tauri FS and verify the SQLite magic header string (`SQLite format 3\0`). Reject with a clear error if it doesn't match. Use `readFile` from `@tauri-apps/plugin-fs` (already used in the project) to read a slice.

---

## Warning Fixes

### W1. Duplicate `shuffle` function
**File:** `src/lib/components/language/LanguageLessonSession.svelte:158-165`
**Fix:** Delete the local `shuffle<T>` function. Import `fisherYatesShuffle` from `$lib/utils/common`. Replace `shuffle(items)` call on line 169 with `fisherYatesShuffle(items)`.

### W2. Fire-and-forget unlock calls suppress failures
**Files:** `src/lib/srs/language-lessons.ts:83`, `src/lib/srs/language-srs.ts:86`
**Fix:** `await` the unlock call and wrap in try/catch. On failure, log to console but also surface via the return value so the UI can optionally show a toast. Minimal change: just `await` it inside a try/catch that logs but doesn't throw.

### W3. Inlined raw SQL duplicates query functions
**File:** `src/lib/srs/language-srs.ts:50-79`
**Problem:** The transaction manually writes UPDATE/INSERT SQL that duplicates `updateLanguageItemSrs` and `logLanguageReview` in `queries/language.ts`.
**Fix:** Refactor the query functions in `language.ts` to accept an optional `db` parameter (for use inside existing transactions). Then call them from the transaction in `language-srs.ts` instead of inlining SQL. The `daily_stats` upsert has no equivalent query function, so it stays inline (or extract a new `upsertDailyStats` function in `queries/language.ts`).

### W4. `withTransaction` doesn't handle nested calls
**File:** `src/lib/db/database.ts:24-35`
**Fix:** Add a module-level `inTransaction` flag. If `withTransaction` is called while already in a transaction, throw a descriptive error: `"Cannot nest transactions -- use the existing db handle"`.

### W5. LanguageReviewSession.svelte exceeds 500 lines
**File:** `src/lib/components/language/LanguageReviewSession.svelte` (507 lines)
**Fix:** Extract the completion summary section into `LanguageReviewComplete.svelte`. This is the cleanest split point.

### W6. ORDER BY allowlist has no rejection test
**File:** `src/lib/db/queries/kanji.ts:88-108`
**Fix:** Add a test in the kanji test file that calls `getDueKanjiReviews` with an invalid `order` value and asserts it throws `"Invalid review order"`.

### W7. Answer validation comment doesn't match logic
**File:** `src/lib/utils/answer-validation.ts:20-29`
**Fix:** Update the comment to accurately describe the two-step logic (length ratio check + directional includes check). No code change needed -- the logic is correct, just the comment is misleading.

### W8. Theme listener cleanup (accept as-is)
**File:** `src/lib/stores/app-settings.svelte.ts:127-157`
**Decision:** In a Tauri desktop app, the window close kills the process. No cleanup needed. Add a one-line comment noting this is intentional.

---

## Suggestion Fixes

### S1. `language.ts` is 1,667 lines
**File:** `src/lib/db/queries/language.ts`
**Fix:** Split into domain files. This is a large refactor -- do it after all other fixes to avoid merge conflicts. Split into:
- `language.ts` -- item CRUD, search, content type queries (keep the name)
- `language-srs-queries.ts` -- SRS state updates, review logging
- `language-unlock-queries.ts` -- unlock/progression queries
- `language-seed.ts` -- seeding/import queries

### S2. `checkLevelProgression` is dead code
**File:** `src/lib/srs/language-unlock.ts:82-127`
**Fix:** Add a `// TODO: Wire up after review batches` comment. Don't delete -- the function is intentional future work per the project memory about WaniKani-style levels.

### S3. `toSqliteDateTime` tests in wrong file
**Files:** `src/lib/srs/language-srs.test.ts:50-60` -> `src/lib/utils/common.test.ts`
**Fix:** Create `common.test.ts`, move the tests there, remove from `language-srs.test.ts`.

### S4. Prefix-based cache invalidation
**File:** `src/lib/db/query-cache.ts:45-52`
**Fix:** Change `invalidateCache` to accept exact key(s) from `CACHE_KEYS` instead of prefix string. Use a union type of valid cache keys.

### S5. Grammar data fails silently
**File:** `src/views/Search.svelte:23-26`
**Fix:** Keep the console.warn but change the comma expression to a proper if/else for readability.

### S6. Migration runner duplicates withTransaction
**File:** `src/lib/db/database.ts:86-114`
**Fix:** Skip -- migrations run before `withTransaction` is fully initialized (chicken-and-egg with DB init). The manual BEGIN/COMMIT is correct here. Add a comment explaining why.

### S7. No migration check after backup restore
**File:** `src/lib/backup/backup.ts:76`
**Fix:** Add a comment confirming that `getDb()` already runs `runMigrations` on reconnect, so imported older-schema DBs are auto-migrated.

---

## Execution Order

1. **C1-C3** -- Critical fixes first
2. **W1-W8** -- Warnings (W3 depends on W4 for transaction-aware query functions)
3. **S2-S7** -- Small suggestions
4. **S1** -- Large `language.ts` split last (touches many imports)

## Verification

- Run `npx vitest run` after each group to catch regressions
- Run `npx svelte-check` for type safety after all changes
- Manual test: complete a language lesson, do a review, import a backup, search
- Verify the ORDER BY rejection test passes
