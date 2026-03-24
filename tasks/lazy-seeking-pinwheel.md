# Fix: Search returns no results (FTS index empty)

## Context

Searching for "person" (or anything) in the Search view returns no results. The root cause is that FTS5 indexes are populated during migrations (v2 for kanji, v11 for language) -- but migrations run BEFORE data is seeded. The startup sequence in `src/main.ts` is:

1. `getDb()` -- runs migrations, including FTS population from empty tables
2. `seedKanjiData()` / `seedLanguageData()` -- fills tables with actual data
3. FTS indexes remain empty forever (never rebuilt automatically)

The only way to fix search currently is to manually click "Rebuild Search Index" in Settings, and that only rebuilds the language FTS -- there's no kanji FTS rebuild at all.

## Fix

### 1. Add `rebuildKanjiFtsIndex()` to `src/lib/db/queries/kanji.ts`

Mirror the existing `rebuildFtsIndex()` in language.ts:

```ts
export async function rebuildKanjiFtsIndex(): Promise<QueryResult<void>> {
    return safeQuery(async () => {
        const db = await getDb();
        await db.execute("DELETE FROM kanji_fts");
        await db.execute(
            `INSERT INTO kanji_fts(rowid, character, meanings, readings)
            SELECT id, character, meanings,
                COALESCE(readings_on, '') || ' ' || COALESCE(readings_kun, '') || ' ' || COALESCE(reading, '')
            FROM kanji_levels`,
        );
    });
}
```

### 2. Rebuild both FTS indexes after seeding in `src/main.ts`

After all seed/enrichment steps, call both rebuild functions. This is idempotent and fast (runs on every startup, only a few seconds for ~30K items).

```ts
import { rebuildFtsIndex } from "$lib/db/queries/language";
import { rebuildKanjiFtsIndex } from "$lib/db/queries/kanji";

// After assignLanguageLevels():
await rebuildFtsIndex();
await rebuildKanjiFtsIndex();
```

### 3. Also rebuild in Settings "Rebuild Search Index" button

Update `handleRebuildFts` in `src/views/Settings.svelte` to also rebuild kanji FTS so the button fixes both indexes.

## Files to modify

- `src/lib/db/queries/kanji.ts` -- add `rebuildKanjiFtsIndex()`
- `src/main.ts` -- call both FTS rebuilds after seeding
- `src/views/Settings.svelte` -- call kanji FTS rebuild alongside language FTS rebuild

## Also fix (from previous plan)

- `src/lib/db/queries/kanji.ts` line 692 -- remove `DELETE FROM review_log` (stale table reference causing reset failure)

## Verification

1. Reset all progress in Settings -- should succeed (no review_log error)
2. Search for "person" -- should return vocabulary items (e.g. 人) in both Kanji and Language tabs
3. Search for "eat" -- should return 食べる and related items
4. Click "Rebuild Search Index" in Settings -- should rebuild both indexes with success toast
