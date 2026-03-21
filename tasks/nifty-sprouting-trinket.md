# Rebuild Item Detail Pages with Enriched WK Data

## Context

The current `KanjiDetail.svelte` (202 lines) is a monolithic component that renders the same basic layout for radicals, kanji, and vocabulary. It's missing most of the rich detail content that WaniKani shows on its item pages: mnemonic HTML rendering, user synonym/note editing, cross-referenced "Found In" grids, context sentences, audio playback, hints, parts of speech, similar kanji, and radical composition displays.

We just enriched the seed data (parts_of_speech, context_sentences, pronunciation_audios, visually_similar_ids, character_images) and added DB columns via migration v6. Now we need UI to display it all.

## Reference Pages (WK site crawl)

- `C:\Github\tech-assistant\site-crawl\wanikani\pages\15-item-detail-radical.md`
- `C:\Github\tech-assistant\site-crawl\wanikani\pages\16-item-detail-kanji.md`
- `C:\Github\tech-assistant\site-crawl\wanikani\pages\17-item-detail-vocabulary.md`

## Pre-Requisite Fixes (before building components)

### Fix 1: Add meaning_hint / reading_hint to DB

These exist in the JSON seed files but are NOT stored in the DB. Need migration v7 + backfill + seed update.

**Files:** `src/lib/db/migrations.ts`, `src/lib/db/seed/kanji-data.ts`

```sql
-- Migration v7
ALTER TABLE kanji_levels ADD COLUMN meaning_hint TEXT;
ALTER TABLE kanji_levels ADD COLUMN reading_hint TEXT;
```

Backfill from `wk-kanji.json` by wk_id. Update seed INSERT for kanji to include these columns.

### Fix 2: Extend KanjiLevelItem interface

**File:** `src/lib/db/queries/kanji.ts`

Add all v6 + v7 columns:
```typescript
parts_of_speech: string | null;
context_sentences: string | null;
pronunciation_audios: string | null;
visually_similar_ids: string | null;
character_images: string | null;
meaning_hint: string | null;
reading_hint: string | null;
```

### Fix 3: Decouple kanji-detail routing

Currently `kanji-detail` only routes through `KanjiRadicals.svelte` (App.svelte line 80). Make it a standalone case in App.svelte so the detail page works from any entry point.

**File:** `src/App.svelte`

```diff
- {:else if currentView() === "kanji-radicals" || currentView() === "kanji-detail"}
-   <KanjiRadicals />
+ {:else if currentView() === "kanji-detail"}
+   <KanjiDetail itemId={Number(viewParams().id)} />
+ {:else if currentView() === "kanji-radicals"}
+   <KanjiRadicals />
```

Remove the `kanji-detail` conditional from `KanjiRadicals.svelte`.

### Fix 4: Add cross-reference query functions

**File:** `src/lib/db/queries/kanji.ts`

New functions:

1. **`getItemsByWkIds(wkIds: number[])`** -- batch lookup by wk_id. Used for resolving component_ids, visually_similar_ids.

2. **`getItemsContainingComponent(wkId: number, targetType: string)`** -- reverse lookup: find kanji/vocab that use a given radical/kanji. Uses SQLite `json_each(component_ids)` to avoid false matches.

3. **`updateUserSynonyms(id: number, synonyms: string[])`** -- save user synonyms as JSON array.

4. **`updateUserNotes(id: number, notes: string)`** -- save user notes as plain text.

### Fix 5: Add mnemonic sanitizer + utilities

**File:** `src/lib/utils/sanitize.ts` -- add `sanitizeMnemonicHtml()` that allows WK custom tags: `radical`, `kanji`, `vocabulary`, `reading`, `ja`

**File:** `src/lib/utils/kanji.ts` -- add JSON parsers:
- `parseContextSentences(json) -> {en, ja}[]`
- `parsePronunciationAudios(json) -> PronunciationAudio[]`
- `parsePartsOfSpeech(json) -> string[]`
- `parseCharacterImages(json) -> CharacterImage[]`
- `parseWkIdArray(json) -> number[]`

**File:** `src/app.css` -- add global styles for mnemonic HTML tags:
- `radical` -- blue badge inline
- `kanji` -- pink badge inline
- `vocabulary` -- purple badge inline
- `reading` -- bold text
- `ja` -- bold text

## Component Architecture

### Shared Sub-Components (in `src/lib/components/kanji/detail/`)

| Component | Lines | Purpose |
|---|---|---|
| `ItemHeader.svelte` | ~80 | Large character/image, SRS badge, TTS, meanings, parts of speech |
| `MnemonicSection.svelte` | ~60 | Mnemonic HTML (sanitized) + collapsible hint box |
| `UserSynonyms.svelte` | ~70 | Editable synonym badges with add/remove |
| `UserNotes.svelte` | ~60 | Inline-editable notes text area |
| `RelatedItemsGrid.svelte` | ~80 | Grid of clickable item tiles for cross-references |
| `ContextSentences.svelte` | ~50 | Japanese + English sentence pairs |
| `AudioPlayer.svelte` | ~70 | Voice actor audio playback (with "requires internet" badge) |
| `ItemProgression.svelte` | ~50 | SRS stage, accuracy, next review, level, unlock date |

### Type-Specific Layouts (in `src/lib/components/kanji/detail/`)

**`RadicalDetail.svelte`** (~120 lines)
1. ItemHeader (with character_images fallback for imageless radicals)
2. UserSynonyms
3. MnemonicSection (meaning only -- radicals have no reading)
4. UserNotes
5. RelatedItemsGrid -- "Found In Kanji" (reverse lookup via getItemsContainingComponent)
6. ItemProgression

**`KanjiItemDetail.svelte`** (~150 lines)
1. ItemHeader
2. UserSynonyms
3. Readings grid (On'yomi / Kun'yomi / Nanori)
4. RelatedItemsGrid -- "Radical Combination" (component_ids resolved to radicals, shown with "+" separators)
5. MnemonicSection -- meaning mnemonic + meaning_hint
6. MnemonicSection -- reading mnemonic + reading_hint
7. UserNotes
8. StrokeOrder (existing component)
9. RelatedItemsGrid -- "Visually Similar Kanji" (visually_similar_ids)
10. RelatedItemsGrid -- "Found In Vocabulary" (reverse lookup)
11. ItemProgression

**`VocabDetail.svelte`** (~140 lines)
1. ItemHeader (with parts_of_speech badges)
2. UserSynonyms
3. Reading + AudioPlayer
4. RelatedItemsGrid -- "Kanji Composition" (component_ids resolved to kanji)
5. MnemonicSection -- meaning mnemonic
6. MnemonicSection -- reading mnemonic
7. UserNotes
8. ContextSentences
9. ItemProgression

### Orchestrator

**`KanjiDetail.svelte`** rewritten to ~60 lines:
- Loading/error states, prev/next navigation (arrow keys + buttons)
- Fetches item via getKanjiItemById
- Dispatches to RadicalDetail, KanjiItemDetail, or VocabDetail based on item_type

## Files to Create/Modify

| File | Action |
|---|---|
| `src/lib/db/migrations.ts` | MODIFY -- add migration v7 (meaning_hint, reading_hint) |
| `src/lib/db/seed/kanji-data.ts` | MODIFY -- seed + backfill meaning_hint, reading_hint |
| `src/lib/db/queries/kanji.ts` | MODIFY -- extend interface, add 4 query functions |
| `src/lib/utils/sanitize.ts` | MODIFY -- add sanitizeMnemonicHtml |
| `src/lib/utils/kanji.ts` | MODIFY -- add JSON parsers + types |
| `src/app.css` | MODIFY -- add mnemonic tag styles |
| `src/App.svelte` | MODIFY -- decouple kanji-detail routing |
| `src/views/KanjiRadicals.svelte` | MODIFY -- remove kanji-detail conditional |
| `src/views/KanjiDetail.svelte` | REWRITE -- thin orchestrator |
| `src/lib/components/kanji/detail/ItemHeader.svelte` | CREATE |
| `src/lib/components/kanji/detail/MnemonicSection.svelte` | CREATE |
| `src/lib/components/kanji/detail/UserSynonyms.svelte` | CREATE |
| `src/lib/components/kanji/detail/UserNotes.svelte` | CREATE |
| `src/lib/components/kanji/detail/RelatedItemsGrid.svelte` | CREATE |
| `src/lib/components/kanji/detail/ContextSentences.svelte` | CREATE |
| `src/lib/components/kanji/detail/AudioPlayer.svelte` | CREATE |
| `src/lib/components/kanji/detail/ItemProgression.svelte` | CREATE |
| `src/lib/components/kanji/detail/RadicalDetail.svelte` | CREATE |
| `src/lib/components/kanji/detail/KanjiItemDetail.svelte` | CREATE |
| `src/lib/components/kanji/detail/VocabDetail.svelte` | CREATE |

## Implementation Order

1. Pre-req fixes (migration v7, interface, routing, queries, utilities, CSS)
2. Shared sub-components (ItemHeader through ItemProgression)
3. Type-specific layouts (RadicalDetail, KanjiItemDetail, VocabDetail)
4. Orchestrator rewrite (KanjiDetail.svelte)

## Verification

1. Navigate to a radical detail -- verify: character/image, mnemonic with styled HTML tags, "Found In Kanji" grid with clickable tiles, user synonym add/remove, user notes edit/save
2. Navigate to a kanji detail -- verify: On/Kun/Nanori readings, radical composition with "+" separators, meaning + reading mnemonics with hints, similar kanji grid, "Found In Vocabulary" grid, stroke order
3. Navigate to a vocabulary detail -- verify: parts of speech badges, audio playback (Kyoko/Kenichi), context sentences (JP + EN), kanji composition grid, reading mnemonic
4. Test prev/next arrow navigation across all three types
5. Test that detail pages are reachable from all browse views (radicals, kanji, vocabulary, level detail)
6. Verify dark mode on all new components
7. Verify user synonyms and notes persist after navigating away and back

## Lessons Learned / Gotchas

- `kanji-detail` route was coupled to `KanjiRadicals.svelte` -- must decouple before adding type-specific layouts
- meaning_hint/reading_hint were in seed JSON but never stored in DB -- need migration v7
- WK mnemonics use non-standard HTML tags (`<radical>`, `<kanji>`, etc.) -- DOMPurify strips them by default, must extend allow list
- Audio URLs are remote (files.wanikani.com) -- offline-first app needs graceful degradation
- `amalgamation_subject_ids` not in DB -- use reverse lookup via `json_each(component_ids)` instead
- SQLite `json_each` requires SQLite 3.38+ (Tauri 2.x bundles 3.39+, so it's fine)
