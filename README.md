# Janki

Personal Windows desktop app for learning Japanese. Replaces Anki with a modern UI, WaniKani-style kanji progression, and a comprehensive language learning system.

## Features

### Kanji System
- **WaniKani-Style Progression** -- 60-level kanji system: radicals -> kanji -> vocabulary with SRS stages (Apprentice through Burned)
- **Stroke Order** -- animated SVG stroke diagrams from KanjiVG
- **Level-Based Unlocks** -- items unlock as you progress through stages, gated by mastery
- **Dual Reviews** -- meaning and reading reviewed separately with romaji-to-hiragana conversion

### Language Learning
- **Five Content Types** -- kana, vocabulary, grammar, sentences, and conjugations with ~33k items
- **Structured Lessons** -- teaching phase with visual cards before quiz phase
- **Lesson Picker** -- choose what to study by content type with available/completed counts
- **Answer Validation** -- fuzzy matching for longer answers (60%+ word overlap)

### SRS & Reviews
- **FSRS-6 Engine** -- 20-30% fewer reviews than Anki's SM-2 (for deck-based cards)
- **WaniKani-Style SRS** -- stages 0-9 with interval progression (4h to 4 months)
- **Review Undo** -- Ctrl+Z to undo last answer with full SRS state rollback
- **Keyboard Shortcuts** -- ? overlay showing all shortcuts, Alt+P for audio, Enter to submit
- **Japanese TTS** -- pronunciation via Web Speech API with configurable rate/pitch

### Search & Stats
- **FTS5 Full-Text Search** -- instant search across all language items with ranked results
- **Review Heatmap** -- combined kanji + language review activity calendar
- **SRS Distribution** -- visual breakdown of items by SRS stage per content type
- **Daily Charts** -- reviews per day, accuracy trends, time spent, content type breakdowns

### General
- **Anki Import** -- import .apkg files from AnkiWeb community decks
- **Dark/Light Theme** -- toggle with system preference detection
- **Auto-Backup** -- daily backups on launch (last 7 kept), manual export/import
- **Auto-Updater** -- checks for updates on launch via GitHub Releases
- **Local-First** -- all data in SQLite, no account or server needed

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop shell | Tauri 2.x |
| Frontend | Svelte 5 (runes) |
| UI components | shadcn-svelte |
| Styling | Tailwind CSS 4 |
| Database | SQLite (tauri-plugin-sql) |
| SRS algorithm | FSRS-6 (ts-fsrs) + WK-style |
| Anki import | anki-reader |
| Linter/Formatter | Biome 2.x |
| Test runner | Vitest |
| Package manager | pnpm |

## Architecture

```
┌─────────────────────────────────────┐
│          Tauri Window               │
│  ┌───────────────────────────────┐  │
│  │     Svelte 5 Frontend         │  │
│  │  ┌─────────┐  ┌───────────┐  │  │
│  │  │ Views   │  │Components │  │  │
│  │  │Dashboard│  │ FlashCard │  │  │
│  │  │ Review  │  │ KanjiCard │  │  │
│  │  │Language │  │StrokeOrder│  │  │
│  │  │ Search  │  │ Lessons   │  │  │
│  │  │ Stats   │  │  Charts   │  │  │
│  │  └────┬────┘  └─────┬─────┘  │  │
│  │       │              │        │  │
│  │  ┌────┴──────────────┴─────┐  │  │
│  │  │     Stores + Logic      │  │  │
│  │  │  FSRS-6 │ WK-SRS │ TTS │  │  │
│  │  └────────────┬────────────┘  │  │
│  └───────────────┼───────────────┘  │
│                  │ tauri-plugin-sql  │
│  ┌───────────────┴───────────────┐  │
│  │    Rust Backend (Tauri)       │  │
│  │  SQLite │ File System │ TTS  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
    $APPDATA/com.janki.desktop/
    ├── janki.db      (SQLite)
    ├── backups/      (daily auto-backup)
    └── logs/
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable toolchain)
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- Windows 11 (WebView2 pre-installed)

## Getting Started

```bash
git clone https://github.com/your-user/janki.git
cd janki
pnpm install
pnpm tauri dev
```

## Project Structure

```
janki/
├── src/                    # Svelte frontend
│   ├── lib/
│   │   ├── components/     # UI components (review, kanji, language, stats, layout)
│   │   ├── stores/         # Svelte state management
│   │   ├── db/             # Database layer (queries, migrations, cache)
│   │   ├── srs/            # FSRS-6 + WaniKani SRS engines
│   │   ├── import/         # Anki .apkg parser
│   │   ├── utils/          # Answer validation, Japanese text utilities
│   │   └── tts/            # Text-to-speech
│   └── views/              # Top-level page components
├── src-tauri/              # Tauri Rust backend
├── public/data/            # Static language data (JSON)
├── data/                   # Build-time data processing
├── tasks/                  # Development plans
└── .claude/                # Claude Code configuration
```

## Data Sources

| Dataset | License | Purpose |
|---------|---------|---------|
| [JMdict](https://www.edrdg.org/jmdict/) | CC BY-SA 4.0 | Japanese-English dictionary |
| [KANJIDIC2](https://www.edrdg.org/kanjidic/) | CC BY-SA 4.0 | Kanji dictionary |
| [KanjiVG](https://github.com/KanjiVG/kanjivg) | CC BY-SA 3.0 | Stroke order SVGs |
| [kanji-data](https://github.com/davidluzgouveia/kanji-data) | MIT | WaniKani-style level data |
| [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) | CC BY-SA 4.0 | JSON-formatted dictionaries |
| [Tatoeba](https://tatoeba.org/) | CC0/CC-BY | Example sentences |

## License

MIT
