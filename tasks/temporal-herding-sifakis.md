# Level Progress Widget Redesign

## Context

The current Level Progress section on the Kanji Dashboard is a simple progress bar showing kanji-only guru counts with three navigation buttons. The user wants it redesigned to match WaniKani's Level Progress widget: a level selector to browse levels without leaving the dashboard, per-type progress cards (radicals/kanji/vocab with guru counts and "See All"), and SRS-aware level-up status messaging with a kanji block progress bar.

## Implementation

### Step 1: Add SRS stage dots helper to `kanji.ts` utils

**File:** [kanji.ts](src/lib/utils/kanji.ts)

Add a helper function that returns dot colors for stages 1-4 (Apprentice progress toward Guru):

```typescript
export function getStageDots(srsStage: number): { filled: number; total: number } {
  if (srsStage === 0) return { filled: 0, total: 4 };  // locked
  if (srsStage <= 4) return { filled: srsStage - 1, total: 4 }; // apprentice: 0-3 dots filled
  return { filled: 4, total: 4 }; // guru+ = all 4 filled
}
```

Dots render as small dashes under each tile: green = stage passed, gray = not yet. This matches WaniKani's visual indicator.

### Step 2: Add `getLevelProgressByType` query

**File:** [kanji.ts](src/lib/db/queries/kanji.ts)

Add new interface and function:

```typescript
export interface LevelProgressByType {
  level: number;
  radicals: { total: number; guru_plus: number; unlocked: number };
  kanji: { total: number; guru_plus: number; unlocked: number };
  vocab: { total: number; guru_plus: number; unlocked: number };
}

export async function getLevelProgressByType(level: number): Promise<QueryResult<LevelProgressByType>>
```

Query groups by `item_type`, counts total, guru_plus (srs_stage >= 5), and unlocked (srs_stage > 0). Single lightweight query returning 3 rows max.

### Step 3: Create `LevelProgressWidget.svelte`

**File:** [LevelProgressWidget.svelte](src/lib/components/kanji/LevelProgressWidget.svelte) (new, ~170 lines)

**Props:** `userLevel: number` (the user's actual current level, used as initial selection)

**Local state:** `selectedLevel`, `progressByType`, `kanjiItems` (for block viz), `loading`

**Layout:**

1. **Header row:** "Level Progress" on left. Right side has `< Level X >` with chevron arrows to cycle levels. Clicking "Level X" text navigates to `kanji-levels` view (full grid for direct selection). Left arrow hidden at level 1, right at level 60.

2. **Three type cards** in a `grid-cols-3`: Each shows colored icon, type name, guru/total count, "See All >" text. Clicking navigates to `kanji-level` view for the selected level.
   - Radicals: blue icon
   - Kanji: pink icon
   - Vocabulary: purple icon

3. **Level-up status message:**
   - Level locked (no items unlocked): "You haven't unlocked this level yet. Do your Kanji Lessons and Reviews to level up!"
   - Level in progress: "Guru X more kanji to level up." + block progress bar (each small square = 1 kanji, colored by SRS stage)
   - Level complete: "Level complete!" in green

**Block color mapping:**
- Locked (stage 0): `bg-muted`
- Apprentice (1-4): `bg-pink-400`
- Guru (5-6): `bg-green-500`
- Master (7): `bg-blue-400`
- Enlightened (8): `bg-yellow-400`
- Burned (9): `bg-zinc-600`

**Data fetching:** `$effect` watches `selectedLevel`, calls `getLevelProgressByType()` and `getItemsByLevel()` (uses `.kanji` for block viz). Includes stale-request guard for rapid clicking.

### Step 4: Update `KanjiLevel.svelte` -- add SRS dots + type filter mode

**File:** [KanjiLevel.svelte](src/views/KanjiLevel.svelte)

Two changes:

**A. SRS stage dots under each tile.** After the character/meaning display in each tile button, render 4 small dashes using `getStageDots(item.srs_stage)`. Green for filled, gray for unfilled. Burned items get a distinct style (all solid). Locked items show no dots (or gray dashes).

**B. Optional `type` param for "See All" filtering.** When navigated with `type=radical|kanji|vocab`, show only that type's section. Header changes from "Level X" to "< Back" + "X/Y items Guru'd". This is the view that "See All >" from the Level Progress widget navigates to.

The `navigate("kanji-level", { level: "1", type: "radical" })` call from the widget cards triggers this filtered mode. Without the `type` param, the view behaves exactly as it does today.

### Step 5: Update `KanjiDashboard.svelte`

**File:** [KanjiDashboard.svelte](src/views/KanjiDashboard.svelte)

- Remove import of `LevelProgressBar` (line 3)
- Remove `levelProgress` state (line 36) and `LevelProgress` type import (line 19)
- Remove `getLevelProgress` import (line 11) and its call (lines 84-85)
- Import `LevelProgressWidget`
- Replace lines 264-287 (entire Level Progress card) with: `<LevelProgressWidget userLevel={userLevel} />`

The widget is self-contained -- handles its own fetching, level browsing, and navigation.

### Step 6: Delete `LevelProgress.svelte`

**File:** [LevelProgress.svelte](src/lib/components/kanji/LevelProgress.svelte) -- delete

Only consumer is KanjiDashboard.svelte. The `LevelProgress` type and `getLevelProgress` function in kanji.ts remain (used by KanjiLevel.svelte).

## Files Changed

| File | Action |
|------|--------|
| `src/lib/utils/kanji.ts` | Add `getStageDots()` helper |
| `src/lib/db/queries/kanji.ts` | Add `LevelProgressByType` interface + `getLevelProgressByType()` |
| `src/lib/components/kanji/LevelProgressWidget.svelte` | New file (~170 lines) |
| `src/views/KanjiLevel.svelte` | Add SRS dots to tiles + optional `type` filter mode |
| `src/views/KanjiDashboard.svelte` | Replace Level Progress section, clean imports |
| `src/lib/components/kanji/LevelProgress.svelte` | Delete |

## Reused Existing Code

- `getItemsByLevel(level)` from [kanji.ts](src/lib/db/queries/kanji.ts) -- for kanji block visualization
- `navigate("kanji-levels")` and `navigate("kanji-level", { level })` -- existing navigation
- `ChevronLeft`/`ChevronRight` from `@lucide/svelte` -- icon library already in use
- `getTileClasses()` from [kanji.ts](src/lib/utils/kanji.ts) -- reference for SRS color patterns

## Verification

1. Run `npm run dev` and navigate to Kanji Dashboard
2. Verify "Level Progress" heading with "Level 1 >" selector on the right
3. Click right chevron -- should show Level 2 data, left chevron appears
4. Click "Level X" text -- should navigate to full Levels grid view
5. Verify three type cards show correct guru/total counts per level
6. Click "See All" on a type card -- should navigate to level detail filtered to that type
7. Verify filtered view shows "X/Y items Guru'd" header with back button
8. Verify SRS stage dots appear under each item tile (green = passed, gray = pending)
9. Verify locked level shows "haven't unlocked" message
10. Verify current level shows "Guru X more kanji" with colored block bar
11. Test dark mode renders correctly

## Lessons Learned / Gotchas

(To be filled after implementation.)
