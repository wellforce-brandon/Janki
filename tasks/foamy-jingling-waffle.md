# Data Quality Cleanup: Full Japanese Study Deck

## Context

77% of vocabulary (18,075 of 23,477) comes from the "Full_Japanese_Study_Deck" with severely messy data across ALL JLPT levels including N5. The `primary_text` and `meaning` fields contain metadata jammed in (POS labels, kanji form annotations, related items). This affects the entire levels system since these items display poorly.

## Data Assessment Summary

**Messy items by JLPT level (FJSD only):**

| JLPT | Total | Has clean duplicate | Unique to FJSD |
|------|-------|---------------------|----------------|
| N5 | 993 | 476 | 517 |
| N4 | 1,971 | 579 | 1,392 |
| N3 | 2,933 | 526 | 2,407 |
| N2 | 3,871 | 478 | 3,393 |
| N1 | 5,399 | 690 | 4,709 |
| None | 2,908 | 507 | 2,401 |
| **Total** | **18,075** | **3,256** | **14,819** |

**What's wrong:**
- `primary_text` contains: word + reading + "Common kanji form" + "Show other kanji forms" + alt writings + "Irregular okurigana usage" + "Search-only kanji form" -- all crammed together with newlines
- `meaning` contains: actual definition + "Common noun" + "Transitive verb" + "Takes the aux. verb 'する'" + "Related: ..." + "May take the 'の' particle" -- all mixed in
- 18,044 of 18,075 items affected

**What clean data looks like (from first line):**
```
primary_text line 1: "意味" (the actual word)
primary_text line 2: "いみ" (the reading)
remaining lines: metadata noise
```

## Cleanup Plan

### Step 1: Parse and clean FJSD items in the JSON source

**File**: `dist/data/language/vocabulary.json`

Write a cleanup script that processes each FJSD item:

1. **Extract clean `primary_text`**: Take only line 1 (the word itself)
2. **Extract clean `reading`**: Take line 2 (the kana reading), strip if same as primary_text
3. **Extract clean `meaning`**: Take the first meaning before any POS label. Split on double-newline, keep only paragraphs that don't match POS patterns
4. **Extract `part_of_speech`**: Parse POS labels from the meaning text ("Common noun", "い-adjective", "Transitive verb", etc.)
5. **Keep useful metadata**: "Related:" entries could go into `related_items`

### Step 2: De-duplicate against clean sources

After cleanup, for items where both an FJSD version and a clean-source version exist (3,256 items):

1. Keep the clean-source version as the primary
2. Upsert any extra data from the FJSD version:
   - If FJSD has `part_of_speech` and clean version doesn't, add it
   - If FJSD has `jlpt_level` and clean version doesn't, add it
   - If FJSD has example sentences and clean version doesn't, merge them
3. Delete the FJSD duplicate

### Step 3: Re-seed the database

After the JSON source is cleaned:
1. Bump the language seed key so the data re-imports
2. Re-run level assignments (bump seed key)
3. Reset SRS state for clean start

## Files to Modify

| File | Changes |
|------|---------|
| New script (one-time) | Parse and clean vocabulary.json |
| `dist/data/language/vocabulary.json` | Cleaned FJSD items |
| `src/lib/db/seed/language-data.ts` | May need upsert logic for de-duplication |
| `src/lib/db/seed/language-levels.ts` | Bump seed key for re-run |

## Verification

1. Open a previously messy item (e.g., ください) -- should show clean primary_text and meaning
2. Check that de-duplicated items kept the best data from both sources
3. Verify total vocab count is reasonable (should drop from 23K to ~20K after dedup)
4. All JLPT levels still have coverage
5. `npx svelte-check` -- 0 errors
6. `npx vitest run` -- all tests pass
