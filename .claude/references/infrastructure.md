# Infrastructure Stack -- Janki (Desktop App)

Janki is a **local desktop application**, not a web app. The standard web infrastructure (Cloudflare Pages, Northflank, etc.) does NOT apply to this project.

## Architecture

```
┌─────────────────────────────────────┐
│          Tauri Window               │
│  ┌───────────────────────────────┐  │
│  │     Svelte 5 Frontend         │  │
│  │     (WebView2 on Windows)     │  │
│  │                               │  │
│  │  Views: Dashboard, Review,    │  │
│  │  KanjiMap, Decks, Stats,      │  │
│  │  Search, Settings             │  │
│  │                               │  │
│  │  Libraries: ts-fsrs, anki-    │  │
│  │  reader, shadcn-svelte        │  │
│  └───────────────┬───────────────┘  │
│                  │                  │
│         tauri-plugin-sql            │
│         tauri-plugin-fs             │
│         tauri-plugin-dialog         │
│                  │                  │
│  ┌───────────────┴───────────────┐  │
│  │     Rust Backend (Tauri)      │  │
│  │                               │  │
│  │  SQLite (sqlx)                │  │
│  │  File system access           │  │
│  │  Native dialogs               │  │
│  │  System tray (Phase 4)        │  │
│  │  Auto-updater (Phase 4)       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
    $APPDATA/janki/
    ├── janki.db        (SQLite database)
    ├── backups/        (daily auto-backup)
    └── logs/           (app logs)
```

## Infrastructure Decisions (Locked)

| Layer | Choice | Notes |
|-------|--------|-------|
| Desktop shell | Tauri 2.x | Uses Windows 11 WebView2 (pre-installed) |
| Frontend runtime | Svelte 5 + Vite | SPA rendered in WebView2 |
| Backend runtime | Rust (Tauri core) | Plugin-based architecture |
| Database | SQLite | Local file, no server, via tauri-plugin-sql |
| File storage | Local filesystem | $APPDATA/janki/ |
| Auth | None | Personal single-user app |
| Networking | None required | TTS (optional, Edge TTS) and auto-update only |

## What Does NOT Apply

This project does NOT use:
- Cloudflare Pages, Northflank, or any cloud hosting
- Postgres, Redis, or any remote database
- Better Auth or any authentication system
- Docker or containers
- API servers or backend services
- Email services (Resend, SES)
- CDN

## Tauri Plugins Used

| Plugin | Crate | JS Package | Purpose |
|--------|-------|------------|---------|
| SQL | `tauri-plugin-sql` | `@tauri-apps/plugin-sql` | SQLite database |
| File System | `tauri-plugin-fs` | `@tauri-apps/plugin-fs` | Read/write files |
| Dialog | `tauri-plugin-dialog` | `@tauri-apps/plugin-dialog` | File picker, confirm dialogs |
| Updater | `tauri-plugin-updater` | `@tauri-apps/plugin-updater` | Auto-update (Phase 4) |

## Data Storage

All data is local. No cloud sync, no accounts.

- **Database:** `$APPDATA/janki/janki.db` (SQLite)
- **Backups:** `$APPDATA/janki/backups/` (daily, keep last 7)
- **Logs:** `$APPDATA/janki/logs/`
- **Static data:** `data/` folder in app bundle (kanji-data.json, stroke order SVGs)
