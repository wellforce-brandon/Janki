# Changelog

All notable changes to Janki will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.11.0.0] - 2026-03-20

### Added

- Level Progress widget on Kanji Dashboard with inline level cycling (chevron arrows), level picker grid, per-type progress cards (Radicals/Kanji/Vocabulary with Guru'd counts), and SRS-colored kanji block progress bar
- Inline "See All" type detail view within the Level Progress widget with scrollable item grid and SRS stage dots
- Inline level picker (60-level grid) within the widget when clicking "Level X" text
- SRS stage dots (Apprentice progress indicators) on item tiles in KanjiLevel detail view
- `getStageDots()` utility for rendering 4-dot Apprentice stage progress
- `getLevelProgressByType()` query for per-type Guru/total/unlocked counts in a single query

### Changed

- Level Progress section no longer navigates away from the dashboard for browsing

### Removed

- Old `LevelProgress.svelte` component (replaced by `LevelProgressWidget.svelte`)

## [0.10.1.0] - 2026-03-20

### Fixed

- Quiz answer checking now strips punctuation, extra whitespace, and is case-insensitive (e.g., "water." and "Water" both accepted)
- Applied lenient matching to both review and lesson quiz sessions

## [0.10.0.0] - 2026-03-20

### Added

- "Found in Kanji" now populates for all radicals on both detail and lesson pages
- Mnemonic tag styling: radical (blue), kanji (pink), vocabulary (purple) references render as colored highlighted text in mnemonics
- Mnemonic tags in lesson view now render as styled HTML instead of raw tag text
- SRS-aware tile styling on detail pages: Found in Kanji, Radical Combination, and header icon reflect locked/lesson/review/burned state
- Shared `getTileClasses()` utility for consistent SRS-aware styling across all views
- Streak tracking: meaning and reading current/longest streaks tracked per item during reviews
- WaniKani-style progression section with streaks, accuracy bar, next review, and unlocked date
- Quiz auto-focus: cursor automatically placed in input field when advancing questions
- Alphabetical prev/next navigation on detail pages (sorted by first meaning within same level and type)
- Migration v8: streak tracking columns (meaning_current_streak, meaning_max_streak, reading_current_streak, reading_max_streak)

### Changed

- Back button on detail pages navigates to parent page (radicals/kanji/vocabulary) instead of dashboard
- Hints in mnemonic sections always visible instead of hidden behind a toggle
- SRS stage indicator badge moved to top-right of progression section

### Fixed

- "Found in Kanji" was always empty because component_ids was never stored for kanji rows during seeding
- Mnemonic custom tags (radical, kanji, vocabulary, reading, ja) were stripped by DOMPurify 3.x; converted to styled spans before sanitization
- SRS review countdown showed inflated hours (e.g., 5h instead of 2h) due to UTC datetime strings parsed as local time
- Backfill version bumped to v2 so existing databases get component_ids populated for kanji

## [0.9.0.0] - 2026-03-19

### Added

- Full WaniKani subject data: 490 radicals, 2,094 kanji, and 6,737 vocabulary with proper level assignments, meanings, readings, and mnemonics
- WK data export files (wk-radicals.json, wk-kanji.json, wk-vocabulary.json) replace kanji-data.json as seed source
- SVG images for 14 WK radicals without Unicode characters (stored locally in public/data/radical-images/)
- Shared answer validation utility (kanji-validation.ts) with proper reading filtering and on'yomi-only enforcement
- Accelerated SRS intervals for levels 1-2 (2h/4h/8h/23h for stages 1-4, matching WK)
- Per-item vocab unlock based on component_subject_ids (vocab unlocks when its component kanji reach Guru, not when 90% of all level kanji do)
- WK subject IDs (wk_id) and component dependencies (component_ids) stored on all items
- Per-question incorrect count tracking (meaning_incorrect, reading_incorrect) in review log
- Kanji on'yomi-only reading validation with shake feedback ("We're looking for the on'yomi reading")
- Migration v4: image_url column and review log incorrect counts
- Migration v5: wk_id and component_ids columns with index

### Changed

- SRS intervals corrected to match WK API exactly (23h, 47h, 167h, 335h, 719h, 2879h instead of rounded values)
- Drop formula now uses WK's real formula: stage - ceil(incorrectCount/2) * penaltyFactor (was fixed drop-by-1 or drop-by-2)
- Review times round up to top of hour (WK behavior)
- getUserLevel now returns lowest level where <90% kanji at Guru (was MAX level with any unlocked item)
- getLevelProgress and getAllLevelProgress count kanji only for level-up percentage
- checkAndUnlockLevel unlocks next-level radicals when 90% kanji reach Guru
- Dashboard shows "Guru X more kanji to level up" instead of "items to progress"
- ItemTypeBrowser sorts items alphabetically by first meaning within each level
- ItemTypeBrowser displays SVG images for radicals without Unicode characters
- Readings with ! prefix (non-accepted) now properly filtered from review validation (1,821 readings affected)
- Seed script rewritten to use WK export data instead of deriving radicals from kanji-data.json
- getDb() uses promise lock to prevent concurrent initialization race condition
- Removed explicit BEGIN TRANSACTION from migrations (conflicts with SQLite DDL auto-transactions)

### Fixed

- Database initialization race condition causing "cannot start a transaction within a transaction" errors
- Radicals displayed English names instead of Unicode characters (seed now uses proper WK character data)
- Radical level assignments were wrong (derived from kanji references instead of WK's actual radical levels)
- Incorrect answers only dropped 1-2 stages regardless of how many times wrong (now uses WK's cumulative formula)

## [0.8.1.0] - 2026-03-19

### Fixed

- Migration runner now wraps each migration in BEGIN/COMMIT/ROLLBACK to prevent corrupt half-applied schemas
- DB singleton only assigned after migrations succeed, preventing use of partially-migrated databases
- checkAndUnlockLevel wrapped in transaction to prevent TOCTOU race on concurrent unlock calls
- getRecentMistakeItems query rewritten for correct DISTINCT + ORDER BY behavior
- Stray "t" characters removed from KanjiDashboard that rendered as visible text in the UI
- Biased shuffle (sort with Math.random) replaced with Fisher-Yates in review and lesson sessions
- Missing await on loadDueItems in KanjiReview handleComplete causing stale UI after review
- DateTime format mismatch between JS ISO strings and SQLite datetime() -- now stores YYYY-MM-DD HH:MM:SS
- sortBy parameter in getCardsByDeck now validated against whitelist to prevent SQL injection
- Furigana off-by-one when remainingKana is 0 at end of word
- kanjiReviewOrder and kanjiBatchSize settings now actually affect lesson and review queries
- Silent error swallowing in app-settings catch blocks replaced with console.error logging
- Manual window.addEventListener in KanjiDetail replaced with svelte:window directive
- Type-unsafe "as any" cast in Settings replaced with proper KanjiReviewOrder type
- DB connection now closed before file replacement during backup import
- Ctrl+I shortcut removed (conflicted with system default, redundant with Ctrl+2)

### Added

- Shared utility module (src/lib/utils/kanji.ts) with getTypeColor, parseMeanings, fisherYatesShuffle
- closeDb() export in database.ts for safe DB file replacement
- LevelUpCelebration: aria-modal, Escape key dismiss, autofocus on Continue button
- Three new wanikani-srs tests: stage 1 incorrect floor, Guru drop, datetime format validation
- Inline style exception comments in Stats for dynamic hex color dots

### Changed

- getTypeColor and parseMeanings extracted from 6 files into shared kanji utility
- ReviewSession playTts uses existing currentFields derived state instead of re-parsing JSON
- getDueKanjiReviews accepts optional order parameter for review ordering setting

## [0.8.0.0] - 2026-03-19

### Added

- Three WaniKani-style item type browser pages: Radicals, Kanji, and Vocabulary with tier pagination (Levels 1-10, 11-20, etc.), per-level grids, status-styled tiles (Locked/In Lessons/In Reviews/Burned), and level sub-tab navigation
- Shared ItemTypeBrowser component with color-configurable tile status styling
- Extra Study modes: Recent Lessons, Recent Mistakes, and Burned Items with practice-only sessions (no SRS impact)
- Practice mode for KanjiReviewSession (practiceMode prop skips SRS updates)
- Advanced Lesson Picker with hierarchical Select All (per level, per type), auto-batch selection, interleave toggle, and custom item selection
- Kanji settings: batch size, max daily lessons, review ordering (shuffled/apprentice-first/lower-srs/lower-level), SRS indicator toggle, autoplay audio toggle
- Kanji review charts in Stats page: reviews per day and accuracy trend with date range filter
- Level-up celebration modal when user advances to a new kanji level after review session
- Extra Study link in review completion screen and empty review state
- Advanced picker link in lessons view and dashboard
- Database queries: getItemsByTypeAndTier(), getAllAvailableLessons(), getRecentLessonItems(), getBurnedItems(), getRecentMistakeItems()

### Changed

- Replaced Kanji Map with three separate pages: Radicals, Kanji, and Vocabulary in sidebar navigation
- Removed kanji-map view type; added kanji-radicals, kanji-kanji, kanji-vocabulary, kanji-extra-study, kanji-lesson-picker view types
- KanjiDashboard Level Progress section now links to Radicals/Kanji/Vocabulary pages instead of Kanji Map
- KanjiDetail back navigation updated from kanji-map to kanji-dashboard
- Sidebar Kanji section expanded: Overview, Radicals, Kanji, Vocabulary, Lessons, Reviews

### Removed

- KanjiMap.svelte view (replaced by three item type browser pages)
- kanji-map view type from navigation

## [0.7.0.0] - 2026-03-19

### Added

- WaniKani-style kanji lesson session with teaching phase (tabbed content: meaning/examples/reading, batch thumbnails, arrow navigation) and quiz phase (typed input with romaji-to-hiragana, incorrect items shuffle back)
- Lesson queries: getAvailableLessons(), getAvailableLessonCount(), markLessonCompleted()
- Kanji dashboard with 3-row widget layout: lessons/reviews/forecast, level progress/item spread, recently unlocked/critical items/recent mistakes
- Dashboard queries: getUpcomingReviews(), getSrsDistribution(), getCriticalItems(), getRecentlyUnlocked(), getRecentMistakes()
- initializeKanjiProgression() to unlock level 1 radicals for new users
- User notes and synonyms editing in lesson teaching phase
- Phase 4 plan update for WaniKani-style separate Radicals/Kanji/Vocabulary pages

### Changed

- Main dashboard reorganized into grouped Decks/Kanji/Language sections with kanji lesson count, review count, and level display
- KanjiLessons view replaced from stub to full lesson flow with batch of 5, completion screen, and next-batch option
- KanjiDashboard view replaced from stub to full widget dashboard with empty state for new users

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
