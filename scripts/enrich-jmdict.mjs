/**
 * JMDict Enrichment Script
 *
 * Cross-references vocabulary.json against jmdict-simplified to:
 * - Fill missing part_of_speech fields
 * - Validate readings and meanings
 *
 * Usage: node scripts/enrich-jmdict.mjs [jmdict-path] [vocab-path]
 * Defaults:
 *   jmdict-path = scripts/data/jmdict-eng-3.5.0.json
 *   vocab-path  = public/data/language/vocabulary.json
 *
 * Download jmdict-eng-3.5.0.json from:
 * https://github.com/scriptin/jmdict-simplified/releases
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Config ──────────────────────────────────────────────────────────────────

const JMDICT_PATH = process.argv[2] || "scripts/data/jmdict-eng-3.6.2.json";
const VOCAB_PATH = process.argv[3] || "public/data/language/vocabulary.json";
const REPORT_DIR = "scripts/reports";

// ── PoS Tag Mapping ─────────────────────────────────────────────────────────
// Maps jmdict-simplified tags to human-readable labels matching our format

const POS_MAP = {
	n: "noun",
	"n-adv": "adverbial noun",
	"n-suf": "noun suffix",
	"n-pref": "noun prefix",
	"n-t": "temporal noun",
	v1: "ichidan verb",
	"v1-s": "ichidan verb (kureru special)",
	v5u: "godan verb (u)",
	"v5u-s": "godan verb (u, special)",
	v5k: "godan verb (ku)",
	"v5k-s": "godan verb (iku/yuku special)",
	v5g: "godan verb (gu)",
	v5s: "godan verb (su)",
	v5t: "godan verb (tsu)",
	v5n: "godan verb (nu)",
	v5b: "godan verb (bu)",
	v5m: "godan verb (mu)",
	v5r: "godan verb (ru)",
	"v5r-i": "godan verb (ru, irregular)",
	v5aru: "godan verb (aru)",
	vt: "transitive",
	vi: "intransitive",
	"vs-i": "suru verb",
	"vs-s": "suru verb (special)",
	vs: "suru verb (irregular)",
	vk: "kuru verb",
	vz: "zuru verb",
	"adj-i": "i-adjective",
	"adj-na": "na-adjective",
	"adj-no": "no-adjective",
	"adj-t": "taru-adjective",
	"adj-f": "prenominal adjective",
	"adj-pn": "pre-noun adjectival",
	"adj-nari": "archaic adjective",
	"adj-ku": "ku-adjective (archaic)",
	"adj-shiku": "shiku-adjective (archival)",
	"adj-ix": "i-adjective (yoi/ii)",
	adv: "adverb",
	"adv-to": "to-adverb",
	prt: "particle",
	conj: "conjunction",
	int: "interjection",
	pref: "prefix",
	suf: "suffix",
	cop: "copula",
	"aux-v": "auxiliary verb",
	"aux-adj": "auxiliary adjective",
	exp: "expression",
	ctr: "counter",
	pn: "pronoun",
	unc: "unclassified",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePos(jmdictTags, tagsDict) {
	// Filter to actual part-of-speech tags (skip vt/vi since they're transitivity markers)
	const posTags = jmdictTags.filter((t) => POS_MAP[t] && t !== "vt" && t !== "vi");
	const transitivity = jmdictTags.filter((t) => t === "vt" || t === "vi");

	if (posTags.length === 0) return null;

	const parts = posTags.map((t) => POS_MAP[t] || tagsDict[t] || t);
	if (transitivity.length > 0) {
		parts.push(...transitivity.map((t) => POS_MAP[t]));
	}
	return parts.join(", ");
}

function getMeaningWords(meaning) {
	if (!meaning) return new Set();
	return new Set(
		meaning
			.toLowerCase()
			.split(/[,;()/\n]+/)
			.map((s) => s.trim())
			.filter(Boolean),
	);
}

function computeMeaningOverlap(ourMeaning, jmdictGlosses) {
	const ourWords = getMeaningWords(ourMeaning);
	if (ourWords.size === 0) return 0;

	const jmdictWords = new Set();
	for (const g of jmdictGlosses) {
		for (const word of g.text
			.toLowerCase()
			.split(/[,;()/]+/)
			.map((s) => s.trim())
			.filter(Boolean)) {
			jmdictWords.add(word);
		}
	}

	let matches = 0;
	for (const w of ourWords) {
		if (jmdictWords.has(w)) matches++;
	}
	return matches / ourWords.size;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("Loading JMDict data...");
if (!existsSync(JMDICT_PATH)) {
	console.error(`JMDict file not found: ${JMDICT_PATH}`);
	console.error("Download from: https://github.com/scriptin/jmdict-simplified/releases");
	process.exit(1);
}

const jmdict = JSON.parse(readFileSync(JMDICT_PATH, "utf-8"));
const tagsDict = jmdict.tags || {};
console.log(`Loaded ${jmdict.words.length} JMDict entries`);

// Build lookup maps
console.log("Building lookup maps...");
const byKanji = new Map(); // text -> JMDictWord[]
const byKana = new Map(); // text -> JMDictWord[]

for (const word of jmdict.words) {
	for (const k of word.kanji) {
		const list = byKanji.get(k.text) || [];
		list.push(word);
		byKanji.set(k.text, list);
	}
	for (const k of word.kana) {
		const list = byKana.get(k.text) || [];
		list.push(word);
		byKana.set(k.text, list);
	}
}
console.log(`Index: ${byKanji.size} kanji forms, ${byKana.size} kana forms`);

// Load vocabulary
console.log("Loading vocabulary...");
const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf-8"));
console.log(`Loaded ${vocab.length} vocabulary items`);

// Process
const report = {
	total: vocab.length,
	matched: 0,
	unmatched: 0,
	posAdded: 0,
	posSkipped: 0,
	readingMismatch: [],
	meaningLowOverlap: [],
	ambiguousMatches: [],
	unmatchedItems: [],
};

let modified = 0;

// Normalize text for lookup: strip parenthetical annotations, tildes, asterisks
function normalizeText(text) {
	if (!text) return text;
	return text
		.replace(/（[^）]*）/g, "") // Remove fullwidth parens and contents
		.replace(/\([^)]*\)/g, "") // Remove ASCII parens and contents
		.replace(/[〜～*]/g, "") // Remove tilde prefixes and asterisks
		.trim();
}

for (const item of vocab) {
	const rawText = item.primary_text;
	const rawReading = item.reading;
	const text = normalizeText(rawText);
	const reading = normalizeText(rawReading);

	// Try matching by kanji form first (exact, then normalized), then by kana
	let candidates = byKanji.get(rawText) || byKanji.get(text) || [];
	if (candidates.length === 0) {
		candidates = byKana.get(rawText) || byKana.get(text) || [];
	}
	// Also try reading as kana lookup
	if (candidates.length === 0 && reading) {
		candidates = byKana.get(reading) || [];
	}

	if (candidates.length === 0) {
		report.unmatched++;
		report.unmatchedItems.push({
			text: rawText,
			normalized: text !== rawText ? text : undefined,
			reading: rawReading,
			meaning: item.meaning?.slice(0, 50),
		});
		continue;
	}

	// Disambiguate: pick best match by meaning overlap
	let bestMatch = candidates[0];
	let bestOverlap = 0;

	if (candidates.length > 1) {
		for (const c of candidates) {
			const glosses = c.sense.flatMap((s) => s.gloss);
			const overlap = computeMeaningOverlap(item.meaning, glosses);
			if (overlap > bestOverlap) {
				bestOverlap = overlap;
				bestMatch = c;
			}
		}

		// Also try reading match as tiebreaker
		if (bestOverlap < 0.3 && reading) {
			const readingMatch = candidates.find((c) => c.kana.some((k) => k.text === reading));
			if (readingMatch) {
				const glosses = readingMatch.sense.flatMap((s) => s.gloss);
				const overlap = computeMeaningOverlap(item.meaning, glosses);
				if (overlap >= bestOverlap) {
					bestMatch = readingMatch;
					bestOverlap = overlap;
				}
			}
		}

		if (bestOverlap < 0.2) {
			report.ambiguousMatches.push({
				text,
				reading,
				candidateCount: candidates.length,
				bestOverlap: Math.round(bestOverlap * 100),
			});
		}
	}

	report.matched++;

	// Validate reading
	const jmdictReadings = bestMatch.kana.map((k) => k.text);
	if (reading && !jmdictReadings.includes(reading)) {
		report.readingMismatch.push({
			text,
			ours: reading,
			jmdict: jmdictReadings.slice(0, 3),
		});
	}

	// Check meaning overlap
	const glosses = bestMatch.sense.flatMap((s) => s.gloss);
	const overlap = computeMeaningOverlap(item.meaning, glosses);
	if (overlap < 0.2 && item.meaning) {
		report.meaningLowOverlap.push({
			text,
			ours: item.meaning?.slice(0, 60),
			jmdict: glosses
				.slice(0, 3)
				.map((g) => g.text)
				.join("; "),
			overlap: Math.round(overlap * 100),
		});
	}

	// Enrich part_of_speech if missing
	if (!item.part_of_speech || item.part_of_speech.trim() === "") {
		const allPosTags = bestMatch.sense.flatMap((s) => s.partOfSpeech);
		const uniqueTags = [...new Set(allPosTags)];
		const pos = normalizePos(uniqueTags, tagsDict);
		if (pos) {
			item.part_of_speech = pos;
			report.posAdded++;
			modified++;
		} else {
			report.posSkipped++;
		}
	} else {
		report.posSkipped++;
	}
}

// Write updated vocabulary
if (modified > 0) {
	console.log(`Writing ${modified} updates to vocabulary.json...`);
	writeFileSync(VOCAB_PATH, JSON.stringify(vocab, null, 2), "utf-8");
}

// Write report
mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = join(REPORT_DIR, "jmdict-enrichment.json");

// Truncate large arrays for readability
const reportOutput = {
	...report,
	unmatchedItems: report.unmatchedItems.slice(0, 100),
	unmatchedItemsTotal: report.unmatchedItems.length,
	readingMismatch: report.readingMismatch.slice(0, 50),
	readingMismatchTotal: report.readingMismatch.length,
	meaningLowOverlap: report.meaningLowOverlap.slice(0, 50),
	meaningLowOverlapTotal: report.meaningLowOverlap.length,
	ambiguousMatches: report.ambiguousMatches.slice(0, 50),
	ambiguousMatchesTotal: report.ambiguousMatches.length,
};

writeFileSync(reportPath, JSON.stringify(reportOutput, null, 2), "utf-8");

console.log("\n=== JMDict Enrichment Report ===");
console.log(`Total items:        ${report.total}`);
console.log(`Matched:            ${report.matched}`);
console.log(`Unmatched:          ${report.unmatched}`);
console.log(`PoS added:          ${report.posAdded}`);
console.log(`PoS already set:    ${report.posSkipped}`);
console.log(`Reading mismatches: ${report.readingMismatch.length}`);
console.log(`Low meaning overlap:${report.meaningLowOverlap.length}`);
console.log(`Ambiguous matches:  ${report.ambiguousMatches.length}`);
console.log(`\nFull report: ${reportPath}`);
