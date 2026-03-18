---
description: Testing conventions for Vitest test files
globs: ["**/test/**", "**/*.test.*", "**/*.spec.*", "**/__tests__/**"]
alwaysApply: false
---

# Testing Conventions

- Test runner: Vitest (Jest-compatible API)
- Test files: colocate with source as `<name>.test.ts` or in `__tests__/` directories
- Name tests descriptively: `it('should calculate next review interval for Good rating')`
- Test behavior, not implementation. Do not assert on internal state.
- Mock tauri-plugin-sql database calls in unit tests. Use in-memory SQLite for integration tests.
- Mock ts-fsrs only when testing scheduling logic in isolation. Let it run for integration tests.
- Do not mock Svelte component internals. Test via @testing-library/svelte if UI testing is needed.
- Each test file should be self-contained. Do not share mutable state between test files.
- Use `describe` blocks to group related tests. Keep nesting to 2 levels max.
