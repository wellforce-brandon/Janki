import { getDb } from "../database";
import type { QueryResult } from "../database";
import { safeQuery } from "../database";
import { getKanaGroupInfo } from "$lib/data/kana-groups";

interface LanguageItem {
	content_type: string;
	item_key: string;
	primary_text: string;
	reading?: string;
	meaning?: string;
	part_of_speech?: string;
	pitch_accent?: string;
	frequency_rank?: number;
	audio?: string[];
	formation?: string;
	explanation?: string;
	sentence_ja?: string;
	sentence_en?: string;
	sentence_reading?: string;
	sentence_audio?: string[];
	romaji?: string;
	stroke_order?: string;
	conjugation_forms?: Record<string, string>;
	verb_group?: string;
	example_sentences?: { ja: string; en: string; reading?: string }[];
	related_items?: string[];
	images?: string[];
	context_notes?: string;
	source_decks?: string[];
	jlpt_level?: string;
	wk_level?: number;
	tags?: string[];
	prerequisite_keys?: string[];
	mnemonic?: string;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
	"vocabulary.json": "vocabulary",
	"grammar.json": "grammar",
	"sentence.json": "sentence",
	"kana.json": "kana",
	"conjugation.json": "conjugation",
};

const BATCH_SIZE = 100;

async function isLanguageSeeded(): Promise<QueryResult<boolean>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = 'language_seeded'",
		);
		return rows.length > 0 && rows[0].value === "true";
	});
}

async function markLanguageSeeded(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('language_seeded', 'true')",
		);
	});
}

function jsonOrNull(value: unknown): string | null {
	if (value == null) return null;
	if (Array.isArray(value) && value.length === 0) return null;
	if (typeof value === "object" && Object.keys(value).length === 0) return null;
	return JSON.stringify(value);
}

function insertItem(
	item: LanguageItem,
	contentType: string,
): { sql: string; params: unknown[] } {
	// Determine lesson group/order for kana items
	let lessonGroup: string | null = null;
	let lessonOrder: number | null = null;
	if (contentType === "kana") {
		const groupInfo = getKanaGroupInfo(item.romaji, item.primary_text);
		if (groupInfo) {
			lessonGroup = groupInfo.group;
			lessonOrder = groupInfo.order;
		}
	}

	const sql = `INSERT OR IGNORE INTO language_items (
		content_type, item_key, primary_text, reading, meaning,
		part_of_speech, pitch_accent, frequency_rank, audio_file,
		formation, explanation,
		sentence_ja, sentence_en, sentence_reading, sentence_audio,
		romaji, stroke_order,
		conjugation_forms, verb_group,
		example_sentences, related_items, images, context_notes, source_decks,
		jlpt_level, wk_level, tags,
		prerequisite_keys,
		lesson_group, lesson_order
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

	const params = [
		contentType,
		item.item_key,
		item.primary_text,
		item.reading ?? null,
		item.meaning ?? null,
		item.part_of_speech ?? null,
		item.pitch_accent ?? null,
		item.frequency_rank ?? null,
		jsonOrNull(item.audio),
		item.formation ?? null,
		item.explanation ?? null,
		item.sentence_ja ?? null,
		item.sentence_en ?? null,
		item.sentence_reading ?? null,
		jsonOrNull(item.sentence_audio),
		item.romaji ?? null,
		item.stroke_order ?? null,
		jsonOrNull(item.conjugation_forms),
		item.verb_group ?? null,
		jsonOrNull(item.example_sentences),
		jsonOrNull(item.related_items),
		jsonOrNull(item.images),
		item.context_notes ?? null,
		jsonOrNull(item.source_decks),
		item.jlpt_level ?? null,
		item.wk_level ?? null,
		jsonOrNull(item.tags),
		jsonOrNull(item.prerequisite_keys),
		lessonGroup,
		lessonOrder,
	];

	return { sql, params };
}

export async function seedLanguageData(): Promise<void> {
	const seeded = await isLanguageSeeded();
	if (seeded.ok && seeded.data) return;

	console.log("Seeding language data from merged deck export...");

	const db = await getDb();
	let totalInserted = 0;

	for (const [filename, contentType] of Object.entries(CONTENT_TYPE_MAP)) {
		let items: LanguageItem[];

		try {
			const res = await fetch(`/data/language/${filename}`);
			if (!res.ok) {
				console.warn(`Language data file not found: ${filename}, skipping`);
				continue;
			}
			items = await res.json();
		} catch (e) {
			console.warn(`Failed to load ${filename}:`, e);
			continue;
		}

		console.log(`Seeding ${items.length} ${contentType} items...`);

		// Batch insert in groups of BATCH_SIZE
		for (let i = 0; i < items.length; i += BATCH_SIZE) {
			const batch = items.slice(i, i + BATCH_SIZE);
			for (const item of batch) {
				const { sql, params } = insertItem(item, contentType);
				await db.execute(sql, params);
			}
			totalInserted += batch.length;
		}
	}

	await markLanguageSeeded();
	console.log(`Language seed complete: ${totalInserted} items inserted`);
}
