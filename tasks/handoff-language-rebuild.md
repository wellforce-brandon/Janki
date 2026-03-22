# Handoff: Language Section Rebuild

## Status
Phase 0 (Deck Assessment) and Phase 1.2 (Merge Pipeline) are COMPLETE.
Next: Phase 1.1, 1.3, 1.4 in a single session.

## Completed Work

### Phase 0 -- Deck Assessment
- `scripts/analyze-decks.mjs` -- parses all 27 .apkg files, outputs structural analysis
- `data/deck-analysis.json` -- field structures, note counts, samples for all 27 decks
- `data/field-mappings.json` -- semantic role mappings for every deck model, merge priorities, skip list

### Phase 1.2 -- Merge Pipeline
- `scripts/build-language-db.mjs` -- the full merge pipeline (run with `node scripts/build-language-db.mjs`)
- Outputs to `public/data/language/`:

| File | Items | Notes |
|------|-------|-------|
| vocabulary.json | 23,477 | JLPT: N5=2462, N4=3054, N3=3525, N2=3872, N1=6339, untagged=4225 |
| grammar.json | 1,166 | Tae Kim + FJSD grammar, with explanations and example sentences |
| sentence.json | 8,104 | Core 6k + Jlab + Beginner Phrases, many with audio |
| kana.json | 372 | Hiragana + Katakana including extended sets |
| conjugation.json | 95 | 95 verbs with conjugation form objects |
| media/ | 21,358 files (619 MB) | Audio + images, deduplicated by content hash |

- 4,502 items enriched from multiple sources (merge hits)
- FJSD filtered to top ~15k by JMdict frequency tiers (nf01-24 + ichi1/ichi2 + spec1/spec2)
- Media filenames are content hashes (e.g., `4699397491f57f69de3d76f54e083a63.mp3`)

## What the User Wants
1. Pre-loaded database with ALL content from 27 Anki decks at `C:\Users\B_StL\OneDrive\Desktop\Personal\Dev\Janki\Decks`
2. No runtime deck importing -- remove entirely
3. WK-style SRS stages (Locked -> Apprentice -> Guru -> Master -> Enlightened -> Burned) for all language content
4. Kanji section stays separate but with heavy cross-references into Language views
5. WK vocab (6k+ items in kanji_levels) appears read-only in Language -- SRS only updates via WK reviews
6. Merge strategy: best source wins for primary fields, enrich from all others. Nothing discarded.
7. Unlock/prerequisite system (design after data assessment -- now complete)

## Next Session: Phase 1.1 + 1.3 + 1.4

### Phase 1.1 -- Migration v10

Create migration v10 in `src/lib/db/migrations.ts`. The full schema is in `tasks/shimmying-pondering-sketch.md` (lines 64-124).

**Create**:
- `language_items` table (schema in plan doc, 30+ columns covering all 5 content types + SRS state + prerequisites)
- `language_review_log` table (mirrors `kanji_review_log`: id, item_id, srs_stage_before, srs_stage_after, correct, created_at)
- Indexes on: content_type, item_key, srs_stage, jlpt_level, next_review, content_type+srs_stage

**Drop**:
- `builtin_items`, `builtin_review_log`, `content_tags`, `content_type_fields`
- `decks`, `notes`, `note_types`, `cards`, `review_log`, `media`

### Phase 1.3 -- Runtime Seeding

Create `src/lib/db/seed/language-data.ts` following the `kanji-data.ts` pattern:
- On first launch, check if `language_items` is empty
- Fetch seed JSON from `/data/language/*.json` (vocabulary, grammar, sentence, kana, conjugation)
- Batch-insert with parameterized queries (100 per transaction)
- Map JSON fields to table columns (the JSON keys match the table columns, mostly 1:1)
- JSON arrays (example_sentences, source_decks, images, audio) stay as JSON TEXT in the DB
- Wire into `src/lib/db/database.ts` startup sequence (after migrations, alongside `seedKanjiData()`)

### Phase 1.4 -- Remove Dead Code

Delete these files/folders entirely:
- `src/lib/import/` (entire folder)
- `src/lib/srs/builtin-scheduler.ts`
- `src/lib/srs/language-scheduler.ts`
- `src/lib/srs/fsrs.ts`
- `src/lib/db/seed-builtin-items.ts`
- `src/lib/db/queries/cards.ts`
- `src/lib/db/queries/notes.ts`
- `src/lib/db/queries/decks.ts`
- `src/views/LanguageDecks.svelte`
- `src/views/DeckBrowse.svelte`

Then fix all broken imports -- grep for references to deleted modules and update/remove them. The build (`npm run build`) and type check (`npm run check`) must pass after cleanup.

## Key Patterns to Follow
- `src/lib/db/seed/kanji-data.ts` -- seeding pattern (fetch JSON, iterate, parameterized INSERT)
- `src/lib/db/migrations.ts` -- migration format (version number, up SQL, down SQL)
- `src/lib/srs/wanikani-srs.ts` -- SRS stages, intervals (adapt for language items in Phase 2)

## After This Session
- Phase 2: SRS engine + unlock system
- Phase 3: UI rebuild
- Phase 4: Polish

## Testing Notes
- `tasks/language-section-testing.md` -- user's manual test results showing what was broken before the rebuild
