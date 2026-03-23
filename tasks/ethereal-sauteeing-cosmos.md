# Fix All Memory Leaks & Resource Cleanup Issues

## Context

A full memory/resource audit identified 14 issues across the Janki frontend. The backend (Rust/Tauri) is clean. Issues fall into 4 categories: uncleared timers, orphaned resources (Audio elements, fetches), stale async race conditions, and DB query inefficiencies. These affect the core study loop (review/lesson sessions) and navigation, causing stale state mutations, wrong content displayed, and unnecessary memory retention.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/components/kanji/detail/AudioPlayer.svelte` | Store Audio ref, cleanup on destroy; fix `$derived` wrapping |
| `src/lib/components/kanji/KanjiLessonSession.svelte` | Clear 3 timeouts on unmount; add stale guard on async effect |
| `src/lib/components/kanji/KanjiReviewSession.svelte` | Clear 2 timeouts on unmount; make Maps non-reactive |
| `src/lib/components/language/LanguageReviewSession.svelte` | Clear 1 timeout on unmount |
| `src/lib/components/language/LanguageLessonSession.svelte` | Clear 2 timeouts on unmount |
| `src/lib/components/kanji/StrokeOrder.svelte` | Add AbortController to fetch effect |
| `src/lib/stores/toast.svelte.ts` | Track timer IDs, cancel on dismiss |
| `src/lib/db/queries/kanji.ts` | Add LIMIT to `getAllAvailableLessons()`; push vocab unlock logic to SQL |
| `src/lib/db/query-cache.ts` | Add max-size cap |
| `src/views/KanjiDetail.svelte` | Add fetchId race guard |
| `src/views/LanguageItemDetail.svelte` | Add fetchId race guard |
| `src/views/Dashboard.svelte` | Add fetchId race guard |
| `src/views/KanjiDashboard.svelte` | Add fetchId race guard |

## Implementation Steps

### Step 1: AudioPlayer -- store ref and fix $derived

**File:** `src/lib/components/kanji/detail/AudioPlayer.svelte`

1. Add `let activeAudio: HTMLAudioElement | null = null;` at component level
2. In `play()`, pause/nullify previous audio before creating new one
3. Add `$effect` cleanup that pauses and releases audio on component destroy:
   ```ts
   $effect(() => {
     return () => {
       if (activeAudio) { activeAudio.pause(); activeAudio.src = ""; activeAudio = null; }
     };
   });
   ```
4. Fix `$derived` -- change `$derived(() => { ... })` to `$derived.by(() => { ... })` so the value is cached properly, then use `voiceActors` without call parens in the template

### Step 2: Timer cleanup in all 4 session components

**Pattern for each:** Declare timer handle variables, store every `setTimeout` return, add a cleanup `$effect` that clears all timers on unmount.

**KanjiLessonSession.svelte** (lines 78, 206, 217):
```ts
let timers: ReturnType<typeof setTimeout>[] = [];
function safeTimeout(fn: () => void, ms: number) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}
// Replace all setTimeout(...) calls with safeTimeout(...)
// Add cleanup effect:
$effect(() => () => timers.forEach(clearTimeout));
```

Same pattern for:
- **KanjiReviewSession.svelte** (lines 157, 175)
- **LanguageReviewSession.svelte** (line 174)
- **LanguageLessonSession.svelte** (lines 46, 181)

### Step 3: StrokeOrder -- AbortController on fetch

**File:** `src/lib/components/kanji/StrokeOrder.svelte`

Replace the `$effect` at line 16:
```ts
$effect(() => {
  loading = true;
  error = false;
  const controller = new AbortController();
  const codepoint = getCodepoint(character);
  fetch(`/data/kanjivg/${codepoint}.svg`, { signal: controller.signal })
    .then((r) => { if (!r.ok) throw new Error("Not found"); return r.text(); })
    .then((text) => { svgContent = text; loading = false; })
    .catch((e) => { if (e.name !== "AbortError") { error = true; loading = false; } });
  return () => controller.abort();
});
```

### Step 4: KanjiLessonSession -- stale guard on async effect

**File:** `src/lib/components/kanji/KanjiLessonSession.svelte` (line 36)

Add a `cancelled` flag pattern:
```ts
$effect(() => {
  let cancelled = false;
  getItemsContainingComponent(item.wk_id, "kanji").then(result => {
    if (!cancelled && result.ok) foundInKanji = result.data;
  });
  return () => { cancelled = true; };
});
```

### Step 5: Toast -- track and cancel timers

**File:** `src/lib/stores/toast.svelte.ts`

1. Add `timerId` to Toast interface (internal, not exported -- use a separate Map):
   ```ts
   const timerMap = new Map<number, ReturnType<typeof setTimeout>>();
   ```
2. In `addToast`, store: `timerMap.set(id, setTimeout(...))`
3. In `dismissToast`, cancel: `const t = timerMap.get(id); if (t) clearTimeout(t); timerMap.delete(id);`
4. Handle eviction in `addToast`: when slicing to MAX_TOASTS, cancel timers for evicted toasts

### Step 6: fetchId race guards in views

**Pattern from LevelProgressWidget.svelte (the existing correct implementation):**
```ts
let fetchId = 0;
async function loadItem(id: number) {
  const myId = ++fetchId;
  // ... await ...
  if (myId !== fetchId) return;
  // ... assign state ...
}
```

Apply to:
- **KanjiDetail.svelte** -- `loadItem()` at line 32
- **LanguageItemDetail.svelte** -- `loadItem()` at line 67
- **Dashboard.svelte** -- `loadDashboard()` at line 49
- **KanjiDashboard.svelte** -- `loadDashboard()`

### Step 7: KanjiReviewSession -- non-reactive Maps

**File:** `src/lib/components/kanji/KanjiReviewSession.svelte` (lines 74-75)

Change from `$state<Map>` to plain `let`:
```ts
let itemResults = new Map<number, ItemResult>();
let savedItems = new Map<number, { allCorrect: boolean; unlockedCount: number }>();
```

Verify these Maps are not read in the template (they are only used in `saveItemIfComplete` and `processResults` -- both async functions). If any template reads them, keep `$state`.

### Step 8: DB query optimizations

**File:** `src/lib/db/queries/kanji.ts`

1. **`getAllAvailableLessons()` (line 613):** Add `LIMIT 200` to the query. Add optional `limit` param defaulting to 200.

2. **`checkAndUnlockLevel()` (line 275):** Replace the JS-side Set approach with a SQL subquery:
   ```sql
   SELECT id FROM kanji_levels
   WHERE item_type = 'vocab' AND srs_stage = 0 AND component_ids IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM json_each(component_ids) je
     WHERE NOT EXISTS (
       SELECT 1 FROM kanji_levels kl
       WHERE kl.wk_id = CAST(je.value AS INTEGER) AND kl.srs_stage >= 5
     )
   )
   ```
   This eliminates the full-table scan into JS memory on every review.

### Step 9: query-cache max-size cap

**File:** `src/lib/db/query-cache.ts`

Add a `MAX_ENTRIES = 20` constant. In `setCache`, if `cache.size >= MAX_ENTRIES`, delete the oldest entry (earliest `expires` value) before inserting.

## Execution Order

Steps 1-6 are independent and can be done in parallel. Step 7 requires verifying template usage first. Step 8 requires testing the SQL subquery. Step 9 is trivial.

## Verification

1. **Type check:** `npx svelte-check` -- zero errors
2. **Tests:** `npx vitest run` -- all pass
3. **Manual smoke test:** Open the app, navigate rapidly between kanji items (arrow keys), start and cancel a review session mid-way, play audio and navigate away, check that no stale data appears and audio stops
4. **Memory check:** Open DevTools, take heap snapshot, do 20 review items, take another snapshot, compare -- no growing object counts for Audio, Map, or timer closures

## Lessons Learned / Gotchas

- (To be filled after implementation)
