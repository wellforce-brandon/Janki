/**
 * Deck Analysis Script
 *
 * Parses all .apkg files in the Decks folder and outputs a structured
 * analysis of each deck: models, field names, note counts, tags, media stats,
 * and sample notes. Used to plan the merge/dedup pipeline.
 *
 * Usage: node scripts/analyze-decks.mjs [decks-folder] [output-file]
 * Defaults: decks-folder = C:\Users\B_StL\OneDrive\Desktop\Personal\Dev\Janki\Decks
 *           output-file  = data/deck-analysis.json
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, basename, dirname } from "path";
import JSZip from "jszip";
import initSqlJs from "sql.js";

const DECKS_FOLDER =
	process.argv[2] ||
	"C:\\Users\\B_StL\\OneDrive\\Desktop\\Personal\\Dev\\Janki\\Decks";
const OUTPUT_FILE = process.argv[3] || "data/deck-analysis.json";

// ── Anki parsing (ported from src/lib/import/apkg-parser.ts) ──

function extractModels(db) {
	const result = db.exec("SELECT models FROM col LIMIT 1");
	if (result.length === 0 || result[0].values.length === 0) return [];

	const modelsJson = JSON.parse(result[0].values[0][0]);
	const models = [];

	for (const [id, model] of Object.entries(modelsJson)) {
		models.push({
			id: Number(id),
			name: model.name,
			fields: (model.flds || [])
				.sort((a, b) => a.ord - b.ord)
				.map((f) => ({ name: f.name, ord: f.ord })),
			templateCount: (model.tmpls || []).length,
		});
	}
	return models;
}

function extractNotes(db) {
	const result = db.exec("SELECT id, mid, flds, tags FROM notes");
	if (result.length === 0) return [];

	return result[0].values.map((row) => ({
		id: row[0],
		mid: row[1],
		fields: String(row[2]).split("\x1f"),
		tags: String(row[3])
			.trim()
			.split(/\s+/)
			.filter((t) => t.length > 0),
	}));
}

function extractDeckName(db) {
	try {
		const result = db.exec("SELECT decks FROM col LIMIT 1");
		if (result.length === 0) return "Unknown";
		const decksJson = JSON.parse(result[0].values[0][0]);
		for (const deck of Object.values(decksJson)) {
			if (deck.name && deck.name !== "Default") return deck.name;
		}
		return "Unknown";
	} catch {
		return "Unknown";
	}
}

function extractMediaStats(zip) {
	const mediaFile = zip.file("media");
	if (!mediaFile) return { totalFiles: 0, byExtension: {} };

	// Media mapping is synchronous-readable from the zip
	// but we need async -- handled in the caller
	return null; // placeholder, computed async in analyzeApkg
}

// Strip HTML tags for cleaner sample display
function stripHtml(html) {
	return String(html || "")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.trim();
}

async function analyzeApkg(filePath) {
	const fileBytes = readFileSync(filePath);
	const zip = await JSZip.loadAsync(fileBytes);

	const dbFile = zip.file("collection.anki21") || zip.file("collection.anki2");
	if (!dbFile) {
		return { error: "No collection database found in .apkg" };
	}

	const dbBytes = await dbFile.async("uint8array");
	const SQL = await initSqlJs();
	const db = new SQL.Database(dbBytes);

	try {
		const models = extractModels(db);
		const notes = extractNotes(db);
		const deckName = extractDeckName(db);

		// Media stats
		let mediaStats = { totalFiles: 0, byExtension: {}, totalSizeBytes: 0 };
		const mediaFile = zip.file("media");
		if (mediaFile) {
			try {
				const mediaJson = JSON.parse(await mediaFile.async("string"));
				const entries = Object.entries(mediaJson);
				mediaStats.totalFiles = entries.length;
				for (const [index, originalName] of entries) {
					const ext = String(originalName).split(".").pop()?.toLowerCase() || "unknown";
					mediaStats.byExtension[ext] = (mediaStats.byExtension[ext] || 0) + 1;
					const file = zip.file(index);
					if (file) {
						const info = zip.files[index];
						mediaStats.totalSizeBytes += info._data?.uncompressedSize || 0;
					}
				}
			} catch {
				// No valid media mapping
			}
		}

		// Collect all unique tags
		const allTags = new Set();
		for (const note of notes) {
			for (const tag of note.tags) {
				allTags.add(tag);
			}
		}

		// Per-model analysis
		const modelAnalysis = models.map((model) => {
			const modelNotes = notes.filter((n) => n.mid === model.id);

			// Sample 3 notes, stripped of HTML
			const samples = modelNotes.slice(0, 3).map((note) => {
				const fieldMap = {};
				model.fields.forEach((f, i) => {
					const raw = note.fields[i] || "";
					const clean = stripHtml(raw);
					// Truncate long fields
					fieldMap[f.name] = clean.length > 200 ? clean.slice(0, 200) + "..." : clean;
				});
				return { tags: note.tags, fields: fieldMap };
			});

			// Field fill rates (what % of notes have non-empty values for each field)
			const fieldFillRates = {};
			model.fields.forEach((f, i) => {
				const filled = modelNotes.filter(
					(n) => n.fields[i] && stripHtml(n.fields[i]).length > 0,
				).length;
				fieldFillRates[f.name] = modelNotes.length > 0
					? Math.round((filled / modelNotes.length) * 100)
					: 0;
			});

			return {
				modelId: model.id,
				modelName: model.name,
				fieldNames: model.fields.map((f) => f.name),
				templateCount: model.templateCount,
				noteCount: modelNotes.length,
				fieldFillRates,
				samples,
			};
		});

		return {
			fileName: basename(filePath),
			deckName,
			totalNotes: notes.length,
			modelCount: models.length,
			models: modelAnalysis,
			tags: [...allTags].sort(),
			mediaStats,
		};
	} finally {
		db.close();
	}
}

// ── Main ──

async function main() {
	console.log(`Scanning decks in: ${DECKS_FOLDER}`);

	const files = readdirSync(DECKS_FOLDER).filter((f) => f.endsWith(".apkg"));
	console.log(`Found ${files.length} .apkg files\n`);

	const results = [];

	for (const file of files) {
		const filePath = join(DECKS_FOLDER, file);
		const fileSize = statSync(filePath).size;
		const sizeMB = (fileSize / 1024 / 1024).toFixed(1);

		process.stdout.write(`Analyzing ${file} (${sizeMB} MB)... `);

		try {
			const analysis = await analyzeApkg(filePath);
			analysis.fileSizeMB = parseFloat(sizeMB);
			results.push(analysis);
			console.log(
				`OK -- ${analysis.totalNotes} notes, ${analysis.modelCount} model(s), ${analysis.mediaStats?.totalFiles || 0} media`,
			);
		} catch (err) {
			console.log(`ERROR: ${err.message}`);
			results.push({
				fileName: file,
				fileSizeMB: parseFloat(sizeMB),
				error: err.message,
			});
		}
	}

	// Write full analysis
	mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
	writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
	console.log(`\nFull analysis written to ${OUTPUT_FILE}`);

	// Print summary table
	console.log("\n=== SUMMARY ===\n");
	console.log(
		"Deck".padEnd(60) +
			"Notes".padStart(8) +
			"Models".padStart(8) +
			"Media".padStart(8) +
			"Size MB".padStart(10),
	);
	console.log("-".repeat(94));

	let totalNotes = 0;
	let totalMedia = 0;

	for (const r of results) {
		if (r.error) {
			console.log(`${r.fileName.padEnd(60)} ERROR: ${r.error}`);
			continue;
		}
		const notes = r.totalNotes || 0;
		const media = r.mediaStats?.totalFiles || 0;
		totalNotes += notes;
		totalMedia += media;
		console.log(
			(r.deckName || r.fileName).slice(0, 58).padEnd(60) +
				String(notes).padStart(8) +
				String(r.modelCount).padStart(8) +
				String(media).padStart(8) +
				String(r.fileSizeMB).padStart(10),
		);
	}

	console.log("-".repeat(94));
	console.log(
		"TOTAL".padEnd(60) +
			String(totalNotes).padStart(8) +
			"".padStart(8) +
			String(totalMedia).padStart(8),
	);

	// Print field names per model for quick reference
	console.log("\n=== FIELD NAMES BY MODEL ===\n");
	for (const r of results) {
		if (r.error || !r.models) continue;
		for (const m of r.models) {
			console.log(`[${r.deckName}] ${m.modelName} (${m.noteCount} notes):`);
			for (const fname of m.fieldNames) {
				const fill = m.fieldFillRates[fname];
				console.log(`  - ${fname} (${fill}% filled)`);
			}
			console.log();
		}
	}
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
