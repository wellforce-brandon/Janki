# Janki

Personal Windows desktop app for learning Japanese. Replaces Anki with a modern UI, FSRS-6 spaced repetition, and WaniKani-style kanji progression.

## Features

- **FSRS-6 SRS Engine** -- 20-30% fewer reviews than Anki's SM-2, with direct retention targeting
- **Anki Deck Import** -- import .apkg files from AnkiWeb community decks
- **WaniKani-Style Kanji** -- 60-level progression: radicals -> kanji -> vocab with SRS stages
- **Stroke Order** -- animated SVG stroke diagrams from KanjiVG
- **Japanese TTS** -- pronunciation via Web Speech API (Windows neural voices)
- **Dark/Light Theme** -- toggle with system preference detection
- **Keyboard-Driven** -- full keyboard shortcuts for reviews and navigation
- **Local-First** -- all data stored in SQLite, no account or server needed

## Tech Stack

| Layer | Choice |
|-------|--------|
| Desktop shell | Tauri 2.x |
| Frontend | Svelte 5 |
| UI components | shadcn-svelte |
| Styling | Tailwind CSS 4 |
| Database | SQLite (tauri-plugin-sql) |
| SRS algorithm | FSRS-6 (ts-fsrs) |
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
│  │  │KanjiMap │  │StrokeOrder│  │  │
│  │  │ Decks   │  │ DeckList  │  │  │
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
    $APPDATA/janki/
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
│   │   ├── components/     # UI components (review, kanji, deck, stats)
│   │   ├── stores/         # Svelte state management
│   │   ├── db/             # Database layer (queries, migrations)
│   │   ├── srs/            # FSRS-6 + WaniKani SRS engines
│   │   ├── import/         # Anki .apkg parser
│   │   └── tts/            # Text-to-speech
│   └── views/              # Top-level page components
├── src-tauri/              # Tauri Rust backend
├── data/                   # Static Japanese language data (JSON, SVG)
├── tasks/                  # Development plans
└── .claude/                # Claude Code configuration
```

## Development Phases

- **Phase 1 -- Foundation:** Project scaffold, layout, theme, SQLite schema
- **Phase 2 -- Core:** SRS engine, Anki import, flashcard review, kanji progression
- **Phase 3 -- Polish:** TTS, search, statistics, keyboard shortcuts, card editor
- **Phase 4 -- Ship:** Auto-updater, system tray, backup/restore, grammar, reading practice

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
