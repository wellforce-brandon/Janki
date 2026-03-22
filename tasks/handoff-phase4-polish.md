# Handoff: Phase 4 -- Polish & Performance

## Status
Phase 3 (UI Rebuild) is COMPLETE. Commit `dcde705`.
Next: Phase 4 -- Polish (FTS5 search, stats page, performance tuning).

## What Phase 3 Delivered
- Language lesson picker (`LanguageLessonPicker.svelte`): per-type selection, auto-batch 5/10, interleave toggle
- Language lesson session (`LanguageLessonSession.svelte`): two-phase teaching (Info/Examples/Reading tabs) + quiz with reshuffled failures
- Language lessons view (`LanguageLessons.svelte`): auto-batch and picker-selected modes via URL params
- Review session polish: fuzzy matching (60%+ word overlap for 3+ word answers), SRS stage transition animation, item info peek after answering
- Language Overview enhancements: lesson count + button, SRS distribution bar chart, recently unlocked items
- Dashboard enhancements: language lesson count, quick-start buttons, SRS distribution badges
- Sidebar: "Lessons" entry under Language section with `lang-lesson-picker` subview
- Navigation: `lang-lessons` and `lang-lesson-picker` views wired

## Current State of the Codebase
- **Lesson flow**: fully functional -- picker -> teaching -> quiz -> completeLessonBatch -> scheduled reviews
- **Review flow**: fully functional -- start -> answer (with fuzzy matching) -> SRS update -> info peek -> next -> summary
- **Dashboard**: shows kanji + language stats, lesson/review counts, quick-start buttons
- **Language Overview**: content cards, SRS distribution chart, recently unlocked items, lesson/review buttons
- **All views use semantic color tokens** (bg-primary, bg-card, text-muted-foreground, etc.) from the Japan theme

## Key Files to Read First
- `src/views/LanguageLessonPicker.svelte` -- lesson picker with type grouping
- `src/views/LanguageLessons.svelte` -- lesson view (auto-batch or picker params)
- `src/lib/components/language/LanguageLessonSession.svelte` -- teaching + quiz component
- `src/lib/components/language/LanguageReviewSession.svelte` -- polished review session
- `src/views/LanguageOverview.svelte` -- overview with SRS distribution
- `src/views/Dashboard.svelte` -- dashboard with language section
- `src/lib/db/queries/language.ts` -- all language queries including getRecentlyUnlockedItems

## Phase 4 Tasks

### 4.1 FTS5 Full-Text Search
- Add migration to create FTS5 virtual table for language_items (primary_text, reading, meaning, explanation)
- Update the Search view to query FTS5 for language items alongside existing card search
- Highlight matched terms in search results

### 4.2 Stats Page Enhancements
- Add language review stats to the Stats view (reviews per day, accuracy by content type, SRS stage progression over time)
- Add language-specific daily stats tracking (currently only kanji reviews tracked in daily_stats)
- Show combined kanji + language review heatmap

### 4.3 Performance Tuning
- Profile dashboard load time -- currently loads 8 parallel queries
- Add query result caching for counts that don't change within a session (content type totals)
- Lazy-load the SRS distribution and recently unlocked sections in overview
- Consider virtual scrolling for lesson picker when item counts are large (200+)

### 4.4 Review Session Improvements
- Add keyboard shortcut hints overlay (press ? to show)
- Add audio playback for items with audio_file set
- Add undo last answer (within same session)

### 4.5 Lesson Session Improvements
- Add "Back to Teaching" button during quiz phase
- Add progress indicator showing which items user already viewed
- Auto-advance to next item on swipe gesture (mobile/tablet)

### 4.6 Edge Cases & Polish
- Handle empty database gracefully (first launch before data seed)
- Add loading skeletons to all views (some only show LoadingState text)
- Ensure all toast messages are consistent in tone and timing

## Navigation Routes (Current)
| View | Route |
|------|-------|
| Dashboard | `dashboard` |
| Language Overview | `lang-overview` |
| Language Review | `lang-review` |
| Language Lessons | `lang-lessons` |
| Language Lesson Picker | `lang-lesson-picker` |
| Kanji Dashboard | `kanji-dashboard` |
| Kanji Lessons | `kanji-lessons` |
| Kanji Review | `kanji-review` |
| Search | `search` |
| Stats | `stats` |
| Settings | `settings` |

## Lessons Learned from Phase 3
- `{@const}` in Svelte 5 must be inside `{#if}`, `{#each}`, or similar blocks -- not at template top level. Use `{#each [computed] as x}` pattern as workaround.
- The language review is single-dimension (meaning only), unlike kanji which has meaning+reading. This keeps the quiz simpler but means fuzzy matching is more important for longer answers.
- The `completeLessonBatch()` function schedules first reviews at Apprentice 1 (4 hours). Items show up in reviews after that interval.
- SRS stage names are shared between kanji and language (`STAGE_NAMES` from wanikani-srs.ts).
