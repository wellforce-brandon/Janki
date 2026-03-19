# Changelog

All notable changes to Janki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.4.0.0] - 2026-03-18

### Added

- FSRS-6 SRS engine wrapping ts-fsrs: createNewCard, reviewCard, getNextIntervals
- Review scheduler with configurable daily new/review card limits
- WaniKani-style fixed-interval SRS engine (10 stages: Locked through Burned)
- Anki .apkg import pipeline using JSZip + sql.js (browser-compatible, no Node.js deps)
- Import deck mapper with DOMPurify sanitization of all card HTML
- Media extractor with hybrid storage (BLOBs < 1MB, filesystem for larger)
- DB query modules: cards, decks, notes, reviews, kanji, stats (all with safeQuery wrapper)
- Flashcard review UI with 3D flip animation and keyboard shortcuts (Space to flip, 1-4 to rate)
- Color-coded rating buttons (Again/Hard/Good/Easy) with next interval preview
- Review session flow controller with post-session summary (accuracy, time, count)
- Deck management: grid view, create/edit/delete, import dialog with progress
- Deck browse view with card table, sorting, and front/back preview
- WaniKani-style kanji level map (60 levels, color-coded by progress)
- Kanji detail view with large character, meanings, readings, stroke order, radicals
- SRS stage indicator badges (color-coded: Apprentice pink, Guru purple, Master blue, etc.)
- Level progress bar component
- Stroke order SVG loader component (KanjiVG on-demand loading)
- Dashboard with summary cards (due count, kanji due, streak, total cards)
- Dashboard quick actions and today's stats display
- Kanji data seeding from davidluzgouveia/kanji-data (13,108 entries, 60 WK levels)
- DB initialization and kanji seeding on app startup
- shadcn-svelte UI components: button, card, dialog, input, label, separator, badge, tooltip, scroll-area, tabs, progress
- cn() utility for Tailwind class merging (clsx + tailwind-merge)
- 25 new tests (34 total): FSRS wrapper (7), WaniKani SRS (12), deck-mapper (6)

### Changed

- Dev server port changed to 7755
- Vite publicDir set to "public" for static data files
- tsconfig.json: added bare $lib path alias for shadcn-svelte compatibility
- Biome config: excluded public/data from linting (large JSON files)

## [0.3.0.0] - 2026-03-18

### Added

- Tauri 2.x + Svelte 5 app scaffold (src/ and src-tauri/)
- Vite config with Tailwind CSS 4 and $lib path alias
- Biome 2.x linter/formatter with Svelte overrides
- Vitest config with jsdom environment and 9 passing tests
- SQLite database layer with migration system (version-tracked, safeQuery wrapper)
- Full initial schema: settings, decks, note_types, notes, cards, review_log, kanji_levels, kanji_dependencies, media, daily_stats
- DOMPurify sanitization utility for Anki card HTML
- App shell with sidebar navigation, header, and dark/light theme toggle
- Placeholder views: Dashboard, Review, KanjiMap, Decks, Stats, Search, Settings
- Store-based SPA routing with keyboard shortcuts (Ctrl+1-5, Ctrl+F)
- Tauri plugin registration: tauri-plugin-sql, tauri-plugin-fs, tauri-plugin-dialog
- Tauri capabilities for SQL, filesystem, and dialog permissions
- Subfolder CLAUDE.md files for src/ and src-tauri/
- 6 new LL-G lessons contributed (Tauri: 1, Svelte: 3, TypeScript: 3)

## [0.2.0.0] - 2026-03-18

### Added

- BP best practices integration with audit protocol and per-phase checkpoints
- Design guardrails reference (component rules, color system, typography, accessibility, animation)
- Path-scoped rules for frontend (.claude/rules/frontend.md), database (.claude/rules/database.md), and tests (.claude/rules/tests.md)
- Agent memory system with architectural decisions, patterns, and debugging log
- Infrastructure reference updated for Janki desktop architecture
- DOMPurify HTML sanitization in stack and plan

### Changed

- Project plan comprehensively rewritten with 29 improvements:
  - Fixed scaffold strategy to work with existing repo (temp dir + selective copy)
  - Added anki-reader Tauri compatibility investigation with JSZip/sql.js fallback
  - Added FTS5 search instead of LIKE queries
  - Added error handling strategy, data migration strategy, testing strategy
  - Added ts-fsrs API mapping, undo review mechanics, chart specifications
  - Added kanji data download details, KanjiVG joyo-only strategy
  - Added Phase 4 specifics: grammar JSON schema, Tatoeba/jmdict loading, furigana rendering
- Updated agents (architect, reviewer, security) with Janki-specific context
- Updated init-repo skill with expanded hook types and setting options
- Updated LL-G check rule with Janki-specific technologies
- Reorganized CLI tools reference

## [0.1.0.0] - 2026-03-18

### Added

- Project plan with full tech stack: Tauri 2.x, Svelte 5, shadcn-svelte, Tailwind CSS 4, SQLite, FSRS-6
- README with architecture diagram, prerequisites, and data source attributions
- Design guardrails for UI consistency, accessibility, and performance
- CLI tools reference for development workflow
- Database schema design covering cards, decks, reviews, kanji levels, and statistics
- Four-phase development plan (Foundation, Core, Polish, Ship)
- LL-G integration with mandatory check and contribution protocols per phase
