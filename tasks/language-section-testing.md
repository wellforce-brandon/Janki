# Unified Language Section -- Manual Testing Checklist

**Date:** 2026-03-21
**Build:** Phase 4 complete (384d298)

Legend: `[ ]` = not tested, `[x]` = pass, `[!]` = issue found (add notes below)

---

## Navigation & Sidebar

- [ x] Sidebar shows single **Language** section (not separate "Decks" and "Language")
  - Notes:
- [ !] Language section has 8 nav items: Overview, Review, Vocabulary, Grammar, Sentences, Kana, Conjugation, Manage Decks
  - Notes: configuration is not visible, but I think that might have been potentially dependent on something else. 
- [ x] Conjugation nav item hidden when no conjugation decks imported
  - Notes: 
- [ x] Each nav item navigates to the correct view
  - Notes:
- [ x] **Ctrl+1** goes to Dashboard
  - Notes:
- [ x] **Ctrl+2** goes to Language Overview
  - Notes:
- [ x] **Ctrl+3** goes to Language Review
  - Notes:
- [x ] **Ctrl+5** goes to Grammar
  - Notes:
- [ x] **Ctrl+6** goes to Sentences
  - Notes:
- [x ] **Ctrl+7** goes to Vocabulary
  - Notes:
- [ x] **Ctrl+8** goes to Stats
  - Notes:
- [x ] **Ctrl+F** opens Search
  - Notes:

---

## Dashboard

- [ x] Language summary shows **Due Reviews** count (violet card)
  - Notes:
- [ x] Shows **New Items** count (blue card)
  - Notes:
- [ x] Shows **Content Types** count
  - Notes:
- [ !] Content type breakdown pills show type + count + due (e.g., "vocabulary: 45 (8 due)")
  - Notes: I don't know about this one. I see pills underneath the language review section on the dashboard, but they say grammar 39, kanji for sentence 18. 
- [ ] **Start Review** button disabled when nothing due or new
  - Notes: I don't know if I have a way to test this since there's items due. 
- [ x] **Start Review** button launches unified review when items are due
  - Notes:
- [ x] **Language Overview** button navigates correctly
  - Notes:

---

## Language Overview

- [ !] Content type cards display (Vocabulary, Grammar, Sentences, Kana, etc.)
  - Notes: I'm not seeing vocabulary. 
- [ !] Each card shows total item count and due count
  - Notes: it's hard to say what the numbers specifically are. I see grammar 39, 39 new. 
- [ x] Cards are clickable, navigate to correct content type view
  - Notes:
- [ !] Quick-launch **Review** button shows due count badge
  - Notes: on the language overview page, I don't see a quick launch review button. 

---

## Vocabulary

I think this section is going to be too hard to do because I don't have decks in here. I kind of thought the idea of scanning all of the decks and gathering all that data and compiling it in a new, better way was to not need decks. 
- [ ] Items display with primary text, reading, and meaning
  - Notes:
- [ ] **Search** filter works
  - Notes:
- [ ] **Deck filter** dropdown filters to a specific deck
  - Notes:
- [ ] **SRS state filter** works (All, New, Learning, Review, Relearning)
  - Notes:
- [ ] **Pagination** (Previous/Next) works
  - Notes:
- [ ] Purple **ContentTypeBadge** shows
  - Notes:
- [ ] **DeckSourceBadge** shows source deck name
  - Notes:
- [ ] **WkBadge** appears on items with kanji in kanji_levels
  - Notes:
- [ ] Clicking WkBadge navigates to kanji detail
  - Notes:
- [ ] **Pitch accent** renders for decks that include it (Core 2k/6k)
  - Notes:
- [ ] SRS state badges show correct colors (New=blue, Learning=orange, Review=green, Relearning=red)
  - Notes:

---

## Grammar

- [ !] **JLPT level buttons** (N5-N1) switch displayed grammar
  - Notes: it switches, but there's no information on N4 through N1. 
- [ x] Search filter narrows grammar points
  - Notes:
- [x ] Expanding shows explanation, examples, formation
  - Notes:
- [ !] **WkBadge** appears for kanji in grammar patterns
  - Notes: I don't really know which one this might affect. I don't have a way of telling if it's working or not. 
- [ !] **TTS button** on examples plays audio
  - Notes: I don't know if this is working or not. I can't see the Janki app listed out specifically in the sound volume mixer settings, so I can't tell if it's on the right audio setting. I see Microsoft Edge WebView2, which might be the Tauri app, but I'm not sure.  Even after changing that to cable D, it's still not playing noise through TTS though. I wonder if there's a way to add in diagnostic logging to tell if it's playing sound at all, but then also a way to fix the app showing properly in the sound volume mixer settings. 
- [ x] Tags display under grammar entries
  - Notes:

---

## Sentences

- [ x] **Reading Mode** shows sentences with progress bar
  - Notes: there's no actual visible progress bar, but I can see that it's like step one, step two out of ten 
- [ x] **Furigana toggle** works
  - Notes:
- [ x] **Translation toggle** works
  - Notes: it would be nice on the translation toggle to have a button like the Furry got a button if someone doesn't want to use a keyboard. 
- [x ] **Shuffle** randomizes order
  - Notes:
- [ x] **Browse Mode** lists sentences
  - Notes:
- [ x] Switching between Reading and Browse modes works
  - Notes:

---

## Kana

- [x ] Kana grid displays correctly
  - Notes:
- [x ] **Hiragana / Katakana / All** toggles switch grid content
  - Notes:
- [x ] **Study Mode** toggle activates study mode
  - Notes:
- [x ] "Add all [kana type] to study" bulk action works
  - Notes:
- [! ] Checkmark shows on items already in study queue
  - Notes: it would be nice to be able to check and uncheck, so have two different toggle status modes. Right now, if you click on it, it checks it off, but you cannot uncheck it by clicking again. 
- [ ] "(in study)" badge appears for queued items
  - Notes:
I have no idea what this study mode is actually supposed to do. When you click done after selecting a few, it brings you back to the normal Kana grid. 
---

## Conjugation
Conjugation decks are not in here at the moment. Kind of goes back to my original notes of I thought we were going to do away with importing decks and just have one giant centralized database that we work around. 
- [ ] Conjugation browser loads (if conjugation decks imported)
  - Notes:
- [ ] Search filters verbs
  - Notes:
- [ ] Expanding a verb shows conjugation form table
  - Notes:
- [ ] Rose **ContentTypeBadge** shows
  - Notes:

---

## Unified Review Session
There's a TTS play button at the top that plays a ridiculous amount of unnecessary text. 
- [ ] Launching review from Overview or Dashboard opens LanguageReviewSession
  - Notes: previous note: I don't have review on the overview page. 
- [! ] Queue contains both imported deck cards AND promoted builtin items
  - Notes: there are no imported decks to test this with. 
- [x ] Card flip works (click to reveal)
  - Notes:
- [x ] **Rating buttons** appear after flip: Again, Hard, Good, Easy
  - Notes:
- [ x] Each rating shows **next interval** (e.g., "1m", "10m", "1d")
  - Notes:
- [x] **Keyboard shortcuts** for ratings work
  - Notes:
- [! ] **Progress bar** shows position in queue
  - Notes: there's no actual progress bar. It's just this card: 2 of 20. I don't see any sort of bar itself. 
- [ x] **Undo** reverts last review (up to 50)
  - Notes:
- [ x] **Timer** shows elapsed session time
  - Notes:
- [ x] **Content type badge** shows during review
  - Notes:
- [ !] **Pause/Resume** works
  - Notes: I don't see any sort of pause or resume button. 
- [ ] **Review summary** screen shows stats after finishing
  - Notes:
- [ ] Card FSRS state updates after review (next due date changed)
  - Notes:
- [ ] Promoted builtin item SRS state updates correctly
  - Notes:

---

## Builtin Item Scheduling

- [ !] Kana promoted via Study Mode appear in review queue when due
  - Notes: study mode didn't really seem to do anything after I clicked Done after choosing them. Nothing happened. 
- [ !] Promoted items have full FSRS state (stability, difficulty, due, reps, lapses)
  - Notes: I have no idea. 
- [ !] After reviewing a builtin item, due date advances based on rating
  - Notes: don't know. 

---

## WaniKani Cross-References

- [ ] Vocabulary items with kanji show **WkBadge** with correct SRS stage
  - Notes: I don't know where to find this. 
- [ ] Grammar items with kanji show **WkBadge**
  - Notes: same with this one. I don't know where to find an example. 
- [ ] Badge colors match stage (gray=Locked, pink=Apprentice, purple=Guru, blue=Master, emerald=Enlightened, amber=Burned)
  - Notes: don't know. 
- [ ] Clicking WkBadge navigates to kanji detail
  - Notes: don't 

---

## Content Classification
This goes back to the whole: I didn't think we were going to be doing importing decks, and we were just going to have a giant database. 
- [ ] After importing .apkg, items auto-classified (content_tags populated)
  - Notes: 
- [ ] Classification detects vocab, grammar, sentences, kana, kanji, radicals, conjugation
  - Notes:
- [ ] **Reclassify** button on Manage Decks re-runs classification
  - Notes:

---

## Search

- [ x] **Content Type dropdown** filter works (All Types, Vocabulary, Grammar, etc.)
  - Notes:
- [ !] **Builtin tab** shows builtin item results
  - Notes: I don't really understand what built-in types means, but I suppose it's working. 
- [ x] Card results show **ContentTypeBadge**
  - Notes:
- [ ] Grammar search returns N5 static data results
  - Notes: I don't know. It's not labeled very well. I don't know why this would all have separate stuff like this and not just show you each type with different results. What's the difference between built-in and the grammar that it finds? 
- [ ] Content type filter + search query narrows results correctly
  - Notes: I'm not sure. 
- [ ] Results show SRS state indicators
  - Notes: I am not sure on this. 

---

## Stats

- [ !] **Builtin item state distribution** chart shows New/Learning/Review/Relearning
  - Notes: I don't know what this means. I see built-in item states, and it says "new 68". 
- [ ] **Per-content-type review breakdown** shows separate stats per type
  - Notes: I don't know where to see this. 
- [ ] Content type stats show reviews + correct counts
  - Notes: I don't know. 
- [ ] **Date range selector** (7d, 30d, 90d, All) changes displayed stats
  - Notes: I see the buttons, but I don't know if it's working or not. 
- [ ] Stats reflect both card-based and builtin reviews
  - Notes: I have no way of telling. 

---

## Manage Decks
Once again, I didn't think we were doing deck management anymore. I thought it was going to be a giant built-in system that has all the stuff imported from the decks we found online. 
- [ ] Import deck works
  - Notes:
- [ ] Create deck works
  - Notes:
- [ ] Edit deck works
  - Notes:
- [ ] Reclassify deck re-runs content classification
  - Notes:

---

## Visual / Styling
Visualization stuff doesn't matter at the moment. We don't have a theme built in. 
- [ ] All views render correctly in **dark mode**
  - Notes:
- [ ] All views render correctly in **light mode**
  - Notes:
- [ ] Japanese text uses proper font (Noto Sans JP / Yu Gothic UI)
  - Notes:
- [ ] Color-coded badges are distinguishable across all 7 content types
  - Notes:
- [ ] No layout overflow or broken scrolling on any page
  - Notes:

---

## General Notes

<!--
Use this space for anything that doesn't fit above:
patterns you noticed, ideas for improvement, etc.
-->
