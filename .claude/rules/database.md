---
description: SQLite database conventions for tauri-plugin-sql
globs: ["src/lib/db/**", "src-tauri/**"]
alwaysApply: false
---

# Database Conventions

- Database: SQLite via tauri-plugin-sql (SQLx-backed). DB file at `$APPDATA/janki/janki.db`.
- All queries go through `src/lib/db/queries/` modules. One file per domain: cards.ts, decks.ts, notes.ts, reviews.ts, kanji.ts, stats.ts.
- Use parameterized queries (`?` placeholders) for all user-provided values. Never concatenate SQL strings.
- Migrations defined in `src/lib/db/migrations.ts`. Each migration has a version number and up/down SQL.
- Run migrations on app startup in `src/lib/db/database.ts`.
- Store dates as ISO 8601 text (`datetime('now')`). Parse with standard Date APIs.
- Store JSON data as TEXT columns. Parse/stringify at the query layer, not in components.
- FSRS card state fields (stability, difficulty, due, etc.) live on the `cards` table.
- WaniKani SRS state lives on the `kanji_levels` table (separate from deck-based SRS).
- Indexes exist for: cards.due, cards.deck_id, cards.state, kanji_levels.level, kanji_levels.srs_stage, review_log.card_id.
