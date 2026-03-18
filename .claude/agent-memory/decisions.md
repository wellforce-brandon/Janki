# Architectural Decisions

Key decisions made during planning. Reference these before proposing alternatives.

## Desktop Shell: Tauri 2.x (not Electron)
- **Why:** 2-10 MB installer vs 100-300 MB. 30-40 MB RAM vs 200-300 MB. Uses Win11's built-in WebView2.
- **Trade-off:** Smaller plugin ecosystem than Electron. Occasional Rust needed for custom native work.
- **Decided:** 2026-03-18

## Frontend: Svelte 5 (not React 19)
- **Why:** 4KB runtime vs 45KB. Built-in animation primitives for card flips. Cleaner DX for SPA.
- **Trade-off:** Smaller ecosystem, fewer Tauri community examples. React would have more boilerplate templates.
- **Decided:** 2026-03-18

## SRS: FSRS-6 (not SM-2)
- **Why:** 20-30% fewer reviews for equivalent retention. Direct retention % targeting. ts-fsrs is the official TypeScript implementation.
- **Trade-off:** More complex (21 parameters vs 3), but defaults work well out of box.
- **Decided:** 2026-03-18

## Kanji SRS: WaniKani fixed intervals (not FSRS)
- **Why:** WaniKani's system uses fixed intervals (4h/8h/1d/2d/1w/2w/1mo/4mo) with stage-based unlocking. This is fundamentally different from FSRS -- it's a progression system, not just a scheduler.
- **Trade-off:** Two separate SRS systems to maintain. But they serve different purposes.
- **Decided:** 2026-03-18

## Database: SQLite via tauri-plugin-sql (not better-sqlite3)
- **Why:** tauri-plugin-sql is the official Tauri plugin (SQLx-backed). better-sqlite3 is a Node addon, incompatible with Tauri's Rust backend.
- **Decided:** 2026-03-18

## Rosetta Stone: Dropped
- **Why:** API is enterprise-only (institutional licenses). Manages users/licenses, not content. No public SDK, no embeddable player.
- **Decided:** 2026-03-18
