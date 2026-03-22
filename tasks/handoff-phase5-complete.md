# Handoff: Phase 5 Complete -- Janki v0.19.0.1

## Status
All five development phases are COMPLETE. Commit `674c4a8` on `main`.
App version: 0.19.0.1 (package.json) / 0.19.0 (Tauri/Cargo).

## What Phase 5 Delivered
- **Test suites**: 3 new test files (40 tests) for language SRS engine, query cache, and answer validation. Total: 9 files, 107 tests, all passing.
- **Version sync**: Tauri and Cargo versions synced to 0.19.0 (were stuck at 0.5.0). Tauri build produces MSI + NSIS installers.
- **FTS rebuild**: `rebuildFtsIndex()` in `src/lib/db/queries/language.ts` + "Rebuild Search Index" button in Settings with loading state.
- **Undo stack cap**: Review undo capped at 10 entries (`MAX_UNDO_DEPTH`) in `LanguageReviewSession.svelte`.
- **Layout shift fix**: Skeleton placeholder for lazy-loaded SRS distribution in `LanguageOverview.svelte`.
- **Code extraction**: `normalizeAnswer` and `fuzzyMatch` extracted to `src/lib/utils/answer-validation.ts` (shared by LanguageReviewSession + LanguageLessonSession).
- **README**: Updated with full feature list, correct architecture, current project structure.

## Build Artifacts
- MSI: `src-tauri/target/release/bundle/msi/Janki_0.19.0_x64_en-US.msi`
- NSIS: `src-tauri/target/release/bundle/nsis/Janki_0.19.0_x64-setup.exe`

## Current Schema
- **Version**: 11 (migrations v1-v11 in `src/lib/db/migrations.ts`)
- **Key tables**: `language_items` (~33k rows), `language_fts` (FTS5 external content), `kanji_levels`, `daily_stats`, `language_review_log`, `review_log`

## Key Files
- `src/lib/db/migrations.ts` -- all 11 migrations
- `src/lib/db/query-cache.ts` -- TTL cache (60s default)
- `src/lib/db/queries/language.ts` -- all language queries including FTS5 search and FTS rebuild
- `src/lib/db/queries/stats.ts` -- daily stats + language review stats
- `src/lib/srs/language-srs.ts` -- WK-style SRS engine (stages 0-9, single dimension)
- `src/lib/srs/language-unlock.ts` -- progressive unlock logic per content type
- `src/lib/utils/answer-validation.ts` -- normalizeAnswer + fuzzyMatch
- `src/lib/components/language/LanguageReviewSession.svelte` -- review with undo/shortcuts/audio
- `src/lib/components/language/LanguageLessonSession.svelte` -- lessons with back-to-teaching
- `src/views/Settings.svelte` -- all settings including FTS rebuild
- `src/views/Stats.svelte` -- full stats page with heatmap + charts
- `src/views/Search.svelte` -- FTS5 search

## All Views
**Kanji (11):** Dashboard, Detail, Level, Levels, Radicals, Kanji, Vocabulary, Lessons, LessonPicker, Review, ExtraStudy
**Language (8):** Overview, Review, Lessons, LessonPicker, Vocabulary, Grammar, Sentences, Kana, Conjugation
**Tools (3):** Search, Stats, Settings
**Main (1):** Dashboard

## Known Pre-existing Issues
- `app-settings.svelte.ts`: 3 TypeScript cast warnings (AppSettings to Record<string, unknown>)
- `KanjiReviewSession.svelte`: 2 unreachable comparison errors (feedbackState type mismatch)
- Several shadcn-svelte components: missing `WithoutChild`/`WithoutChildrenOrChild` exports (upstream)
- 5 Svelte `state_referenced_locally` warnings (intentional initial-value captures)
- None affect runtime behavior.

## Performance Findings (Not Blocking, Future Work)
1. **Dashboard critical path**: `checkAndUnlockItems()` runs sequentially after parallel queries in `Dashboard.svelte:72-75`. Move to lazy second wave.
2. **Unlock N+1**: `unlockGrammar()` in `language-unlock.ts:87-116` issues per-JLPT-level COUNT queries. Batch with single IN query.
3. **Streak query**: `getStreak()` in `stats.ts:63-87` fetches all history rows with no LIMIT. Add LIMIT or recursive CTE.
4. **Uncached lesson count**: `getAvailableLessonCount()` called from 6 views with no cache. Add getCached/setCache pattern.
5. **Search grammar filter**: `Search.svelte:43-58` grammar derived runs on every keystroke with no minimum length guard.

## Lessons Learned from Phase 5
- Tauri uses 3-segment semver (0.19.0) while package.json uses 4-segment (0.19.0.1). Keep them in sync manually -- the Tauri config doesn't support the 4th segment.
- FTS5 `content=` external content tables require manual rebuild if the source table changes at runtime. The rebuild function handles this but users must trigger it manually from Settings.
- Extracting inline component functions to shared utilities is worth doing early -- the same normalizeAnswer was duplicated in two components.
- `tabindex="-1"` on headings is correct for programmatic focus (`.focus()` works, but element stays out of tab order). This is the intended pattern for view-change focus management.
