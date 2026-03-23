# Assign JLPT Levels to 369 Tae Kim Grammar Items

## Context

369 grammar items from Tae Kim decks have no `jlpt_level` assigned. These are quiz questions ("How to specify the direct object of a verb?") and example sentences illustrating grammar points. The content is clearly assessable -- を particle is N5, relative clauses are N4, etc. They already have `language_level` (51-60) from the levels system, but the JLPT tag is missing.

**Source breakdown:**
- 188 from Tae_Kims_Grammar_Guide_Vocabulary_Grammar_and_Exercises (mix of English quiz questions and Japanese examples with highlighted grammar)
- 181 from TAE_KIM_complete_guide_deck_Athos (Japanese example sentences)

## Assessment

The Tae Kim guide covers these topics in order:
- State-of-being / copula (だ, です) -- N5
- Particles (は, が, を, に, で, と, も, か, ね, よ) -- N5
- Adjectives (い, な) -- N5
- Verb basics and conjugation -- N5
- Negative forms -- N5
- Past tense -- N5
- Adverbs -- N5
- Noun modification -- N5
- Explanatory の/のだ -- N5
- Transitive/intransitive -- N5 (basic concept, though deeper usage is N4)
- Relative clauses -- N4 (the only clearly N4 topic)

Only 2 quiz questions mention N4-level concepts explicitly (relative clauses, transitive/intransitive). Everything else is textbook N5.

**Decision: Tag all 369 as N5.** Even the relative clause and transitive/intransitive items are teaching the basic concept, not advanced usage. Tae Kim's guide is universally recognized as N5-level material.

## Implementation

**File:** `src/lib/db/seed/language-data.ts`

Add to the existing `applySentenceJlptTagging()` function (or create a new fixup gated by `grammar_jlpt_v1`):

```sql
UPDATE language_items SET jlpt_level = 'N5'
WHERE content_type = 'grammar' AND jlpt_level IS NULL
```

This is a single UPDATE statement. All 369 items get N5 since they're all from Tae Kim's beginner guide.

## Files to Modify

1. `src/lib/db/seed/language-data.ts` -- add fixup function `applyGrammarJlptTagging()`
2. `src/main.ts` -- wire into init sequence after other fixups

## Verification

```sql
SELECT COUNT(*) FROM language_items WHERE content_type='grammar' AND jlpt_level IS NULL;
-- Should return 0
```
