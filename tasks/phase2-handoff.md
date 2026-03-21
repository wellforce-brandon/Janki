# Phase 2 Handoff: Unified Language Section -- Core UI & Navigation

## Context

Phase 1 (commit 0421407) added the foundation for the unified Language section:
- Migration v9 with 4 new tables: `content_tags`, `content_type_fields`, `builtin_items`, `builtin_review_log`
- Content classifier (`src/lib/import/content-classifier.ts`) that auto-detects 7 content types from Anki deck field names
- Language query layer (`src/lib/db/queries/language.ts`) for cross-deck browsing, content type counts, WK cross-references
- Builtin items seeder (`src/lib/db/seed-builtin-items.ts`) for promoting static grammar/reading to SRS-trackable items
- Classifier hooked into import pipeline in `src/lib/import/deck-mapper.ts`

The full design plan is at `tasks/purrfect-cooking-zephyr.md`. Read it first.

## What Phase 2 Needs to Build

### 1. Navigation Changes (`src/lib/stores/navigation.svelte.ts`)

Add new View types:
```typescript
| "lang-overview" | "lang-kana" | "lang-vocabulary" | "lang-grammar"
| "lang-sentences" | "lang-conjugation" | "lang-review" | "lang-decks"
| "lang-browse"
```

Remove old views: `"decks"`, `"grammar"`, `"reading"` -- but add fallback redirects so old routes map to new ones.

Update `SECTION_ROOTS` so all `lang-*` views map back to `lang-overview`.

### 2. Sidebar Restructure (`src/lib/components/layout/Sidebar.svelte`)

Replace the "Decks" and "Language" sidebar sections with a single "Language" section:
- Overview
- Kana
- Vocabulary
- Grammar
- Sentences
- Conjugation (only show if conjugation content exists)
- Review
- Manage Decks

Keep "WaniKani" (kanji) section unchanged.

### 3. App Routing (`src/App.svelte`)

Add routing for all new `lang-*` views. Remove old `grammar`/`reading`/`decks` routes (replace with redirects to `lang-grammar`/`lang-sentences`/`lang-decks`).

Update keyboard shortcuts:
- Ctrl+2: lang-overview (was decks)
- Ctrl+3: lang-review (was deck-review)
- Ctrl+5: lang-grammar (was grammar)
- Ctrl+6: lang-sentences (was reading)

### 4. New View Components

All views go in `src/views/`. Each should follow existing patterns (Svelte 5 runes, Tailwind, dark mode variants).

**LanguageOverview.svelte** (`lang-overview`)
- Uses `getContentTypeCounts()` from language.ts
- Shows summary cards per content type (total items, due reviews, new items)
- "Start Review" button linking to lang-review
- Import .apkg button (reuse existing ImportDialog)
- On first load, call `seedBuiltinItems()` to populate grammar/sentence builtin items

**LanguageVocabulary.svelte** (`lang-vocabulary`)
- Uses `getNotesByContentType('vocabulary')` from language.ts
- Cross-deck vocabulary browser with filters (deck, SRS state)
- Uses `getSemanticFields()` to display fields by semantic role (word, reading, meaning, pitch accent, etc.)
- Search box filtering on note fields
- Paginated list/card view

**LanguageGrammar.svelte** (`lang-grammar`)
- Merges builtin grammar items (`getBuiltinItems('grammar')`) with imported grammar notes (`getNotesByContentType('grammar')`)
- JLPT level tabs
- Each grammar point shows pattern, meaning, formation, examples
- Similar to current Grammar.svelte but with SRS tracking capability

**LanguageSentences.svelte** (`lang-sentences`)
- Replaces Reading.svelte
- Merges builtin sentences with imported sentence notes
- Reading mode (sequential, like current Reading.svelte) and browse mode
- Furigana toggle, TTS -- carry over from Reading.svelte

**LanguageDecks.svelte** (`lang-decks`)
- Replaces Decks.svelte
- Shows imported decks with content type badges (using `getDeckContentTypes()`)
- Import/delete functionality (reuse existing ImportDialog and deck deletion logic)
- "Reclassify" button per deck (calls `classifyDeckContent()`)

**LanguageKana.svelte** (`lang-kana`)
- Shows kana content from imported decks
- Simple grid view of hiragana/katakana

**LanguageConjugation.svelte** (`lang-conjugation`)
- Shows verb conjugation content from imports
- Table view of stems and forms

### 5. New Components (`src/lib/components/language/`)

- `ContentTypeBadge.svelte` -- Small colored badge showing content type name
- `DeckSourceBadge.svelte` -- Shows which deck an item came from
- `LanguageOverviewCard.svelte` -- Summary card widget for overview dashboard
- `ContentTypeFilter.svelte` -- Reusable filter bar for content type views

## Key Files to Reference

- `src/views/Grammar.svelte` -- Current grammar view to evolve from
- `src/views/Reading.svelte` -- Current reading view to evolve from
- `src/views/Decks.svelte` -- Current decks view to evolve from
- `src/views/KanjiDashboard.svelte` -- Good pattern for dashboard layout and lazy seeding
- `src/lib/components/layout/Sidebar.svelte` -- Sidebar structure to modify
- `src/lib/stores/navigation.svelte.ts` -- Navigation state management
- `src/App.svelte` -- Top-level routing

## What NOT to Touch in Phase 2

- WaniKani section (kanji-*) stays completely unchanged
- Review system (Phase 3) -- don't build lang-review yet, just add a placeholder
- Builtin scheduler (Phase 3) -- don't build FSRS for builtin_items yet
- WK cross-reference badges (Phase 3)
- PitchAccentDisplay component (Phase 3)

## Testing

- Run `npx vitest run` after changes -- all 99 existing tests must still pass
- Verify the app builds with `npm run build`
- Manual testing: navigate to each new view, verify sidebar links work, verify old keyboard shortcuts redirect correctly
