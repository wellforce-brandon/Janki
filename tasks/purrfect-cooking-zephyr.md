# Unified Language Section -- Design Plan

## Context

Janki has three isolated learning systems: Decks (Anki imports with FSRS-6), Kanji (WaniKani structured progression), and Language (static grammar/reading reference). The user wants to merge Decks and Language into a single **Language** section that auto-categorizes imported content by type (vocabulary, grammar, sentences, kana, etc.) and enables cross-deck study by content type. WaniKani stays as its own independent section.

**Key constraints:**
- Japanese-specific app
- WaniKani SRS does NOT auto-update from Language activity
- Cross-references between sections OK, just not automatic SRS sync
- Existing FSRS scheduling continues to work for flashcard review

## Deck Analysis Results

27 .apkg files parsed (~67k notes, ~75k cards, ~40k media files). Content types cluster into:

| Type | Field Pattern | Example Decks | Notes |
|------|--------------|---------------|-------|
| **Kana** | Character + Reading + Audio + Strokes | Hiragana, Katakana, FJSD-Kana | ~300 notes |
| **Kanji** | Character + Meanings + On/Kun + Strokes + JLPT + Freq | JLPT N4/N5, Kanji Drawing, FJSD-Kanji | ~3k notes |
| **Vocabulary** | Word + Reading + Meaning + POS + Audio + Sentence + Pitch | Core 2k/6k, Kaishi 1.5k, Genki | ~12k notes |
| **Grammar** | Point + Meaning + Usage + Example Phrases | FJSD-Grammar, Tae Kim (4 variants) | ~3k notes |
| **Sentences** | Sentence + Translation + Audio + Source | Core 2k6k, Jlab/anime | ~8k notes |
| **Radicals** | Element + Meaning + Related Kanji + Mnemonic | FJSD-Radical, Kaishi elements | ~540 notes |
| **Conjugation** | Stem + Meaning + Forms (te, bases 1-5) | 106 Common Verbs | ~108 notes |
| **Textbook** | Lesson-ordered vocab/kanji/grammar | Genki 1 & 2 (6 decks) | ~5k notes |

**Pitch accent**: Core 2000/6000 decks contain OJAD HTML tables. Kaishi 1.5k has pitch accent fields. No add-on needed.

---

## 1. Data Model (Migration v9)

### New Tables

**`content_tags`** -- classifies each note into content types

```sql
CREATE TABLE content_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,  -- 'kana','kanji','vocabulary','grammar','sentence','radical','conjugation'
    confidence REAL NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL DEFAULT 'auto',  -- 'auto','user','builtin'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(note_id, content_type)
);
CREATE INDEX idx_content_tags_type ON content_tags(content_type);
CREATE INDEX idx_content_tags_note ON content_tags(note_id);
```

**`content_type_fields`** -- maps note_type fields to semantic roles

```sql
CREATE TABLE content_type_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_type_id INTEGER NOT NULL REFERENCES note_types(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    semantic_role TEXT NOT NULL,  -- 'primary_text','reading','meaning','audio','example_sentence','pitch_accent','stroke_order','mnemonic','pos','jlpt_level','frequency','image'
    UNIQUE(note_type_id, content_type, field_name)
);
CREATE INDEX idx_ctf_notetype ON content_type_fields(note_type_id);
```

**`builtin_items`** -- promotes static grammar/reading content to SRS-trackable

```sql
CREATE TABLE builtin_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    item_key TEXT NOT NULL UNIQUE,
    data TEXT NOT NULL,  -- JSON blob
    jlpt_level TEXT,
    stability REAL NOT NULL DEFAULT 0,
    difficulty REAL NOT NULL DEFAULT 0,
    due TEXT NOT NULL DEFAULT (datetime('now')),
    last_review TEXT,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL DEFAULT 0,
    scheduled_days INTEGER NOT NULL DEFAULT 0,
    elapsed_days INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_builtin_type ON builtin_items(content_type);
CREATE INDEX idx_builtin_due ON builtin_items(due);
CREATE INDEX idx_builtin_state ON builtin_items(state);
```

**`builtin_review_log`** -- review history for builtin items

```sql
CREATE TABLE builtin_review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    builtin_item_id INTEGER NOT NULL REFERENCES builtin_items(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    state INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    elapsed_days INTEGER NOT NULL,
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    duration_ms INTEGER,
    reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_builtin_review_item ON builtin_review_log(builtin_item_id);
```

### Why a classification layer, not normalized tables per type?

Normalizing vocabulary into a `vocabulary` table, grammar into `grammar`, etc. would require duplicating all FSRS scheduling logic, rewriting the review/scheduler/stats system, and a destructive migration. The classification approach adds a lightweight overlay. The existing `notes` table keeps storing data as JSON fields. `content_type_fields` tells the UI which fields map to which semantic roles. Existing `cards`/`notes`/`review_log`/scheduler code stays untouched.

---

## 2. Import Pipeline -- Content Classifier

### New file: `src/lib/import/content-classifier.ts`

Runs after `mapAnkiToDeck()` completes. Analyzes each note_type's field names with a scoring heuristic:

**Strong indicators** (3 points each): field names that uniquely identify a content type
- Kana: Romaji, StrokeOrder
- Kanji: Onyomi, Kunyomi, Nanori, Components, JLPT
- Vocabulary: Part of Speech, Pitch Accent, Word Audio, Frequency
- Grammar: Point, Usage, Phrases, Formation
- Sentence: Sentence (as primary), sentence-audio, Source (anime/show name)
- Radical: Radical, Element, Related Kanji
- Conjugation: Stem, TeTaForm, Base1, DictionaryForm

**Weak indicators** (1 point each): shared fields like Reading, Meaning, Audio

**Threshold**: 3+ points to classify. Notes can have multiple tags (e.g. Kaishi 1.5k = vocabulary + sentence).

After scoring, populates `content_type_fields` by matching field names to semantic roles using regex patterns.

### Integration: Hook into `deck-mapper.ts`

After `mapAnkiToDeck()` returns, call `classifyDeckContent(deckId)`. Also provide `reclassifyAllContent()` for retroactive classification from Settings.

---

## 3. UI / Navigation

### Sidebar Restructure

Replace "Decks" and "Language" sections with a single "Language" section:

```
Language
  Overview        (lang-overview)
  Kana            (lang-kana)
  Vocabulary      (lang-vocabulary)
  Grammar         (lang-grammar)
  Sentences       (lang-sentences)
  Conjugation     (lang-conjugation)
  Review          (lang-review)
  Manage Decks    (lang-decks)
```

### View Types

Add to `navigation.svelte.ts`:
```typescript
| "lang-overview" | "lang-kana" | "lang-vocabulary" | "lang-grammar"
| "lang-sentences" | "lang-conjugation" | "lang-review" | "lang-decks"
| "lang-browse"
```

Remove: `"decks"`, `"grammar"`, `"reading"` (redirect old routes to new equivalents)

### View Descriptions

| View | Purpose |
|------|---------|
| **lang-overview** | Dashboard: counts per content type, due reviews, import button |
| **lang-kana** | Hiragana/Katakana grid from imports, stroke order, SRS study toggle |
| **lang-vocabulary** | Cross-deck vocab browser with filters (JLPT, frequency, POS, SRS state, deck) |
| **lang-grammar** | Merges static grammar (from data/grammar/) with imported grammar decks, JLPT tabs |
| **lang-sentences** | Replaces Reading.svelte -- sentence cards from imports + built-in, reading mode + review mode |
| **lang-conjugation** | Verb conjugation tables and drills (only shown if conjugation content detected) |
| **lang-review** | Unified review queue with content type filter, reuses ReviewSession component |
| **lang-decks** | Replaces Decks.svelte -- import/delete/reclassify, content type badges per deck |
| **lang-browse** | Detail view for any item -- all fields, SRS state, WK cross-reference links |

### New Components

```
src/lib/components/language/
    LanguageOverviewCard.svelte
    ContentTypeFilter.svelte
    VocabularyCard.svelte
    GrammarPointCard.svelte
    SentenceCard.svelte
    PitchAccentDisplay.svelte
    ContentTypeBadge.svelte
    DeckSourceBadge.svelte
```

---

## 4. Review System

### Unified Review Queue (`src/lib/srs/language-scheduler.ts`)

Pulls from two sources:
1. **cards table** (imported deck content) -- joined with `content_tags` for filtering
2. **builtin_items table** (promoted static content) -- grammar points, reading sentences

Returns `UnifiedReviewItem[]` sorted by due date. Content type filter optional.

### Built-in Scheduler (`src/lib/srs/builtin-scheduler.ts`)

Mirrors existing `processReview()` from scheduler.ts but targets `builtin_items` and `builtin_review_log`. Uses same ts-fsrs library.

### ReviewSession Adaptation

Generalize `ReviewSession.svelte` to accept `UnifiedReviewItem[]`. For `builtin_items` without Anki templates, use default templates per content type:
- Grammar: front = pattern + formation, back = meaning + explanation + examples
- Sentence: front = Japanese text, back = reading + translation

---

## 5. Cross-References

When displaying vocabulary/kanji in Language section, look up `kanji_levels` for matching characters. Show a "WK" badge (clickable, navigates to kanji-detail) with WK SRS stage color. Read-only -- no SRS sync.

New query in `src/lib/db/queries/language.ts`:
```typescript
async function findWkCrossReference(character: string): Promise<WkRef | null>
```

---

## 6. Phased Implementation

### Phase 1: Foundation
1. Migration v9 -- add all new tables
2. Build `content-classifier.ts` with scoring heuristics
3. Build `src/lib/db/queries/language.ts` with basic queries
4. Seed `builtin_items` from `data/grammar/n5.json` and Reading.svelte static data
5. Run classifier on existing imported decks
6. Tests for classifier against known deck field patterns

### Phase 2: Core
1. Add new View types to `navigation.svelte.ts`
2. Restructure `Sidebar.svelte` -- merge Decks into Language
3. Build LanguageOverview, LanguageVocabulary, LanguageGrammar, LanguageSentences views
4. Build LanguageDecks (deck management moved here)
5. Update `App.svelte` routing
6. Redirect old grammar/reading routes

### Phase 3: Polish
1. Build `language-scheduler.ts` and `builtin-scheduler.ts`
2. Build LanguageReview with content type filtering
3. Generalize ReviewSession for unified items
4. WaniKani cross-reference badges
5. PitchAccentDisplay component
6. LanguageKana and LanguageConjugation views

### Phase 4: Ship
1. Update stats queries to include builtin reviews
2. Update Search with content type facets
3. Update Dashboard with Language summary
4. Remove old Grammar.svelte, Reading.svelte
5. Keyboard shortcuts
6. End-to-end testing: import -> classify -> browse -> review

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `src/lib/db/migrations.ts` | Add migration v9 with 4 new tables |
| `src/lib/import/deck-mapper.ts` | Hook classifier after mapAnkiToDeck() |
| `src/lib/stores/navigation.svelte.ts` | Add lang-* views, update SECTION_ROOTS, remove old views |
| `src/App.svelte` | Route new lang-* views, redirect old grammar/reading |
| `src/lib/components/layout/Sidebar.svelte` | Restructure sections |
| `src/lib/db/queries/language.ts` | New file -- all language queries |
| `src/lib/import/content-classifier.ts` | New file -- classification engine |
| `src/lib/srs/language-scheduler.ts` | New file -- unified review queue |
| `src/lib/srs/builtin-scheduler.ts` | New file -- FSRS for builtin items |

## Verification

1. Import one of the downloaded .apkg files and verify content tags are created
2. Check lang-overview shows correct counts per content type
3. Browse vocabulary across multiple imported decks with filters
4. Verify grammar view shows both built-in and imported grammar
5. Run a review session mixing card-based and builtin items
6. Click a WK cross-reference badge and verify navigation to kanji-detail
7. Verify old grammar/reading routes redirect correctly

## Risks

- **Classifier accuracy**: Heuristic scoring may misclassify. Mitigation: user can override tags, confidence field flags uncertain ones, reclassify always available.
- **Performance on large datasets**: 30k+ notes with JOINs. Mitigation: indexes + pagination.
- **Pitch accent HTML safety**: Raw HTML from decks. Mitigation: existing `sanitizeCardHtml()` + additional sanitization in PitchAccentDisplay.
- **FSRS parity**: builtin_items duplicates FSRS fields. Mitigation: identical field types, same ts-fsrs library.

## Lessons Learned / Gotchas
(To be filled after implementation and routed to LL-G)
