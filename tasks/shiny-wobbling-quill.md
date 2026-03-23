# Full Visual Pass -- Sidebar + UI Polish

## Context

The sidebar section headers ("Language", "Kanji") are tiny (11px, 60% opacity), making them nearly invisible. The active nav item uses a heavy solid primary background that's jarring. The app has a well-defined color theme (BoardPandas Design Studio export) with sidebar-specific tokens that are currently unused. This plan applies modern Linear/shadcn patterns while retaining the existing theme feel.

**User preferences:** Linear/shadcn-style headers, filled background + left border for active items, full visual pass, keep current theme.

## Research Summary

Modern apps (Linear, Notion, shadcn) use:
- Section headers: 12-13px, medium weight, muted color, generous spacing between groups
- Active items: subtle filled background (10-15% opacity of brand color) + 3px left accent border
- Dark mode: soft grays not pure black, 3+ surface levels, text at 75% white max
- Sidebar-specific color tokens for background, hover, active states

## Sidebar Changes

### File: `src/lib/components/layout/Sidebar.svelte`

**1. Use sidebar color tokens** (already defined in app.css but unused):
- Sidebar bg: `bg-sidebar` instead of `bg-card`
- Text: `text-sidebar-foreground` instead of `text-muted-foreground`
- Active: `bg-sidebar-active text-sidebar-active-foreground` + 3px left border in primary
- Hover: `bg-sidebar-hover` instead of `bg-accent`

**2. Section headers** (line 153):
- Current: `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60`
- New: `text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50`
- Add `mt-2 mb-2` for breathing room between sections
- Add `gap-6` between section groups (up from `gap-4`)

**3. Active nav item** (line 167-170):
- Current: `bg-primary text-primary-foreground` (solid red/dark background)
- New: `bg-sidebar-active text-sidebar-active-foreground border-l-3 border-primary` (subtle tinted bg + left accent border)
- The dark mode sidebar tokens already define: `sidebar-active: rgba(232, 51, 74, 0.12)`, `sidebar-active-foreground: #e8334a`

**4. Inactive items:**
- Current: `text-muted-foreground hover:bg-accent hover:text-accent-foreground`
- New: `text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground`

**5. Shortcuts text:**
- Make slightly more visible: `opacity-40` -> `opacity-30` (subtler, less distracting)

**6. Bottom section separator:**
- Add a subtle divider line before the Stats/Search/Settings group

## Full Visual Pass -- Other Views

### File: `src/app.css`

**7. Add border-l-3 utility** (Tailwind doesn't have `border-l-3` by default):
- Add `border-l-3` as a custom utility or use `border-l-[3px]` inline

### File: `src/views/LanguageOverview.svelte` + `src/views/Dashboard.svelte` (if exists)

**8. Page section headers consistency:**
- Ensure all h3 section headers use `text-sm font-semibold uppercase tracking-wider text-muted-foreground`
- Check spacing between sections is consistent (use `space-y-6` or `space-y-8`)

### File: `src/lib/components/language/LanguageOverviewCard.svelte`

**9. Card hover states:**
- Add `hover:border-primary/30 transition-colors` for interactive cards
- Ensure cards have consistent border + bg-card pattern

### File: Various views

**10. Button hierarchy audit:**
- Primary actions (Start Lessons, Start Review): `variant="default"` (primary color)
- Secondary actions (Back, Cancel): `variant="outline"` or `variant="ghost"`
- Verify no orphaned button styles

### File: `src/views/Settings.svelte`

**11. Settings section spacing:**
- Ensure consistent gap between settings sections
- Verify all input labels use same muted-foreground pattern

## Critical Files

| File | Changes |
|---|---|
| `src/lib/components/layout/Sidebar.svelte` | Main sidebar restyle (1-6) |
| `src/app.css` | Optional utility if needed (7) |
| `src/views/LanguageOverview.svelte` | Section header consistency (8) |
| `src/lib/components/language/LanguageOverviewCard.svelte` | Card hover (9) |

## Verification

1. `npx vite build` -- compiles
2. Visual: Dark mode sidebar -- section headers readable, active item has left border + tinted bg
3. Visual: Light mode sidebar -- same patterns with light theme tokens
4. Visual: Dashboard/Overview pages -- consistent heading hierarchy
5. Visual: Settings page -- consistent section spacing

## Lessons Learned / Gotchas

(To be filled after implementation)
