/**
 * WaniKani API v2 Subject Export
 *
 * Fetches all subjects from the WaniKani API and writes enriched JSON files
 * to public/data/ for use as Janki seed data.
 *
 * Usage: WK_API_TOKEN=<token> node scripts/wk-api-export.mjs
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../public/data");

const API_BASE = "https://api.wanikani.com/v2";
const TOKEN = process.env.WK_API_TOKEN;

if (!TOKEN) {
	console.error("Error: WK_API_TOKEN environment variable is required");
	console.error("Usage: WK_API_TOKEN=<token> node scripts/wk-api-export.mjs");
	process.exit(1);
}

const headers = {
	Authorization: `Bearer ${TOKEN}`,
	"Wanikani-Revision": "20170710",
};

async function fetchAllSubjects() {
	const subjects = [];
	let url = `${API_BASE}/subjects`;
	let page = 1;

	while (url) {
		console.log(`Fetching page ${page}...`);
		const res = await fetch(url, { headers });

		if (!res.ok) {
			console.error(`API error ${res.status}: ${await res.text()}`);
			process.exit(1);
		}

		const json = await res.json();
		subjects.push(...json.data);
		url = json.pages.next_url;
		page++;
	}

	console.log(`Fetched ${subjects.length} total subjects across ${page - 1} pages`);
	return subjects;
}

function extractRadical(subject) {
	const d = subject.data;
	return {
		id: subject.id,
		level: d.level,
		character: d.characters,
		slug: d.slug,
		meanings: d.meanings.map((m) => ({
			meaning: m.meaning,
			primary: m.primary,
			accepted: m.accepted_answer,
		})),
		auxiliary_meanings: d.auxiliary_meanings || [],
		meaning_mnemonic: d.meaning_mnemonic,
		image_url: null,
		character_images: d.character_images || [],
		amalgamation_subject_ids: d.amalgamation_subject_ids || [],
	};
}

function extractKanji(subject) {
	const d = subject.data;
	return {
		id: subject.id,
		level: d.level,
		character: d.characters,
		slug: d.slug,
		meanings: d.meanings.map((m) => ({
			meaning: m.meaning,
			primary: m.primary,
			accepted: m.accepted_answer,
		})),
		auxiliary_meanings: d.auxiliary_meanings || [],
		readings: d.readings.map((r) => ({
			reading: r.reading,
			type: r.type,
			primary: r.primary,
			accepted: r.accepted_answer,
		})),
		meaning_mnemonic: d.meaning_mnemonic,
		reading_mnemonic: d.reading_mnemonic,
		meaning_hint: d.meaning_hint || null,
		reading_hint: d.reading_hint || null,
		component_subject_ids: d.component_subject_ids || [],
		amalgamation_subject_ids: d.amalgamation_subject_ids || [],
		visually_similar_subject_ids: d.visually_similar_subject_ids || [],
	};
}

function extractVocabulary(subject) {
	const d = subject.data;
	return {
		id: subject.id,
		object: subject.object,
		level: d.level,
		character: d.characters,
		slug: d.slug,
		meanings: d.meanings.map((m) => ({
			meaning: m.meaning,
			primary: m.primary,
			accepted: m.accepted_answer,
		})),
		auxiliary_meanings: d.auxiliary_meanings || [],
		readings: (d.readings || []).map((r) => ({
			reading: r.reading,
			primary: r.primary,
			accepted: r.accepted_answer,
		})),
		meaning_mnemonic: d.meaning_mnemonic,
		reading_mnemonic: d.reading_mnemonic || null,
		component_subject_ids: d.component_subject_ids || [],
		parts_of_speech: d.parts_of_speech || [],
		context_sentences: d.context_sentences || [],
		pronunciation_audios: d.pronunciation_audios || [],
	};
}

async function main() {
	console.log("WaniKani API v2 Subject Export");
	console.log("=============================\n");

	const allSubjects = await fetchAllSubjects();

	const radicals = [];
	const kanji = [];
	const vocabulary = [];
	let skipped = 0;

	for (const subject of allSubjects) {
		// Skip hidden subjects
		if (subject.data.hidden_at) {
			skipped++;
			continue;
		}

		switch (subject.object) {
			case "radical":
				radicals.push(extractRadical(subject));
				break;
			case "kanji":
				kanji.push(extractKanji(subject));
				break;
			case "vocabulary":
			case "kana_vocabulary":
				vocabulary.push(extractVocabulary(subject));
				break;
			default:
				console.warn(`Unknown subject type: ${subject.object}`);
		}
	}

	// Sort by id for consistency
	radicals.sort((a, b) => a.id - b.id);
	kanji.sort((a, b) => a.id - b.id);
	vocabulary.sort((a, b) => a.id - b.id);

	// Write files
	const radFile = resolve(OUTPUT_DIR, "wk-radicals.json");
	const kanjiFile = resolve(OUTPUT_DIR, "wk-kanji.json");
	const vocabFile = resolve(OUTPUT_DIR, "wk-vocabulary.json");

	writeFileSync(radFile, JSON.stringify(radicals, null, 1));
	writeFileSync(kanjiFile, JSON.stringify(kanji, null, 1));
	writeFileSync(vocabFile, JSON.stringify(vocabulary, null, 1));

	console.log("\n--- Summary ---");
	console.log(`Radicals:   ${radicals.length} items (${(Buffer.byteLength(JSON.stringify(radicals)) / 1024).toFixed(0)} KB)`);
	console.log(`Kanji:      ${kanji.length} items (${(Buffer.byteLength(JSON.stringify(kanji)) / 1024).toFixed(0)} KB)`);
	console.log(`Vocabulary: ${vocabulary.length} items (${(Buffer.byteLength(JSON.stringify(vocabulary)) / 1024).toFixed(0)} KB)`);
	if (skipped > 0) console.log(`Skipped:    ${skipped} hidden subjects`);

	const kanaVocab = vocabulary.filter((v) => v.object === "kana_vocabulary");
	if (kanaVocab.length > 0) {
		console.log(`  (includes ${kanaVocab.length} kana_vocabulary items)`);
	}

	console.log(`\nFiles written to: ${OUTPUT_DIR}`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
