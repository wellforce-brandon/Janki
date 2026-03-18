# Plan: Update tasks/plan-repo.md with Comprehensive Improvements

## Context

The original plan was written early in the session before the repo was fully configured. Since then we've added: BP audit integration, LL-G gotcha seeding, agent memory with architectural decisions, path-scoped rules (frontend, database, tests), design guardrails, and updated the init-repo skill. The plan needs to reflect all of this and fix several gaps identified during review.

## Changes Overview

All changes target `tasks/plan-repo.md`. No other files need modification.

### Critical Fixes (things that would break implementation)

1. **Phase 1 Step 1.2 -- Scaffold into existing repo:** The current plan runs `pnpm create tauri-app janki` which creates a NEW directory. The repo already has package.json, CLAUDE.md, .claude/, etc. Fix: scaffold to temp dir, selectively copy src/ and src-tauri/, merge deps into existing package.json.

2. **Phase 1 Step 1.9 -- "Create" vs "Update":** package.json and CHANGELOG.md already exist. Change to "Update".

3. **Phase 2 Step 2.3 -- anki-reader + Tauri compatibility:** anki-reader may use Node.js `fs` internally. Tauri's WebView2 is a browser context, not Node. Add an investigation-first step with fallback plan (JSZip + sql.js).

4. **Phase 2 -- Missing HTML sanitization:** Design guardrails require DOMPurify but the plan never mentions it. Add DOMPurify install in Phase 1, sanitization utility in Phase 2.

### Detail Improvements

5. **Phase 1 -- Add existing repo state table:** List all files that exist and whether they're updated or untouched during scaffold.

6. **Phase 1 -- Add subfolder CLAUDE.md creation:** src/CLAUDE.md and src-tauri/CLAUDE.md should be created in Phase 1 per the hierarchy plan.

7. **Phase 1 -- Add Vitest config + smoke test:** Vitest is installed but never configured. Add vitest.config.ts and one smoke test.

8. **Phase 1 -- Add Biome Svelte file ignore:** biome.json should ignore shadcn-svelte generated components.

9. **Phase 2 -- Kanji data download specifics:** Add exact git clone URLs, file sizes, data structure examples, attribution requirements.

10. **Phase 2 -- KanjiVG strategy:** Bundle only joyo kanji SVGs (~2,200), not all 11,000. Load on demand from filesystem, not SQLite BLOBs.

11. **Phase 2 -- ts-fsrs API mapping:** Add version, actual API surface, schema column mapping.

12. **Phase 2 -- Import error handling:** Wrap in transaction, validate .apkg structure, media size limits, progress callback.

13. **Phase 2 -- Media storage strategy:** BLOBs for <1MB, filesystem for larger. Hybrid approach per user preference.

14. **Phase 3 -- FTS5 instead of LIKE:** SQLite FTS5 for search instead of LIKE queries with wildcards. Add schema, indexing, and query patterns.

15. **Phase 3 -- Chart type specifics:** Specify exact chart types (bar, line, stacked bar) with data/axis definitions.

16. **Phase 3 -- Undo review mechanics:** Undo stack, previous state snapshot, rollback SQL, daily_stats adjustment.

17. **Phase 4 -- Grammar data:** Concrete JSON schema for grammar points. Start with N5 (~80 entries). Reference YouTuber research.

18. **Phase 4 -- Tatoeba loading:** Download on first use, store in AppData, import to SQLite with FTS5.

19. **Phase 4 -- jmdict loading:** Download on first use as pre-processed SQLite (~40MB), separate DB file.

20. **Phase 4 -- Furigana rendering:** Ruby HTML tags, kuroshiro library or Rust-based segmentation, lazy kuromoji dictionary loading.

### New Sections

21. **Error Handling Strategy:** Database errors, import errors, SRS errors, file system errors, general pattern with `safeQuery()`.

22. **Data Migration Strategy:** Migration format, append-only rules, version tracking, automatic pre-destructive backup.

23. **Testing Strategy:** Specific test files and test cases per phase per step.

24. **BP Checkpoints:** Add BP checkpoint to every phase (not just LL-G).

25. **YouTuber Research Reference:** Note in Phase 4 grammar section referencing saved channel list.

### Minor Fixes

26. Remove `tailwind.config.ts` from file structure (Tailwind 4 CSS-first, no config file).
27. Remove redundant `idx_daily_stats_date` index (date is already PRIMARY KEY).
28. Fix KRADFILE source attribution.
29. Add media storage strategy note about hybrid BLOB/filesystem approach.

## Files to Modify

- `C:/Github/Janki/tasks/plan-repo.md` -- all changes go here

## Verification

After updating the plan:
- Read the full plan end-to-end to verify consistency
- Confirm all phase steps are numbered sequentially
- Confirm all verification checklists are complete
- Confirm LL-G AND BP checkpoints exist in every phase
- Confirm no references to creating files that already exist
- Verify line count is reasonable (aim for ~1200-1400 lines with the added detail)
