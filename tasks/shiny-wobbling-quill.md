# Language Section Redesign -- WaniKani-Style Browse + Pedagogical Ordering

## Context

The language section needs two major changes:
1. **Architecture:** Replace flat list/accordion pages with WaniKani-style browsable item stubs organized by difficulty, with SRS state indicators and detail pages
2. **Ordering:** Items should follow a research-backed learning progression, not arbitrary frequency sorting

The user hasn't started learning yet, so this is a clean-slate redesign.

## Research-Backed Learning Progression

### N5 Curriculum Order (based on Genki, BunPro, Tofugu, Tae Kim)

**Phase 0: Kana (weeks 1-2)**
- Already implemented with 24 lesson groups, progressive unlock
- No changes needed

**Phase 1: First 100 words + basic grammar (weeks 3-5)**
- Topic-bootstrapped vocabulary: greetings, pronouns, numbers 1-100, time words, days, core nouns (family, food, places, school)
- Grammar: copula (です/だ) -> basic particles (は/が/を/に) -> demonstratives (これ/それ/あれ)
- This is Genki Ch1-2 / BunPro L1 territory

**Phase 2: Verbs + adjectives (weeks 5-8)**
- Frequency-ordered N5 vocabulary, gated behind kanji knowledge
- Grammar: verb polite forms (ます) -> adjectives (い/な) -> existence (ある/いる) -> plain form
- BunPro L2-4 territory

**Phase 3: Te-form and beyond (weeks 8-12)**
- Te-form is the major inflection point -- everything after depends on it
- Grammar: te-form -> ている/てから/てください -> past forms -> たい -> たことがある -> permission/obligation
- Sentence cards begin here (threshold: 50+ vocab, 10+ grammar at Apprentice 4+)
- BunPro L5-8 territory

**Phase 4: N5 completion (weeks 12-16)**
- Remaining N5 grammar: comparison, giving/receiving, experience, obligation
- BunPro L9-10 territory
- Conjugation practice begins here (dictionary -> masu -> te -> ta forms)

### Grammar Dependency Chain

```
copula (です/だ)
  -> particles (は/が/を/に/で/へ/の/と/か/も)
    -> verb polite forms (ます/ません/ました)
      -> adjectives (い-adj, な-adj conjugation)
        -> existence (ある/いる)
          -> plain/dictionary form
            -> past forms (た/だ)
              -> te-form (THE major unlock point)
                -> ている/てから/てください/てもいい/てはいけない
                  -> たい/たことがある/たり~たりする
                    -> permission/obligation forms
```

### Conjugation Teaching Order

```
1. dictionary form (learn verb groups: ichidan/godan/irregular)
2. masu-form (polite present)
3. nai-form (negative)
4. te-form (connective -- biggest leap)
5. ta-form (past plain)
6. potential form (N4)
7. volitional form (N4)
8. conditional forms: tara/ba/to/nara (N4)
9. passive (N4)
10. causative (N4)
11. causative-passive (N4)
```

### Cross-Level Progression

| Level | Vocab | Grammar | Kanji Gate | Time |
|---|---|---|---|---|
| N5 | ~800 words | ~80 points | WK 1-10 | 3-4 months |
| N4 | +700 words | +100 points | WK 11-20 | 3-4 months |
| N3 | +1,500 words | +170 points | WK 21-35 | 6 months |
| N2 | +3,000 words | +200 points | WK 36-50 | 6-12 months |
| N1 | +6,000 words | +300 points | WK 51-60 | 12+ months |

Gate: 80% of previous level at Guru+ before next level opens (already implemented).

## Current Data Audit

| Content Type | Items | JLPT Tagged | Freq Ranked | Ordering Data |
|---|---|---|---|---|
| Vocabulary | 23,477 | 82% | 81% | JLPT + frequency_rank |
| Grammar | 648 (N5) + 518 | 68% | 17% | context_notes has Tae Kim lesson numbers (004-138) |
| Sentences | 8,104 | <1% | 74% valid | frequency_rank (Core 2k/6k order) |
| Conjugation | 95 | 100% N5 | 0% | verb_group field, no form ordering |
| Kana | 372 | 38% | 0% | lesson_group + lesson_order (done) |

**Key gaps:**
- Grammar has no explicit prerequisite_keys (dependency chain not encoded)
- Conjugation has no form ordering (all forms mixed together)
- No WK level on vocabulary items
- Sentences have no grammar-point association

## Architecture: Browse Pages

### New Views

**LanguageItemBrowser** (replaces Vocabulary, Grammar, Sentences, Conjugation pages)
- JLPT tier accordion: N5 (expanded) -> N4 -> N3 -> N2 -> N1 -> Untagged
- Within each tier: sub-groups of ~50 items by frequency rank
- Grid of item stubs showing: primary_text, reading, meaning (truncated), SRS stage indicator
- SRS colors match kanji pattern (locked=muted, apprentice=pink, guru=purple, master=blue, enlightened=amber, burned=green)
- Locked items show muted/dashed styling

**LanguageItemDetail** (new)
- Full item info: meaning, reading, pitch accent, example sentences, audio, conjugation forms
- SRS stage + next review time
- WK cross-references (for kanji-containing vocab)
- Keyboard nav (left/right arrows) between adjacent items
- Back button to browser

**LanguageKana** (enhance existing)
- Keep gojuon chart
- Add SRS state color tinting on each cell
- Make cells clickable to LanguageItemDetail

### Navigation

Sidebar entries (Vocabulary, Grammar, Sentences, Conjugation) route to LanguageItemBrowser with the content type as a parameter. Add `lang-item-detail` view for the detail page.

## Implementation Phases

This is a large feature. Split into phases that can be implemented in separate sessions.

### Phase 1: Foundation (data + queries)
1. Add migration v14 to reset language items (already written, pending commit)
2. Add `getLanguageItemsByJlptAndRange()` query
3. Add `getLanguageItemCountsByJlpt()` query for tier progress
4. Add `getAdjacentLanguageItem()` query for detail nav
5. Extract grammar lesson ordering from context_notes into lesson_order field

### Phase 2: Browse UI
6. Create LanguageItemBrowser.svelte (JLPT tiers + sub-groups + item grid)
7. Create LanguageItemDetail.svelte (full item info + keyboard nav)
8. Add `lang-item-detail` to navigation store
9. Wire routing: sidebar entries -> LanguageItemBrowser

### Phase 3: Replace + Polish
10. Replace LanguageVocabulary.svelte with LanguageItemBrowser(vocabulary)
11. Replace LanguageGrammar.svelte with LanguageItemBrowser(grammar)
12. Replace LanguageSentences.svelte with LanguageItemBrowser(sentence)
13. Replace LanguageConjugation.svelte with LanguageItemBrowser(conjugation)
14. Enhance LanguageKana.svelte with SRS state + click-to-detail
15. SRS stage colors/indicators on item stubs
16. Tier progress bars

### Phase 4: Pedagogical Ordering (future session)
17. Populate grammar prerequisite_keys from the dependency chain
18. Add conjugation form ordering (lesson_order for conjugation items)
19. Add grammar-point tags to sentences for better gating
20. Consider adding topic-based ordering for first 100 N5 vocab

## Critical Files

| File | Action |
|---|---|
| `src/views/LanguageItemBrowser.svelte` | NEW |
| `src/views/LanguageItemDetail.svelte` | NEW |
| `src/lib/db/queries/language.ts` | Add 3 new queries |
| `src/lib/stores/navigation.svelte.ts` | Add lang-item-detail view |
| `src/lib/db/migrations.ts` | v14 reset (already done) |
| `src/views/LanguageVocabulary.svelte` | REPLACE |
| `src/views/LanguageGrammar.svelte` | REPLACE |
| `src/views/LanguageSentences.svelte` | REPLACE |
| `src/views/LanguageConjugation.svelte` | REPLACE |
| `src/views/LanguageKana.svelte` | ENHANCE |
| `src/App.svelte` | Wire new view routing |

## Verification

1. Navigate to Vocabulary -> see N5 tier expanded with sub-groups of items
2. Items show SRS state (locked items muted, learned items colored)
3. Click item -> detail page with full info
4. Arrow keys navigate between items
5. Back button returns to browser
6. Same for Grammar, Sentences, Conjugation
7. Kana chart cells show SRS colors and are clickable
8. Lessons/Reviews still work independently
9. Dashboard shows correct counts after reset migration

## Lessons Learned / Gotchas

### 1. Migration vs. Seed Ordering (HIGH)
**Problem:** Migration v15's vocabulary topic UPDATEs depend on `jlpt_level = 'N5'`, but migrations run BEFORE `seedLanguageData()` in the startup sequence (`getDb()` -> migrations -> seed). On first launch, the language_items table is empty when v15 runs, so all vocab UPDATEs match 0 rows. The migration commits (schema_version=15) and never re-runs, leaving vocab items permanently without topic groups.

**Wrong pattern:** Putting data-dependent UPDATEs in a migration that runs before the data exists.

**Fix:** Added `applyVocabTopicOrdering()` as a post-seed fixup in `main.ts`, gated by a settings flag (`vocab_topics_v1`) so it runs once after seeding completes. For any future migrations that need to UPDATE seeded data, the pattern is: put the UPDATE logic in a post-seed fixup function, not in a migration.

**Severity:** HIGH -- silently fails with no error, all N5 vocab items remain ungrouped.

### 2. Browser UI Must Match Data Model (MEDIUM)
**Problem:** Phase 4 added `lesson_group` / `lesson_order` columns and populated them via migration, but the LanguageItemBrowser component still used flat 50-item chunking (`getLanguageItemsByJlptAndRange`) without any lesson_group awareness. The pedagogical structure existed in the DB but was invisible to users.

**Fix:** Updated the query to ORDER BY `lesson_order` first, group items by `lesson_group` into named sections (with human-readable labels), and fall back to numeric chunks for ungrouped items. Both the query function and the browser component needed changes.

**Severity:** MEDIUM -- no data loss, but the core UX feature of Phase 4 (topic-based learning order) was not surfaced.

### 3. Expected Data Gaps Are Normal (LOW)
- 848 grammar items have no `context_notes` or `frequency_rank`, so they receive no group. These are imported items without structured Tae Kim metadata.
- 2054 sentences have no `frequency_rank`, so they receive no JLPT level. These are imported sentences without Core 2k/6k frequency data.
- 190 of 2462 N5 vocab items match the 15 topic patterns. The remaining ~2272 are general vocabulary without matching part_of_speech or meaning patterns.

These gaps are by design -- the topic queries are intentionally narrow to avoid false positives.
