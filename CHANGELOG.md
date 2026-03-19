# Changelog

All notable changes to Janki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.6.0.0] - 2026-03-19

### Added

- Grouped sidebar navigation: Decks, Kanji, Language, and Tools sections with collapsible headers
- Kanji Dashboard, Kanji Lessons, and Kanji Review stub views with navigation wiring
- Section-aware `navigateBack()` helper for sub-view navigation
- Database migration v3: `kanji_review_log` table for review history tracking
- `lesson_completed_at`, `user_notes`, `user_synonyms` columns on `kanji_levels` table
- Backfill migration: existing unlocked items treated as lesson-completed
- Kanji review log queries: logKanjiReview(), getTodayKanjiReviewCount(), getKanjiReviewStats()
- User notes and synonyms update queries for kanji items
- WaniKani-style kanji review session with typed meaning and reading answers
- Romaji-to-hiragana real-time input converter for reading questions (handles double consonants, n-before-consonant, combination syllables)
- Green/red feedback bars, progress tracking, and remaining counter in kanji reviews
- Review completion summary with accuracy, time, and unlock notifications
- Unlock cascade triggered on kanji review promotions via checkAndUnlockLevel()
- Review duration tracking per item
- Toast notifications, empty state, and loading state reusable components
- Undo system for deck-based FSRS reviews
- Search with FTS5 support for cards and kanji
- 16 new tests for romaji-to-hiragana converter (72 total)

### Changed

- Sidebar restructured from flat list to grouped sections (Decks, Kanji, Language, Tools)
- View type renamed: "review" to "deck-review", "kanji" to "kanji-map"
- All navigate() call sites updated for new view names
- reviewKanjiItem() now logs reviews, triggers unlock cascade, accepts level and duration params
- getDueKanjiReviews() and getDueKanjiCount() now require lesson_completed_at IS NOT NULL
- KanjiLevelItem interface extended with lesson_completed_at, user_notes, user_synonyms
- Dashboard, Stats, Settings, and all views updated for new navigation structure

## [0.5.0.0] - 2026-03-18

### Added

- Auto-updater via tauri-plugin-updater with GitHub Releases endpoint
- Non-blocking update check on app launch with dialog prompt
- Manual "Check for Updates" button in Settings
- System tray with icon, "Open Janki" and "Quit" menu items
- Left-click tray icon to restore window, right-click for menu
- Tray tooltip showing "Janki"
- Backup & restore: export database to user-chosen location
- Backup & restore: import/restore from backup file (with pre-restore safety backup)
- Auto-backup on each launch to $APPDATA/janki/backups/ (keeps last 7)
- Backup & Restore section in Settings with Export/Import buttons
- Grammar reference view with 37 N5 grammar points (particles, conjugations, expressions)
- Grammar point detail with pattern, formation, explanation, examples, and related grammar links
- Grammar search by pattern, meaning, tags, and example text
- Reading practice view with N5 and N4 example sentences
- Furigana rendering via ruby HTML tags with show/hide toggle
- Japanese text utilities: isKanji, isHiragana, isKatakana, isKana, containsKanji
- simpleFurigana() for basic kanji-reading alignment
- furiganaToHtml() for building ruby tag markup from segments
- TTS integration in Reading practice (speak current sentence)
- Translation toggle in Reading practice (show/hide English)
- Navigation items for Grammar (Ctrl+5) and Reading (Ctrl+6)
- 17 new tests for Japanese text utilities (56 total)

### Changed

- Sidebar navigation expanded: Grammar and Reading added between Decks and Stats
- Keyboard shortcuts renumbered: Grammar=Ctrl+5, Reading=Ctrl+6, Stats=Ctrl+7
- Tauri config: added updater plugin config and createUpdaterArtifacts bundle flag
- Tauri features: added tray-icon and image-png to core tauri dependency
- Capabilities: added fs:allow-copy-file, fs:allow-remove, fs:allow-rename, fs:allow-read-dir, dialog:allow-ask, dialog:allow-message, updater permissions
- Version synced across package.json (0.5.0.0), Cargo.toml (0.5.0), tauri.conf.json (0.5.0)
- About section in Settings updated to v0.5.0
- FTS5 query string concatenation changed to template literal (lint fix)

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
