# Janki -- Project Plan

> Personal Windows desktop app for learning Japanese. Replaces Anki with a modern UI, FSRS-6 SRS engine, WaniKani-style kanji progression, and comprehensive Japanese language data.

## Project Requirements

| Field | Value |
|-------|-------|
| Type | Windows desktop app (personal, single user) |
| Users | Just me |
| Scale | Personal project |
| UI style | Clean, minimal, utilitarian (not gamified, not Anki-ugly) |
| Theme | Dark/light toggle |
| Data storage | Local SQLite (no server) |
| Priority features | SRS flashcards + WaniKani-style kanji progression |
| Anki pain point | Dated UI, clunky workflow |
| TTS | Web Speech API first, Edge TTS later |
| Stroke order | Visual SVG diagrams (drawing input is future) |
| Rosetta Stone | Dead end -- no public API, enterprise-only |

---

## Stack (Approved)

| Layer | Choice | Version | Why |
|-------|--------|---------|-----|
| Desktop shell | Tauri | 2.x | 2-10 MB bundle, 30-40 MB RAM, native WebView2 on Win11 |
| Language | TypeScript + Rust | TS 5.x, Rust stable | TS for UI logic, Rust for native Tauri plugins |
| Frontend | Svelte | 5.x | 4KB runtime, built-in animations, cleanest DX for SPA |
| UI library | shadcn-svelte | latest | Copy-paste-own model, minimal aesthetic, dark mode |
| Styling | Tailwind CSS | 4.x | JIT purging, `dark:` toggle, CSS-first config (no tailwind.config.ts) |
| Database | SQLite | via tauri-plugin-sql 2.3.x | Official Tauri plugin, SQLx-backed, built-in migrations |
| SRS algorithm | FSRS-6 | via ts-fsrs 4.x | 20-30% fewer reviews than SM-2, retention targeting |
| Anki import | anki-reader | latest | Parses .apkg zip+SQLite, notes/cards/media |
| HTML sanitizer | DOMPurify | latest | Sanitize Anki card HTML before rendering (XSS prevention) |
| Japanese data | jmdict-simplified, KANJIDIC2, KanjiVG, KRADFILE | latest | Free, JSON, TypeScript types available |
| Kanji levels | kanji-data (davidluzgouveia) | latest | WaniKani-style levels, JLPT mappings, radical data |
| TTS | Web Speech API + Edge TTS | -- | Free Japanese neural voices |
| Package mgr | pnpm | latest | Tauri default |
| Bundler | Vite | latest | Tauri standard, Svelte plugin |
| Linter/Formatter | Biome | 2.x | 423+ rules, replaces ESLint + Prettier |
| Test runner | Vitest | latest | Vite-native, Jest-compatible API |

---

## LL-G Integration

### What is LL-G?

LL-G is a lessons-learned knowledge base at `https://github.com/wellforce-brandon/LL-G`. It contains known coding gotchas organized by technology, with severity levels (HIGH/MEDIUM/LOW). Claude Code fetches it before writing code to avoid repeating known failures.

### LL-G Technologies Relevant to Janki

| Technology | Sub-index URL | Current entries |
|------------|--------------|-----------------|
| TypeScript | `kb/typescript/llms.txt` | 3 |
| Tailwind CSS | `kb/tailwind/llms.txt` | 4 |
| Bash | `kb/bash/llms.txt` | 2 |

New technologies to add as lessons accumulate:
- Tauri (new -- `kb/tauri/llms.txt`)
- Svelte (new -- `kb/svelte/llms.txt`)
- FSRS (new -- `kb/fsrs/llms.txt`)

### LL-G Check Protocol (MANDATORY -- Every Phase)

**Before writing or editing ANY source file**, Claude Code MUST:

1. Fetch master index:
   ```
   WebFetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/llms.txt
   ```

2. Identify technologies in the file being edited (TypeScript, Svelte, Tailwind, Tauri, etc.)

3. Fetch each relevant tech sub-index:
   ```
   WebFetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/kb/<tech>/llms.txt
   ```

4. Read ALL HIGH-severity entries for matched technologies.

5. Read MEDIUM entries whose title matches the specific task.

6. If already checked for the same tech earlier in this conversation, skip re-fetch.

### LL-G Contribution Protocol (MANDATORY -- Every Phase)

**After completing each phase**, review all gotchas, bugs, and non-obvious solutions encountered during implementation. For each discovery:

1. Determine if it's a new lesson not already in LL-G.
2. Run `/add-lesson` to submit it. This uses the GitHub API directly -- no local clone needed.
3. Required fields: technology, title, problem, wrong pattern, right pattern, severity, tags.
4. Severity guide:
   - **HIGH** = silent wrong output or hard-to-debug errors
   - **MEDIUM** = obvious failures (build errors, test failures)
   - **LOW** = style/convention, caught by linter

### LL-G Phase Checklist

Every phase section below ends with an **LL-G Checkpoint**. This is not optional. The checkpoint has two parts:

1. **CHECK:** Verify LL-G was consulted before every code edit in this phase.
2. **CONTRIBUTE:** List all new gotchas discovered. Run `/add-lesson` for each. If none, write "No new lessons."

---

## BP Integration

### What is BP?

BP is a best-practices knowledge base at `https://github.com/wellforce-brandon/BP`. It contains proven patterns organized by concern, with priority levels (FOUNDATIONAL/RECOMMENDED/OPTIONAL). Claude Code loads applicable practices before starting new work.

### BP Check Protocol (MANDATORY -- Every Phase)

**Before starting any phase**, Claude Code MUST:

1. Fetch master index:
   ```
   WebFetch https://raw.githubusercontent.com/wellforce-brandon/BP/main/llms.txt
   ```

2. Identify concerns relevant to the phase (e.g., testing, database, components, accessibility).

3. Fetch each relevant concern index.

4. Load ALL FOUNDATIONAL entries (these apply to every repo).

5. Load RECOMMENDED entries whose tech tags match Janki's stack (Svelte, Tauri, TypeScript, SQLite, Tailwind).

### BP Phase Checklist

Every phase section below ends with a **BP Checkpoint** alongside the LL-G checkpoint:

1. **CHECK:** Were applicable BP practices consulted before starting this phase?
2. **APPLY:** List which practices were followed or intentionally skipped (with rationale).

---

## Database Schema

### Tables

```sql
-- User preferences and app state
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Decks (collections of cards)
CREATE TABLE decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT, -- 'imported', 'builtin', 'custom'
  source_file TEXT, -- original .apkg filename if imported
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Note types (card templates)
CREATE TABLE note_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  fields TEXT NOT NULL, -- JSON array of field names
  card_templates TEXT NOT NULL, -- JSON array of {front, back} HTML templates
  css TEXT -- shared styling for cards of this type
);

-- Notes (raw content, one note can generate multiple cards)
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_type_id INTEGER NOT NULL REFERENCES note_types(id),
  deck_id INTEGER NOT NULL REFERENCES decks(id),
  fields TEXT NOT NULL, -- JSON object mapping field names to values
  tags TEXT, -- JSON array of tag strings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cards (reviewable items, generated from notes)
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL REFERENCES notes(id),
  deck_id INTEGER NOT NULL REFERENCES decks(id),
  template_index INTEGER NOT NULL DEFAULT 0, -- which card template
  -- FSRS state
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  due TEXT NOT NULL DEFAULT (datetime('now')),
  last_review TEXT,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state INTEGER NOT NULL DEFAULT 0, -- 0=new, 1=learning, 2=review, 3=relearning
  -- Scheduling
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Review log (every single review, for FSRS optimization)
CREATE TABLE review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  rating INTEGER NOT NULL, -- 1=again, 2=hard, 3=good, 4=easy
  state INTEGER NOT NULL, -- card state at time of review
  scheduled_days INTEGER NOT NULL,
  elapsed_days INTEGER NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  duration_ms INTEGER, -- time spent on review
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- WaniKani-style kanji progression
CREATE TABLE kanji_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level INTEGER NOT NULL, -- 1-60
  item_type TEXT NOT NULL, -- 'radical', 'kanji', 'vocab'
  character TEXT NOT NULL, -- the radical/kanji/word
  meanings TEXT NOT NULL, -- JSON array of English meanings
  readings_on TEXT, -- JSON array of on'yomi (kanji only)
  readings_kun TEXT, -- JSON array of kun'yomi (kanji only)
  reading TEXT, -- kana reading (vocab only)
  radicals TEXT, -- JSON array of component radicals (kanji only)
  mnemonic_meaning TEXT, -- mnemonic for meaning
  mnemonic_reading TEXT, -- mnemonic for reading
  -- SRS state (separate from deck-based SRS)
  srs_stage INTEGER NOT NULL DEFAULT 0, -- 0=locked, 1-4=apprentice, 5-6=guru, 7=master, 8=enlightened, 9=burned
  unlocked_at TEXT,
  next_review TEXT,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0
);

-- Kanji unlock dependencies
CREATE TABLE kanji_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kanji_level_id INTEGER NOT NULL REFERENCES kanji_levels(id),
  depends_on_id INTEGER NOT NULL REFERENCES kanji_levels(id),
  UNIQUE(kanji_level_id, depends_on_id)
);

-- Media files extracted from imported decks
-- Strategy: BLOBs for files <1MB, filesystem for larger files
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER REFERENCES decks(id),
  filename TEXT NOT NULL,
  mime_type TEXT,
  data BLOB, -- actual file bytes (NULL if stored on filesystem)
  file_path TEXT, -- relative path in $APPDATA/janki/media/ (NULL if stored as BLOB)
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User study statistics (daily aggregates)
CREATE TABLE daily_stats (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD
  reviews_count INTEGER NOT NULL DEFAULT 0,
  new_cards_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  time_spent_ms INTEGER NOT NULL DEFAULT 0,
  kanji_learned INTEGER NOT NULL DEFAULT 0
);
```

### FTS5 Virtual Tables (Phase 3)

```sql
-- Full-text search for cards
CREATE VIRTUAL TABLE cards_fts USING fts5(
  front_text, -- extracted plain text from front template
  back_text,  -- extracted plain text from back template
  content=cards,
  content_rowid=id
);

-- Full-text search for kanji
CREATE VIRTUAL TABLE kanji_fts USING fts5(
  character,
  meanings,    -- space-separated meanings
  readings,    -- space-separated on/kun readings
  content=kanji_levels,
  content_rowid=id
);

-- Triggers to keep FTS in sync
CREATE TRIGGER cards_fts_insert AFTER INSERT ON cards BEGIN
  INSERT INTO cards_fts(rowid, front_text, back_text) VALUES (new.id, '', '');
END;

CREATE TRIGGER cards_fts_delete AFTER DELETE ON cards BEGIN
  INSERT INTO cards_fts(cards_fts, rowid, front_text, back_text) VALUES('delete', old.id, '', '');
END;
```

Query pattern:
```sql
-- Search cards
SELECT c.* FROM cards c
JOIN cards_fts ON cards_fts.rowid = c.id
WHERE cards_fts MATCH ?
ORDER BY rank;
```

### Indexes

```sql
CREATE INDEX idx_cards_due ON cards(due);
CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_cards_state ON cards(state);
CREATE INDEX idx_notes_deck ON notes(deck_id);
CREATE INDEX idx_review_log_card ON review_log(card_id);
CREATE INDEX idx_review_log_date ON review_log(reviewed_at);
CREATE INDEX idx_kanji_levels_level ON kanji_levels(level);
CREATE INDEX idx_kanji_levels_type ON kanji_levels(item_type);
CREATE INDEX idx_kanji_levels_srs ON kanji_levels(srs_stage);
CREATE INDEX idx_kanji_levels_review ON kanji_levels(next_review);
-- Note: daily_stats.date is already PRIMARY KEY, no separate index needed
```

---

## File Structure

```
janki/
├── src/                          # Svelte frontend
│   ├── app.html                  # HTML shell
│   ├── app.css                   # Global styles + Tailwind imports
│   ├── main.ts                   # Svelte mount point
│   ├── App.svelte                # Root component (layout + router)
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/               # shadcn-svelte components (button, card, dialog, etc.)
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   ├── Header.svelte
│   │   │   │   └── ThemeToggle.svelte
│   │   │   ├── review/
│   │   │   │   ├── FlashCard.svelte       # Card with flip animation
│   │   │   │   ├── RatingButtons.svelte   # Again/Hard/Good/Easy
│   │   │   │   ├── ReviewSession.svelte   # Review flow controller
│   │   │   │   └── ReviewSummary.svelte   # Post-review stats
│   │   │   ├── kanji/
│   │   │   │   ├── KanjiCard.svelte       # Kanji detail display
│   │   │   │   ├── StrokeOrder.svelte     # SVG stroke order viewer
│   │   │   │   ├── LevelProgress.svelte   # WaniKani-style level bar
│   │   │   │   ├── RadicalGrid.svelte     # Grid of radicals for a level
│   │   │   │   └── SrsStageIndicator.svelte
│   │   │   ├── deck/
│   │   │   │   ├── DeckList.svelte
│   │   │   │   ├── DeckCard.svelte
│   │   │   │   ├── DeckEditor.svelte
│   │   │   │   └── ImportDialog.svelte    # .apkg import UI
│   │   │   └── stats/
│   │   │       ├── DashboardStats.svelte
│   │   │       ├── ReviewChart.svelte
│   │   │       └── StreakDisplay.svelte
│   │   ├── stores/
│   │   │   ├── settings.ts        # App settings (theme, daily limits, etc.)
│   │   │   ├── review.ts          # Current review session state
│   │   │   ├── kanji.ts           # Kanji progression state
│   │   │   └── navigation.ts      # View routing state
│   │   ├── db/
│   │   │   ├── database.ts        # tauri-plugin-sql wrapper, init, migrations
│   │   │   ├── migrations.ts      # Schema migration definitions
│   │   │   ├── queries/
│   │   │   │   ├── cards.ts       # Card CRUD + due card queries
│   │   │   │   ├── decks.ts       # Deck CRUD
│   │   │   │   ├── notes.ts       # Note CRUD
│   │   │   │   ├── reviews.ts     # Review log queries
│   │   │   │   ├── kanji.ts       # Kanji level queries + unlock logic
│   │   │   │   └── stats.ts       # Statistics aggregation
│   │   │   └── seed/
│   │   │       └── kanji-data.ts  # Load kanji/radical/vocab data into DB
│   │   ├── srs/
│   │   │   ├── fsrs.ts            # FSRS-6 wrapper around ts-fsrs
│   │   │   ├── scheduler.ts       # Review scheduling logic
│   │   │   └── wanikani-srs.ts    # WaniKani-style fixed-interval SRS for kanji
│   │   ├── import/
│   │   │   ├── apkg-parser.ts     # Parse .apkg files via anki-reader (or fallback)
│   │   │   ├── deck-mapper.ts     # Map Anki data to Janki schema
│   │   │   └── media-extractor.ts # Extract and store media from .apkg
│   │   ├── tts/
│   │   │   └── speech.ts          # TTS abstraction (Web Speech API, later Edge TTS)
│   │   └── utils/
│   │       ├── date.ts            # Date formatting helpers
│   │       ├── japanese.ts        # Kana detection, reading helpers
│   │       └── sanitize.ts        # DOMPurify wrapper for Anki HTML
│   └── views/
│       ├── Dashboard.svelte       # Home: upcoming reviews, level, streak
│       ├── Review.svelte          # Flashcard review session
│       ├── KanjiMap.svelte        # WaniKani-style level map
│       ├── KanjiDetail.svelte     # Single kanji deep-dive
│       ├── Decks.svelte           # Deck management
│       ├── DeckBrowse.svelte      # Browse cards in a deck
│       ├── Search.svelte          # Search across all content
│       ├── Stats.svelte           # Review history + analytics
│       └── Settings.svelte        # App settings
├── src-tauri/                     # Tauri Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json            # Tauri config (window, permissions, plugins)
│   ├── capabilities/
│   │   └── default.json           # Permission capabilities
│   ├── src/
│   │   ├── lib.rs                 # Plugin registration, setup
│   │   └── main.rs                # Entry point
│   └── icons/                     # App icons
├── data/                          # Static Japanese language data (committed)
│   ├── kanji-data.json            # WaniKani-style levels from davidluzgouveia/kanji-data
│   ├── radicals.json              # Radical-kanji decomposition (derived from KRADFILE2/RADKFILE2)
│   └── README.md                  # Data attribution and sources
├── package.json                   # (exists -- update, do not recreate)
├── pnpm-lock.yaml
├── vite.config.ts
├── vitest.config.ts               # Vitest configuration
├── svelte.config.js
├── tsconfig.json
├── biome.json
├── CHANGELOG.md                   # (exists -- update, do not recreate)
├── README.md                      # (exists)
├── CLAUDE.md                      # (exists)
├── agents.md                      # (exists)
├── tasks/
│   └── plan-repo.md               # This file
└── .claude/                       # Claude Code config (exists)
```

Note: No `tailwind.config.ts` -- Tailwind 4 uses CSS-first configuration in `src/app.css`.

---

## Existing Repo State

These files already exist in the repo and must be updated, not recreated, during Phase 1:

| File | Action | Notes |
|------|--------|-------|
| `package.json` | Update | Merge Tauri/Svelte deps into existing file |
| `CHANGELOG.md` | Update | Add entries under `[Unreleased]` |
| `README.md` | Untouched | Already written |
| `CLAUDE.md` | Untouched | Already configured |
| `agents.md` | Untouched | Already configured |
| `.claude/` | Untouched | Full config already exists |
| `tasks/plan-repo.md` | Untouched | This file |
| `llms.txt` | Untouched | Already exists |

Files created by scaffold (new):

| File | Source |
|------|--------|
| `src/` tree | Tauri scaffold (selective copy) |
| `src-tauri/` tree | Tauri scaffold (selective copy) |
| `vite.config.ts` | Tauri scaffold |
| `vitest.config.ts` | Manual creation |
| `svelte.config.js` | Tauri scaffold |
| `tsconfig.json` | Tauri scaffold |
| `biome.json` | Manual creation |
| `data/` | Manual creation |

---

## Error Handling Strategy

All database and I/O operations use a consistent error handling pattern:

### safeQuery() Wrapper

```typescript
// src/lib/db/database.ts
type QueryResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function safeQuery<T>(fn: () => Promise<T>): Promise<QueryResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[DB Error]', error);
    return { ok: false, error };
  }
}
```

### Error Categories

| Category | Pattern | User Feedback |
|----------|---------|---------------|
| Database query | `safeQuery()` wrapper | Toast with "Database error" + retry option |
| Import (.apkg) | Transaction + try/catch | Progress dialog shows specific failure |
| SRS calculation | try/catch in reviewCard() | Toast + skip card, don't lose review session |
| File system | Tauri plugin-fs error handling | Toast with "File not found" or "Permission denied" |
| Media load | Fallback to placeholder | Show broken-image icon, don't crash card |
| TTS | isAvailable() check first | Silently disable TTS button if unavailable |

### Import Error Handling (Phase 2)

```typescript
// Wrap entire import in a transaction
await db.execute('BEGIN TRANSACTION');
try {
  // 1. Validate .apkg structure (must contain collection.anki2 or collection.anki21)
  // 2. Check media total size (warn if >500MB, reject if >2GB)
  // 3. Import notes, cards, media with progress callback
  // 4. Commit on success
  await db.execute('COMMIT');
} catch (e) {
  await db.execute('ROLLBACK');
  // Return structured error with phase that failed
}
```

---

## Data Migration Strategy

### Migration Format

```typescript
// src/lib/db/migrations.ts
interface Migration {
  version: number;
  description: string;
  up: string;   // SQL to apply
  down: string; // SQL to revert (best-effort)
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: `CREATE TABLE settings ...`, // full schema
    down: `DROP TABLE IF EXISTS ...`,
  },
  // Future migrations appended here
];
```

### Rules

1. **Append-only:** Never modify an existing migration. Always add a new one.
2. **Version tracking:** Store current version in `settings` table (`key='schema_version'`).
3. **Run on startup:** `database.ts` checks current version, runs pending migrations in order.
4. **Pre-destructive backup:** Before any migration that drops columns or tables, automatically copy `janki.db` to `janki.db.pre-v{N}.bak`.
5. **No down in production:** Down migrations are for development only. Production always moves forward.

---

## Testing Strategy

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '$lib': '/src/lib',
    },
  },
});
```

### Tests by Phase

#### Phase 1 Tests

| File | Tests |
|------|-------|
| `src/lib/db/migrations.test.ts` | Migrations array is valid, versions are sequential, SQL parses |

#### Phase 2 Tests

| File | Tests |
|------|-------|
| `src/lib/srs/fsrs.test.ts` | createNewCard returns valid defaults, reviewCard updates state for each rating, stability/difficulty change correctly |
| `src/lib/srs/scheduler.test.ts` | getReviewQueue respects daily limits, processReview writes review_log, daily_stats updated |
| `src/lib/srs/wanikani-srs.test.ts` | Stage advances on correct, drops on incorrect, intervals match spec, burn stops reviews |
| `src/lib/import/deck-mapper.test.ts` | Maps Anki fields correctly, handles field separator, generates cards from templates |
| `src/lib/import/media-extractor.test.ts` | Extracts media, maps filenames, respects size threshold |
| `src/lib/db/queries/cards.test.ts` | getDueCards returns only due, getNewCards respects limit, CRUD operations |
| `src/lib/db/queries/kanji.test.ts` | Level progression, unlock logic, SRS stage queries |
| `src/lib/utils/sanitize.test.ts` | Strips script tags, preserves safe HTML, handles edge cases |

#### Phase 3 Tests

| File | Tests |
|------|-------|
| `src/lib/tts/speech.test.ts` | isAvailable check, speak called with ja-JP, stop cancels |
| `src/lib/db/queries/stats.test.ts` | Daily aggregation correct, streak calculation, time tracking |

#### Phase 4 Tests

| File | Tests |
|------|-------|
| `src/lib/utils/japanese.test.ts` | Kana detection, furigana generation, reading helpers |

### Mocking Rules

- **Mock** tauri-plugin-sql in unit tests (no real DB).
- **Mock** ts-fsrs only when testing scheduling logic in isolation.
- **Do not mock** Svelte component internals. Use @testing-library/svelte if UI testing is needed.
- Each test file is self-contained. No shared mutable state between files.

---

## Phase 1 -- Foundation

### Goal
Scaffold the Tauri + Svelte project into the existing repo, get a window rendering with navigation, dark/light theme, and an empty SQLite database with the full schema.

### Prerequisites
- Node.js 18+ installed
- Rust toolchain installed (rustup)
- pnpm installed globally

### Steps

#### 1.1 -- LL-G + BP Check
```
MANDATORY: Before writing any code in this phase:

LL-G:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/llms.txt
2. Fetch kb/typescript/llms.txt -- read ALL HIGH entries
3. Fetch kb/tailwind/llms.txt -- read ALL HIGH entries
4. If kb/tauri/llms.txt or kb/svelte/llms.txt exist, read those too

BP:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/BP/main/llms.txt
2. Load ALL FOUNDATIONAL entries
3. Load RECOMMENDED entries matching: Svelte, Tauri, TypeScript, Tailwind, SQLite
```

#### 1.2 -- Scaffold Tauri + Svelte into Existing Repo

**IMPORTANT:** This repo already has `package.json`, `CLAUDE.md`, `.claude/`, `README.md`, `CHANGELOG.md`, etc. Running `pnpm create tauri-app janki` would create a NEW directory and overwrite existing files.

Instead:
```bash
# 1. Scaffold to a temp directory
pnpm create tauri-app janki-temp --template svelte-ts --manager pnpm

# 2. Selectively copy scaffold output into existing repo
cp -r janki-temp/src ./src
cp -r janki-temp/src-tauri ./src-tauri
cp janki-temp/vite.config.ts ./vite.config.ts
cp janki-temp/svelte.config.js ./svelte.config.js
cp janki-temp/tsconfig.json ./tsconfig.json
# Do NOT copy package.json -- merge deps manually

# 3. Merge dependencies from janki-temp/package.json into existing package.json
# Add devDependencies: @sveltejs/vite-plugin-svelte, svelte, svelte-check, typescript, vite, @tauri-apps/cli
# Add dependencies: @tauri-apps/api

# 4. Clean up
rm -rf janki-temp
```

Expected result:
- `src/` folder with Svelte app (from scaffold)
- `src-tauri/` folder with Rust backend (from scaffold)
- Existing `package.json` updated with Tauri + Svelte deps
- Existing `CLAUDE.md`, `.claude/`, `README.md` untouched

#### 1.3 -- Install Core Dependencies

```bash
# Frontend
pnpm add -D tailwindcss@latest @tailwindcss/vite
pnpm add -D @biomejs/biome vitest @testing-library/svelte jsdom
pnpm add bits-ui mode-watcher clsx tailwind-merge tailwind-variants
pnpm add dompurify
pnpm add -D @types/dompurify

# Tauri plugins (JS side)
pnpm add @tauri-apps/plugin-sql @tauri-apps/plugin-fs @tauri-apps/plugin-dialog

# SRS engine
pnpm add ts-fsrs

# Anki import (investigate compatibility first -- see Step 2.3)
pnpm add anki-reader
```

```toml
# src-tauri/Cargo.toml -- add Tauri plugin features
[dependencies]
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

#### 1.4 -- Configure Biome

Create `biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "files": {
    "ignore": ["src/lib/components/ui/**"]
  }
}
```

Note: `src/lib/components/ui/` is ignored because shadcn-svelte generates these files. Don't lint generated code.

#### 1.5 -- Set Up Tailwind CSS 4

Use the CSS-first approach (no `tailwind.config.ts`):
```css
/* src/app.css */
@import "tailwindcss";
```

#### 1.6 -- Set Up shadcn-svelte

Follow the shadcn-svelte init process. Install base components:
- Button, Card, Dialog, Input, Label, Separator, Badge, Tooltip, ScrollArea, DropdownMenu, Tabs

#### 1.7 -- Create Layout Shell

Build the basic app layout:
- `App.svelte` -- sidebar + main content area
- `Sidebar.svelte` -- navigation links (Dashboard, Review, Kanji, Decks, Stats, Settings)
- `Header.svelte` -- top bar with app name + theme toggle
- `ThemeToggle.svelte` -- dark/light switch using mode-watcher
- Simple view routing via a Svelte store (no SvelteKit router needed)

Each view starts as a placeholder component with just a heading.

#### 1.8 -- Initialize SQLite Database

- Register `tauri-plugin-sql` in `src-tauri/src/lib.rs`
- Create `src/lib/db/database.ts` -- initialize DB, run migrations, export `safeQuery()` wrapper
- Create `src/lib/db/migrations.ts` -- full schema from this plan (version 1)
- DB file location: Tauri's app data directory (`$APPDATA/janki/janki.db`)
- Run migrations on app startup
- Store schema version in `settings` table

#### 1.9 -- Update package.json and CHANGELOG.md

- **Update** existing `package.json` -- merge scaffold deps, keep version at `0.1.0.0` (bump on commit per changelog rule)
- **Update** existing `CHANGELOG.md` -- add foundation entries under `[Unreleased]`

#### 1.10 -- Create DOMPurify Sanitization Utility

File: `src/lib/utils/sanitize.ts`

```typescript
import DOMPurify from 'dompurify';

const purify = DOMPurify(window);

// Sanitize Anki card HTML -- strips scripts, event handlers, iframes
export function sanitizeCardHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'br', 'div', 'span', 'p', 'img', 'ruby', 'rt', 'rp',
                   'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'sup', 'sub', 'hr'],
    ALLOWED_ATTR: ['class', 'style', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  });
}
```

#### 1.11 -- Configure Vitest + Smoke Test

Create `vitest.config.ts` (see Testing Strategy section above for contents).

Create `src/lib/db/migrations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { migrations } from './migrations';

describe('migrations', () => {
  it('should have sequential version numbers', () => {
    for (let i = 0; i < migrations.length; i++) {
      expect(migrations[i].version).toBe(i + 1);
    }
  });

  it('should have non-empty up SQL', () => {
    for (const m of migrations) {
      expect(m.up.trim().length).toBeGreaterThan(0);
    }
  });
});
```

#### 1.12 -- Create Subfolder CLAUDE.md Files

Create `src/CLAUDE.md` -- frontend conventions are already defined in `.claude/rules/frontend.md` (path-scoped), so this is a lightweight pointer:
```markdown
# src/ -- Frontend

See `.claude/rules/frontend.md` for full conventions. Key points:
- Svelte 5 runes only ($state, $derived, $effect)
- All DB access via src/lib/db/queries/ -- never raw SQL in components
- Tailwind utility classes only, dark: variants on everything
```

Create `src-tauri/CLAUDE.md`:
```markdown
# src-tauri/ -- Tauri Backend

- Plugins registered in src/lib.rs via .plugin() calls
- All Tauri commands return Result<T, String> for error handling
- Capabilities defined in capabilities/default.json
- Principle of least privilege -- no unnecessary permissions
```

#### 1.13 -- Verify

- [ ] `pnpm tauri dev` launches a window
- [ ] Sidebar navigation switches between placeholder views
- [ ] Dark/light theme toggle works
- [ ] SQLite database file is created on first launch
- [ ] All tables exist in the database
- [ ] Biome lint passes with no errors
- [ ] `pnpm test` passes (smoke test)
- [ ] DOMPurify sanitize function strips `<script>` tags

### LL-G Checkpoint -- Phase 1
- **CHECK:** Was LL-G consulted before every code edit? (TypeScript, Tailwind at minimum)
- **CONTRIBUTE:** List all new gotchas discovered during Phase 1. Run `/add-lesson` for each.
  - Expected areas: Tauri plugin registration, tauri-plugin-sql setup, Svelte 5 + shadcn-svelte quirks, Tailwind 4 CSS-first config in Tauri

### BP Checkpoint -- Phase 1
- **CHECK:** Were applicable BP practices consulted? (project setup, testing, linting)
- **APPLY:** List which practices were followed or intentionally skipped with rationale.

---

## Phase 2 -- Core

### Goal
Build the two primary features: FSRS-6 SRS flashcard system with Anki import, and WaniKani-style kanji progression.

### Steps

#### 2.1 -- LL-G + BP Check
```
MANDATORY: Before writing any code in this phase:

LL-G:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/llms.txt
2. Fetch sub-indexes for: typescript, tailwind, and any new tech indexes added in Phase 1
3. Read ALL HIGH entries. Read MEDIUM entries matching: SRS, database, import, Svelte components

BP:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/BP/main/llms.txt
2. Load FOUNDATIONAL entries
3. Load RECOMMENDED entries matching: database, components, testing
```

#### 2.2 -- FSRS-6 SRS Engine

File: `src/lib/srs/fsrs.ts`

ts-fsrs 4.x API mapping:

```typescript
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type RecordLog } from 'ts-fsrs';

// ts-fsrs Card fields -> cards table columns:
//   due        -> cards.due (ISO 8601 text)
//   stability  -> cards.stability (REAL)
//   difficulty -> cards.difficulty (REAL)
//   elapsed_days -> cards.elapsed_days (INTEGER)
//   scheduled_days -> cards.scheduled_days (INTEGER)
//   reps       -> cards.reps (INTEGER)
//   lapses     -> cards.lapses (INTEGER)
//   state      -> cards.state (INTEGER: 0=new, 1=learning, 2=review, 3=relearning)
//   last_review -> cards.last_review (ISO 8601 text, nullable)

const params = generatorParameters();
const f = fsrs(params);

export function createNewCard(): Card {
  return createEmptyCard();
}

export function reviewCard(card: Card, rating: Rating): RecordLog {
  const now = new Date();
  return f.repeat(card, now);
  // Returns RecordLog with entries for each rating
  // Use recordLog[rating] to get the scheduled card + review log
}
```

- Wrap `ts-fsrs` library with a clean API:
  - `createNewCard()` -- returns default FSRS card state
  - `reviewCard(card, rating)` -- returns updated card state + scheduling info
  - `getDueCards(deckId, limit)` -- query cards due for review
  - `getNewCards(deckId, limit)` -- query unseen cards
- Rating scale: Again (1), Hard (2), Good (3), Easy (4)
- Default parameters (ts-fsrs defaults work well out of box)
- Store FSRS state fields on the `cards` table

File: `src/lib/srs/scheduler.ts`

- `getReviewQueue(deckId)` -- combine due cards + new cards (configurable daily new card limit)
- `processReview(cardId, rating)` -- update card state, write review log, update daily stats
- Respect daily new card limit from settings (default: 20)
- Respect daily review limit from settings (default: 200)

#### 2.3 -- Anki .apkg Import

**IMPORTANT: Compatibility Investigation Required**

`anki-reader` may use Node.js `fs` module internally. Tauri's WebView2 is a browser context, not Node.js. Before implementing:

1. **Check anki-reader source** for Node.js dependencies (`fs`, `path`, `buffer`, `stream`).
2. **If browser-compatible:** Use directly -- proceed with the plan below.
3. **If Node-dependent:** Use this fallback approach:
   - Use Tauri's `plugin-fs` to read the `.apkg` file as bytes
   - Use `JSZip` to unzip in the browser
   - The `.apkg` contains `collection.anki2` (or `collection.anki21`) which is a SQLite DB
   - Use `sql.js` (SQLite compiled to WASM) to read the Anki database in the browser
   - Extract media files from the zip directly
   - **Fallback deps:** `pnpm add jszip sql.js`

File: `src/lib/import/apkg-parser.ts`

- Use `anki-reader` (or fallback) to extract from .apkg:
  - Notes (with fields, tags)
  - Note types (models with field definitions and card templates)
  - Cards (scheduling state -- import as new cards, ignore Anki scheduling)
  - Media files (images, audio)
- Use Tauri's `plugin-dialog` for file picker (filter: `*.apkg`)
- Use Tauri's `plugin-fs` to read the selected file
- **Validate .apkg structure:** must contain `collection.anki2` or `collection.anki21`
- **Wrap entire import in a SQLite transaction** -- rollback on any failure
- **Progress callback:** report progress to UI (`onProgress(step, current, total)`)
- **Media size check:** warn if total media >500MB, reject if >2GB

File: `src/lib/import/deck-mapper.ts`

- Map Anki note types to Janki note_types table
- Map Anki notes to Janki notes table
- Generate cards from notes based on card templates
- All imported cards start as new (state=0, no scheduling history)
- Handle field separator (`\x1f` in Anki)
- Parse Anki's HTML in card templates
- **Sanitize all card HTML through DOMPurify** before storing

File: `src/lib/import/media-extractor.ts`

- Extract numbered media files from .apkg
- Map to original filenames via the `media` JSON file
- **Hybrid storage strategy:**
  - Files <1MB: store as BLOBs in the `media` table
  - Files >=1MB: save to `$APPDATA/janki/media/{deck_id}/`, store path in `media.file_path`
- Support: images (jpg, png, gif), audio (mp3, ogg, wav)
- Record `size_bytes` for each file

Component: `src/lib/components/deck/ImportDialog.svelte`

- File picker button
- Progress indicator during import (step + percentage)
- Summary after import (cards imported, media extracted, errors)
- Error display with specific failure details

#### 2.4 -- Flashcard Review UI

Component: `src/lib/components/review/FlashCard.svelte`

- Card with 3D flip animation (CSS `transform: rotateY(180deg)`)
- Front: question/prompt from card template
- Back: answer from card template
- **Render HTML through `sanitizeCardHtml()` before `{@html}`** -- never render unsanitized content
- Display media (images inline, audio with play button)
- Keyboard shortcut: Space to flip

Component: `src/lib/components/review/RatingButtons.svelte`

- Four buttons: Again (1), Hard (2), Good (3), Easy (4)
- Show next review interval above each button
- Keyboard shortcuts: 1/2/3/4
- Color-coded: red/orange/green/blue (see design guardrails)

Component: `src/lib/components/review/ReviewSession.svelte`

- Controls the review flow:
  1. Fetch review queue (due + new cards)
  2. Show card front
  3. Wait for flip (Space or click)
  4. Show card back + rating buttons
  5. Process rating, advance to next card
  6. When queue empty, show ReviewSummary

Component: `src/lib/components/review/ReviewSummary.svelte`

- Cards reviewed count
- Accuracy percentage
- Time spent
- Next review due time
- "Back to Dashboard" button

View: `src/views/Review.svelte`

- Deck selector (which deck to review)
- "Start Review" button
- Embeds ReviewSession component
- Shows "No cards due" if queue is empty

#### 2.5 -- Deck Management

View: `src/views/Decks.svelte`

- Grid of DeckCard components
- "Import Deck" button (opens ImportDialog)
- "Create Deck" button
- Each DeckCard shows: name, card count, due count

View: `src/views/DeckBrowse.svelte`

- Table/list of all cards in a deck
- Columns: front preview, back preview, SRS state, due date, interval
- Click card to view/edit
- Search/filter within deck
- Sort by: due date, interval, state, created

Component: `src/lib/components/deck/DeckEditor.svelte`

- Create/edit deck name and description
- Delete deck (with confirmation dialog)

#### 2.6 -- WaniKani-Style Kanji Progression

##### Kanji Data Download

Before seeding, download data to the `data/` folder:

```bash
# WaniKani-style levels (JSON, ~2MB)
git clone --depth 1 https://github.com/davidluzgouveia/kanji-data.git /tmp/kanji-data
cp /tmp/kanji-data/kanji.json data/kanji-data.json
rm -rf /tmp/kanji-data

# Radical-kanji decomposition
# Source: KRADFILE2/RADKFILE2 (part of EDRDG project)
# License: Creative Commons Attribution-ShareAlike 4.0
# Pre-processed JSON version available via jmdict-simplified or manual conversion
```

Data structure example (`data/kanji-data.json`):
```json
{
  "1": {
    "kanji": ["一", "二", "三", "人", "大", ...],
    "radicals": ["一", "丨", "丶", ...],
    "vocabulary": ["一つ", "二つ", ...]
  },
  ...
}
```

Attribution requirements (add to `data/README.md`):
- kanji-data: MIT License (davidluzgouveia)
- KRADFILE2/RADKFILE2: CC BY-SA 4.0 (Electronic Dictionary Research and Development Group)
- KanjiVG: CC BY-SA 3.0 (Ulrich Apel)

##### KanjiVG Stroke Order Strategy

**Bundle only joyo kanji SVGs (~2,200 characters), not all 11,000+.**

- Clone KanjiVG, filter to joyo kanji only
- Store SVGs as individual files in `data/kanjivg/` (not as SQLite BLOBs)
- Load on demand when viewing KanjiDetail
- Total size: ~5MB for joyo subset (vs ~50MB for all)
- Filename format: `{unicode_codepoint}.svg` (e.g., `04e00.svg` for 一)

```bash
git clone --depth 1 https://github.com/KanjiVG/kanjivg.git /tmp/kanjivg
mkdir -p data/kanjivg
# Copy only joyo kanji SVGs (filter list from kanji-data.json)
# Script to generate during Phase 2 implementation
rm -rf /tmp/kanjivg
```

File: `src/lib/db/seed/kanji-data.ts`

- On first launch, load `data/kanji-data.json` into `kanji_levels` table
- Populate `kanji_dependencies` table (radicals unlock kanji, kanji unlock vocab)
- 60 levels, each with radicals, kanji, and vocabulary
- Source: `davidluzgouveia/kanji-data` repo
- Skip if data already seeded (check settings table for `kanji_seeded=true`)

File: `src/lib/srs/wanikani-srs.ts`

- Fixed-interval SRS (NOT FSRS -- WaniKani uses fixed intervals):
  - Stage 0: Locked (not yet unlocked)
  - Stage 1: Apprentice 1 (4 hours)
  - Stage 2: Apprentice 2 (8 hours)
  - Stage 3: Apprentice 3 (1 day)
  - Stage 4: Apprentice 4 (2 days)
  - Stage 5: Guru 1 (1 week)
  - Stage 6: Guru 2 (2 weeks)
  - Stage 7: Master (1 month)
  - Stage 8: Enlightened (4 months)
  - Stage 9: Burned (removed from rotation)
- Wrong answer drops 1-2 stages based on current stage
- `reviewKanjiItem(id, correct)` -- advance or drop stage, calculate next review time
- `unlockCheck(level)` -- check if enough items at Guru+ to unlock next batch
- Level-up requires ~90% of level's kanji at Guru or above

File: `src/lib/db/queries/kanji.ts`

- `getKanjiByLevel(level)` -- all items for a level
- `getDueKanjiReviews()` -- all kanji items due for review
- `getUnlockedItems()` -- items with srs_stage > 0
- `getLevelProgress(level)` -- percentage of items at Guru+
- `checkAndUnlock(level)` -- unlock next batch if requirements met
- `getUserLevel()` -- current highest unlocked level

View: `src/views/KanjiMap.svelte`

- Grid of 60 levels
- Each level shows: level number, completion percentage, item count
- Color-coded by progress (locked/in-progress/complete)
- Click level to expand and see radicals/kanji/vocab
- Current level highlighted

View: `src/views/KanjiDetail.svelte`

- Single kanji deep-dive:
  - Character (large display)
  - Meanings
  - On'yomi and Kun'yomi readings
  - Component radicals
  - Stroke order SVG (loaded on demand from `data/kanjivg/`)
  - Mnemonic (if available)
  - Example vocabulary using this kanji
  - SRS stage indicator
  - Review history

Component: `src/lib/components/kanji/StrokeOrder.svelte`

- Load KanjiVG SVG from `data/kanjivg/{codepoint}.svg` on demand
- Animate stroke order on click/tap (draw strokes sequentially)
- Number each stroke
- Show placeholder if SVG not found (non-joyo kanji)

Component: `src/lib/components/kanji/LevelProgress.svelte`

- Progress bar for current level
- Shows: radicals at Guru / total, kanji at Guru / total
- Unlock status indicators

Component: `src/lib/components/kanji/SrsStageIndicator.svelte`

- Visual indicator of SRS stage (Apprentice through Burned)
- Color-coded badge (see design guardrails SRS Stage Colors)
- Next review time

#### 2.7 -- Dashboard

View: `src/views/Dashboard.svelte`

- Summary cards:
  - Reviews due today (deck-based + kanji)
  - Current kanji level + progress to next
  - Study streak (consecutive days with reviews)
  - Cards learned (total)
- Quick action buttons:
  - "Start Review" (deck-based)
  - "Kanji Review" (WaniKani-style)
  - "Learn New Kanji" (unlock and learn new items)
- Upcoming reviews timeline (next 24 hours)

#### 2.8 -- Verify

- [ ] Can import an .apkg file and see cards in a deck
- [ ] Import wraps in transaction and rolls back on failure
- [ ] Card HTML is sanitized (no script execution)
- [ ] Flashcard review works: flip card, rate, advance to next
- [ ] FSRS-6 calculates correct next intervals
- [ ] Review log records every review
- [ ] Daily stats update after reviews
- [ ] Kanji data loads on first launch (all 60 levels)
- [ ] Kanji review works with fixed-interval SRS
- [ ] Unlocking works: radicals at Guru unlock kanji, kanji at Guru unlock vocab
- [ ] Level-up triggers when ~90% of kanji reach Guru
- [ ] Stroke order SVGs display correctly (loaded on demand)
- [ ] Dashboard shows accurate counts and progress
- [ ] Media stored correctly (BLOBs for small, filesystem for large)
- [ ] `pnpm test` passes all Phase 2 tests

### LL-G Checkpoint -- Phase 2
- **CHECK:** Was LL-G consulted before every code edit?
- **CONTRIBUTE:** List all new gotchas. Run `/add-lesson` for each.
  - Expected areas: ts-fsrs API quirks, anki-reader browser compatibility, Svelte 5 reactivity with database queries, KanjiVG SVG rendering, tauri-plugin-sql query patterns, DOMPurify configuration

### BP Checkpoint -- Phase 2
- **CHECK:** Were applicable BP practices consulted? (database, components, error handling)
- **APPLY:** List which practices were followed or intentionally skipped with rationale.

---

## Phase 3 -- Polish

### Goal
Add TTS, search (FTS5), statistics with charts, keyboard shortcuts, card editing, undo review, and general UX polish.

### Steps

#### 3.1 -- LL-G + BP Check
```
MANDATORY: Before writing any code in this phase:

LL-G:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/llms.txt
2. Fetch all relevant tech sub-indexes
3. Read ALL HIGH entries. Read MEDIUM entries matching: TTS, search, charts, keyboard

BP:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/BP/main/llms.txt
2. Load FOUNDATIONAL entries
3. Load RECOMMENDED entries matching: accessibility, performance, search
```

#### 3.2 -- TTS Pronunciation

File: `src/lib/tts/speech.ts`

- Abstract TTS behind an interface:
  ```typescript
  interface TtsEngine {
    speak(text: string, lang: string): Promise<void>;
    stop(): void;
    isAvailable(): boolean;
  }
  ```
- Implement `WebSpeechTts` using `window.speechSynthesis`
  - Language: `ja-JP`
  - Auto-detect best available Japanese voice
  - Rate/pitch configurable in settings
- Future: implement `EdgeTts` using Edge TTS via Tauri command
- Add speak button to:
  - FlashCard back side (pronounce the answer)
  - KanjiDetail view (pronounce readings)
  - Search results (pronounce any word)

#### 3.3 -- Search (FTS5)

**Use SQLite FTS5 instead of LIKE queries.** FTS5 is built into SQLite and provides fast full-text search with ranking.

Add FTS5 tables via migration (version 2):
- `cards_fts` -- indexes card front/back text
- `kanji_fts` -- indexes character, meanings, readings
- See Database Schema section for table definitions and triggers

View: `src/views/Search.svelte`

- Single search box at top
- Search across: cards (front/back text), kanji (character, meanings, readings), vocabulary
- Results grouped by type: Cards, Kanji, Vocabulary
- Click result to navigate to detail view
- Debounced input (300ms)
- Query pattern:
  ```sql
  SELECT c.* FROM cards c
  JOIN cards_fts ON cards_fts.rowid = c.id
  WHERE cards_fts MATCH ?
  ORDER BY rank
  LIMIT 50;
  ```

#### 3.4 -- Statistics & Analytics

View: `src/views/Stats.svelte`

Charts (all inline SVG, no charting library):

| Chart | Type | X-axis | Y-axis | Data source |
|-------|------|--------|--------|-------------|
| Reviews per day | Bar chart | Date (last 30 days) | Review count | daily_stats.reviews_count |
| Accuracy trend | Line chart | Date (last 30 days) | % correct | daily_stats.correct_count / reviews_count |
| Time spent | Bar chart | Date (last 30 days) | Minutes | daily_stats.time_spent_ms / 60000 |
| Card state distribution | Stacked bar | State labels | Card count | cards grouped by state |
| Kanji SRS stages | Stacked bar | Stage labels | Item count | kanji_levels grouped by srs_stage |

Additional stats (text, no charts):
- Total cards learned, reviews done, streak length
- Average accuracy (all time)
- Average review time per card

#### 3.5 -- Keyboard Shortcuts

Global shortcuts (always active):
- `Ctrl+1` through `Ctrl+5` -- navigate to Dashboard/Review/Kanji/Decks/Stats
- `Ctrl+F` -- focus search
- `Ctrl+I` -- open import dialog

Review shortcuts (during review session):
- `Space` -- flip card
- `1/2/3/4` -- rate Again/Hard/Good/Easy
- `Ctrl+Z` -- undo last review (see 3.6)
- `P` -- play TTS for current card

#### 3.6 -- Undo Review

Mechanics for `Ctrl+Z` during review:

**Undo stack:** Keep an in-memory array of previous states for the current session (max 50 entries).

```typescript
interface UndoEntry {
  cardId: number;
  previousCard: CardState;     // snapshot of card row before review
  reviewLogId: number;         // review_log row to delete
  previousDailyStats: {        // snapshot of daily_stats before review
    reviews_count: number;
    correct_count: number;
    incorrect_count: number;
    time_spent_ms: number;
  };
}
```

On undo:
1. Pop last entry from undo stack
2. Restore card state: `UPDATE cards SET stability=?, difficulty=?, due=?, ... WHERE id=?`
3. Delete review log entry: `DELETE FROM review_log WHERE id=?`
4. Restore daily_stats: `UPDATE daily_stats SET reviews_count=?, ... WHERE date=?`
5. Re-insert the card at the front of the review queue
6. Show the card again

#### 3.7 -- Card Editor

Component: `src/lib/components/deck/CardEditor.svelte`

- Edit existing cards (modify field values)
- Add new cards to a deck
- Preview front/back rendering
- Tag editing
- Delete card (with confirmation)

#### 3.8 -- Settings Page

View: `src/views/Settings.svelte`

- Theme: dark/light/system
- Daily new card limit (default: 20)
- Daily review limit (default: 200)
- TTS: enable/disable, voice selection, rate, pitch
- Kanji: auto-play pronunciation on reveal
- Review: show/hide timer, auto-advance delay
- Data: export database, import database, reset progress
- About: version, credits, data attributions

#### 3.9 -- UX Polish

- Loading states for database queries
- Empty states for views with no data
- Error toasts for failed operations (using safeQuery error messages)
- Smooth page transitions between views
- Review session timer (optional, shows in corner)
- Card count indicator during review ("Card 5 of 23")

#### 3.10 -- Verify

- [ ] TTS speaks Japanese text correctly
- [ ] Search returns relevant results via FTS5 across all content types
- [ ] Statistics charts render correctly with real review data
- [ ] All keyboard shortcuts work
- [ ] Undo review restores card state, deletes log entry, adjusts daily_stats
- [ ] Card editor saves changes correctly
- [ ] Settings persist across app restarts
- [ ] No UI jank or layout shifts during normal use
- [ ] `pnpm test` passes all Phase 3 tests

### LL-G Checkpoint -- Phase 3
- **CHECK:** Was LL-G consulted before every code edit?
- **CONTRIBUTE:** List all new gotchas. Run `/add-lesson` for each.
  - Expected areas: Web Speech API Japanese voice quirks, FTS5 query syntax, SVG chart rendering, keyboard event handling in Tauri webview, settings persistence patterns

### BP Checkpoint -- Phase 3
- **CHECK:** Were applicable BP practices consulted? (accessibility, search, performance)
- **APPLY:** List which practices were followed or intentionally skipped with rationale.

---

## Phase 4 -- Ship

### Goal
Production-ready: auto-updater, system tray, backup/restore, grammar reference, reading practice with furigana, and dictionary integration.

### Steps

#### 4.1 -- LL-G + BP Check
```
MANDATORY: Before writing any code in this phase:

LL-G:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/LL-G/main/llms.txt
2. Fetch all relevant tech sub-indexes
3. Read ALL HIGH entries

BP:
1. Fetch https://raw.githubusercontent.com/wellforce-brandon/BP/main/llms.txt
2. Load FOUNDATIONAL entries
3. Load RECOMMENDED entries matching: distribution, security, i18n
```

#### 4.2 -- Auto-Updater

- Add `tauri-plugin-updater` to Cargo.toml and JS deps
- Configure update endpoint (GitHub Releases or custom URL)
- Check for updates on app launch (non-blocking)
- Show notification if update available
- One-click update + restart

#### 4.3 -- System Tray

- App icon in system tray
- Tray menu: "Open Janki", "Reviews Due: N", "Quit"
- Minimize to tray instead of closing
- Review reminder notification (configurable interval)
- Badge/tooltip showing due count

#### 4.4 -- Backup & Restore

- Export: copy SQLite database file to user-chosen location
- Import: restore from a backup file (replace current DB, restart app)
- Auto-backup: daily backup to `$APPDATA/janki/backups/` (keep last 7)
- Use Tauri's `plugin-dialog` for save/open dialogs
- Use Tauri's `plugin-fs` for file operations

#### 4.5 -- Grammar Reference

View: add a "Grammar" section to navigation

**Data format:** JSON, one file per JLPT level, start with N5 (~80 grammar points).

```json
// data/grammar/n5.json
{
  "level": "N5",
  "points": [
    {
      "id": "n5-desu",
      "pattern": "〜です",
      "meaning": "is/am/are (polite)",
      "formation": "Noun + です",
      "examples": [
        { "ja": "学生です。", "en": "I am a student.", "reading": "がくせいです。" }
      ],
      "related_grammar": ["n5-ja-nai"],
      "related_kanji": ["学", "生"],
      "tags": ["polite", "copula", "beginner"]
    }
  ]
}
```

- Each grammar point: pattern, explanation, formation rule, example sentences
- Search within grammar points (uses FTS5 from Phase 3)
- Link related grammar to kanji/vocab where applicable
- Start with N5 (~80 entries), expand to N4-N1 over time

**YouTuber Research Reference:** See saved memory at `reference_japanese_youtubers.md` for channels to research post-implementation. Their grammar approaches and recommended resources may inform how grammar points are structured and prioritized.

#### 4.6 -- Reading Practice

View: add a "Reading" section to navigation

##### Tatoeba Loading Strategy

- **Download on first use**, not bundled with app
- Source: `https://downloads.tatoeba.org/exports/sentences.tar.bz2` (filter to Japanese + English pairs)
- Store in `$APPDATA/janki/data/tatoeba/`
- Import to SQLite table with FTS5 index:
  ```sql
  CREATE TABLE sentences (
    id INTEGER PRIMARY KEY,
    ja_text TEXT NOT NULL,
    en_text TEXT NOT NULL,
    jlpt_level TEXT -- estimated, based on kanji used
  );
  CREATE VIRTUAL TABLE sentences_fts USING fts5(ja_text, en_text, content=sentences, content_rowid=id);
  ```
- Progress indicator during download + import
- ~200K Japanese-English sentence pairs

##### jmdict Dictionary Loading Strategy

- **Download on first use**, not bundled with app
- Source: `jmdict-simplified` pre-processed JSON (~40MB compressed)
- Store as a **separate SQLite database** at `$APPDATA/janki/data/jmdict.db`
  - Keeps main DB small, dictionary is read-only after import
  - Schema: `entries(id, kanji, kana, meanings_json, pos_json, jlpt_level)`
  - FTS5 index on kanji + kana + meanings
- Tap/hover on words to see dictionary definitions
- Filter by JLPT level
- "Add to deck" button to create flashcard from a sentence

##### Furigana Rendering

- Use `<ruby>` HTML tags for furigana display:
  ```html
  <ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>
  ```
- **Segmentation approach:** Use a JavaScript-based tokenizer (e.g., `kuromoji.js` or `budoux`) to split Japanese text into words and attach readings
- `kuromoji.js` provides accurate morphological analysis but has a large dictionary (~20MB, loaded lazily on first use)
- `budoux` is lightweight (~5KB) but only does word boundary detection, not reading generation
- Recommended: use `kuromoji.js` with lazy dictionary loading. Cache the tokenizer instance.
- Furigana toggle (show/hide readings above kanji) -- user preference stored in settings

#### 4.7 -- Final Polish

- App icon design
- Installer configuration (Tauri NSIS or WiX)
- First-run onboarding (brief tutorial on app features)
- About page with credits and data attributions
- Performance audit: ensure smooth 60fps during card flips and navigation

#### 4.8 -- Verify

- [ ] Auto-updater detects and installs updates
- [ ] System tray shows correct due count
- [ ] Minimize to tray works
- [ ] Backup creates valid database copy
- [ ] Restore replaces database and app restarts correctly
- [ ] Grammar reference displays N5 points correctly
- [ ] Grammar search works via FTS5
- [ ] Reading practice word lookup works (jmdict)
- [ ] Tatoeba sentences load and display correctly
- [ ] Furigana renders correctly with ruby tags
- [ ] Furigana toggle works
- [ ] App installs cleanly via installer on a fresh Windows 11 machine
- [ ] `pnpm test` passes all Phase 4 tests

### LL-G Checkpoint -- Phase 4
- **CHECK:** Was LL-G consulted before every code edit?
- **CONTRIBUTE:** List all new gotchas. Run `/add-lesson` for each.
  - Expected areas: Tauri updater configuration, system tray behavior, NSIS installer quirks, furigana rendering, kuromoji.js lazy loading, FTS5 cross-database queries

### BP Checkpoint -- Phase 4
- **CHECK:** Were applicable BP practices consulted? (distribution, security, i18n)
- **APPLY:** List which practices were followed or intentionally skipped with rationale.

---

## Japanese Language Data Sources

### Required Data (download before Phase 2)

| Dataset | Source | License | Format | Size | Usage |
|---------|--------|---------|--------|------|-------|
| kanji-data | `github.com/davidluzgouveia/kanji-data` | MIT | JSON | ~2MB | WaniKani levels, meanings, readings, JLPT, radicals |
| KanjiVG (joyo subset) | `github.com/KanjiVG/kanjivg` | CC BY-SA 3.0 | SVG | ~5MB | Stroke order diagrams (2,200 joyo kanji only) |
| KRADFILE2/RADKFILE2 | EDRDG (via `edrdg.org`) | CC BY-SA 4.0 | JSON (pre-processed) | ~500KB | Radical-kanji decomposition |

### Downloaded on First Use (Phase 4)

| Dataset | Source | License | Format | Size | Usage |
|---------|--------|---------|--------|------|-------|
| jmdict-simplified | `github.com/scriptin/jmdict-simplified` | CC BY-SA 4.0 | JSON -> SQLite | ~40MB | Dictionary lookups, word definitions |
| Tatoeba | `tatoeba.org/en/downloads` | CC BY 2.0 | TSV -> SQLite | ~50MB | Example sentences (Japanese + English) |

### Optional Data (import via .apkg)

| Deck | Source | Cards |
|------|--------|-------|
| Core 2k/6k Optimized | AnkiWeb `1880390099` | 6,000 common words |
| JLPT N5-N1 Study | AnkiWeb `1407096987` | All JLPT levels |
| KanjiDamage | `kanjidamage.com` | 1,700+ kanji with mnemonics |

---

## CLAUDE.md Hierarchy (Planned)

These will be created during Phase 1 (Step 1.12):

### Root CLAUDE.md (already exists -- update if needed)
- Full stack summary already present
- Janki-specific conventions already present

### src/CLAUDE.md (create in Phase 1)
- Lightweight pointer to `.claude/rules/frontend.md`
- Key conventions summary

### src-tauri/CLAUDE.md (create in Phase 1)
- Tauri backend conventions
- Plugin registration, capabilities, error handling

### Path-scoped rules (already exist)
- `.claude/rules/frontend.md` -- Svelte, shadcn, Tailwind conventions
- `.claude/rules/database.md` -- SQLite, queries, migrations
- `.claude/rules/tests.md` -- Vitest, mocking, test structure

---

## Design Guardrails Summary

See `.claude/references/design-guardrails.md` for full rules. Key points:

- Components max 200 lines. Split if larger.
- shadcn-svelte components are the base -- extend, don't replace.
- Tailwind only, no CSS modules or inline styles.
- Dark mode via `dark:` variants on every visual element.
- Accessible: all interactive elements keyboard-navigable, proper ARIA labels.
- Japanese text: use `font-sans` with a Japanese-capable font stack.
- Card content: sanitize through DOMPurify before rendering (XSS prevention).
- SRS stage colors: defined in design guardrails (Apprentice=pink, Guru=purple, Master=blue, Enlightened=sky, Burned=amber).
- Rating button colors: Again=destructive/red, Hard=orange, Good=green, Easy=blue.

---

## Environment Variables

None required. This is a fully local desktop app. All data stored in:
- SQLite: `$APPDATA/janki/janki.db`
- Dictionary: `$APPDATA/janki/data/jmdict.db` (separate DB, Phase 4)
- Sentences: `$APPDATA/janki/data/tatoeba/` (Phase 4)
- Media (large files): `$APPDATA/janki/media/`
- Backups: `$APPDATA/janki/backups/`
- Logs: `$APPDATA/janki/logs/`

---

## Lessons Learned / Gotchas

> This section is filled during and after implementation. After each phase, route discoveries to LL-G via `/add-lesson`.

### Phase 1
- (To be filled)

### Phase 2
- (To be filled)

### Phase 3
- (To be filled)

### Phase 4
- (To be filled)