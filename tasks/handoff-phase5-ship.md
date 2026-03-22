# Handoff: Phase 5 -- Ship & Release

## Status
Phase 4 (Polish & Performance) is COMPLETE. Commit `0c0278f`.
Next: Phase 5 -- Ship (release prep, testing, packaging, final polish).

## What Phase 4 Delivered
- **FTS5 Search**: Migration v11 creates `language_fts` virtual table. Search view uses FTS5 with ranked results (LIKE fallback). Structured result display with per-field highlighting.
- **Stats Enhancements**: Language review daily stats from `language_review_log`. Combined kanji+language review heatmap. Language SRS distribution. Content type review breakdown with visual bars. Language review charts (daily + accuracy trend).
- **Performance**: Query cache (`query-cache.ts`) with TTL for content type counts. Lazy-load in LanguageOverview (counts first, then SRS/recent). Cache invalidated on SRS review.
- **Review Session**: Keyboard shortcut hints overlay (? key). Audio playback (Alt+P, TTS). Undo last answer (Ctrl+Z) with full SRS state rollback.
- **Lesson Session**: "Back to Teaching" button during quiz. Progress indicator (viewed/total) with thumbnail opacity.
- **Loading States**: Skeleton card component (`skeleton-cards.svelte`). Replaced spinner loading across 10+ views. Empty database detection on Dashboard.

## Current State of the Codebase
- **Schema version**: 11 (language_fts added in v11)
- **All views functional**: Dashboard, Language Overview, Lesson Picker, Lessons, Review, Search, Stats
- **All language content types**: kana, vocabulary, grammar, sentence, conjugation
- **SRS engine**: WK-style stages 0-9, single-dimension reviews, undo support
- **Seeded data**: ~33k language items from pre-built JSON

## Key Files
- `src/lib/db/migrations.ts` -- all 11 migrations
- `src/lib/db/query-cache.ts` -- TTL query cache
- `src/lib/db/queries/language.ts` -- all language queries (FTS5 search)
- `src/lib/db/queries/stats.ts` -- daily stats + language review stats
- `src/lib/components/language/LanguageReviewSession.svelte` -- review with undo/shortcuts/audio
- `src/lib/components/language/LanguageLessonSession.svelte` -- lessons with back-to-teaching
- `src/lib/components/ui/skeleton-cards.svelte` -- loading skeleton component
- `src/views/Stats.svelte` -- full stats page with heatmap
- `src/views/Search.svelte` -- FTS5 search

## Phase 5 Tasks

### 5.1 Testing & Validation
- Run existing Vitest test suite and fix any broken tests
- Add tests for language SRS engine (reviewLanguageItem, calculateDrop, stage transitions)
- Add tests for query cache (get/set/invalidate, TTL expiry)
- Add tests for FTS5 search query construction
- Add tests for answer normalization and fuzzy matching
- Manual smoke test: full lesson flow, review flow, undo, search, stats

### 5.2 Tauri Build & Packaging
- Sync `src-tauri/tauri.conf.json` version to 0.19.0
- Sync `src-tauri/Cargo.toml` version to 0.19.0
- Test `cargo tauri build` produces working installer
- Verify database migration runs clean on fresh install (no existing DB)
- Verify migration v11 runs clean on existing v10 database

### 5.3 Data Integrity
- Verify language_fts stays in sync (content= external content table, read-only columns)
- Add FTS rebuild command in Settings for manual re-index if data changes
- Verify undo doesn't leave orphaned review_log entries
- Verify cache invalidation works after review sessions

### 5.4 Accessibility & Polish
- Verify keyboard navigation works across all views (Tab, Enter, Escape)
- Verify dark mode contrast on all new UI elements (heatmap, skeleton cards, shortcut overlay)
- Verify screen reader announces view changes (focus management already in App.svelte)
- Review all toast messages for consistent tone and timing

### 5.5 Performance Validation
- Profile Dashboard load time (should be < 500ms with cache)
- Profile Search with large dataset (33k items via FTS5)
- Verify LanguageOverview lazy-load doesn't cause layout shift
- Check memory usage with long review sessions (undo stack growth)

### 5.6 Release Prep
- Update README with current feature list
- Create GitHub release with changelog
- Tag v0.19.0
- Generate installer artifact

## Known Pre-existing Issues (Not Phase 4)
- `app-settings.svelte.ts` has 3 TypeScript cast warnings (AppSettings to Record<string, unknown>)
- `KanjiReviewSession.svelte` has 2 unreachable comparison errors (feedbackState type mismatch)
- Several shadcn-svelte components have missing `WithoutChild`/`WithoutChildrenOrChild` exports (upstream type issue)
- These are all pre-existing and do not affect runtime behavior.

## Architecture Notes
- FTS5 table uses `content=language_items, content_rowid=id` (external content). The searchable columns (primary_text, reading, meaning, explanation) are populated once at migration time and don't change during normal use. SRS fields are not indexed.
- Query cache is simple Map-based with TTL. No persistence, clears on page reload. Only `contentTypeCounts` is cached currently.
- Undo stack in review session stores previous SRS state per item. Stack grows unbounded within a session but is discarded when session completes.
- Skeleton cards component accepts `count` and `columns` props (2/3/4 grid layouts).

## Lessons Learned from Phase 4
- SQLite FTS5 `content=` tables require manual sync if source data changes -- the initial INSERT in the migration populates the index, but any runtime insertions to `language_items` would need corresponding FTS inserts. Currently not an issue since data is seeded once.
- Vite warns about mixed static/dynamic imports of the same module. Avoid `await import()` for modules already statically imported elsewhere.
- Svelte 5 `$derived` should be used for any computed value that references `$props()` or `$state()`, even if it looks like it could be a `const`. Using `const` captures the initial value only.
