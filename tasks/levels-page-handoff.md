# Next Session: Levels Page + Sidebar Redesign

## Context

Janki v0.9.0.0 has full WK data (490 radicals, 2094 kanji, 6737 vocab) with correct SRS mechanics. The next task is to add a Levels page and restructure the sidebar to match WK's top nav bar.

## Requirements (from user screenshots of WK)

### 1. Sidebar restructure to match WK's top nav

The KANJI section in the sidebar should mirror WK's top navigation:

```
KANJI
  Lessons          (with count badge)
  Reviews          (with count badge)
  Levels           (NEW -- level picker)
  Radicals         (existing -- with tier flyout)
  Kanji            (existing -- with tier flyout)
  Vocabulary       (existing -- with tier flyout)
```

### 2. Levels page -- level picker dropdown

From the Levels sidebar item, show a dropdown/flyout with:
- 6 tier groups with Japanese names + English translations:
  - 快 Pleasant (Levels 01-10)
  - 苦 Painful (Levels 11-20)
  - 死 Death (Levels 21-30)
  - 地獄 Hell (Levels 31-40)
  - 天国 Paradise (Levels 41-50)
  - 現実 Reality (Levels 51-60)
- Each tier expands to show individual level buttons (01-10, etc.)
- Current level is highlighted/bordered

### 3. Radicals/Kanji/Vocabulary tier flyouts

Each of these sidebar items should also have a tier flyout (like WK) showing:
- Same 6 tier groups with colored backgrounds:
  - Radicals: blue background
  - Kanji: pink/magenta background
  - Vocabulary: purple background
- Clicking a tier navigates to that item type browser filtered to those levels

### 4. Individual Level page (new view)

When you click a level number, show a page with ALL item types for that level:
- Level header with number and progress bar
- **Radicals** section -- grid of all radicals at this level
- **Kanji** section -- grid of all kanji at this level
- **Vocabulary** section -- grid of all vocab at this level
- Each item shows character + first meaning, colored by status (locked/lesson/review/burned)
- Same color scheme as existing ItemTypeBrowser

### 5. Existing pages to keep

The separate Radicals, Kanji, Vocabulary browser pages remain -- the flyouts just navigate to them with a pre-selected tier.

## Current sidebar structure (for reference)

```
KANJI
  Overview         -> kanji-dashboard
  Radicals         -> kanji-radicals
  Kanji            -> kanji-kanji
  Vocabulary       -> kanji-vocabulary
  Lessons          -> kanji-lessons
  Reviews          -> kanji-review
```

## Files to modify

- `src/lib/components/layout/Sidebar.svelte` -- restructure nav items, add flyouts
- `src/lib/stores/navigation.svelte.ts` -- add `kanji-level` view type with level param
- `src/views/KanjiLevel.svelte` -- NEW: individual level page
- `src/App.svelte` -- add KanjiLevel route
- `src/lib/db/queries/kanji.ts` -- add `getItemsByLevel(level)` query returning all types

## Key data

- WK tier names: 快 Pleasant, 苦 Painful, 死 Death, 地獄 Hell, 天国 Paradise, 現実 Reality
- WK tier colors: Levels (gray), Radicals (blue), Kanji (pink), Vocabulary (purple)
