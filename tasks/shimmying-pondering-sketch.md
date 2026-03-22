# Language Section Rebuild -- Complete Plan

## Context

After manual testing of the Phase 1-4 unified Language section, the fundamental approach was wrong. The system was built around runtime Anki deck importing with a "builtin items" bolt-on. The user expected a **pre-loaded, self-contained database** where all content is built in, richly merged from multiple sources, and managed through a WK-style SRS progression. This plan tears down the current Language system and rebuilds it correctly.

## What's Changing

- **Remove**: Deck import UI, "builtin_items" table, "content_tags" table, all deck-related tables (decks/notes/cards/note_types/media/review_log), FSRS for language content
- **Add**: Unified `language_items` table, offline deck merge pipeline, WK-style SRS progression, lesson system, prerequisite unlocking
- **Keep**: WK Kanji Dashboard (separate section), kanji_levels table, WK cross-references (enhanced), kana grid, existing WK SRS engine

## Data Sources

27 Anki decks at `C:\Users\B_StL\OneDrive\Desktop\Personal\Dev\Janki\Decks\` (~1GB):

| Category | Decks | Est. Items |
|----------|-------|-----------|
| Vocabulary | Kaishi 15k, Core 2k/6k Pitch, Genki 1&2, Full JLPT | ~15,000 unique |
| Grammar | Tae Kim Guide (×4 versions), Full JLPT | ~300-500 unique |
| Sentences | Core 2k/6k Sentences, Beginner Phrases, Genki | ~6,000+ |
| Conjugation | 106 Common Verbs | ~106 |
| Kana | Hiragana, Katakana, Basic Katakana | ~96 |
| Kanji decks | JLPT N4/N5, Drawing, Radicals | SKIP (WK handles) |

Plus 6,000+ WK vocabulary items already shipped (read-only reference in Language views).

**Merge strategy**: Best source wins for primary fields, then enrich from all others. A vocab item gets readings from Kaishi 15k + pitch accent from Core 2k/6k + audio from Genki + context sentences from everywhere. Nothing is discarded.

---

## Phase 0: Deck Assessment (Foundation -- Data Discovery)

**Goal**: Catalog all 27 decks, understand field structures, identify overlaps, create field mappings.

### 0.1 Build deck analysis script
- Create `scripts/analyze-decks.mjs` (Node ESM)
- Port `apkg-parser.ts` logic to work outside Tauri (it uses browser/Tauri APIs)
- For each deck: extract note count, model names, field names, sample notes, tag list, media stats
- Output `data/deck-analysis.json`

### 0.2 Create field mappings
- Based on analysis output, manually create `data/field-mappings.json`
- Map each deck's Anki field names to semantic roles: primary_text, reading, meaning, part_of_speech, pitch_accent, audio, example_sentence_ja, example_sentence_en, formation, explanation, conjugation_forms, romaji, stroke_order
- Document which decks overlap and the priority order for merging

### 0.3 Categorize and deduplicate plan
- Identify exact dedup keys per content type
- Vocabulary: normalize to kanji form (or reading if kana-only)
- Grammar: normalize to pattern text
- Sentences: hash of Japanese text
- Document expected unique item counts after merge

**Deliverable**: `data/deck-analysis.json` + `data/field-mappings.json` + written assessment of what we have

---

## Phase 1: Schema & Seed Pipeline (Foundation)

**Goal**: New DB schema + offline build pipeline producing seed data.

### 1.1 Design `language_items` table (migration v10)

```sql
CREATE TABLE language_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,       -- vocabulary|grammar|sentence|kana|conjugation
    item_key TEXT NOT NULL UNIQUE,    -- dedup key

    -- Universal fields
    primary_text TEXT NOT NULL,
    reading TEXT,
    meaning TEXT,

    -- Vocabulary
    part_of_speech TEXT,              -- JSON array
    pitch_accent TEXT,
    frequency_rank INTEGER,
    audio_file TEXT,

    -- Grammar
    formation TEXT,
    explanation TEXT,

    -- Sentence
    sentence_ja TEXT,
    sentence_en TEXT,
    sentence_reading TEXT,
    sentence_audio TEXT,

    -- Kana
    romaji TEXT,
    stroke_order TEXT,

    -- Conjugation
    conjugation_forms TEXT,           -- JSON object of forms
    verb_group TEXT,

    -- Enrichment (from multi-source merge)
    example_sentences TEXT,           -- JSON array of {ja, en, reading}
    related_items TEXT,               -- JSON array of item_keys
    images TEXT,                      -- JSON array of image paths
    context_notes TEXT,
    source_decks TEXT,                -- JSON array of contributing deck names

    -- Classification
    jlpt_level TEXT,                  -- N5|N4|N3|N2|N1
    wk_level INTEGER,
    tags TEXT,                        -- JSON array

    -- SRS (WK-style stages, same as kanji_levels)
    srs_stage INTEGER NOT NULL DEFAULT 0,
    unlocked_at TEXT,
    next_review TEXT,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    lesson_completed_at TEXT,

    -- Prerequisites
    prerequisite_keys TEXT,           -- JSON array of item_keys that must be Guru+

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Plus `language_review_log` table (mirrors kanji_review_log structure).

Migration v10 also **drops**: builtin_items, builtin_review_log, content_tags, content_type_fields, decks, notes, note_types, cards, review_log, media.

### 1.2 Build offline merge pipeline

Create `scripts/build-language-db.mjs`:
1. Parse all 27 .apkg files (reuse apkg-parser logic, ported to Node)
2. Apply field mappings from `data/field-mappings.json`
3. Generate deterministic item_keys for dedup
4. Merge overlapping items: primary data from highest-priority source, enrich fields from all sources
5. Assign JLPT levels from deck tags + frequency data
6. Extract and deduplicate media files (content-hash based)
7. Output: `public/data/language/{vocabulary,grammar,sentences,kana,conjugation}.json` + `public/data/language/media/`

**Merge priority** (per content type):
- Vocab: Kaishi 15k > Core 2k/6k > Full JLPT > Genki
- Grammar: Tae Kim Guide > Full JLPT > Tae Kim extended versions
- Sentences: Genki > Core 2k/6k > Beginner Phrases

### 1.3 Runtime seeding

Create `src/lib/db/seed/language-data.ts` (follows kanji-data.ts pattern):
- On first launch, check if `language_items` is empty
- Fetch seed JSON from `/data/language/*.json`
- Batch-insert (100 per transaction)
- Copy media to `$APPDATA/janki/media/`

### 1.4 Remove dead code

Delete:
- `src/lib/import/` (entire folder -- move apkg-parser to scripts/)
- `src/lib/srs/builtin-scheduler.ts`
- `src/lib/srs/language-scheduler.ts`
- `src/lib/srs/fsrs.ts` (no longer used for language)
- `src/lib/db/seed-builtin-items.ts`
- `src/lib/db/queries/cards.ts`
- `src/lib/db/queries/notes.ts`
- `src/lib/db/queries/decks.ts`
- `src/views/LanguageDecks.svelte`
- `src/views/DeckBrowse.svelte`
- `src/lib/components/deck/` (entire folder)
- `src/lib/components/language/DeckSourceBadge.svelte`

**Deliverable**: App launches with ~20k+ language items seeded from merged deck data. Old tables gone.

---

## Phase 2: SRS & Progression (Core)

**Goal**: WK-style SRS for all language items with unlock cascading.

### 2.1 Language SRS engine

Create `src/lib/srs/language-srs.ts`:
- Reuse stage definitions, intervals, and drop formula from `wanikani-srs.ts`
- Same Apprentice 1-4 → Guru 1-2 → Master → Enlightened → Burned progression
- Correct: stage += 1 (cap at 9)
- Incorrect: stage drops by `ceil(incorrectCount/2) * penalty` (penalty=2 for Guru+)
- Single review dimension (not meaning+reading split like kanji)

### 2.2 Unlock system

Create `src/lib/srs/language-unlock.ts`:
- Kana: unlocked from start (srs_stage = 1)
- Vocabulary: unlocked when all kanji in the word are Guru+ in kanji_levels (kana-only words unlock immediately)
- Grammar: N5 basics unlock first, then sequentially within level
- Sentences: unlock when their grammar pattern is Guru+
- N4+ content: gated behind majority of N(level-1) being Guru+
- Conjugation: unlock when base verb is Apprentice 4+
- Escape hatch: manual "unlock anyway" option in settings

### 2.3 Lesson system

Create `src/lib/srs/language-lessons.ts`:
- Batch size: 5 items (matching WK)
- Flow: present item info → quiz → correct answers move to Apprentice 1
- Available lessons = unlocked items (prerequisite_keys satisfied) where srs_stage = 0

### 2.4 Rewrite query layer

Rewrite `src/lib/db/queries/language.ts`:
- `getLanguageItemsByType(type, filters)` -- single table, no dual-source merge
- `getDueLanguageItems(type?)` -- next_review <= now, stage 1-8
- `getAvailableLessons(type?, limit)` -- stage 0, prerequisites met
- `updateLanguageItemSrs(id, newStage, nextReview)`
- `logLanguageReview(itemId, correct, stageBefore, stageAfter, durationMs)`
- `getLanguageStats()` -- counts by type, stage, JLPT level
- `searchLanguageItems(query)` -- FTS across primary_text, reading, meaning

**Deliverable**: Working SRS progression. Items unlock, enter lessons, progress through reviews.

---

## Phase 3: UI Rebuild (Core)

**Goal**: All Language views work against `language_items` with unified WK-style experience.

### 3.1 New sidebar navigation

| Nav Item | View | Shortcut |
|----------|------|----------|
| Overview | Language stats + quick actions | Ctrl+2 |
| Lessons | Lesson picker + lesson session | Ctrl+3 |
| Review | WK-style review session | Ctrl+4 (was Ctrl+3) |
| Vocabulary | Browse/search vocab | Ctrl+5 |
| Grammar | Browse grammar by JLPT | Ctrl+6 |
| Sentences | Reading mode + browse | Ctrl+7 |
| Kana | Grid with SRS progress | Ctrl+8 |
| Conjugation | Verb browser | (visible when items exist) |

Remove: Manage Decks nav item

### 3.2 LanguageOverview (rewrite)

- SRS stage breakdown per content type (Apprentice/Guru/Master/Enlightened/Burned counts)
- Available lessons count with "Start Lessons" button
- Due reviews count with "Start Review" button
- JLPT progress bars (N5 → N1)
- No more "builtin" terminology anywhere

### 3.3 Content type views (rewrite all)

All views query `language_items` directly. Each shows:
- SRS stage badge per item (using WK stage colors/names)
- WK kanji cross-reference badges (clickable, SRS-aware)
- JLPT level filter
- SRS stage filter
- Search

**Vocabulary**: primary_text + reading + meaning + pitch accent + POS + WK kanji badges + example sentences
**Grammar**: pattern + formation + explanation + examples + JLPT level
**Sentences**: Japanese + furigana toggle + translation toggle + audio + kanji badges
**Kana**: grid with romaji + stroke order + SRS stage per character
**Conjugation**: dictionary form + verb group + conjugation table + link to vocab item

### 3.4 Language Review (rewrite)

WK-style review flow (not card-flip):
- Show question (e.g., "What does 食べる mean?")
- User types answer OR selects from options
- Correct/incorrect feedback with SRS stage change shown
- Progress bar (actual bar, not just "2 of 20")
- Session summary at end

### 3.5 Language Lessons (new view)

- Lesson picker: choose content type or "all available"
- Lesson presentation: show all info for each item in batch
- Quiz after presentation
- Items move from Locked → Apprentice 1

### 3.6 Dashboard update

- Replace current Language summary with: lessons available, reviews due, items by SRS category
- Remove "content type breakdown pills" confusion
- "Start Lessons" and "Start Review" buttons

### 3.7 Search update

- Remove "Builtin" tab
- Single unified search across all language_items
- Content type filter (dropdown)
- Results show SRS stage, content type, JLPT level

**Deliverable**: Complete, cohesive Language section with no deck/builtin terminology.

---

## Phase 4: Polish & Ship

### 4.1 FTS5 search index for language_items
### 4.2 Stats page: language SRS progress, review history, accuracy by type
### 4.3 WK cross-references: kanji badges everywhere, bidirectional linking
### 4.4 Performance: virtual scrolling for 15k vocab list, lazy media loading
### 4.5 Audio/media: proper playback component, audio routing fix (TTS issue from testing)
### 4.6 Visual progress bar in review sessions
### 4.7 Translation toggle button (not just keyboard) for sentences

---

## Files to Modify/Create

**Create:**
- `scripts/analyze-decks.mjs`
- `scripts/build-language-db.mjs`
- `data/field-mappings.json`
- `public/data/language/*.json` (generated)
- `src/lib/srs/language-srs.ts`
- `src/lib/srs/language-unlock.ts`
- `src/lib/srs/language-lessons.ts`
- `src/lib/db/seed/language-data.ts`
- `src/views/LanguageLessons.svelte`

**Rewrite:**
- `src/lib/db/queries/language.ts`
- `src/lib/db/migrations.ts` (add v10)
- `src/views/LanguageOverview.svelte`
- `src/views/LanguageVocabulary.svelte`
- `src/views/LanguageGrammar.svelte`
- `src/views/LanguageSentences.svelte`
- `src/views/LanguageKana.svelte`
- `src/views/LanguageConjugation.svelte`
- `src/views/LanguageReview.svelte`
- `src/views/Dashboard.svelte` (Language section)
- `src/lib/stores/navigation.svelte.ts`
- `src/lib/components/layout/Sidebar.svelte`

**Delete:**
- `src/lib/import/` (move apkg-parser to scripts/)
- `src/lib/srs/builtin-scheduler.ts`, `language-scheduler.ts`, `fsrs.ts`
- `src/lib/db/seed-builtin-items.ts`
- `src/lib/db/queries/cards.ts`, `notes.ts`, `decks.ts`
- `src/views/LanguageDecks.svelte`, `DeckBrowse.svelte`
- `src/lib/components/deck/`, `DeckSourceBadge.svelte`

**Keep unchanged:**
- `src/lib/srs/wanikani-srs.ts` (reuse pattern)
- `src/lib/db/queries/kanji.ts`, `kanji-reviews.ts`
- `src/lib/db/seed/kanji-data.ts`
- All kanji views
- `src/lib/components/language/WkBadge.svelte`
- `src/lib/components/language/PitchAccentDisplay.svelte`

## Risks

1. **1GB deck processing**: Build script may be slow. Cache intermediate results.
2. **Seed data size**: 15k+ items with media could be 50-100MB. May need chunked loading or pre-built SQLite.
3. **Field mapping accuracy**: Automated mapping will miss edge cases. Manual curation required after Phase 0.
4. **Migration drops all old data**: Acceptable for pre-release. No production users yet.
5. **Unlock graph too strict**: Need escape hatch so users don't get stuck.

## Verification

After each phase:
- **Phase 0**: Review deck-analysis.json, confirm field mappings cover all decks
- **Phase 1**: App launches, language_items table populated, old tables gone, `SELECT count(*) FROM language_items GROUP BY content_type` returns expected counts
- **Phase 2**: Complete a lesson batch, review due items, verify SRS stage changes, verify unlock cascading
- **Phase 3**: Navigate all views, search works, WK badges appear, no "builtin"/"deck" terminology visible
- **Phase 4**: Search is fast (FTS), 15k vocab list scrolls smoothly, audio plays correctly

## Lessons Learned / Gotchas

(To be populated after implementation and routed to LL-G)
