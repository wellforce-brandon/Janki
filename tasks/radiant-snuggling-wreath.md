# Language Section Deep Dive: Learning Paths, Level Redesign, and Progression Gating

## Context

The language section's level assignments are broken. Items are distributed arbitrarily across 60 levels -- "aunt" appears at level 41, kana variants lack structure, grammar has no group data, and 8,000+ sentences have no JLPT tags. There are no daily lesson caps, no proper unlock gating (all 372 kana unlock at once), and no daily limits despite settings existing for them. The user wants the language section to mirror the kanji section's gated WaniKani-style progression with a new feature: selectable learning paths.

## Current State

| Content Type | Total | N5 | N4 | N3 | N2 | N1 | Untagged | Has Freq Rank |
|---|---|---|---|---|---|---|---|---|
| Vocabulary | 23,477 | 2,462 | 3,054 | 3,525 | 3,872 | 6,339 | 4,225 | 20,146 |
| Grammar | 1,166 | 648 | 86 | 0 | 63 | 0 | 369 | 0 |
| Sentence | 8,104 | 61 | ? | ? | ? | ? | ~8,000 | ? |
| Kana | 372 | 142 | 0 | 0 | 0 | 0 | 230 | 0 |
| Conjugation | 95 | 95 | 0 | 0 | 0 | 0 | 0 | 0 |

**Key problems:**
- Grammar lesson_group field exists in schema but is never populated from JSON
- Sentences have almost no JLPT tags (61 of 8,104)
- ~3,300 vocab items have frequency_rank = 0 (no real rank)
- Unlock logic is broken: `checkAndUnlockLanguageLevel()` exists but isn't triggered automatically
- No daily lesson cap is enforced (settings are decorative)
- All level-1 kana unlock at once instead of a controlled batch

## Design: Learning Paths

### Path Selection

On first launch (or after reset), user picks one of 4 paths:

| Path | Target | Items | JLPT Scope | Levels |
|---|---|---|---|---|
| **JLPT N5** | Pass the N5 exam | ~800-1,200 | N5 only | 60 |
| **Conversational** | Everyday fluency | ~3,000-4,000 | N5-N3, frequency-biased | 60 |
| **JLPT N1** | Full JLPT mastery | ~8,000 core | N5-N1 | 100 + advanced |
| **Completionist** | Learn everything | All 33K | All | 100 core + advanced batches |

Each path defines:
- Which items are included
- How they map to 60 (or 100) levels
- The item mix per level (kana/vocab/grammar/conjugation/sentences)

### Per-Level Structure (mirroring kanji)

Each level has items assigned by type, unlocking in sequence:

```
Kana (if any) → unlock first
  ↓ 90% guru'd
Vocabulary → unlocks
  ↓ 90% guru'd
Grammar + Conjugation → unlocks
  ↓ 90% guru'd
Sentences → unlocks
  ↓ 90% of level guru'd overall
Next level's kana/vocab unlocks
```

Target: ~50-80 items per level, distributed roughly:
- Kana: 0-15 (only in early levels)
- Vocabulary: 20-40
- Grammar: 3-8
- Conjugation: 0-5
- Sentences: 5-15

### Per-Path Pacing

Different paths should teach the same content at different speeds depending on assumed commitment level:

| Path | Kana Pacing | Vocab Density | Grammar Intro |
|---|---|---|---|
| **N5** | Gentle: ~15 kana/level across 8 levels | Light: 20-30/level | Level 9 |
| **Conversational** | Moderate: ~25 kana/level across 5 levels | Medium: 30-40/level | Level 6 |
| **N1** | Aggressive: ~45 kana/level across 3 levels | Medium: 30-40/level | Level 4 |
| **Completionist** | Aggressive: ~45 kana/level across 3 levels | Heavy: 40-50/level | Level 4 |

The N5 learner is likely a complete beginner -- they need time with kana. The completionist already knows (or can quickly learn) kana and wants to get to real content fast. The unlock gating still applies within each level (guru kana before vocab unlocks), but the levels themselves contain more kana so you move through them faster.

### Level Assignment Algorithm

For each path, build levels using:
1. **Sort items by JLPT tier** (N5 first), then by **frequency_rank** within tier
2. **Group related items** (e.g., verb + its conjugations + example sentences)
3. **Fill levels to target size** (50-80), balancing content types
4. **Sentence assignment**: attach sentences to the level where their vocab prerequisites first appear

## Implementation Plan

### Phase 1: Data Quality Fixes (scripts/)

**1a. Tag sentences with JLPT levels**
- New script: `scripts/tag-sentence-jlpt.mjs`
- For each sentence, analyze its vocabulary content
- Assign JLPT level = highest JLPT of any word in the sentence
- Use jmdict-simplified (already downloaded) for lookups
- Output: updated `sentence.json` with jlpt_level filled

**1b. Fix grammar lesson_group data**
- Audit grammar items: which have groups, which don't
- Script to assign groups based on grammar point type/source
- Update `grammar.json` with lesson_group populated

**1c. Fill remaining frequency_rank gaps**
- Re-run frequency enrichment for the ~3,300 vocab items still at 0
- Consider assigning a high default rank (e.g., 50000) to unmatched items so they sort last

### Phase 2: Path Definition System

**2a. Create path definitions** -- `src/lib/data/learning-paths.ts`

```typescript
interface LearningPath {
  id: "n5" | "conversational" | "n1" | "completionist";
  label: string;
  description: string;
  jlptScope: string[];       // which JLPT levels to include
  maxCoreLevels: number;      // 60 or 100
  frequencyCutoff?: number;   // for conversational: only items above this rank
  includeUntagged: boolean;
}
```

**2b. Create level builder** -- `scripts/build-language-levels.mjs`

Build-time script that generates level assignments per path:
- Input: vocabulary.json, grammar.json, sentence.json, kana.json, conjugation.json
- Output: `public/data/language/paths/{path-id}.json` -- maps item_key → level for each path
- Algorithm:
  1. Filter items by path's JLPT scope
  2. Sort by frequency_rank within each content type
  3. Assign kana to levels 1-8 (same for all paths)
  4. Distribute vocab across remaining levels by frequency
  5. Attach grammar to levels based on prerequisite vocab
  6. Attach sentences to levels where their vocab first appears
  7. Attach conjugations alongside related verb vocab

### Phase 3: Path Selection UI

**3a. Path picker component** -- `src/lib/components/language/PathPicker.svelte`
- Full-screen overlay shown on first language launch (or after reset)
- 4 cards, each with path name, description, item count, level count
- Stores selection in `settings` table: `language_path = "n5" | "conversational" | "n1" | "completionist"`

**3b. Settings integration** -- `src/views/Settings.svelte`
- Show current path in Language section
- "Change Path" button (warns: resets all language progress)

### Phase 4: Gated Unlock System

**4a. Rewrite `src/lib/srs/language-unlock.ts`**

Replace current flat unlock with kanji-mirrored gating:

```
bootstrapLevel1():
  - Unlock level 1 kana ONLY (not all, just level 1's ~15 items)

checkAndUnlockWithinLevel(level):
  - If 90% kana guru'd → unlock vocab
  - If 90% vocab guru'd → unlock grammar + conjugation
  - If 90% grammar guru'd → unlock sentences

checkLevelProgression(level):
  - If 90% of level overall at guru+ → unlock next level's kana
  - (Like kanji: guru 90% kanji to unlock next level radicals)
```

**4b. Hook into review completion**

In `src/lib/srs/language-srs.ts` (or wherever reviews are submitted):
- After each review answer, call `checkAndUnlockWithinLevel(currentLevel)`
- After batch completion, call `checkLevelProgression(currentLevel)`

**4c. Level-up celebration**
- Mirror kanji's level-up toast/animation when progressing to next level

### Phase 5: Daily Lesson Caps

**5a. Wire up `kanjiMaxDailyLessons`** setting in kanji lesson flow
- In `getAvailableLessonCount()`: check how many lessons completed today (from review_log), subtract from max
- In lesson picker: respect the cap

**5b. Add `languageMaxDailyLessons`** setting (or reuse `dailyNewLimit`)
- Same pattern: count today's completed lessons from language_review_log
- Cap available lessons accordingly
- Add to Settings UI

**5c. Wire up `dailyReviewLimit`**
- In review session start: check how many reviews done today
- If at limit, show "Daily limit reached" instead of starting session
- Separate limits for kanji and language, or shared (user preference in settings)

### Phase 6: Remove/Rename Unused Settings

- Remove `dailyNewLimit` and `dailyReviewLimit` (replaced by per-system caps)
- Or rename them to `languageMaxDailyLessons` and `languageMaxDailyReviews`
- Clean up Settings.svelte to reflect actual working settings

## Files to Modify/Create

| File | Action | Phase |
|------|--------|-------|
| `scripts/tag-sentence-jlpt.mjs` | Create | 1 |
| `scripts/build-language-levels.mjs` | Create | 2 |
| `public/data/language/paths/*.json` | Create (generated) | 2 |
| `src/lib/data/learning-paths.ts` | Create | 2 |
| `src/lib/components/language/PathPicker.svelte` | Create | 3 |
| `src/views/Settings.svelte` | Modify | 3, 5 |
| `src/lib/srs/language-unlock.ts` | Rewrite | 4 |
| `src/lib/srs/language-srs.ts` | Modify | 4 |
| `src/lib/srs/language-lessons.ts` | Modify | 5 |
| `src/lib/db/queries/language.ts` | Modify | 4, 5 |
| `src/lib/db/queries/kanji.ts` | Modify | 5 |
| `src/lib/stores/app-settings.svelte.ts` | Modify | 5, 6 |
| `src/lib/db/seed/language-levels.ts` | Rewrite | 2 |
| `public/data/language/grammar.json` | Update | 1 |
| `public/data/language/sentence.json` | Update | 1 |

## Verification

1. Reset language data, verify path picker appears
2. Select N5 path, verify level 1 has ~15 kana items unlocked (not 372)
3. Complete kana lessons, verify vocab unlocks after 90% guru
4. Complete vocab, verify grammar unlocks
5. Complete grammar, verify sentences unlock
6. Guru 90% of level, verify level 2 unlocks
7. Hit daily lesson cap, verify no more lessons offered
8. Check levels browser -- verify "aunt" is in an appropriate early level, not level 41
9. Switch paths in settings, verify progress resets and new path loads
10. Run `npx svelte-check` -- 0 errors

## Risks

- **Sentence JLPT tagging accuracy**: Automated tagging by vocab content is approximate. Some sentences may end up in wrong levels.
- **Path switching destroys progress**: User must confirm. Consider offering backup before path change.
- **Grammar grouping quality**: Without Bunpro-style curated groups, grammar ordering may feel arbitrary. Manual curation of N5 grammar order would improve quality.
- **33K items across 4 paths**: The level builder script needs to handle all 4 paths correctly. Edge cases around items that span JLPT boundaries.
- **This is a multi-session task**: Phases 1-2 are data/scripts work. Phases 3-6 are code changes. Should be split across at least 2-3 implementation sessions.
