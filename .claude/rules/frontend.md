---
description: Svelte 5 component and UI conventions
globs: ["src/**/*.svelte", "src/**/*.ts", "src/**/*.css"]
alwaysApply: false
---

# Frontend Conventions

- Svelte 5 runes syntax only. Use `$state`, `$derived`, `$effect`. Do not use legacy `let` reactivity or stores API.
- shadcn-svelte components live in `src/lib/components/ui/`. Do not modify them unless extending functionality.
- Custom components use PascalCase filenames in domain folders: `review/`, `kanji/`, `deck/`, `stats/`, `layout/`.
- Max 200 lines per component. Split into sub-components if larger.
- All database access goes through `src/lib/db/queries/`. Never write raw SQL in components.
- Views are top-level page components in `src/views/`. They compose domain components.
- Use Tailwind utility classes only. No inline `style` attributes. No `<style>` blocks in custom components.
- Dark mode: always use `dark:` Tailwind variants. Never hardcode color values.
- Japanese text: use the system font stack with Japanese fallbacks (Noto Sans JP, Yu Gothic UI).
- Sanitize all HTML from imported Anki card templates before rendering with `{@html}`.
