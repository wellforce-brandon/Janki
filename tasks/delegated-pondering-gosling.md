# Fill Data Gaps: Grammar Groups, Vocab Topics, Sentence JLPT Tags

## Context

Phase 4 (shiny-wobbling-quill) added pedagogical ordering via migration v15, but verification revealed three gaps:
- **848 grammar items** have no lesson_group (practice cards, example sentences, quiz questions)
- **2272 N5 vocab items** are ungrouped (only 190 of 2462 matched the original 15 narrow topics)
- **1543 of those vocab items** also have NULL part_of_speech
- **2054 sentences** from the Tae Kim anime course have no JLPT level

The goal is zero ungrouped items -- every item should belong to a named topic group for coherent learning progression.

## Files to Modify

1. `src/lib/db/seed/language-data.ts` -- add 4 new fixup functions
2. `src/lib/db/queries/language.ts` -- add new group keys to GROUP_LABELS map
3. `src/main.ts` -- wire new fixup functions into init sequence

## Step 1: Vocab Part-of-Speech Assignment

**Function:** `applyVocabPartOfSpeech()` gated by `vocab_pos_v1`
**Must run BEFORE topic ordering** (topics 1-15 depend on part_of_speech).

1543 items with NULL part_of_speech break down as:
- 935 have "Common noun" in meaning -> `noun`
- 120 have meaning starting with "to " -> `verb`
- 82 have "Adverb" in meaning -> `adverb`
- 12 have "Counter" in meaning -> `counter`
- 9 have "Expression" in meaning -> `expression`
- 8 have "Godan verb" in meaning -> `verb`
- 7 have "Pronoun" in meaning -> `pronoun`
- 1 has "Ichidan verb" in meaning -> `verb`
- ~576 with no embedded PoS hints -- analyze each and route:
  - Items with "(na-adj)" in meaning -> `な adjective`
  - Items with meaning matching "to ..." pattern -> `verb`
  - Remaining -> `noun` (safe default; these are compound nouns, place names, academic terms)

SQL UPDATE order (most specific first, all with `AND part_of_speech IS NULL`):
1. Godan/Ichidan verbs (from embedded JMdict data)
2. "to " prefix verbs
3. Adverbs (embedded "Adverb")
4. Counters (embedded "Counter")
5. Expressions (embedded "Expression")
6. Pronouns (embedded "Pronoun")
7. Na-adjectives (meaning contains "(na-adj)")
8. Common nouns (embedded "Common noun")
9. Default remaining -> `noun`

## Step 2: Expanded Vocab Topic Groups

**Function:** `applyVocabTopicOrderingV2()` gated by `vocab_topics_v2`
**Runs AFTER Step 1 and after existing `applyVocabTopicOrdering()` (v1).**

Existing 15 topics cover 190 items. Add ~15 semantic topics to cover the remaining ~2082 N5 items. Each UPDATE uses `AND lesson_group IS NULL` so existing assignments are preserved.

| Order | Key | Label | Matching strategy (on meaning field) |
|-------|-----|-------|--------------------------------------|
| 16 | vocab-greetings | Greetings & Expressions | PoS = expression, OR meaning matches hello/goodbye/thanks/sorry/excuse/please/welcome patterns |
| 17 | vocab-question-words | Question Words | meaning matches who/what/where/when/why/how/which patterns AND short primary_text |
| 18 | vocab-food | Food & Drink | meaning keywords: rice, tea, meat, fish, egg, vegetable, fruit, water, milk, coffee, bread, lunch, dinner, breakfast, meal, eat, drink, cook, food, steak, soup, cake, sugar, salt, etc. |
| 19 | vocab-body | Body & Health | meaning keywords: hand, foot, eye, head, face, mouth, ear, nose, tooth, hair, finger, heart, stomach, sick, medicine, hospital, doctor, etc. |
| 20 | vocab-school | School & Education | meaning keywords: school, student, teacher, class, study, learn, test, exam, university, lesson, homework, textbook, library, etc. |
| 21 | vocab-house | House & Home | meaning keywords: house, home, room, door, window, kitchen, bed, table, chair, floor, wall, garden, apartment, etc. |
| 22 | vocab-transport | Transportation | meaning keywords: car, bus, train, airplane, bicycle, station, airport, road, drive, ticket, etc. |
| 23 | vocab-nature | Nature & Weather | meaning keywords: rain, snow, wind, cloud, sky, sun, moon, star, mountain, river, sea, tree, flower, weather, hot, cold, warm, etc. |
| 24 | vocab-clothes | Clothing & Accessories | meaning keywords: clothes, shirt, shoe, hat, wear, coat, dress, skirt, pants, bag, umbrella, glasses, etc. |
| 25 | vocab-colors | Colors | meaning matches exact color words: red, blue, green, yellow, white, black, brown, pink, purple, orange, color, etc. |
| 26 | vocab-animals | Animals | meaning keywords: dog, cat, bird, fish, cow, horse, rabbit, bear, insect, animal, etc. |
| 27 | vocab-work | Work & Office | meaning keywords: work, job, office, company, meeting, business, employee, money, bank, etc. |
| 28 | vocab-location | Places & Directions | meaning keywords: north, south, east, west, left, right, front, back, above, below, inside, outside, near, far, map, park, hospital, station, store, shop, etc. |
| 29 | vocab-time | Time Expressions | meaning keywords: today, tomorrow, yesterday, morning, afternoon, evening, night, now, later, always, sometimes, week, month, year, early, late, etc. |
| 30 | vocab-actions | Common Verbs | PoS contains 'verb' AND lesson_group IS NULL (verbs that didn't match any semantic topic) |
| 31 | vocab-descriptors | Descriptors | PoS contains 'adjective' or 'adverb' AND lesson_group IS NULL |
| 32 | vocab-general | General | Catch-all: lesson_group IS NULL (everything remaining) |

**Keyword matching approach:** Use `LOWER(meaning) LIKE '%keyword%'` with multiple OR conditions per topic. Run topics in the order shown (most specific semantic categories first, then PoS-based catch-alls, then general catch-all). The `AND lesson_group IS NULL` on each statement means first match wins.

**Critical:** The meaning field is multi-line for some items. Use `LIKE '%keyword%'` which searches the full text. For short keyword matches that risk false positives (e.g., "to" matching "tomato"), use word boundary tricks: `meaning LIKE '% to %'` or `LOWER(TRIM(meaning)) LIKE 'to %'`.

## Step 3: Grammar Group Assignment

**Function:** `applyGrammarGroupOrdering()` gated by `grammar_groups_v1`

### 3a: N5 Grammar Pattern Cards (603 items)
Source: Full_Japanese_Study_Deck. These have `primary_text` with the grammar form (e.g., "~か", "~たい") and `meaning` with English explanation.

Match in priority order (most specific grammar concept first):

1. **grammar-transitivity** (8): meaning contains "transitive", "intransitive"
2. **grammar-clauses** (9): meaning contains "relative clause", "nominalization", "subordinate", "explanatory"
3. **grammar-adverbs-gobi** (11): meaning contains "adverb", "sentence end", "exclamation", or primary_text matches sentence-enders (~ね, ~よ, ~わ, ~ぞ, ~ぜ)
4. **grammar-noun-particles** (10): primary_text matches ~の, ~こと, ~もの, or meaning contains "noun modification"
5. **grammar-past-tense** (6): primary_text contains ~た or ~だった, or meaning contains "past tense"
6. **grammar-negative-verbs** (5): primary_text contains ~ない or ~ず, or meaning contains "negative", "negat"
7. **grammar-verb-particles** (7): primary_text matches compound verb particles (~てから, ~ために, ~ながら, ~ように, ~ところ)
8. **grammar-verb-basics** (4): meaning contains "verb", "conjugat", "te-form", "masu", or primary_text contains ~ます, ~て, ~ている
9. **grammar-adjectives** (3): meaning contains "adjective", or primary_text pattern matches い/な adjective forms
10. **grammar-particles** (2): primary_text is a single particle pattern (~は, ~が, ~を, ~に, ~で, ~と, ~か, ~へ, ~から, ~まで, ~も)
11. **grammar-copula** (1): primary_text contains ~だ or ~です, or meaning contains "copula", "state of being"
12. **grammar-supplemental** (12): catch-all for remaining

### 3b: Tae Kim Quiz Questions (64 items)
Source: Tae_Kims_Grammar_Guide. These are English Q&A. Match on English keywords in `primary_text`:

- "copula" / "state of being" / "です" -> grammar-copula
- "particle" / "は" / "が" / "を" -> grammar-particles
- "adjective" / "i-adjective" / "na-adjective" -> grammar-adjectives
- "conjugat" / "verb" / "ru-verb" / "u-verb" -> grammar-verb-basics
- "negative" / "negate" -> grammar-negative-verbs
- "past" / "past tense" -> grammar-past-tense
- "transitive" / "intransitive" -> grammar-transitivity
- "relative clause" -> grammar-clauses
- "adverb" -> grammar-adverbs-gobi
- Remaining -> grammar-supplemental

### 3c: Tae Kim Example Sentences (181 items)
Source: TAE_KIM_complete_guide_deck_Athos. Japanese text only, no meaning. Match via Japanese grammar markers in `primary_text`:

1. Sentences containing させ -> grammar-verb-particles (causative)
2. Sentences containing られ/された -> grammar-transitivity (passive)
3. Sentences containing ば/たら/なら -> grammar-clauses (conditionals)
4. Sentences containing ている/ていた -> grammar-verb-basics (progressive)
5. Sentences ending in ない/ません/なかった -> grammar-negative-verbs
6. Sentences ending in た/ました/だった -> grammar-past-tense
7. Sentences with は/が/を/に/で prominently -> grammar-particles
8. Sentences ending in だ/です -> grammar-copula
9. Remaining -> grammar-supplemental

## Step 4: Sentence JLPT Tagging

**Function:** `applySentenceJlptTagging()` gated by `sentence_jlpt_v1`

All 2054 untagged sentences are from the Tae Kim anime course. Data analysis shows:
- Average 9.7 chars (existing N5 averages 25.3 chars)
- 60% are 10 chars or fewer -- single grammar point illustrations
- Grammar patterns are overwhelmingly N5 (copula, basic particles, simple tense)
- The Tae Kim course is a beginner's course; even its later sections teach foundational grammar

**Decision: Tag all 2054 as N5.** These are scaffolding examples for beginners. A single UPDATE:
```sql
UPDATE language_items SET jlpt_level = 'N5'
WHERE content_type = 'sentence' AND jlpt_level IS NULL
```

## Step 5: GROUP_LABELS Map

Add to `GROUP_LABELS` in `src/lib/db/queries/language.ts`:
```
"vocab-greetings": "Greetings & Expressions"
"vocab-question-words": "Question Words"
"vocab-food": "Food & Drink"
"vocab-body": "Body & Health"
"vocab-school": "School & Education"
"vocab-house": "House & Home"
"vocab-transport": "Transportation"
"vocab-nature": "Nature & Weather"
"vocab-clothes": "Clothing & Accessories"
"vocab-colors": "Colors"
"vocab-animals": "Animals"
"vocab-work": "Work & Office"
"vocab-location": "Places & Directions"
"vocab-time": "Time Expressions"
"vocab-actions": "Common Verbs"
"vocab-descriptors": "Descriptors"
"vocab-general": "General"
```

## Step 6: Wire Into main.ts

Update init() call order:
```typescript
await seedLanguageData();
await applyVocabPartOfSpeech();        // Step 1: PoS first
await applyVocabTopicOrdering();       // Existing v1 (15 topics)
await applyVocabTopicOrderingV2();     // Step 2: expanded topics
await applyGrammarGroupOrdering();     // Step 3: grammar groups
await applySentenceJlptTagging();      // Step 4: sentence JLPT
```

## Verification

1. Run the app (`npm run tauri dev`) and check console for fixup messages
2. Query database to confirm zero ungrouped items:
   ```sql
   SELECT content_type, COUNT(*) FROM language_items
   WHERE lesson_group IS NULL AND content_type IN ('grammar', 'vocabulary')
   AND jlpt_level = 'N5' GROUP BY content_type;
   -- Should return 0 rows

   SELECT COUNT(*) FROM language_items WHERE content_type='sentence' AND jlpt_level IS NULL;
   -- Should return 0

   SELECT COUNT(*) FROM language_items WHERE content_type='vocabulary' AND part_of_speech IS NULL;
   -- Should return 0
   ```
3. Navigate to Grammar (Ctrl+5), Vocabulary (Ctrl+7), Sentences (Ctrl+6) browser views
4. Verify each JLPT tier shows named topic groups instead of numeric ranges
5. Spot-check: open a "Food & Drink" vocab item -- confirm it's food-related
6. Spot-check: open a grammar-particles item -- confirm it's about particles
