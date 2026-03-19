# Phase 4 Plan Update: WaniKani-Style Separate Item Type Pages

## Context

User reviewed Phase 3 output and the WaniKani screenshots showing separate top-level pages for Radicals, Kanji, and Vocabulary. Current plan (Phase 4.3) has a single `KanjiLevelDetail.svelte` with filter tabs. User directive: **"I want to have the Kanji section mimic WaniKani almost 100%"** -- meaning separate sidebar entries, not tabs on one page.

WaniKani reference crawl at `C:\Github\tech-assistant\site-crawl\wanikani\pages\` confirms the exact layout:
- `03-radicals.md` -- Radicals page structure
- `04-kanji.md` -- Kanji page structure
- `05-vocabulary.md` -- Vocabulary page structure

## What Changes in Phase 4

### 4.3 Replaces: "Level Detail view" -> "Separate Radicals / Kanji / Vocabulary pages"

**Remove:** Single `KanjiLevelDetail.svelte` with filter tabs.

**Add:** Three new views matching WaniKani's top-level navigation.

#### New views
- `src/views/KanjiRadicals.svelte` -- All radicals, grouped by level (1-60)
- `src/views/KanjiKanji.svelte` -- All kanji, grouped by level (1-60)
- `src/views/KanjiVocabulary.svelte` -- All vocabulary, grouped by level (1-60)

#### Shared layout (from WaniKani crawl -- all 3 pages use identical structure)

**Header area:**
- Title: "Radicals LEVELS 1-10" / "Kanji LEVELS 1-10" / "Vocabulary LEVELS 1-10"
- Tier pagination via header (Levels 1-10, 11-20, 21-30, 31-40, 41-50, 51-60)

**Legend (top-right):**
- Locked (dashed border, type color) -- `srs_stage = 0`
- In Lessons (solid color, lighter) -- `srs_stage >= 1 AND lesson_completed_at IS NULL`
- In Reviews (solid color, full) -- `lesson_completed_at IS NOT NULL AND srs_stage 1-8`
- Burned (dark/muted) -- `srs_stage = 9`

**Level sub-tabs:**
- Individual level numbers within current tier: `1 | 2 | 3 | ... | 10`
- Clicking a level scrolls to / filters that level section

**Per-level section:**
- "Level N" header with "(X/Y unlocked)" count
- Progress bar (green for complete, type color for partial)
- Grid of item tiles

**Tile content (differs by type):**
- **Radicals**: character + English name (no reading) -- blue/cyan tiles
- **Kanji**: character + primary reading (hiragana) + primary meaning -- pink/magenta tiles
- **Vocabulary**: word + primary reading (hiragana) + primary meaning -- purple tiles

**Tile status styling:**
- Dashed border = locked (no fill, just outline)
- Solid fill = in lessons / in reviews (type color: blue/pink/purple)
- Dark/muted fill = burned
- Click tile -> navigates to KanjiDetail

#### Shared component opportunity
Since all three pages use identical structure (only differing by item_type filter and color), extract a shared component:
- `src/lib/components/kanji/ItemTypeBrowser.svelte` -- accepts `itemType: "radical" | "kanji" | "vocab"`, renders the full page
- Each view file is just a thin wrapper passing the item type

#### Navigation changes
- **View type union** -- add: `"kanji-radicals"`, `"kanji-kanji"`, `"kanji-vocabulary"`
- **Sidebar Kanji section** becomes: Overview, Radicals, Kanji, Vocabulary, Lessons, Reviews (Kanji Map removed)
- **SECTION_ROOTS** -- all three new views root back to `"kanji-dashboard"`
- **App.svelte** -- add routing cases for the three new views

#### KanjiMap removal
- Remove "Kanji Map" from sidebar -- the three type-specific pages replace it
- Remove `KanjiMap.svelte` import from App.svelte routing
- Remove `"kanji-map"` view type (keep `"kanji-detail"` for item detail navigation)
- Update any `navigate("kanji-map")` call sites to `navigate("kanji-radicals")` or `navigate("kanji-dashboard")` as appropriate
- Delete `src/views/KanjiMap.svelte`

#### New query
- `getItemsByTypeAndTier(itemType, startLevel, endLevel)` in `src/lib/db/queries/kanji.ts`
  - Returns items filtered by type and level range, with unlock/lesson/review status
  - Grouped by level for rendering sections

### Other Phase 4 items remain unchanged
- 4.1 Extra Study modes
- 4.2 Lesson Picker
- 4.4 WaniKani-style kanji settings
- 4.5 Kanji stats
- 4.6 Keyboard shortcuts
- 4.7 Toast feedback + level-up celebration
- 4.8 Accessibility

## Critical Files

| File | Change |
|------|--------|
| `src/lib/stores/navigation.svelte.ts` | Add 3 new view types, remove `kanji-map` |
| `src/lib/components/layout/Sidebar.svelte` | Replace Kanji Map with Radicals, Kanji, Vocabulary |
| `src/App.svelte` | Add routing for 3 new views, remove KanjiMap route |
| `src/lib/components/kanji/ItemTypeBrowser.svelte` | NEW: shared browsing component |
| `src/views/KanjiRadicals.svelte` | NEW: thin wrapper for ItemTypeBrowser |
| `src/views/KanjiKanji.svelte` | NEW: thin wrapper for ItemTypeBrowser |
| `src/views/KanjiVocabulary.svelte` | NEW: thin wrapper for ItemTypeBrowser |
| `src/views/KanjiMap.svelte` | DELETE |
| `src/lib/db/queries/kanji.ts` | Add `getItemsByTypeAndTier()` query |
| ~5 files with `navigate("kanji-map")` | Update to new targets |

## Reuse Existing

- `SrsStageIndicator` from `src/lib/components/kanji/SrsStageIndicator.svelte`
- `LevelProgress` from `src/lib/components/kanji/LevelProgress.svelte`
- `getStageColor()`, `STAGE_NAMES`, `STAGE_CATEGORIES` from `src/lib/srs/wanikani-srs.ts`
- Tile color scheme: blue = radical, pink = kanji, purple = vocab (established in KanjiReviewSession + KanjiDashboard)
- `navigate()` + `navigateBack()` from `src/lib/stores/navigation.svelte.ts`

## WaniKani Reference

Source crawl files used for this plan:
- `C:\Github\tech-assistant\site-crawl\wanikani\pages\03-radicals.md`
- `C:\Github\tech-assistant\site-crawl\wanikani\pages\04-kanji.md`
- `C:\Github\tech-assistant\site-crawl\wanikani\pages\05-vocabulary.md`
- Screenshots provided by user showing radicals (levels 1-10) and kanji (levels 1-10) grid layouts

## Verification

1. `pnpm test` -- all tests pass
2. `pnpm lint` -- no errors
3. `pnpm build` -- Vite build succeeds
4. Smoke test: each new sidebar item renders its page, tier pagination works, level sections show correct items, tile status matches SRS state, tile click navigates to KanjiDetail
