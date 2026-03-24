/**
 * Sentence JLPT Tagging Script
 *
 * Tags untagged sentences in sentence.json with JLPT levels by analyzing
 * their vocabulary content against:
 *   1. Our own vocabulary.json (primary source -- has JLPT for ~19K items)
 *   2. JMDict-simplified for additional word lookups
 *
 * Algorithm:
 *   - Strip ruby annotations from sentence text to get plain Japanese
 *   - Match vocabulary words in sentence (longest match first)
 *   - Sentence JLPT = highest (most advanced) JLPT level found
 *   - JLPT ranking: N5 < N4 < N3 < N2 < N1
 *
 * Usage: node scripts/tag-sentence-jlpt.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const SENTENCE_PATH = "public/data/language/sentence.json";
const VOCAB_PATH = "public/data/language/vocabulary.json";
const JMDICT_PATH = "scripts/data/jmdict-eng-3.6.2.json";
const REPORT_DIR = "scripts/reports";

// JLPT level ordering (higher index = more advanced)
const JLPT_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

function jlptHigher(a, b) {
  return (JLPT_ORDER[a] ?? -1) > (JLPT_ORDER[b] ?? -1) ? a : b;
}

// ── Ruby Stripping ─────────────────────────────────────────────────────────
// Input format: "日曜日[にちようび]は 図書館[としょかん]に\n行[い]きます\n。"
// Output: "日曜日は図書館に行きます。"

function stripRuby(text) {
  if (!text) return "";
  return (
    text
      // Remove ruby readings: kanji[reading] -> kanji
      .replace(/\[([^\]]*)\]/g, "")
      // Remove [;n] style annotations
      .replace(/\[;[^\]]*\]/g, "")
      // Remove newlines and excess whitespace
      .replace(/\n/g, "")
      .replace(/\s+/g, "")
      .trim()
  );
}

// ── Character Classification ───────────────────────────────────────────────

function isKanji(ch) {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0xf900 && code <= 0xfaff) // CJK Compatibility Ideographs
  );
}

function isJapanese(ch) {
  const code = ch.charCodeAt(0);
  return (
    isKanji(ch) ||
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0xff65 && code <= 0xff9f) // Half-width Katakana
  );
}

// ── Build Vocab JLPT Lookup ────────────────────────────────────────────────

function hasKanji(text) {
  for (const ch of text) {
    if (isKanji(ch)) return true;
  }
  return false;
}

// Extract verb/adjective stems to register at the base word's JLPT level.
// This prevents masu-stems (教え from 教える) from matching N1 noun entries
// when the actual word in the sentence is the N5 verb's conjugated form.
function getVerbStems(text) {
  const stems = [];
  // Ichidan (ru-verbs): drop る -> stem
  if (text.endsWith("る") && text.length >= 2) {
    stems.push(text.slice(0, -1));
  }
  // Godan (u-verbs): various endings
  // う -> い stem
  if (text.endsWith("う") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "い");
  }
  // く -> き stem
  if (text.endsWith("く") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "き");
  }
  // す -> し stem
  if (text.endsWith("す") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "し");
  }
  // つ -> ち stem
  if (text.endsWith("つ") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "ち");
  }
  // ぬ -> に stem
  if (text.endsWith("ぬ") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "に");
  }
  // ぶ -> び stem
  if (text.endsWith("ぶ") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "び");
  }
  // む -> み stem
  if (text.endsWith("む") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "み");
  }
  // ぐ -> ぎ stem
  if (text.endsWith("ぐ") && text.length >= 2) {
    stems.push(text.slice(0, -1) + "ぎ");
  }
  return stems;
}

function buildVocabLookup(vocab) {
  // Map: word text -> JLPT level
  // For words with same text at different levels, keep the LOWEST (most basic) level
  // since that represents the simplest interpretation of the word
  const lookup = new Map();

  function addEntry(text, level) {
    const existing = lookup.get(text);
    if (!existing || JLPT_ORDER[level] < JLPT_ORDER[existing]) {
      lookup.set(text, level);
    }
  }

  for (const item of vocab) {
    if (!item.jlpt_level) continue;

    let text = item.primary_text;
    if (!text) continue;

    // Some vocab items (especially N2) have multi-line primary_text with
    // metadata ("Common kanji form", alternate spellings, etc.)
    // Extract just the first line as the actual word
    if (text.includes("\n")) {
      text = text.split("\n")[0].trim();
    }

    addEntry(text, item.jlpt_level);

    // Register verb/adjective stems at the base word's JLPT level
    // so that 教え (stem of 教える N5) gets N5 instead of N1 noun
    const pos = (item.part_of_speech || "").toLowerCase();
    if (
      pos.includes("verb") ||
      text.endsWith("る") ||
      text.endsWith("う") ||
      text.endsWith("く") ||
      text.endsWith("す") ||
      text.endsWith("つ") ||
      text.endsWith("ぶ") ||
      text.endsWith("む") ||
      text.endsWith("ぬ") ||
      text.endsWith("ぐ")
    ) {
      for (const stem of getVerbStems(text)) {
        if (stem.length >= 2) {
          addEntry(stem, item.jlpt_level);
        }
      }
    }

    // i-adjective stem: drop い
    if (
      (pos.includes("adjective") || text.endsWith("い")) &&
      text.length >= 3
    ) {
      addEntry(text.slice(0, -1), item.jlpt_level);
    }

    // For multi-line primary_text items, register alternate KANJI forms only.
    // Kana-only readings (ます, はと, ない) cause massive false positives
    // when substring-matching against sentences.
    if (item.primary_text.includes("\n")) {
      const lines = item.primary_text.split("\n").map((l) => l.trim());
      for (const line of lines.slice(1)) {
        if (
          !line ||
          line.includes("kanji form") ||
          line.includes("Show other") ||
          line.includes("Search-only") ||
          line.includes("Rarely used") ||
          line.includes("Irregular") ||
          line.includes("Ateji")
        )
          continue;
        // Only register if it contains kanji (avoid kana-only false positives)
        if (line.length >= 2 && line.length <= 20 && hasKanji(line)) {
          addEntry(line, item.jlpt_level);
        }
      }
    }

    // Only add kana reading for kana-only words (no kanji in primary_text)
    if (item.reading && !hasKanji(text)) {
      const reading = item.reading.trim();
      if (reading && reading.length >= 3 && !lookup.has(reading)) {
        addEntry(reading, item.jlpt_level);
      }
    }
  }

  return lookup;
}

// ── Build JMDict JLPT Supplement ───────────────────────────────────────────
// JMDict doesn't have JLPT data, but we can use "common" flag as a rough proxy
// and cross-reference with our vocab to build a broader lookup

function buildJmdictSupplement(jmdict, vocabLookup) {
  // Build a secondary lookup for words in jmdict that aren't in our vocab.
  // Only include kanji-containing forms (2+ chars) to avoid kana substring
  // false positives. Derive JLPT from the AVERAGE of component kanji levels
  // rather than the highest, to reduce N1 inflation from single rare kanji
  // in otherwise common compounds.
  const kanjiLookup = new Map(); // single kanji -> JLPT level

  // Extract single-kanji JLPT levels from vocab
  for (const [text, level] of vocabLookup.entries()) {
    if (text.length === 1 && isKanji(text)) {
      const existing = kanjiLookup.get(text);
      // Keep the most basic (lowest) level for each kanji
      if (!existing || JLPT_ORDER[level] < JLPT_ORDER[existing]) {
        kanjiLookup.set(text, level);
      }
    }
  }

  const supplement = new Map();
  const LEVEL_FROM_INDEX = ["N5", "N4", "N3", "N2", "N1"];

  for (const word of jmdict.words) {
    // Only use kanji forms (skip kana-only to avoid substring issues)
    const forms = word.kanji.map((k) => k.text);

    for (const form of forms) {
      if (form.length < 2) continue; // Skip single chars
      if (vocabLookup.has(form)) continue;
      if (supplement.has(form)) continue;

      // Derive JLPT from component kanji using AVERAGE level
      // (not max, to avoid inflating everything to N1)
      const kanjiLevels = [];
      for (const ch of form) {
        if (isKanji(ch) && kanjiLookup.has(ch)) {
          kanjiLevels.push(JLPT_ORDER[kanjiLookup.get(ch)]);
        }
      }

      if (kanjiLevels.length > 0) {
        // Use the max of individual kanji levels, but only if we matched
        // at least half the kanji in the word (avoid partial matches)
        const kanjiCount = [...form].filter(isKanji).length;
        if (kanjiLevels.length >= kanjiCount * 0.5) {
          const maxLevel = Math.max(...kanjiLevels);
          supplement.set(form, LEVEL_FROM_INDEX[maxLevel]);
        }
      }
    }
  }

  return supplement;
}

// ── Sentence Analyzer ──────────────────────────────────────────────────────

function analyzeSentence(plainText, vocabLookup, supplement) {
  if (!plainText || plainText.length === 0) return null;

  let highestJlpt = null;
  const matchedWords = [];

  // Greedy longest-match scanning
  // Try all substrings from longest to shortest at each position
  // Minimum match length: 2 for kana-only, 1 for kanji-containing
  const maxWordLen = 12;
  let i = 0;

  while (i < plainText.length) {
    let matched = false;

    for (
      let len = Math.min(maxWordLen, plainText.length - i);
      len >= 2;
      len--
    ) {
      const substr = plainText.slice(i, i + len);

      let jlpt = vocabLookup.get(substr) || supplement.get(substr);
      if (jlpt) {
        highestJlpt = highestJlpt ? jlptHigher(highestJlpt, jlpt) : jlpt;
        matchedWords.push({ word: substr, jlpt });
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Single-kanji fallback: only for N5-N3 kanji.
      // N2/N1 single-kanji matches produce false positives (小 in 小さな,
      // 皆 in compound words), but N5-N3 single-kanji words (車, 家, 雨, 犬)
      // are common standalone words that need to match.
      const ch = plainText[i];
      if (isKanji(ch)) {
        const kanjiJlpt = vocabLookup.get(ch);
        if (kanjiJlpt && JLPT_ORDER[kanjiJlpt] <= JLPT_ORDER["N3"]) {
          highestJlpt = highestJlpt
            ? jlptHigher(highestJlpt, kanjiJlpt)
            : kanjiJlpt;
          matchedWords.push({ word: ch, jlpt: kanjiJlpt });
        }
      }
      i++;
    }
  }

  return { jlpt: highestJlpt, matchedWords };
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("Loading data...");

const sentences = JSON.parse(readFileSync(SENTENCE_PATH, "utf-8"));
console.log(`Loaded ${sentences.length} sentences`);

const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf-8"));
console.log(`Loaded ${vocab.length} vocabulary items`);

console.log("Building vocab JLPT lookup...");
const vocabLookup = buildVocabLookup(vocab);
console.log(`Vocab lookup: ${vocabLookup.size} entries`);

let supplement = new Map();
if (existsSync(JMDICT_PATH)) {
  console.log("Loading JMDict for supplementary lookups...");
  const jmdict = JSON.parse(readFileSync(JMDICT_PATH, "utf-8"));
  console.log(`Loaded ${jmdict.words.length} JMDict entries`);

  console.log("Building JMDict supplement...");
  supplement = buildJmdictSupplement(jmdict, vocabLookup);
  console.log(`Supplement lookup: ${supplement.size} entries`);
} else {
  console.log(
    "JMDict not found, using vocab-only lookup (less comprehensive)",
  );
}

// Process sentences
console.log("Analyzing sentences...");

const report = {
  total: sentences.length,
  alreadyTagged: 0,
  tagged: 0,
  untaggable: 0,
  byLevel: { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 },
  untaggableSamples: [],
};

let modified = 0;

for (const sentence of sentences) {
  // Skip already-tagged sentences
  if (sentence.jlpt_level) {
    report.alreadyTagged++;
    continue;
  }

  const plainText = stripRuby(sentence.primary_text);
  const result = analyzeSentence(plainText, vocabLookup, supplement);

  if (result && result.jlpt) {
    sentence.jlpt_level = result.jlpt;
    report.tagged++;
    report.byLevel[result.jlpt]++;
    modified++;
  } else {
    report.untaggable++;
    if (report.untaggableSamples.length < 50) {
      report.untaggableSamples.push({
        key: sentence.item_key,
        text: plainText.slice(0, 60),
        meaning: (sentence.meaning || "").slice(0, 60),
      });
    }
  }
}

// Write updated sentences
if (modified > 0) {
  console.log(`Writing ${modified} updates to sentence.json...`);
  writeFileSync(SENTENCE_PATH, JSON.stringify(sentences, null, 2), "utf-8");
}

// Write report
mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = "scripts/reports/sentence-jlpt-tagging.json";
writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== Sentence JLPT Tagging Report ===");
console.log(`Total sentences:     ${report.total}`);
console.log(`Already tagged:      ${report.alreadyTagged}`);
console.log(`Newly tagged:        ${report.tagged}`);
console.log(`Unable to tag:       ${report.untaggable}`);
console.log(`\nBy JLPT level:`);
Object.entries(report.byLevel).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`);
});
console.log(`\nFull report: ${reportPath}`);
