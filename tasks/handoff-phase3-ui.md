# Handoff: Phase 3 -- UI Rebuild (WK-Style Experience)

## Status
Phase 2 (SRS Engine + Unlock System + Lessons) is COMPLETE. Commit `9d60c04`.
Next: Phase 3 -- UI rebuild for WK-style lesson picker, review session polish, and overview displays.

## What Phase 2 Delivered
- Language SRS engine (`src/lib/srs/language-srs.ts`): WK stages, intervals, drop formula, daily stats
- Unlock system (`src/lib/srs/language-unlock.ts`): kana auto-unlock, vocab gates on kanji Guru+, grammar JLPT gating, sentence/conjugation prerequisite gating
- Lesson system (`src/lib/srs/language-lessons.ts`): batch fetching (5 items), completion with first-review scheduling
- Query layer additions in `src/lib/db/queries/language.ts`: 12+ new queries for lessons, unlocks, SRS summary, due counts
- `LanguageReviewSession.svelte`: working review session with type-aware prompts and answer validation
- `LanguageReview.svelte`: replaced stub with full start/review/summary flow
- Unlock runs on dashboard load and after kanji reviews

## Current State of the Codebase
- **Kana**: auto-unlocked on first `checkAndUnlockItems()` call (dashboard load)
- **Vocabulary**: unlocks when kanji reach Guru+ in kanji_levels; kana-only words unlock immediately
- **Grammar**: N5 unlocks first; N4+ gated behind >80% of previous JLPT level at Guru+
- **Sentences/Conjugation**: gate on prerequisite item_keys reaching target SRS stage
- **Review session**: functional but basic -- single input, no lesson picker UI yet
- **No lesson UI** exists yet -- `getNextLessonBatch()` and `completeLessonBatch()` are wired but no view calls them

## Key Files to Read First
- `src/lib/srs/language-lessons.ts` -- lesson batch API (getNextLessonBatch, completeLessonBatch)
- `src/lib/srs/language-srs.ts` -- SRS engine (reviewLanguageItem, calculateNextReview)
- `src/lib/srs/language-unlock.ts` -- unlock logic (checkAndUnlockItems)
- `src/lib/components/language/LanguageReviewSession.svelte` -- current review session component
- `src/views/LanguageReview.svelte` -- current review view
- `src/views/KanjiLessonPicker.svelte` -- THE pattern to follow for language lesson picker
- `src/views/KanjiLessons.svelte` -- THE pattern for lesson session flow
- `src/lib/components/kanji/KanjiReviewSession.svelte` -- reference for review session UX

## Phase 3 Tasks

### 3.1 Language Lesson Picker View
Create `src/views/LanguageLessonPicker.svelte`:
- Show available lesson count by content type
- Let user pick which type to study (or "all")
- Start button loads a batch of 5 items
- Follow the same pattern as `KanjiLessonPicker.svelte`

### 3.2 Language Lesson Session View
Create `src/views/LanguageLessons.svelte`:
- Present each item's full info card (primary_text, reading, meaning, example sentences, formation)
- After viewing all items, quiz the user on them
- On completion, call `completeLessonBatch()` to schedule first reviews
- Follow the same flow as `KanjiLessons.svelte`

### 3.3 Wire Lesson Views Into App
- Add `lang-lessons` and `lang-lesson-picker` to the View type in `navigation.svelte.ts`
- Add routes in `App.svelte`
- Add navigation from LanguageOverview and Dashboard to lesson picker
- Add SECTION_ROOTS entries

### 3.4 Polish LanguageReviewSession
- Add reading input with romaji-to-hiragana conversion for vocabulary (show reading, user types romaji)
- Improve answer validation: fuzzy matching for longer meanings, accept common abbreviations
- Add "item info" peek after answering (show reading, example sentence, formation)
- Show SRS stage change animation on answer (e.g., "Apprentice 2 -> Apprentice 3")

### 3.5 Language Overview Enhancements
Update `src/views/LanguageOverview.svelte`:
- Show lesson count alongside due count
- Add "Start Lessons" button when lessons are available
- Show SRS stage distribution per content type (use `getLanguageSrsSummary()`)
- Show recently unlocked items

### 3.6 Dashboard Language Section
Update `src/views/Dashboard.svelte`:
- Show language due count and lesson count
- Add quick-start buttons for language reviews and lessons
- Show language SRS distribution summary

## Navigation Routes to Add
| View | Route |
|------|-------|
| Lesson Picker | `lang-lesson-picker` |
| Lesson Session | `lang-lessons` |

## After This Session
- Phase 4: Polish (FTS5 search, stats page, performance tuning)

## Lessons Learned from Phase 2
- The `getContentTypeCounts` query needs to match the actual review filter (require `lesson_completed_at IS NOT NULL`, exclude burned) or counts will be misleading.
- `checkAndUnlockItems()` should run on dashboard load, not just after reviews -- this catches up on kanji progress made in previous sessions.
- The language review is single-dimension (just meaning), unlike kanji which has meaning+reading. Keep the review session component simpler.
