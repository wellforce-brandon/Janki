/**
 * Language DB Build Pipeline
 *
 * Parses all 27 .apkg files, applies field mappings, deduplicates,
 * merges overlapping items (best source wins), extracts media,
 * and outputs seed JSON for the language_items table.
 *
 * Usage: node scripts/build-language-db.mjs [decks-folder] [output-dir]
 * Defaults:
 *   decks-folder = C:\Users\B_StL\OneDrive\Desktop\Personal\Dev\Janki\Decks
 *   output-dir   = public/data/language
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import JSZip from "jszip";
import initSqlJs from "sql.js";

// ── Config ──────────────────────────────────────────────────────────────────

const DECKS_FOLDER =
	process.argv[2] || "C:\\Users\\B_StL\\OneDrive\\Desktop\\Personal\\Dev\\Janki\\Decks";
const OUTPUT_DIR = process.argv[3] || "public/data/language";
const MEDIA_DIR = join(OUTPUT_DIR, "media");
const MAPPINGS_FILE = "data/field-mappings.json";

// ── Load field mappings ─────────────────────────────────────────────────────

const fieldMappings = JSON.parse(readFileSync(MAPPINGS_FILE, "utf-8"));

// ── HTML Stripping ──────────────────────────────────────────────────────────

const HTML_ENTITIES = {
	"&nbsp;": " ",
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
	"&#x27;": "'",
	"&#x2F;": "/",
	"&#34;": '"',
	"&#38;": "&",
	"&#60;": "<",
	"&#62;": ">",
};

function stripHtml(html) {
	if (!html) return "";
	let text = String(html);
	// Remove sound/image tags first: [sound:file.mp3], <img ...>
	text = text.replace(/\[sound:[^\]]*\]/g, "");
	text = text.replace(/<img[^>]*>/gi, "");
	// Remove all HTML tags
	text = text.replace(/<br\s*\/?>/gi, "\n");
	text = text.replace(
		/<\/?(div|p|li|ul|ol|tr|td|th|table|span|a|b|i|u|em|strong|ruby|rt|rp|sup|sub|font|center|blockquote|pre|code|h[1-6])[^>]*>/gi,
		"\n",
	);
	text = text.replace(/<[^>]*>/g, "");
	// Decode HTML entities
	for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
		text = text.replaceAll(entity, char);
	}
	// Decode numeric entities
	text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
	text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
	// Normalize whitespace
	text = text.replace(/\r\n/g, "\n");
	text = text.replace(/[ \t]+/g, " ");
	text = text.replace(/\n{3,}/g, "\n\n");
	return text.trim();
}

/**
 * Extract audio file references from field text.
 * Returns array of filenames like ["file.mp3", "file2.ogg"]
 */
function extractAudioRefs(text) {
	if (!text) return [];
	const refs = [];
	const re = /\[sound:([^\]]+)\]/g;
	let m;
	while ((m = re.exec(text)) !== null) {
		refs.push(m[1].trim());
	}
	return refs;
}

/**
 * Extract image file references from field text.
 * Returns array of filenames.
 */
function extractImageRefs(text) {
	if (!text) return [];
	const refs = [];
	const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
	let m;
	while ((m = re.exec(text)) !== null) {
		refs.push(m[1].trim());
	}
	return refs;
}

// ── Normalization for dedup keys ────────────────────────────────────────────

/**
 * Normalize Japanese text for dedup: strip whitespace, normalize Unicode,
 * remove common punctuation variance.
 */
function normalizeJapanese(text) {
	if (!text) return "";
	let t = stripHtml(text);
	// Normalize Unicode (NFC)
	t = t.normalize("NFC");
	// Remove furigana notation like 人[ひと] -> 人
	t = t.replace(/\[([^\]]*)\]/g, "");
	// Remove all whitespace
	t = t.replace(/\s+/g, "");
	// Normalize full-width to half-width for alphanumeric
	t = t.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
	// Lowercase
	t = t.toLowerCase();
	return t;
}

/**
 * Generate a dedup key based on content type.
 */
function makeDedupKey(contentType, item) {
	switch (contentType) {
		case "vocabulary": {
			// Primary: kanji form normalized. Fallback: reading.
			const primary = normalizeJapanese(item.primary_text);
			if (primary) return `vocab:${primary}`;
			const reading = normalizeJapanese(item.reading);
			if (reading) return `vocab:${reading}`;
			return null; // Can't dedup
		}
		case "grammar": {
			const pattern = normalizeJapanese(item.primary_text);
			if (pattern) return `grammar:${pattern}`;
			return null;
		}
		case "sentence": {
			const text = normalizeJapanese(item.primary_text);
			if (!text) return null;
			// Use hash for long sentences
			if (text.length > 50) {
				const hash = createHash("md5").update(text).digest("hex").slice(0, 12);
				return `sent:${hash}`;
			}
			return `sent:${text}`;
		}
		case "kana": {
			const ch = normalizeJapanese(item.primary_text);
			if (ch) return `kana:${ch}`;
			return null;
		}
		case "conjugation": {
			const stem = normalizeJapanese(item.primary_text);
			if (stem) return `conj:${stem}`;
			return null;
		}
		default:
			return null;
	}
}

// ── APKG Parsing (reused from analyze-decks.mjs) ───────────────────────────

function extractModels(db) {
	const result = db.exec("SELECT models FROM col LIMIT 1");
	if (result.length === 0 || result[0].values.length === 0) return [];

	const modelsJson = JSON.parse(result[0].values[0][0]);
	const models = [];
	for (const [id, model] of Object.entries(modelsJson)) {
		models.push({
			id: Number(id),
			name: model.name,
			fields: (model.flds || []).sort((a, b) => a.ord - b.ord).map((f) => f.name),
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

function _extractMediaMap(zip) {
	const mediaFile = zip.file("media");
	if (!mediaFile) return null;
	// We'll resolve this async in the caller
	return mediaFile;
}

async function parseApkg(filePath) {
	const fileBytes = readFileSync(filePath);
	const zip = await JSZip.loadAsync(fileBytes);

	const dbFile = zip.file("collection.anki21") || zip.file("collection.anki2");
	if (!dbFile) throw new Error("No collection database found");

	const dbBytes = await dbFile.async("uint8array");
	const SQL = await initSqlJs();
	const db = new SQL.Database(dbBytes);

	try {
		const models = extractModels(db);
		const notes = extractNotes(db);

		// Parse media mapping
		let mediaMap = {};
		const mediaFile = zip.file("media");
		if (mediaFile) {
			try {
				mediaMap = JSON.parse(await mediaFile.async("string"));
			} catch {
				/* no valid media */
			}
		}

		return { models, notes, mediaMap, zip };
	} finally {
		db.close();
	}
}

// ── JLPT Level Extraction ──────────────────────────────────────────────────

/**
 * Extract JLPT level from note tags based on the jlptSource config.
 */
function extractJlptLevel(note, modelConfig) {
	const source = modelConfig.jlptSource;
	if (!source || source === "none") return null;

	const tags = note.tags;

	if (source === "frequency_range") {
		// Infer from frequency rank -- rough JLPT mapping
		return null; // Will be assigned post-merge based on frequency
	}

	if (source === "n5") return "N5";
	if (source === "basic_grammar_is_n5") return "N5";
	if (source === "genki1_is_n5") return "N5";
	if (source === "genki2_is_n4") return "N4";

	if (source === "genki_chapter_to_jlpt") {
		// Genki 1 chapters = N5, Genki 2 = N4
		for (const t of tags) {
			if (
				t.includes("Genki_1") ||
				t.includes("Genki1") ||
				t.includes("L1_") ||
				t.includes("L2_") ||
				t.includes("L3_") ||
				t.includes("L4_") ||
				t.includes("L5_") ||
				t.includes("L6_") ||
				t.includes("L7_") ||
				t.includes("L8_") ||
				t.includes("L9_") ||
				t.includes("L10_") ||
				t.includes("L11_") ||
				t.includes("L12_")
			)
				return "N5";
			if (
				t.includes("Genki_2") ||
				t.includes("Genki2") ||
				t.includes("L13_") ||
				t.includes("L14_") ||
				t.includes("L15_") ||
				t.includes("L16_") ||
				t.includes("L17_") ||
				t.includes("L18_") ||
				t.includes("L19_") ||
				t.includes("L20_") ||
				t.includes("L21_") ||
				t.includes("L22_") ||
				t.includes("L23_")
			)
				return "N4";
		}
		return null;
	}

	// Tag-prefix based: FJSD uses nf tiers for frequency, map to JLPT
	if (source.startsWith("tags_prefix:")) {
		// Extract nf tier and map to JLPT
		for (const t of tags) {
			const nfMatch = t.match(/^word::common::nf(\d+)$/);
			if (nfMatch) {
				const tier = parseInt(nfMatch[1], 10);
				// nf01-02 (~1000 words) -> N5
				// nf03-06 (~2000 words) -> N4
				// nf07-12 (~3000 words) -> N3
				// nf13-20 (~4000 words) -> N2
				// nf21+                 -> N1
				if (tier <= 2) return "N5";
				if (tier <= 6) return "N4";
				if (tier <= 12) return "N3";
				if (tier <= 20) return "N2";
				return "N1";
			}
		}
		return null;
	}

	// Tag-based: "tags:grammar::n5,grammar::n4,..."
	if (source.startsWith("tags:")) {
		const tagPatterns = source.slice("tags:".length).split(",");
		for (const t of tags) {
			const lower = t.toLowerCase();
			// Check JLPT tags
			for (const pattern of tagPatterns) {
				if (
					lower.includes("n5") ||
					(pattern.includes("n5") && lower.includes(pattern.split("::")[0]))
				)
					return "N5";
			}
			if (lower.includes("n5")) return "N5";
			if (lower.includes("n4")) return "N4";
			if (lower.includes("n3")) return "N3";
			if (lower.includes("n2")) return "N2";
			if (lower.includes("n1")) return "N1";
			// Tae Kim specific
			if (lower === "basic-grammar" || lower === "basicgrammar") return "N5";
			if (lower === "essential-grammar" || lower === "essentialgrammar") return "N4";
			if (lower === "special-expressions" || lower === "specialexpressions") return "N2";
			// Kana
			if (lower === "hiragana" || lower === "katakana") return "N5";
			// Verb types (all assumed beginner)
			if (lower.startsWith("verb-")) return "N5";
		}
		return null;
	}

	return null;
}

// ── Field Mapping ───────────────────────────────────────────────────────────

/**
 * Apply field mapping to a raw Anki note, producing a semantic item object.
 */
function mapNoteToItem(note, ankiModel, modelConfig, deckConfig) {
	const fieldMap = modelConfig.fieldMap;
	if (!fieldMap) return null;

	const item = {
		_source_deck: deckConfig.fileName,
		_source_model: modelConfig.modelName,
		_priority: deckConfig.priority,
		_tags: note.tags,
	};

	// Map each Anki field to its semantic role
	for (const [ankiField, role] of Object.entries(fieldMap)) {
		if (role === "_skip") continue;

		// Find field index in the Anki model
		const fieldIndex = ankiModel.fields.indexOf(ankiField);
		if (fieldIndex === -1) continue;

		const rawValue = note.fields[fieldIndex] || "";
		if (!rawValue.trim()) continue;

		if (role.startsWith("_")) {
			// Internal/enrichment field -- store raw for later processing
			item[role] = rawValue;
			continue;
		}

		// Semantic role fields
		switch (role) {
			case "primary_text":
			case "reading":
			case "meaning":
			case "part_of_speech":
			case "formation":
			case "explanation":
			case "romaji":
			case "verb_group":
			case "context_notes":
			case "mnemonic":
				item[role] = stripHtml(rawValue);
				break;

			case "pitch_accent":
			case "stroke_order":
				// Keep some HTML for pitch accent display
				item[role] = rawValue;
				break;

			case "audio":
			case "sentence_audio": {
				const refs = extractAudioRefs(rawValue);
				if (refs.length > 0) {
					item[role] = refs;
				}
				break;
			}

			case "images": {
				const refs = extractImageRefs(rawValue);
				if (refs.length > 0) {
					item[role] = refs;
				}
				break;
			}

			case "example_sentence_ja":
			case "example_sentence_en":
			case "example_sentence_reading":
				item[role] = stripHtml(rawValue);
				break;

			case "frequency_rank": {
				const num = parseInt(stripHtml(rawValue), 10);
				if (!Number.isNaN(num)) item[role] = num;
				break;
			}

			case "tags_source":
			case "jlpt_source":
				item[role] = stripHtml(rawValue);
				break;

			default:
				item[role] = stripHtml(rawValue);
		}
	}

	return item;
}

// ── Tae Kim Grammar: Collapse Multiple Examples ─────────────────────────────

/**
 * For Tae Kim MIA grammar model, collapse Expression2-12 / Meaning2-12
 * into an example_sentences array.
 */
function collapseTaeKimExamples(item) {
	const examples = [];

	// First example is primary_text + meaning
	// Additional examples are in _example_N_ja / _example_N_en
	for (let i = 2; i <= 12; i++) {
		const ja = item[`_example_${i}_ja`];
		const en = item[`_example_${i}_en`];
		if (ja) {
			examples.push({
				ja: stripHtml(ja),
				en: en ? stripHtml(en) : "",
			});
		}
	}

	if (examples.length > 0) {
		item._extra_examples = examples;
	}

	// Clean up internal fields
	for (let i = 2; i <= 12; i++) {
		delete item[`_example_${i}_ja`];
		delete item[`_example_${i}_en`];
	}
}

// ── Conjugation: Collapse Verb Forms ────────────────────────────────────────

function collapseConjugationForms(item) {
	const forms = {};
	const baseNames = {
		_te_ta: "te_ta_form",
		_base1: "mizenkei",
		_base2: "renyoukei",
		_dictionary: "dictionary",
		_base4: "rentaikei",
		_base5: "kateikei",
	};

	for (const [key, formName] of Object.entries(baseNames)) {
		if (item[key]) {
			forms[formName] = stripHtml(item[key]);
			delete item[key];
		}
	}

	if (Object.keys(forms).length > 0) {
		item.conjugation_forms = forms;
	}
}

// ── Genki: Handle kana/kanji primary_text swap ──────────────────────────────

function fixGenkiPrimaryText(item) {
	// Genki 1/2 sound decks: when kanjis is empty, japanese_kana is primary
	if (!item.primary_text && item.reading) {
		item.primary_text = item.reading;
		item.reading = null;
	}
}

// ── Merge Engine ────────────────────────────────────────────────────────────

/**
 * Merge two items. `existing` is the current best; `incoming` may enrich it.
 * Fields from higher-priority sources (lower number) win for primary fields.
 * All sources contribute to enrichment fields.
 */
function mergeItems(existing, incoming) {
	const merged = { ...existing };

	// Track source decks
	const sources = new Set(existing.source_decks || []);
	sources.add(incoming._source_deck);
	merged.source_decks = [...sources];

	const existingPriority = existing._priority ?? 99;
	const incomingPriority = incoming._priority ?? 99;
	const incomingWins = incomingPriority < existingPriority;

	// Primary fields: higher priority wins (only if existing is empty or incoming is higher priority)
	const primaryFields = [
		"primary_text",
		"reading",
		"meaning",
		"part_of_speech",
		"formation",
		"explanation",
		"romaji",
		"verb_group",
	];

	for (const field of primaryFields) {
		if (!incoming[field]) continue;
		if (!merged[field] || incomingWins) {
			merged[field] = incoming[field];
		}
	}

	// Enrichment: accumulate from all sources (don't overwrite)
	const enrichFields = ["pitch_accent", "stroke_order", "mnemonic", "context_notes"];
	for (const field of enrichFields) {
		if (incoming[field] && !merged[field]) {
			merged[field] = incoming[field];
		}
	}

	// Frequency rank: prefer lower (more common)
	if (incoming.frequency_rank != null) {
		if (merged.frequency_rank == null || incoming.frequency_rank < merged.frequency_rank) {
			merged.frequency_rank = incoming.frequency_rank;
		}
	}

	// Audio: prefer having audio over not
	if (incoming.audio?.length > 0 && (!merged.audio || merged.audio.length === 0)) {
		merged.audio = incoming.audio;
	}

	// Images: accumulate
	if (incoming.images?.length > 0) {
		const existingImages = merged.images || [];
		const allImages = [...new Set([...existingImages, ...incoming.images])];
		merged.images = allImages;
	}

	// Example sentences: accumulate
	if (incoming.example_sentence_ja && incoming.example_sentence_ja !== merged.example_sentence_ja) {
		if (!merged.example_sentences) {
			merged.example_sentences = [];
		}
		// Add existing primary example if not yet in the array
		if (merged.example_sentence_ja && merged.example_sentences.length === 0) {
			merged.example_sentences.push({
				ja: merged.example_sentence_ja,
				en: merged.example_sentence_en || "",
				reading: merged.example_sentence_reading || "",
			});
		}
		merged.example_sentences.push({
			ja: incoming.example_sentence_ja,
			en: incoming.example_sentence_en || "",
			reading: incoming.example_sentence_reading || "",
		});
	}

	// JLPT: prefer more specific (non-null)
	if (incoming.jlpt_level && !merged.jlpt_level) {
		merged.jlpt_level = incoming.jlpt_level;
	}

	// Priority: keep the best (lowest)
	if (incomingWins) {
		merged._priority = incomingPriority;
	}

	return merged;
}

// ── Media Extraction ────────────────────────────────────────────────────────

const mediaRegistry = new Map(); // hash -> { destName, sourcePaths[] }
let mediaCount = 0;

/**
 * Extract a media file from the zip, deduplicate by content hash.
 * Returns the deduplicated filename.
 */
async function extractMediaFile(zip, _mediaMap, ankiIndex, originalName) {
	const zipEntry = zip.file(String(ankiIndex));
	if (!zipEntry) return null;

	try {
		const data = await zipEntry.async("uint8array");
		const hash = createHash("md5").update(data).digest("hex");
		const ext = extname(originalName).toLowerCase() || ".bin";

		if (mediaRegistry.has(hash)) {
			return mediaRegistry.get(hash).destName;
		}

		const destName = `${hash}${ext}`;
		const destPath = join(MEDIA_DIR, destName);

		if (!existsSync(MEDIA_DIR)) {
			mkdirSync(MEDIA_DIR, { recursive: true });
		}

		writeFileSync(destPath, Buffer.from(data));
		mediaRegistry.set(hash, { destName, originalName });
		mediaCount++;

		return destName;
	} catch {
		return null;
	}
}

/**
 * Resolve audio/image references in an item to deduplicated filenames.
 */
async function resolveMediaRefs(item, zip, mediaMap) {
	if (!mediaMap || Object.keys(mediaMap).length === 0) return;

	// Build reverse map: originalName -> ankiIndex
	const reverseMap = {};
	for (const [idx, name] of Object.entries(mediaMap)) {
		reverseMap[name] = idx;
	}

	// Resolve audio refs
	for (const field of ["audio", "sentence_audio"]) {
		if (!item[field] || !Array.isArray(item[field])) continue;
		const resolved = [];
		for (const ref of item[field]) {
			const idx = reverseMap[ref];
			if (idx != null) {
				const dest = await extractMediaFile(zip, mediaMap, idx, ref);
				if (dest) resolved.push(dest);
			}
		}
		item[field] = resolved.length > 0 ? resolved : undefined;
	}

	// Resolve image refs
	if (item.images && Array.isArray(item.images)) {
		const resolved = [];
		for (const ref of item.images) {
			const idx = reverseMap[ref];
			if (idx != null) {
				const dest = await extractMediaFile(zip, mediaMap, idx, ref);
				if (dest) resolved.push(dest);
			}
		}
		item.images = resolved.length > 0 ? resolved : undefined;
	}
}

// ── FJSD Filtering ──────────────────────────────────────────────────────────

/**
 * FJSD has 44k vocab but many are obscure. Filter to useful items:
 * - Has a frequency tier nf01-24 (top ~12k by JMdict frequency)
 * - Or has ichi1/ichi2 tag (ichimango common word list)
 * - Or has spec1/spec2 tag (specialized but important)
 * This gives ~12-15k FJSD items. Combined with other decks after dedup,
 * total vocab lands in the 15-20k range.
 */
function fjsdVocabFilter(note) {
	for (const t of note.tags) {
		// Frequency tier: word::common::nf01 through nf24
		const nfMatch = t.match(/^word::common::nf(\d+)$/);
		if (nfMatch && parseInt(nfMatch[1], 10) <= 24) return true;
		// Ichimango common word lists
		if (t === "word::common::ichi1" || t === "word::common::ichi2") return true;
		// Specialized but important
		if (t === "word::common::spec1" || t === "word::common::spec2") return true;
	}
	return false;
}

// ── Welcome/Intro Card Detection ────────────────────────────────────────────

function isWelcomeCard(note, modelConfig) {
	// Kaishi 1.5k+: first note is a welcome card
	if (modelConfig.modelName === "Kaishi 1.5k++") {
		const firstField = stripHtml(note.fields[0] || "");
		if (
			!firstField ||
			firstField.length > 100 ||
			firstField.toLowerCase().includes("welcome") ||
			firstField.toLowerCase().includes("about")
		) {
			return true;
		}
	}
	return false;
}

// ── Jlab Translation Fallback ───────────────────────────────────────────────

/**
 * Jlab sentences have 0% fill on Translation. Pull from RemarksBack.
 */
function fixJlabTranslation(item) {
	if (!item.meaning && item.context_notes) {
		// RemarksBack often contains the translation
		item.meaning = item.context_notes;
		item.context_notes = null;
	}
}

// ── Main Pipeline ───────────────────────────────────────────────────────────

async function main() {
	console.log("=== Language DB Build Pipeline ===\n");
	console.log(`Decks folder: ${DECKS_FOLDER}`);
	console.log(`Output dir:   ${OUTPUT_DIR}`);
	console.log(`Mappings:     ${MAPPINGS_FILE}\n`);

	// Ensure output dirs exist
	mkdirSync(OUTPUT_DIR, { recursive: true });
	mkdirSync(MEDIA_DIR, { recursive: true });

	// Content buckets: key -> merged item
	const buckets = {
		vocabulary: new Map(),
		grammar: new Map(),
		sentence: new Map(),
		kana: new Map(),
		conjugation: new Map(),
	};

	const stats = {
		decksProcessed: 0,
		decksSkipped: 0,
		notesProcessed: 0,
		notesSkipped: 0,
		notesMapped: 0,
		mergeHits: 0,
		errors: [],
	};

	// Process each deck in priority order (lowest priority number first)
	const deckConfigs = fieldMappings.decks
		.filter((d) => d.priority > 0)
		.sort((a, b) => a.priority - b.priority);

	const skippedDecks = fieldMappings.decks.filter((d) => d.priority <= 0);
	stats.decksSkipped = skippedDecks.length;
	console.log(
		`Skipping ${skippedDecks.length} decks: ${skippedDecks.map((d) => d.fileName.slice(0, 30)).join(", ")}\n`,
	);

	for (const deckConfig of deckConfigs) {
		const filePath = join(DECKS_FOLDER, deckConfig.fileName);

		if (!existsSync(filePath)) {
			console.log(`MISSING: ${deckConfig.fileName}`);
			stats.errors.push(`Missing file: ${deckConfig.fileName}`);
			continue;
		}

		process.stdout.write(`Processing ${deckConfig.fileName.slice(0, 55).padEnd(58)}... `);

		let parsed;
		try {
			parsed = await parseApkg(filePath);
		} catch (err) {
			console.log(`PARSE ERROR: ${err.message}`);
			stats.errors.push(`Parse error ${deckConfig.fileName}: ${err.message}`);
			continue;
		}

		stats.decksProcessed++;
		let deckMapped = 0;
		let deckSkipped = 0;

		for (const modelConfig of deckConfig.models || []) {
			if (modelConfig.contentType === "_skip") continue;
			const contentType = modelConfig.contentType;
			const bucket = buckets[contentType];
			if (!bucket) {
				stats.errors.push(`Unknown content type: ${contentType} in ${deckConfig.fileName}`);
				continue;
			}

			// Find matching Anki model
			const ankiModel = parsed.models.find((m) => m.name === modelConfig.modelName);
			if (!ankiModel) {
				// Try fuzzy match
				const fuzzy = parsed.models.find((m) =>
					m.name.toLowerCase().includes(modelConfig.modelName.toLowerCase().slice(0, 10)),
				);
				if (!fuzzy) {
					stats.errors.push(
						`Model not found: "${modelConfig.modelName}" in ${deckConfig.fileName}. Available: ${parsed.models.map((m) => m.name).join(", ")}`,
					);
					continue;
				}
				// Use fuzzy match
				Object.assign(ankiModel || {}, fuzzy);
			}

			const modelNotes = parsed.notes.filter((n) => n.mid === ankiModel.id);

			for (const note of modelNotes) {
				stats.notesProcessed++;

				// Skip welcome/intro cards
				if (isWelcomeCard(note, modelConfig)) {
					deckSkipped++;
					stats.notesSkipped++;
					continue;
				}

				// FJSD vocab filter
				if (
					deckConfig.fileName.includes("Full_Japanese_Study_Deck") &&
					contentType === "vocabulary"
				) {
					if (!fjsdVocabFilter(note)) {
						deckSkipped++;
						stats.notesSkipped++;
						continue;
					}
				}

				// Map note fields to semantic item
				const item = mapNoteToItem(note, ankiModel, modelConfig, deckConfig);
				if (!item || !item.primary_text) {
					deckSkipped++;
					stats.notesSkipped++;
					continue;
				}

				// Post-processing per deck type
				if (modelConfig.modelName.includes("Tae Kim") && modelConfig.modelName.includes("MIA")) {
					collapseTaeKimExamples(item);
				}

				if (contentType === "conjugation") {
					collapseConjugationForms(item);
				}

				if (
					deckConfig.fileName.includes("Genki") &&
					(modelConfig.modelName.includes("Simple Model") ||
						modelConfig.modelName.includes("Basic"))
				) {
					fixGenkiPrimaryText(item);
				}

				if (deckConfig.fileName.includes("Japanese_course_based_on_Tae_Kim")) {
					fixJlabTranslation(item);
				}

				// FJSD: extract frequency rank from nf tier tag
				if (
					deckConfig.fileName.includes("Full_Japanese_Study_Deck") &&
					contentType === "vocabulary" &&
					!item.frequency_rank
				) {
					for (const t of note.tags) {
						const nfMatch = t.match(/^word::common::nf(\d+)$/);
						if (nfMatch) {
							// Each nf tier is ~500 words; approximate rank
							item.frequency_rank = parseInt(nfMatch[1], 10) * 500;
							break;
						}
					}
				}

				// Extract JLPT level
				item.jlpt_level = extractJlptLevel(note, modelConfig);

				// Resolve media references
				await resolveMediaRefs(item, parsed.zip, parsed.mediaMap);

				// Generate dedup key
				const key = makeDedupKey(contentType, item);
				if (!key) {
					deckSkipped++;
					stats.notesSkipped++;
					continue;
				}

				item.item_key = key;
				item.source_decks = [deckConfig.fileName];

				// Merge or insert
				if (bucket.has(key)) {
					bucket.set(key, mergeItems(bucket.get(key), item));
					stats.mergeHits++;
				} else {
					bucket.set(key, item);
				}

				deckMapped++;
				stats.notesMapped++;
			}
		}

		console.log(`${deckMapped} mapped, ${deckSkipped} skipped`);
	}

	// ── Post-merge: assign JLPT by frequency for items missing it ───────────

	console.log("\nPost-merge: assigning JLPT levels by frequency...");
	for (const [_key, item] of buckets.vocabulary) {
		if (!item.jlpt_level && item.frequency_rank) {
			if (item.frequency_rank <= 800) item.jlpt_level = "N5";
			else if (item.frequency_rank <= 1500) item.jlpt_level = "N4";
			else if (item.frequency_rank <= 3000) item.jlpt_level = "N3";
			else if (item.frequency_rank <= 5000) item.jlpt_level = "N2";
			else item.jlpt_level = "N1";
		}
	}

	// ── Clean output items ──────────────────────────────────────────────────

	function cleanItem(item) {
		const clean = { ...item };
		// Remove internal fields
		for (const key of Object.keys(clean)) {
			if (key.startsWith("_")) delete clean[key];
		}
		// Remove empty/null fields
		for (const [k, v] of Object.entries(clean)) {
			if (v === null || v === undefined || v === "") delete clean[k];
			if (Array.isArray(v) && v.length === 0) delete clean[k];
		}
		// Collapse example_sentences from primary fields
		if (clean.example_sentence_ja && !clean.example_sentences) {
			clean.example_sentences = [
				{
					ja: clean.example_sentence_ja,
					en: clean.example_sentence_en || "",
					reading: clean.example_sentence_reading || "",
				},
			];
		}
		// Add extra examples from Tae Kim
		if (item._extra_examples?.length > 0) {
			if (!clean.example_sentences) clean.example_sentences = [];
			clean.example_sentences.push(...item._extra_examples);
		}
		// Remove flat example fields (now in array)
		delete clean.example_sentence_ja;
		delete clean.example_sentence_en;
		delete clean.example_sentence_reading;
		return clean;
	}

	// ── Write output files ──────────────────────────────────────────────────

	console.log("\n=== Output ===\n");

	for (const [contentType, bucket] of Object.entries(buckets)) {
		const items = [...bucket.values()].map(cleanItem);

		// Sort by frequency_rank (if available), then by primary_text
		items.sort((a, b) => {
			if (a.frequency_rank != null && b.frequency_rank != null) {
				return a.frequency_rank - b.frequency_rank;
			}
			if (a.frequency_rank != null) return -1;
			if (b.frequency_rank != null) return 1;
			return (a.primary_text || "").localeCompare(b.primary_text || "", "ja");
		});

		const outFile = join(OUTPUT_DIR, `${contentType}.json`);
		writeFileSync(outFile, JSON.stringify(items, null, 2));

		const sizeMB = (Buffer.byteLength(JSON.stringify(items)) / 1024 / 1024).toFixed(1);
		console.log(
			`${contentType.padEnd(15)} ${String(items.length).padStart(7)} items  ${sizeMB.padStart(6)} MB  -> ${outFile}`,
		);

		// JLPT breakdown for vocab
		if (contentType === "vocabulary") {
			const jlptCounts = {};
			for (const item of items) {
				const level = item.jlpt_level || "untagged";
				jlptCounts[level] = (jlptCounts[level] || 0) + 1;
			}
			console.log(
				`  JLPT: ${Object.entries(jlptCounts)
					.map(([k, v]) => `${k}=${v}`)
					.join(", ")}`,
			);
		}
	}

	// ── Stats ───────────────────────────────────────────────────────────────

	console.log("\n=== Statistics ===\n");
	console.log(`Decks processed: ${stats.decksProcessed}`);
	console.log(`Decks skipped:   ${stats.decksSkipped}`);
	console.log(`Notes processed: ${stats.notesProcessed}`);
	console.log(`Notes mapped:    ${stats.notesMapped}`);
	console.log(`Notes skipped:   ${stats.notesSkipped} (filtered, empty, no key)`);
	console.log(`Merge hits:      ${stats.mergeHits} (items enriched from multiple sources)`);
	console.log(`Media files:     ${mediaCount} unique files extracted`);

	if (stats.errors.length > 0) {
		console.log(`\n=== Errors (${stats.errors.length}) ===\n`);
		for (const err of stats.errors) {
			console.log(`  - ${err}`);
		}
	}

	console.log("\nDone.");
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
