# Janki UX Polish -- Page Improvements Plan

## Context

Every page in Janki works but lacks production-quality UX: no loading skeletons, no empty states for new users, silent error swallowing, and no user feedback on actions (backup, import, delete). The weakest pages are Reading, Grammar, Stats, Search, Review, and Decks. There is no toast/notification system at all. This plan makes every page feel solid and production-ready.

---

## Phase 1: Cross-Cutting Infrastructure

Must be done first. All subsequent phases depend on these components.

### 1.1 -- Toast Notification System

**New file:** `src/lib/stores/toast.svelte.ts` (~40 lines)
- Svelte 5 runes store with `$state` array of toasts
- `addToast(message, type, duration?)` -- types: success, error, info, warning
- `dismissToast(id)` -- manual dismiss
- Auto-dismiss: 3s success, 5s error. Max 5 visible, FIFO eviction
- Counter-based IDs, no uuid dependency

**New file:** `src/lib/components/layout/ToastContainer.svelte` (~60 lines)
- Fixed position bottom-right, renders toast stack
- Lucide icons: CheckCircle, XCircle, Info, AlertTriangle (already in deps)
- Svelte transitions for slide-in/fade-out
- `role="status"` + `aria-live="polite"` for accessibility
- Dismiss X button on each toast
- Dark mode variants

**Mount:** Add `<ToastContainer />` to `src/App.svelte` after the main layout div.

### 1.2 -- Loading & Empty State Components

**New file:** `src/lib/components/ui/loading-state.svelte` (~20 lines)
- Props: `message?: string`
- Tailwind `animate-pulse` skeleton pattern
- Centered spinner + optional message text

**New file:** `src/lib/components/ui/empty-state.svelte` (~35 lines)
- Props: `title: string`, `description?: string`, `actionLabel?: string`, `onaction?: () => void`
- Centered card with text and optional CTA button
- Reusable across Dashboard, Decks, Review, Stats, Search

### 1.3 -- View Data Loading Pattern

Establish in every view:
```
let loading = $state(true);
let error = $state<string | null>(null);
// in load:
loading = true; error = null;
const result = await someQuery();
if (!result.ok) { error = result.error; addToast(result.error, 'error'); }
loading = false;
```

### 1.4 -- Accessibility Baseline in App.svelte

- Escape key dismisses topmost toast
- On view change, auto-focus first `h2` heading in main content
- Verify all icon-only buttons have `aria-label`

**Phase 1 totals:** 4 new files (~155 lines), ~10 lines added to App.svelte.

---

## Phase 2: Reading, Grammar, Search

These are the weakest pages. Independent of Phases 3/4.

### 2.1 -- Reading.svelte

| Improvement | Detail |
|---|---|
| Keyboard shortcuts | Left/Right = prev/next, T = toggle translation, F = toggle furigana, S = speak |
| Shuffle mode | Toggle button to randomize sentence order |
| Better progress | Progress bar component instead of "3/10" text |
| Empty state | When no sentences for level, show EmptyState component |
| TTS error toast | Toast "TTS not available" instead of silent fail |
| Accessibility | `aria-live="polite"` on sentence region |

No new components. +20 lines.

### 2.2 -- Grammar.svelte

| Improvement | Detail |
|---|---|
| TTS on examples | Small speaker icon button on each example sentence |
| Keyboard nav | Up/Down arrows between grammar points, Enter to expand/collapse |
| Empty search state | EmptyState when search yields zero results |
| Count badge | Show grammar point count on level selector buttons |
| Accessibility | `aria-expanded` on expand/collapse buttons |

No new components. +25 lines.

### 2.3 -- Search.svelte (largest feature add)

| Improvement | Detail |
|---|---|
| Multi-scope tabs | shadcn Tabs: "Kanji" / "Cards" / "Grammar" |
| Card search | New `searchCards(query, limit)` query in cards.ts via LIKE on fields |
| Grammar search | Filter imported N5 data in-memory |
| Result highlighting | New `highlightMatch()` utility in `src/lib/utils/search.ts` |
| Empty states | Per-tab empty state when no results, "Start typing" when query empty |
| Autofocus | Search input focused on page load |

**New file:** `src/lib/utils/search.ts` (~15 lines) -- `highlightMatch(text, query): string`
**Query addition:** `searchCards()` in `src/lib/db/queries/cards.ts` (~20 lines)

Search.svelte grows to ~180 lines.

---

## Phase 3: Review, Decks, Stats

Independent of Phase 2. Depends on Phase 1.

### 3.1 -- Review.svelte

| Improvement | Detail |
|---|---|
| Loading state | Show LoadingState while decks fetch |
| Empty state | No decks? EmptyState with "Create Deck" / "Import Deck" CTAs |
| "All caught up" | When no cards due, friendly message + checkmark instead of error text |
| Time estimate | Show estimated review time: `(due + new) * avgTimePerCard` |
| Toast | On queue load failure |

**Query addition:** `getAverageTimePerCard(days)` in stats.ts (~15 lines)

+30 lines. Total ~110.

### 3.2 -- ReviewSession.svelte

| Improvement | Detail |
|---|---|
| Progress bar | Completion percentage bar at top of session |
| Pause/resume | Escape to pause (overlay), any key to resume, stops timer |
| Toast on undo | "Review undone" toast feedback |
| Extract undo | Move undo stack logic to `src/lib/srs/undo.ts` to stay under line limit |

**New file:** `src/lib/srs/undo.ts` (~60 lines) -- UndoEntry interface, snapshot/restore logic

### 3.3 -- Decks.svelte

| Improvement | Detail |
|---|---|
| Loading state | LoadingState while decks load |
| Better empty state | EmptyState with deck icon, "Create Deck" + "Import Deck" CTAs |
| Toast feedback | On create/delete/import success/failure |

+15 lines.

### 3.4 -- DeckBrowse.svelte

| Improvement | Detail |
|---|---|
| State filter tabs | shadcn Tabs: All / New / Learning / Review / Relearning |
| Search within deck | Text input filtering cards by content |
| Clickable rows | Click card row to open CardEditor in a dialog |
| Pagination | "Load more" button when at 200-card limit |
| Toast | On card edit save |

**Query change:** Add optional `stateFilter` param to `getCardsByDeck()` (~5 lines).

DeckBrowse grows to ~180 lines.

### 3.5 -- Stats.svelte

| Improvement | Detail |
|---|---|
| Loading state | LoadingState while stats fetch |
| Move raw SQL out | Extract inline SQL to proper query functions in stats.ts |
| Date range selector | Button group: 7d / 30d / 90d / All |
| Per-deck filter | Dropdown to filter stats by deck |
| Empty chart state | EmptyState in chart area when no review data exists |

**Query additions to stats.ts:** (~50 lines total)
- `getCardStateDistribution()` -- moved from Stats.svelte inline SQL
- `getKanjiStageDistribution()` -- moved from Stats.svelte inline SQL
- `getStatsByDeck(deckId, days)` -- per-deck stats

Stats.svelte stays ~160 lines (SQL moves out, date range adds lines, net neutral).

---

## Phase 4: Dashboard, KanjiMap, KanjiDetail, Settings

Independent of Phases 2/3. Depends on Phase 1.

### 4.1 -- Dashboard.svelte

| Improvement | Detail |
|---|---|
| Loading skeleton | Pulsing placeholder cards while data loads |
| Error + retry | Error message with retry button on query failure |
| Welcome state | When totalCards === 0, welcome message + "Import your first deck" CTA |
| Refresh button | Circular arrow icon to manually reload stats |
| Accessibility | `aria-label` on stat cards |

+25 lines. Total ~138.

### 4.2 -- KanjiMap.svelte

| Improvement | Detail |
|---|---|
| Batch loading | New `getAllLevelProgress()` query -- single SQL instead of 60 sequential calls |
| Summary stats | Top bar: total kanji learned, % complete, next unlock level |
| Skeleton loading | Grid of pulsing placeholder tiles |

**Query addition:** `getAllLevelProgress()` in kanji.ts (~20 lines)

+15 lines. Total ~142.

### 4.3 -- KanjiDetail.svelte

| Improvement | Detail |
|---|---|
| Prev/Next nav | Navigate to adjacent kanji within the same level |
| Not-found state | Proper EmptyState when item doesn't exist |

**Query addition:** `getAdjacentKanji(level, currentId)` in kanji.ts (~20 lines)

+20 lines. Total ~165.

### 4.4 -- Settings.svelte

| Improvement | Detail |
|---|---|
| Toast feedback | Toast on every setting save, backup success/failure |
| Dynamic version | Use `getVersion()` from `@tauri-apps/api/app` instead of hardcoded |
| Reset defaults | Button with confirmation dialog to restore all settings |
| Remove inline status | Replace backup status text with toast messages |

Net -10 lines (remove inline status). Total ~190.

---

## File Change Summary

### New Files (6)

| File | Lines | Purpose |
|---|---|---|
| `src/lib/stores/toast.svelte.ts` | ~40 | Toast state management |
| `src/lib/components/layout/ToastContainer.svelte` | ~60 | Toast rendering UI |
| `src/lib/components/ui/loading-state.svelte` | ~20 | Reusable loading skeleton |
| `src/lib/components/ui/empty-state.svelte` | ~35 | Reusable empty state |
| `src/lib/utils/search.ts` | ~15 | Search result highlighting |
| `src/lib/srs/undo.ts` | ~60 | Extracted undo logic from ReviewSession |

### Modified Files (15)

| File | Changes |
|---|---|
| `src/App.svelte` | ToastContainer mount, focus management, Escape handler |
| `src/views/Dashboard.svelte` | Loading, error, welcome empty state, refresh |
| `src/views/Review.svelte` | Loading, empty state, time estimate, "all caught up", toast |
| `src/lib/components/review/ReviewSession.svelte` | Progress bar, pause/resume, toast, extract undo |
| `src/views/Decks.svelte` | Loading, improved empty state, toast |
| `src/views/DeckBrowse.svelte` | State filter tabs, search, clickable rows, pagination, toast |
| `src/views/Grammar.svelte` | TTS on examples, keyboard nav, aria-expanded, empty search |
| `src/views/Reading.svelte` | Keyboard shortcuts, shuffle, aria-live, TTS error toast |
| `src/views/Stats.svelte` | Loading, move SQL to queries, date range, per-deck, empty charts |
| `src/views/Search.svelte` | Multi-scope tabs, card/grammar search, highlighting, empty states |
| `src/views/KanjiMap.svelte` | Batch level load, summary stats, skeleton |
| `src/views/KanjiDetail.svelte` | Prev/next kanji nav, not-found state |
| `src/views/Settings.svelte` | Toast feedback, dynamic version, reset defaults |
| `src/lib/db/queries/stats.ts` | 4 new functions: distributions, per-deck, avg time |
| `src/lib/db/queries/cards.ts` | searchCards(), stateFilter param on getCardsByDeck |
| `src/lib/db/queries/kanji.ts` | getAllLevelProgress(), getAdjacentKanji() |

### No New Dependencies

Everything uses existing packages: @lucide/svelte, @tauri-apps/api, shadcn tabs, Svelte transitions.

---

## Session Handoff Prompts

Use these prompts to continue in a fresh session after each phase.

### After Phase 1 (start Phase 2):

```
Continue Janki UX polish from tasks/vast-brewing-lamport.md -- Phase 2 (Reading, Grammar, Search).

Phase 1 is complete: toast notification system (src/lib/stores/toast.svelte.ts, src/lib/components/layout/ToastContainer.svelte), loading-state and empty-state reusable components (src/lib/components/ui/), App.svelte updated with ToastContainer mount, Escape-to-dismiss, and view-change focus management. 56 tests passing, lint clean, build succeeds.

Phase 2 improves the three weakest pages:
- 2.1 Reading.svelte: keyboard shortcuts (arrows/T/F/S), shuffle mode, progress bar, empty state, TTS error toast, aria-live
- 2.2 Grammar.svelte: TTS on example sentences, keyboard nav (Up/Down/Enter), empty search state, count badge on level buttons, aria-expanded
- 2.3 Search.svelte: multi-scope tabs (Kanji/Cards/Grammar), new searchCards() query in cards.ts, grammar in-memory search, highlightMatch() utility in src/lib/utils/search.ts, per-tab empty states, autofocus

Use addToast() from $lib/stores/toast.svelte for action feedback. Use LoadingState and EmptyState from $lib/components/ui/ for loading/empty patterns. Dev server runs on port 7755.
```

### After Phase 2 (start Phase 3):

```
Continue Janki UX polish from tasks/vast-brewing-lamport.md -- Phase 3 (Review, Decks, DeckBrowse, Stats).

Phases 1-2 are complete: toast system, loading/empty state components, Reading page (keyboard shortcuts, shuffle, progress bar, aria-live), Grammar page (TTS on examples, keyboard nav, aria-expanded), Search page (multi-scope tabs for Kanji/Cards/Grammar, highlighting, new searchCards query). Tests passing, lint clean, build succeeds.

Phase 3 improves Review, Decks, and Stats:
- 3.1 Review.svelte: loading state, empty state with CTAs, "all caught up" message, review time estimate (new getAverageTimePerCard query in stats.ts), toast on failure
- 3.2 ReviewSession.svelte: progress bar, pause/resume (Escape), toast on undo, extract undo logic to src/lib/srs/undo.ts
- 3.3 Decks.svelte: loading state, improved empty state with CTAs, toast on create/delete/import
- 3.4 DeckBrowse.svelte: state filter tabs (All/New/Learning/Review/Relearning), search within deck, clickable rows opening CardEditor dialog, pagination, toast on save. Add stateFilter param to getCardsByDeck()
- 3.5 Stats.svelte: loading state, extract inline SQL to stats.ts (getCardStateDistribution, getKanjiStageDistribution), date range selector (7d/30d/90d/All), per-deck filter (new getStatsByDeck query), empty chart states

Use addToast(), LoadingState, EmptyState from the infrastructure built in Phase 1. Dev server port 7755.
```

### After Phase 3 (start Phase 4):

```
Continue Janki UX polish from tasks/vast-brewing-lamport.md -- Phase 4 (Dashboard, KanjiMap, KanjiDetail, Settings).

Phases 1-3 are complete: toast system, loading/empty components, Reading/Grammar/Search improvements, Review/Decks/DeckBrowse/Stats improvements. All pages from Phases 2-3 have loading states, empty states, toast feedback, and keyboard shortcuts. Tests passing, lint clean, build succeeds.

Phase 4 polishes the remaining pages:
- 4.1 Dashboard.svelte: loading skeleton, error+retry, welcome state for new users (totalCards===0 shows "Import your first deck" CTA), refresh button, aria-labels
- 4.2 KanjiMap.svelte: batch loading via new getAllLevelProgress() query in kanji.ts (replaces 60 sequential calls), summary stats bar, skeleton loading
- 4.3 KanjiDetail.svelte: prev/next kanji navigation via new getAdjacentKanji() query in kanji.ts, proper not-found EmptyState
- 4.4 Settings.svelte: toast on every setting save and backup, dynamic version via getVersion() from @tauri-apps/api/app, "Reset to defaults" button with confirmation dialog, remove inline backup status text

Use addToast(), LoadingState, EmptyState from Phase 1. Dev server port 7755.
```

---

## Verification

After each phase:
1. `pnpm test` -- all tests pass
2. `pnpm lint` -- no errors
3. `pnpm build` -- Vite build succeeds
4. `pnpm tauri dev` -- manual smoke test each modified page:
   - Toast appears on actions (save, delete, backup)
   - Loading state visible briefly on page entry
   - Empty state shows when no data (test with fresh DB)
   - Keyboard shortcuts work (test each page's shortcuts)
   - Dark mode renders correctly
   - Error state shows on simulated failure (disconnect DB)

---

## Risks

1. **Stats.svelte raw SQL extraction** -- inline SQL moves to query layer, data flow changes. Test distributions render correctly after move.
2. **ReviewSession at 260 lines** -- already over 200-line limit. Undo extraction is necessary to keep it manageable.
3. **KanjiMap batch query** -- single SQL replacing 60 sequential calls must match the `LevelProgress` interface exactly.
4. **Card search via LIKE on JSON fields** -- slow on large decks. Cap at 50 results with "refine your search" message.
