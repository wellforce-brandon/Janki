/**
 * KanjiAPI Validation Script
 *
 * Validates kanji metadata against kanjiapi.dev. Produces a validation
 * report -- does NOT auto-modify seed files.
 *
 * Usage: node scripts/enrich-kanjiapi.mjs [vocab-path]
 * Defaults:
 *   vocab-path = public/data/language/vocabulary.json
 *
 * API: https://kanjiapi.dev (free, no auth, no documented rate limits)
 * Responses are cached locally in scripts/.cache/kanjiapi/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// ── Config ──────────────────────────────────────────────────────────────────

const VOCAB_PATH = process.argv[2] || "public/data/language/vocabulary.json";
const CACHE_DIR = "scripts/.cache/kanjiapi";
const REPORT_DIR = "scripts/reports";
const API_BASE = "https://kanjiapi.dev/v1";
const DELAY_MS = 100;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractKanji(text) {
	// Match CJK Unified Ideographs
	const matches = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g);
	return matches ? [...new Set(matches)] : [];
}

async function fetchKanji(char) {
	const cacheFile = join(CACHE_DIR, `${char.codePointAt(0).toString(16)}.json`);

	if (existsSync(cacheFile)) {
		return JSON.parse(readFileSync(cacheFile, "utf-8"));
	}

	const url = `${API_BASE}/kanji/${encodeURIComponent(char)}`;
	const res = await fetch(url);

	if (!res.ok) {
		if (res.status === 404) {
			// Not in database -- cache the miss
			const miss = { error: "not_found", kanji: char };
			writeFileSync(cacheFile, JSON.stringify(miss), "utf-8");
			return miss;
		}
		throw new Error(`API error ${res.status} for ${char}: ${res.statusText}`);
	}

	const data = await res.json();
	writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf-8");
	await sleep(DELAY_MS);
	return data;
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(CACHE_DIR, { recursive: true });
mkdirSync(REPORT_DIR, { recursive: true });

console.log("Loading vocabulary...");
const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf-8"));
console.log(`Loaded ${vocab.length} vocabulary items`);

// Collect unique kanji from all vocab items
const allKanji = new Set();
for (const item of vocab) {
	for (const k of extractKanji(item.primary_text)) {
		allKanji.add(k);
	}
}
console.log(`Found ${allKanji.size} unique kanji across vocabulary`);

// Fetch kanji data
const kanjiData = new Map();
let fetched = 0;
let cached = 0;
let notFound = 0;

for (const k of allKanji) {
	const cacheFile = join(CACHE_DIR, `${k.codePointAt(0).toString(16)}.json`);
	const wasCached = existsSync(cacheFile);

	try {
		const data = await fetchKanji(k);
		if (data.error === "not_found") {
			notFound++;
		} else {
			kanjiData.set(k, data);
		}
		if (wasCached) cached++;
		else fetched++;
	} catch (err) {
		console.error(`Failed to fetch ${k}: ${err.message}`);
	}

	if (fetched > 0 && fetched % 100 === 0) {
		console.log(`Fetched ${fetched} kanji (${cached} from cache)...`);
	}
}

console.log(
	`Done: ${kanjiData.size} kanji loaded, ${notFound} not found, ${cached} from cache, ${fetched} new fetches`,
);

// Build validation report
const report = {
	totalKanji: allKanji.size,
	foundInApi: kanjiData.size,
	notInApi: notFound,
	kanjiDetails: [],
	jlptDistribution: {},
	gradeDistribution: {},
	missingFromApi: [],
};

// Analyze each kanji
for (const [char, data] of kanjiData) {
	const entry = {
		kanji: char,
		meanings: data.meanings || [],
		onReadings: data.on_readings || [],
		kunReadings: data.kun_readings || [],
		jlpt: data.jlpt || null,
		grade: data.grade || null,
		strokeCount: data.stroke_count || null,
		unicode: data.unicode || null,
		newspaperFreq: data.newspaper_frequency || null,
	};

	report.kanjiDetails.push(entry);

	// Count JLPT distribution
	const jlptKey = entry.jlpt ? `N${entry.jlpt}` : "none";
	report.jlptDistribution[jlptKey] = (report.jlptDistribution[jlptKey] || 0) + 1;

	// Count grade distribution
	const gradeKey = entry.grade ? `grade${entry.grade}` : "none";
	report.gradeDistribution[gradeKey] = (report.gradeDistribution[gradeKey] || 0) + 1;
}

// Find kanji not in the API
for (const k of allKanji) {
	if (!kanjiData.has(k)) {
		report.missingFromApi.push(k);
	}
}

// Cross-validate vocab items that are single kanji
const singleKanjiValidation = [];
for (const item of vocab) {
	const kanji = extractKanji(item.primary_text);
	if (kanji.length !== 1 || item.primary_text.length !== 1) continue;

	const char = kanji[0];
	const apiData = kanjiData.get(char);
	if (!apiData) continue;

	const issues = [];

	// Check if our reading matches any API reading
	if (item.reading) {
		const allReadings = [
			...(apiData.on_readings || []),
			...(apiData.kun_readings || []).map((r) => r.replace(/\..+/, "")),
		];
		const ourReading = item.reading.replace(/\..+/, "");
		if (!allReadings.some((r) => r === ourReading || r === item.reading)) {
			issues.push({
				type: "reading",
				ours: item.reading,
				api: allReadings.slice(0, 5),
			});
		}
	}

	// Check JLPT level
	if (item.jlpt_level && apiData.jlpt) {
		const ourJlpt = parseInt(item.jlpt_level.replace("N", ""), 10);
		if (ourJlpt !== apiData.jlpt) {
			issues.push({
				type: "jlpt",
				ours: item.jlpt_level,
				api: `N${apiData.jlpt}`,
			});
		}
	}

	if (issues.length > 0) {
		singleKanjiValidation.push({
			text: item.primary_text,
			reading: item.reading,
			meaning: item.meaning?.slice(0, 40),
			issues,
		});
	}
}

report.singleKanjiValidation = singleKanjiValidation;
report.singleKanjiConflicts = singleKanjiValidation.length;

// Write report
const reportPath = join(REPORT_DIR, "kanjiapi-validation.json");

// Write a summary version (without the full kanjiDetails for readability)
const summaryReport = {
	totalKanji: report.totalKanji,
	foundInApi: report.foundInApi,
	notInApi: report.notInApi,
	jlptDistribution: report.jlptDistribution,
	gradeDistribution: report.gradeDistribution,
	singleKanjiConflicts: report.singleKanjiConflicts,
	singleKanjiValidation: report.singleKanjiValidation,
	missingFromApi: report.missingFromApi,
};
writeFileSync(reportPath, JSON.stringify(summaryReport, null, 2), "utf-8");

// Write full data (including all kanji details)
const fullReportPath = join(REPORT_DIR, "kanjiapi-full.json");
writeFileSync(fullReportPath, JSON.stringify(report, null, 2), "utf-8");

console.log("\n=== KanjiAPI Validation Report ===");
console.log(`Total unique kanji:      ${report.totalKanji}`);
console.log(`Found in API:            ${report.foundInApi}`);
console.log(`Not in API:              ${report.notInApi}`);
console.log(`JLPT distribution:       ${JSON.stringify(report.jlptDistribution)}`);
console.log(`Grade distribution:      ${JSON.stringify(report.gradeDistribution)}`);
console.log(`Single-kanji conflicts:  ${report.singleKanjiConflicts}`);
console.log(`\nSummary report: ${reportPath}`);
console.log(`Full report:    ${fullReportPath}`);
