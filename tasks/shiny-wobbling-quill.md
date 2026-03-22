# Structured Kana Lesson Progression

## Context

The kana lesson system currently treats all 372 kana items as a flat, unordered pool. All kana unlock at once, and the lesson picker shows them mixed together without distinguishing Hiragana from Katakana or basic from advanced. This makes the learning experience chaotic -- a beginner could encounter obscure combination kana (yi, nyo) before mastering basic vowels. The goal is to implement a pedagogically sound, progressive lesson structure that follows the standard Japanese learning order.

## Approach

Add `lesson_group` and `lesson_order` columns to `language_items`, define a kana lesson group mapping in a shared constant, backfill existing data via migration, and gate kana unlocking so groups unlock progressively.

## Progression Model

**Hiragana seion first, then Katakana begins.** Complete basic Hiragana (vowels through W-row + n), then Katakana seion begins. Dakuten/handakuten/yoon are taught for both scripts together after both seion sets are done.

**Gate threshold:** 80% of items in the previous group must reach Apprentice 4+ (srs_stage >= 4) before the next group unlocks.

## Lesson Group Structure

| Order | Group Key | Label | Characters |
|-------|-----------|-------|------------|
| 1 | `hiragana-vowels` | Hiragana: Vowels | あ い う え お |
| 2 | `hiragana-k` | Hiragana: K-row | か き く け こ |
| 3 | `hiragana-s` | Hiragana: S-row | さ し す せ そ |
| 4 | `hiragana-t` | Hiragana: T-row | た ち つ て と |
| 5 | `hiragana-n` | Hiragana: N-row | な に ぬ ね の |
| 6 | `hiragana-h` | Hiragana: H-row | は ひ ふ へ ほ |
| 7 | `hiragana-m` | Hiragana: M-row | ま み む め も |
| 8 | `hiragana-y` | Hiragana: Y-row | や ゆ よ |
| 9 | `hiragana-r` | Hiragana: R-row | ら り る れ ろ |
| 10 | `hiragana-w` | Hiragana: W & N | わ を ん |
| 11 | `katakana-vowels` | Katakana: Vowels | ア イ ウ エ オ |
| 12 | `katakana-k` | Katakana: K-row | カ キ ク ケ コ |
| 13 | `katakana-s` | Katakana: S-row | サ シ ス セ ソ |
| 14 | `katakana-t` | Katakana: T-row | タ チ ツ テ ト |
| 15 | `katakana-n` | Katakana: N-row | ナ ニ ヌ ネ ノ |
| 16 | `katakana-h` | Katakana: H-row | ハ ヒ フ ヘ ホ |
| 17 | `katakana-m` | Katakana: M-row | マ ミ ム メ モ |
| 18 | `katakana-y` | Katakana: Y-row | ヤ ユ ヨ |
| 19 | `katakana-r` | Katakana: R-row | ラ リ ル レ ロ |
| 20 | `katakana-w` | Katakana: W & N | ワ ヲ ン |
| 21 | `dakuten` | Dakuten (Both) | ga-go, za-zo, da-do, ba-bo (ひらがな + カタカナ) |
| 22 | `handakuten` | Handakuten (Both) | pa-po (ひらがな + カタカナ) |
| 23 | `yoon` | Combinations (Both) | kya, sha, cha, nya, etc. (ひらがな + カタカナ) |
| 24 | `extended` | Extended Kana | yi, ye, wi, we, etc. (rare/obsolete, both scripts) |

## Critical Files

- `src/lib/db/migrations.ts` -- new migration adding columns + backfill
- `src/lib/data/kana-groups.ts` -- **new file**, shared constant defining group mapping (romaji + unicode range -> group key + order)
- `src/lib/db/seed/language-data.ts` -- update seeder to populate lesson_group/lesson_order for new installs
- `src/lib/srs/language-unlock.ts` -- change `unlockKana()` from "unlock all" to "unlock next group"
- `src/lib/db/queries/language.ts` -- update `getAvailableLessons()` ordering, add group-aware queries
- `src/views/LanguageLessonPicker.svelte` -- show kana sub-grouped by lesson group with Hiragana/Katakana sections
- `src/views/LanguageKana.svelte` -- reuse existing chart structure (already has Hiragana/Katakana tabs, no major changes needed)

## Implementation Steps

### Step 1: Create kana group mapping (`src/lib/data/kana-groups.ts`)

Define a `KANA_LESSON_GROUPS` constant that maps each romaji value to its group key and order number. Use unicode range detection (already exists in LanguageKana.svelte as `isHiragana`/`isKatakana`) to determine script type. Structure:

```typescript
export interface KanaGroup {
  key: string;        // e.g. "hiragana-vowels"
  label: string;      // e.g. "Hiragana: Vowels"
  order: number;      // 1-28
  script: "hiragana" | "katakana";
  category: "seion" | "dakuten" | "handakuten" | "yoon" | "extended";
}

// Map from romaji -> row category (script is determined by unicode)
export const ROMAJI_TO_ROW: Record<string, { row: string; category: string }>;

// Full group definitions
export const KANA_GROUPS: KanaGroup[];

// Helper: given a kana item (romaji + primary_text), return group key + lesson_order
export function getKanaGroupInfo(romaji: string, primaryText: string): { group: string; order: number };
```

Reuse the row definitions already in [LanguageKana.svelte:38-79](src/views/LanguageKana.svelte#L38-L79) (GOJUON_ROWS, DAKUTEN_ROWS, etc.) to build the mapping. Move those constants to the shared file so both the chart view and the group logic use the same source of truth.

### Step 2: Add DB migration

New migration (version 12 or next available):
- `ALTER TABLE language_items ADD COLUMN lesson_group TEXT`
- `ALTER TABLE language_items ADD COLUMN lesson_order INTEGER`
- `CREATE INDEX idx_language_items_lesson_group ON language_items(lesson_group)`
- Backfill via UPDATE statements using the romaji + unicode detection logic:
  - For each group, build an UPDATE with `WHERE content_type = 'kana' AND romaji IN (...) AND primary_text GLOB '[hiragana-range]*'`
  - SQLite doesn't have regex, so use hex(primary_text) range checks or hardcode item_key lists

### Step 3: Update seeder

In [language-data.ts](src/lib/db/seed/language-data.ts), after inserting kana items, run a post-seed step that calls `getKanaGroupInfo()` for each kana item and updates `lesson_group` and `lesson_order`. This ensures new installs get the data populated without relying on the migration backfill.

### Step 4: Update unlock logic

In [language-unlock.ts:51-58](src/lib/srs/language-unlock.ts#L51-L58), change `unlockKana()`:
- Instead of unlocking ALL locked kana, find the lowest-order lesson_group that has locked items
- Only unlock that group IF either: (a) it's group order 1 (hiragana vowels), or (b) 80% of items in the previous group have reached Apprentice 4+ (srs_stage >= 4)
- This creates a natural gate: learn vowels -> K-row unlocks -> learn K-row -> S-row unlocks, etc.
- After all hiragana seion groups (1-10) are done, katakana seion (11-20) begins, then dakuten/handakuten/yoon for both scripts together (21-23), then extended (24)
- Add new queries in language.ts:
  - `getLockedKanaByGroup()` -- get locked items for a specific lesson_group
  - `getKanaGroupProgress(groupKey)` -- returns `{ total, at_apprentice4_plus }` for gate checking
  - `getNextLockedKanaGroup()` -- find the lowest lesson_order group that still has locked items

### Step 5: Update lesson ordering query

In [language.ts:315-340](src/lib/db/queries/language.ts#L315-L340), update `getAvailableLessons()`:
- When `content_type = 'kana'`, order by `lesson_order ASC, id ASC` instead of `frequency_rank`
- This ensures lessons present kana in the correct pedagogical order

### Step 6: Update lesson picker UI

In [LanguageLessonPicker.svelte](src/views/LanguageLessonPicker.svelte):
- When kana items are present, sub-group them by `lesson_group` instead of showing a flat list
- Show group labels (e.g., "Hiragana: Vowels", "Hiragana: K-row")
- Add Hiragana/Katakana filter tabs (similar to [LanguageKana.svelte:191-193](src/views/LanguageKana.svelte#L191-L193))
- Show progress per group (e.g., "3/5 learned")

### Step 6b: Replace "Kana" label with Hiragana/Katakana throughout

Currently "Kana" is used as the generic content_type label everywhere. Update all user-facing labels:
- **Lesson picker** ([LanguageLessonPicker.svelte:114](src/views/LanguageLessonPicker.svelte#L114)): Change `getTypeLabel("kana")` from "Kana" to show "Hiragana" / "Katakana" based on the items' script. When both are present, show them as separate sections rather than one "Kana" bucket.
- **Lesson session header**: Show "Hiragana: Vowels" (the lesson_group label) instead of just "Kana" so the user knows exactly what they're studying.
- **Overview/stats cards** ([LanguageOverviewCard.svelte](src/lib/components/language/LanguageOverviewCard.svelte)): If kana stats are shown, break them into Hiragana/Katakana counts.
- **Content type badges** ([ContentTypeBadge.svelte](src/lib/components/language/ContentTypeBadge.svelte)): When displaying a kana item's badge, show "Hiragana" or "Katakana" instead of "Kana". Use the existing `isHiragana()`/`isKatakana()` unicode detection.
- **Navigation/sidebar**: If there's a "Kana" nav entry, consider splitting into "Hiragana" and "Katakana" or keeping "Kana" as the parent with sub-labels inside.

### Step 7: Refactor LanguageKana.svelte chart constants

Move GOJUON_ROWS, DAKUTEN_ROWS, HANDAKUTEN_ROWS, YOON_ROWS from [LanguageKana.svelte:38-79](src/views/LanguageKana.svelte#L38-L79) into the shared `kana-groups.ts` file. Import them back in the chart view. This prevents duplication and ensures both the reference chart and the lesson system use the same row definitions.

## Verification

1. **New install test**: Delete DB, restart app. Verify only hiragana vowels (a, i, u, e, o) are available as first lessons
2. **Progression test**: Complete vowel lessons, verify K-row unlocks next
3. **Lesson picker**: Open picker, verify kana are grouped by lesson group with labels
4. **Ordering**: Start auto-lesson with kana, verify they come in row order (vowels first, not random)
5. **Migration test**: Run with existing DB, verify lesson_group/lesson_order are backfilled for all kana items
6. **Chart view**: Verify LanguageKana.svelte still renders correctly after constant extraction

## Lessons Learned / Gotchas

(To be filled after implementation)
