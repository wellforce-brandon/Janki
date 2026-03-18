# Design Guardrails -- Janki

Rules for UI consistency, accessibility, and performance. All components must follow these constraints.

## Component Rules (shadcn-svelte)

- Max component file size: 200 lines. Split into sub-components if larger.
- shadcn-svelte components (`src/lib/components/ui/`) are the base layer. Extend, do not replace.
- Custom components go in domain folders: `review/`, `kanji/`, `deck/`, `stats/`, `layout/`.
- Props: use TypeScript interfaces. No `any` types on component props.
- Events: use Svelte 5's `$props()` callback pattern, not legacy `createEventDispatcher`.
- Composition over inheritance. Prefer slot-based composition.

## Styling Rules (Tailwind CSS 4)

- Tailwind utility classes only. No CSS modules, no inline `style` attributes, no `<style>` blocks.
- Exception: shadcn-svelte components may use `<style>` internally -- do not modify their styling approach.
- Dark mode via `dark:` variants on every visual element. Never hardcode colors.
- Responsive breakpoints (even though desktop-only, window can resize):
  - `sm`: 640px (compact sidebar)
  - `md`: 768px (default)
  - `lg`: 1024px (expanded)
  - `xl`: 1280px (wide)
- Spacing: use Tailwind's default scale (`p-2`, `gap-4`, `m-6`). No arbitrary values unless truly needed.
- Border radius: consistent `rounded-lg` for cards, `rounded-md` for buttons, `rounded-sm` for inputs.

## Color System

Use shadcn-svelte's CSS variable system. Do not hardcode hex/rgb values.

- `--background` / `--foreground` -- main surfaces
- `--card` / `--card-foreground` -- card surfaces
- `--primary` / `--primary-foreground` -- primary actions, active navigation
- `--secondary` / `--secondary-foreground` -- secondary elements
- `--muted` / `--muted-foreground` -- disabled, placeholder text
- `--accent` / `--accent-foreground` -- hover states, highlights
- `--destructive` / `--destructive-foreground` -- delete, error, "Again" rating

### SRS Stage Colors (custom, must work in both themes)

| Stage | Light | Dark | Usage |
|-------|-------|------|-------|
| Locked | `gray-400` | `gray-600` | Locked kanji items |
| Apprentice | `pink-500` | `pink-400` | SRS stages 1-4 |
| Guru | `purple-500` | `purple-400` | SRS stages 5-6 |
| Master | `blue-500` | `blue-400` | SRS stage 7 |
| Enlightened | `sky-500` | `sky-400` | SRS stage 8 |
| Burned | `amber-500` | `amber-400` | SRS stage 9 (completed) |

### Rating Button Colors

| Rating | Color | Shortcut |
|--------|-------|----------|
| Again | `destructive` (red) | 1 |
| Hard | `orange-500` | 2 |
| Good | `green-500` | 3 |
| Easy | `blue-500` | 4 |

## Typography

- Base font: system sans-serif stack with Japanese support:
  ```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic UI', sans-serif;
  ```
- Japanese text (kanji, kana): use the same stack -- `Noto Sans JP` or `Yu Gothic UI` will render.
- Large kanji display (detail views, flashcard front): `text-6xl` to `text-8xl`
- Reading/pronunciation text: `text-lg` to `text-xl`
- Body text: `text-sm` to `text-base`
- Monospace (for technical info like SRS values): `font-mono`

## Accessibility

- WCAG AA minimum contrast ratios (4.5:1 for text, 3:1 for large text).
- All interactive elements must be keyboard-navigable (tab order, focus rings).
- Focus rings: use Tailwind's `focus-visible:ring-2 focus-visible:ring-ring` pattern.
- ARIA labels on icon-only buttons (e.g., play TTS, flip card).
- Screen reader text for SRS stage indicators and progress bars.
- No information conveyed by color alone -- always pair with text or icons.

## Animation

- Card flip: CSS 3D transform (`rotateY(180deg)`), 300ms duration, ease-in-out.
- Page transitions: Svelte `fade` transition, 150ms.
- Progress bars: Svelte `tweened` store, 300ms.
- Hover effects: 150ms transition on `background-color` and `transform`.
- Reduce motion: respect `prefers-reduced-motion`. Disable animations when set.

## Performance

- No heavy charting libraries. Use inline SVG for charts.
- Lazy-load KanjiVG stroke order SVGs (load on demand, not all at once).
- Database queries: always use prepared statements via tauri-plugin-sql.
- Image media from imported decks: load from BLOB on demand, cache in memory for current session.
- Target: 60fps during card flip animations and view transitions.

## Security

- Sanitize all HTML from Anki card templates before rendering. Anki cards can contain arbitrary HTML/JS.
- Use a DOM sanitizer (DOMPurify or equivalent) on imported card content.
- Never use `{@html}` on unsanitized content.
- File picker: only accept `.apkg` extension via Tauri dialog filter.
- No network requests except: TTS (Edge TTS, future), auto-update check (Phase 4).

## Layout

- Sidebar: fixed left, 240px wide (collapsible to 60px icon-only).
- Main content: fills remaining width, scrollable.
- Header: fixed top within main content area, 48px height.
- Content padding: `p-6` on main content area.
- Max content width: none (fill available space for data tables and grids).
- Flashcard review: centered in viewport, max-width `max-w-2xl`.
