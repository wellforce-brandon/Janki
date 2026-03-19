# src/ -- Frontend

See `.claude/rules/frontend.md` for full conventions. Key points:
- Svelte 5 runes only ($state, $derived, $effect) -- use .svelte.ts for reactive stores
- All DB access via src/lib/db/queries/ -- never raw SQL in components
- Tailwind utility classes only, dark: variants on everything
- Sanitize all Anki HTML through src/lib/utils/sanitize.ts before {@html}
