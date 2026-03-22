# Code Review Fix Plan -- All Issues

## Context

A full code review identified 5 critical, 7 warning, and 7 suggestion issues across the Janki codebase. This plan addresses all of them in a safe execution order that avoids cross-contamination between fixes. File-size warnings (#1, #2) are excluded per user request.

Fixes are grouped into 5 batches by dependency. Each batch touches independent files or non-overlapping regions, so they can be implemented sequentially without conflicts.

---

## Batch 1: Shared Utilities (no downstream dependents yet)

These changes create or move shared utilities that later batches will import.

### 1A. Move `toSqliteDateTime` to shared utils (SUGGESTION)
**Files:** `src/lib/utils/common.ts`, `src/lib/srs/wanikani-srs.ts`, `src/lib/srs/language-srs.ts`

- Add `toSqliteDateTime(date: Date): string` to `src/lib/utils/common.ts`
- In `wanikani-srs.ts`: delete local `toSqliteDateTime` (lines 57-62), add import from `../utils/common`
- In `language-srs.ts`: delete local `toSqliteDateTime` (lines 21-26), remove its export, add import from `../utils/common`

### 1B. Remove deprecated `normalizeAnswer` alias (SUGGESTION)
**Files:** `src/lib/utils/answer-validation.ts`, `src/lib/components/language/LanguageReviewSession.svelte`, `src/lib/components/language/LanguageLessonSession.svelte`

- In `LanguageReviewSession.svelte` (line 8): change import from `normalizeAnswer` to `normalizeLanguageAnswer`
- In `LanguageLessonSession.svelte` (line 7): same change
- Update all usages of `normalizeAnswer(...)` to `normalizeLanguageAnswer(...)` in both files
- In `answer-validation.ts`: delete lines 23-24 (the deprecated alias)
- Check test files (`answer-validation.test.ts`) for `normalizeAnswer` imports and update those too

### 1C. Build prefix Set for `isValidPrefix` (SUGGESTION)
**File:** `src/lib/utils/romaji-to-hiragana.ts`

- At module scope after `ROMAJI_MAP`, build a `Set<string>` of all valid prefixes:
  ```ts
  const VALID_PREFIXES = new Set<string>();
  for (const key of Object.keys(ROMAJI_MAP)) {
    for (let i = 1; i <= key.length; i++) {
      VALID_PREFIXES.add(key.slice(0, i));
    }
  }
  ```
- Replace the loop in `isValidPrefix` (lines 162-164) with `VALID_PREFIXES.has(prefix)`

---

## Batch 2: Database & Query Layer

### 2A. Consolidate duplicate `updateUserSynonyms` / `updateUserNotes` (CRITICAL)
**Files:** `src/lib/db/queries/kanji-reviews.ts`, `src/lib/db/queries/kanji.ts`, `src/lib/components/kanji/KanjiLessonSession.svelte`

The canonical versions live in `kanji.ts`:
- `updateUserSynonyms(id, synonyms: string[])` -- takes array, stringifies internally (line 722)
- `updateUserNotes(id, notes: string)` -- trims and nullifies empty (line 735)

The `kanji-reviews.ts` versions (lines 99-111) take raw strings and are only imported by `KanjiLessonSession.svelte`.

**Steps:**
- Delete `updateUserNotes` and `updateUserSynonyms` from `kanji-reviews.ts` (lines 99-111)
- In `KanjiLessonSession.svelte` (line 6): change import source from `kanji-reviews` to `kanji`
- In `KanjiLessonSession.svelte` `addSynonym()` (line 169): pass the array instead of JSON string:
  ```ts
  const result = await updateUserSynonyms(current.id, existing);
  ```
  (The `kanji.ts` version handles stringification)
- In `KanjiLessonSession.svelte` `saveNotes()` (line 159): no signature change needed (`updateUserNotes` in `kanji.ts` also takes a string)

### 2B. Add error handling to `saveNotes` and `addSynonym` (CRITICAL + WARNING)
**File:** `src/lib/components/kanji/KanjiLessonSession.svelte`

After 2A is done, both functions use `safeQuery`-wrapped versions that return `QueryResult`. Update both to check results:

```ts
async function saveNotes() {
  if (!current) return;
  const result = await updateUserNotes(current.id, notesInput);
  if (result.ok) {
    current.user_notes = notesInput;
    editingNotes = false;
  } else {
    addToast("Failed to save notes", "error");
  }
}

async function addSynonym() {
  if (!current || !synonymInput.trim()) return;
  const existing = getUserSynonyms(current);
  existing.push(synonymInput.trim());
  const result = await updateUserSynonyms(current.id, existing);
  if (result.ok) {
    current.user_synonyms = JSON.stringify(existing);
    synonymInput = "";
  } else {
    addToast("Failed to add synonym", "error");
  }
}
```

### 2C. Add runtime assertion to `getDueKanjiReviews` ORDER BY (CRITICAL)
**File:** `src/lib/db/queries/kanji.ts` (lines 98-112)

Add an assertion before the `safeQuery` call:
```ts
if (!(order in ORDER_CLAUSES)) {
  throw new Error(`Invalid review order: ${order}`);
}
// Intentional SQL interpolation from allowlist -- safe because ORDER_CLAUSES is a static map
const orderBy = ORDER_CLAUSES[order] ?? "next_review ASC";
```

### 2D. Escape LIKE wildcards in language search (WARNING)
**File:** `src/lib/db/queries/language.ts` (lines 107-111)

```ts
if (options.searchQuery) {
  const escaped = options.searchQuery.replace(/[%_\\]/g, '\\$&');
  where += " AND (primary_text LIKE ? ESCAPE '\\' OR reading LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\' OR item_key LIKE ? ESCAPE '\\')";
  const like = `%${escaped}%`;
  params.push(like, like, like, like);
}
```

### 2E. Wrap `getGuruPlusKanji` in safeQuery (CRITICAL)
**File:** `src/lib/srs/language-unlock.ts` (lines 197-203)

```ts
async function getGuruPlusKanji(): Promise<Set<string>> {
  const result = await safeQuery(async () => {
    const db = await getDb();
    const rows = await db.select<{ character: string }[]>(
      "SELECT character FROM kanji_levels WHERE item_type = 'kanji' AND srs_stage >= 5",
    );
    return new Set(rows.map((r) => r.character));
  });
  return result.ok ? result.data : new Set();
}
```

Import `safeQuery` from `../db/database` if not already imported. On failure, returns empty Set so other unlock phases continue.

### 2F. Add cache invalidation after kanji reviews (SUGGESTION)
**File:** `src/lib/srs/wanikani-srs.ts` (after line 127)

Add at the end of `reviewKanjiItem`, before the return:
```ts
invalidateCache("contentTypeCounts");
```
Import `invalidateCache` from `../db/query-cache`.

---

## Batch 3: Migration Safety

### 3A. Add data check to migration 10 drops (CRITICAL)
**File:** `src/lib/db/migrations.ts` (lines 372-381)

The old tables (`review_log`, `cards`, `notes`, `note_types`, `decks`, `media`) were already migrated to the new `language_items` schema in earlier steps of migration 10. The `DROP TABLE IF EXISTS` statements are safe because:
- The data was migrated in the same transaction
- `IF EXISTS` prevents errors if tables don't exist

However, add a comment documenting this is intentional:
```sql
-- Legacy Anki-import tables replaced by language_items schema.
-- Data was never user-generated in these tables (only from Anki imports).
-- Safe to drop as migration 10 creates the replacement schema above.
```

### 3B. Fix v1 down migration drop order (SUGGESTION)
**File:** `src/lib/db/migrations.ts` (lines 126-137)

Reorder to drop dependent tables first:
```sql
DROP TABLE IF EXISTS daily_stats;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS review_log;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS kanji_dependencies;
DROP TABLE IF EXISTS kanji_levels;
DROP TABLE IF EXISTS note_types;
DROP TABLE IF EXISTS decks;
DROP TABLE IF EXISTS settings;
```

`review_log` references `cards`, `cards` references `notes`/`decks`, `kanji_dependencies` references `kanji_levels`.

---

## Batch 4: UI / Component Fixes

### 4A. Fix race condition in LanguageReviewSession (WARNING)
**File:** `src/lib/components/language/LanguageReviewSession.svelte` (lines 160-214)

Set `isProcessing = true` at the start of `submitAnswer`, before any `await`:
```ts
async function submitAnswer() {
  if (!current || isProcessing || feedbackState !== "none") return;
  const answer = inputValue.trim();
  if (answer.length === 0) return;

  isProcessing = true;  // <-- ADD THIS

  const isCorrect = checkAnswer();
  // ... rest of function ...
}
```

Also need to reset `isProcessing = false` in `advanceToNext()` or after the setTimeout fires. Check `advanceToNext` to see if it already resets it -- if not, add it there.

### 4B. Validate settings number parsing (WARNING)
**File:** `src/lib/stores/app-settings.svelte.ts` (lines 59-60)

```ts
if (typeof DEFAULTS[key] === "number") {
  const parsed = Number(val);
  (settings as Record<string, unknown>)[key] = Number.isFinite(parsed) ? parsed : DEFAULTS[key];
}
```

### 4C. Replace hardcoded hex colors in Stats heatmap (WARNING)
**File:** `src/views/Stats.svelte`

Replace `heatColor` function (lines 185-192) to use Tailwind classes instead of hex:
```ts
function heatColor(value: number, max: number): string {
  if (value === 0) return "bg-muted";
  const intensity = Math.min(value / max, 1);
  if (intensity < 0.25) return "bg-violet-300";
  if (intensity < 0.5) return "bg-violet-400";
  if (intensity < 0.75) return "bg-violet-500";
  return "bg-violet-600";
}
```

Update the heatmap cell (line 253) from `style="background: {heatColor(...)}"` to `class="{heatColor(...)} ..."`.

Update the legend (lines 260-264) from inline `style="background: ..."` to Tailwind classes:
```svelte
<div class="h-3 w-3 rounded-sm bg-muted"></div>
<div class="h-3 w-3 rounded-sm bg-violet-300"></div>
<div class="h-3 w-3 rounded-sm bg-violet-400"></div>
<div class="h-3 w-3 rounded-sm bg-violet-500"></div>
<div class="h-3 w-3 rounded-sm bg-violet-600"></div>
```

Note: The bar chart colors (line 302, 316, 343) use dynamic data-driven colors (`ks.color`, `contentTypeColors`), which require inline styles. Leave those as-is -- they're data-driven, not hardcoded.

### 4D. Add `simpleFurigana` fallback (SUGGESTION)
**File:** `src/lib/utils/japanese.ts` (line 76-86)

When suffix alignment fails (the `suffixInReading` check), add a fallback that treats the entire kanji block + remaining reading as one segment instead of producing partial/wrong segmentation:

In the `if (suffixInReading > readIdx)` branch, add an else that falls back to whole-word:
```ts
if (suffixInReading > readIdx) {
  // existing alignment logic
} else {
  // Fallback: treat entire remaining text as one segment
  return [{ text, reading }];
}
```

### 4E. Lazy-init `window.speechSynthesis` (SUGGESTION)
**File:** `src/lib/tts/speech.ts` (line 8)

Change from eager init:
```ts
private synth = window.speechSynthesis;
```
To a getter:
```ts
private get synth() { return window.speechSynthesis; }
```

---

## Batch 5: Deferred SRS Save (CRITICAL -- largest change)

### 5A. Save kanji SRS results per-item instead of at session end
**File:** `src/lib/components/kanji/KanjiReviewSession.svelte`

This is the TODO at line 208. Currently `processResults()` batches all SRS writes to session end. If the app closes mid-session, all progress is lost.

**Approach:** When both meaning and reading questions for an item are answered, call `reviewKanjiItem()` immediately for that item. `processResults()` becomes a summary-only function.

**Detailed steps:**
1. In the answer submission handler (where `itemResults` is updated), after both meaning and reading are marked complete for an item, call `reviewKanjiItem()` with the accumulated incorrect counts
2. Track which items have already been saved to the DB in a `Set<number>`
3. In `processResults()`, skip the DB write for already-saved items -- only compute the summary stats
4. Remove the TODO comment

**Risk:** This changes the SRS timing slightly (reviews are timestamped when answered, not at session end). This is actually more accurate behavior.

---

## Verification

1. **Run existing tests:** `npm test` -- ensures no regressions from utility moves and import changes
2. **Test kanji lesson flow:** Open a kanji lesson, add a synonym, save notes -- verify DB writes succeed and error toasts appear on failure
3. **Test language review:** Rapid-tap Enter during a language review -- verify no double-advances
4. **Test kanji review:** Complete a kanji review session, verify SRS updates are saved per-item (check `kanji_levels` table mid-session)
5. **Test Stats page:** Verify heatmap renders with proper purple gradient in both light and dark mode
6. **Test search:** Search for `%` or `_` in language items -- should match literally, not as wildcards
7. **Test settings:** Manually corrupt a settings value in SQLite to non-numeric -- verify it falls back to default

## Lessons Learned / Gotchas

(To be filled after implementation)
