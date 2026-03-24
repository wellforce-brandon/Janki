/**
 * Frequency Rank Enrichment Script
 *
 * Replaces frequency_rank=0 placeholders in vocabulary.json with real
 * corpus frequency ranks from a TSV frequency list.
 *
 * Usage: node scripts/enrich-frequency.mjs [freq-path] [vocab-path]
 * Defaults:
 *   freq-path  = scripts/data/frequency.tsv
 *   vocab-path = public/data/language/vocabulary.json
 *
 * The TSV file should have columns: word, reading, rank
 * (tab-separated, no header row, or header row starting with #)
 *
 * Compatible sources:
 * - Innocent Corpus: https://github.com/wareya/jpfreq
 * - Wikipedia JP: https://github.com/scriptin/wikipedia-word-frequency-jp
 * - jpdb community export
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const FREQ_PATH = process.argv[2] || "scripts/data/jpdb-freq.csv";
const VOCAB_PATH = process.argv[3] || "public/data/language/vocabulary.json";
const REPORT_DIR = "scripts/reports";

// ── Main ─────────────────────────────────────────────────────────────────────

if (!existsSync(FREQ_PATH)) {
	console.error(`Frequency file not found: ${FREQ_PATH}`);
	console.error("Place a TSV file with columns: word, reading, rank");
	console.error("Compatible sources:");
	console.error("  - https://github.com/wareya/jpfreq (Innocent Corpus)");
	console.error(
		"  - https://github.com/scriptin/wikipedia-word-frequency-jp",
	);
	process.exit(1);
}

// Parse frequency list
console.log("Loading frequency data...");
const freqRaw = readFileSync(FREQ_PATH, "utf-8");
const freqLines = freqRaw.split("\n").filter((l) => l.trim());

// Detect and skip header row
let startIndex = 0;
const firstLine = freqLines[0];
if (firstLine && /^[a-zA-Z]/.test(firstLine)) {
	console.log(`Skipping header: ${firstLine}`);
	startIndex = 1;
}

// Build lookup: word -> Map<reading|"*", rank>
// Supports formats:
//   2-col: word, rank
//   3-col: word, reading, rank
//   4-col: term, reading, frequency, kana_frequency (JPDB v2.2)
const freqByWord = new Map();

const sampleParts = freqLines[startIndex]?.split("\t") || [];
const detectedCols = sampleParts.length;
console.log(`Detected ${detectedCols}-column format`);

for (let i = startIndex; i < freqLines.length; i++) {
	const parts = freqLines[i].split("\t").map((s) => s.trim());

	let word, reading, rank;
	if (detectedCols >= 4) {
		// JPDB format: term, reading, frequency, kana_frequency
		[word, reading, rank] = parts;
	} else if (detectedCols === 3) {
		[word, reading, rank] = parts;
	} else {
		[word, rank] = parts;
		reading = "*";
	}

	if (!reading) reading = "*";
	const rankNum = parseInt(rank, 10);
	if (!word || isNaN(rankNum)) continue;

	if (!freqByWord.has(word)) {
		freqByWord.set(word, new Map());
	}
	const readingMap = freqByWord.get(word);
	// Keep the best (lowest) rank for each word+reading pair
	const existing = readingMap.get(reading);
	if (!existing || rankNum < existing) {
		readingMap.set(reading, rankNum);
	}
}

console.log(`Loaded ${freqByWord.size} unique words from frequency list`);

// Load vocabulary
console.log("Loading vocabulary...");
const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf-8"));
console.log(`Loaded ${vocab.length} vocabulary items`);

// Process
const report = {
	total: vocab.length,
	alreadyHasRank: 0,
	updated: 0,
	noMatch: 0,
	matchedByReading: 0,
	matchedByWildcard: 0,
	unmatchedSamples: [],
};

let modified = 0;

for (const item of vocab) {
	// Only update items with placeholder rank (0 or null)
	if (item.frequency_rank && item.frequency_rank > 0) {
		report.alreadyHasRank++;
		continue;
	}

	const text = item.primary_text;
	const reading = item.reading;

	const readingMap = freqByWord.get(text);
	if (!readingMap) {
		report.noMatch++;
		if (report.unmatchedSamples.length < 100) {
			report.unmatchedSamples.push({
				text,
				reading,
				meaning: item.meaning?.slice(0, 40),
			});
		}
		continue;
	}

	// Try exact reading match first
	let rank = readingMap.get(reading);
	if (rank !== undefined) {
		report.matchedByReading++;
	} else {
		// Try wildcard (2-column format) or first available
		rank = readingMap.get("*");
		if (rank !== undefined) {
			report.matchedByWildcard++;
		} else {
			// Take the best rank among all readings for this word
			rank = Math.min(...readingMap.values());
			report.matchedByWildcard++;
		}
	}

	item.frequency_rank = rank;
	report.updated++;
	modified++;
}

// Write updated vocabulary
if (modified > 0) {
	console.log(`Writing ${modified} updates to vocabulary.json...`);
	writeFileSync(VOCAB_PATH, JSON.stringify(vocab, null, 2), "utf-8");
}

// Write report
mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = join(REPORT_DIR, "frequency-enrichment.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== Frequency Enrichment Report ===");
console.log(`Total items:         ${report.total}`);
console.log(`Already had rank:    ${report.alreadyHasRank}`);
console.log(`Updated:             ${report.updated}`);
console.log(`  By reading match:  ${report.matchedByReading}`);
console.log(`  By wildcard/best:  ${report.matchedByWildcard}`);
console.log(`No match in corpus:  ${report.noMatch}`);
console.log(`\nFull report: ${reportPath}`);
