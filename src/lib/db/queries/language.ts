import { getDb, safeQuery, type QueryResult } from "../database";

// Content type literal
export type ContentType = "vocabulary" | "grammar" | "sentence" | "kana" | "conjugation";

export interface ContentTypeCount {
	type: string;
	total: number;
	due: number;
	new_count: number;
}

export interface LanguageItem {
	id: number;
	content_type: string;
	item_key: string;
	primary_text: string;
	reading: string | null;
	meaning: string | null;
	part_of_speech: string | null;
	pitch_accent: string | null;
	frequency_rank: number | null;
	audio_file: string | null;
	formation: string | null;
	explanation: string | null;
	sentence_ja: string | null;
	sentence_en: string | null;
	sentence_reading: string | null;
	sentence_audio: string | null;
	romaji: string | null;
	stroke_order: string | null;
	conjugation_forms: string | null;
	verb_group: string | null;
	example_sentences: string | null;
	related_items: string | null;
	images: string | null;
	context_notes: string | null;
	source_decks: string | null;
	jlpt_level: string | null;
	wk_level: number | null;
	tags: string | null;
	srs_stage: number;
	unlocked_at: string | null;
	next_review: string | null;
	correct_count: number;
	incorrect_count: number;
	lesson_completed_at: string | null;
	prerequisite_keys: string | null;
	created_at: string;
	updated_at: string;
}

export interface WkCrossReference {
	id: number;
	character: string;
	item_type: string;
	srs_stage: number;
	level: number;
	meanings: string;
}

export async function getContentTypeCounts(): Promise<QueryResult<ContentTypeCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<ContentTypeCount[]>(`
			SELECT
				content_type as type,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage > 0 AND next_review IS NOT NULL AND next_review <= datetime('now') THEN 1 END) as due,
				COUNT(CASE WHEN srs_stage = 0 THEN 1 END) as new_count
			FROM language_items
			GROUP BY content_type
		`);
	});
}

export async function getLanguageItems(
	contentType: ContentType,
	options: {
		limit?: number;
		offset?: number;
		sortBy?: "next_review" | "created_at" | "frequency_rank";
		srsFilter?: number;
		jlptFilter?: string;
		searchQuery?: string;
	} = {},
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [contentType];
		let where = "content_type = ?";

		if (options.srsFilter !== undefined) {
			where += " AND srs_stage = ?";
			params.push(options.srsFilter);
		}
		if (options.jlptFilter) {
			where += " AND jlpt_level = ?";
			params.push(options.jlptFilter);
		}
		if (options.searchQuery) {
			where += " AND (primary_text LIKE ? OR reading LIKE ? OR meaning LIKE ? OR item_key LIKE ?)";
			const like = `%${options.searchQuery}%`;
			params.push(like, like, like, like);
		}

		let orderBy = "created_at DESC";
		if (options.sortBy === "next_review") orderBy = "next_review ASC";
		else if (options.sortBy === "frequency_rank") orderBy = "COALESCE(frequency_rank, 999999) ASC";

		const limit = options.limit ?? 50;
		const offset = options.offset ?? 0;
		params.push(limit, offset);

		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
			params,
		);
	});
}

export async function getLanguageItemById(id: number): Promise<QueryResult<LanguageItem | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<LanguageItem[]>(
			"SELECT * FROM language_items WHERE id = ?",
			[id],
		);
		return rows[0] ?? null;
	});
}

export async function findWkCrossReference(
	character: string,
): Promise<QueryResult<WkCrossReference | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<WkCrossReference[]>(
			`SELECT id, character, item_type, srs_stage, level, meanings
			 FROM kanji_levels
			 WHERE character = ?
			 LIMIT 1`,
			[character],
		);
		return rows[0] ?? null;
	});
}

export async function findWkCrossReferences(
	characters: string[],
): Promise<QueryResult<WkCrossReference[]>> {
	if (characters.length === 0) return { ok: true, data: [] };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = characters.map(() => "?").join(",");
		return db.select<WkCrossReference[]>(
			`SELECT id, character, item_type, srs_stage, level, meanings
			 FROM kanji_levels
			 WHERE character IN (${placeholders})`,
			characters,
		);
	});
}

export async function searchLanguageItems(
	query: string,
	contentType?: string,
	limit = 50,
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const like = `%${query.trim()}%`;
		const params: (string | number)[] = [like, like, like];
		let typeWhere = "";

		if (contentType) {
			typeWhere = " AND content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items
			WHERE (primary_text LIKE ? OR meaning LIKE ? OR item_key LIKE ?)${typeWhere}
			ORDER BY id ASC
			LIMIT ?`,
			params,
		);
	});
}

export async function updateLanguageItemSrs(
	id: number,
	srsStage: number,
	nextReview: string | null,
	correctCount: number,
	incorrectCount: number,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`UPDATE language_items SET
				srs_stage = ?, next_review = ?, correct_count = ?, incorrect_count = ?,
				updated_at = datetime('now')
			WHERE id = ?`,
			[srsStage, nextReview, correctCount, incorrectCount, id],
		);
	});
}

export async function logLanguageReview(
	itemId: number,
	srsStage_before: number,
	srsStageAfter: number,
	correct: boolean,
	durationMs?: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			`INSERT INTO language_review_log (item_id, srs_stage_before, srs_stage_after, correct, duration_ms)
			VALUES (?, ?, ?, ?, ?)`,
			[itemId, srsStage_before, srsStageAfter, correct ? 1 : 0, durationMs ?? null],
		);
		return result.lastInsertId ?? 0;
	});
}

export async function getDueLanguageItems(
	contentType?: ContentType,
	limit = 200,
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "srs_stage > 0 AND next_review IS NOT NULL AND next_review <= datetime('now')";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items WHERE ${where} ORDER BY next_review ASC LIMIT ?`,
			params,
		);
	});
}

export async function getNewLanguageItems(
	contentType?: ContentType,
	limit = 20,
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "srs_stage = 0";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items WHERE ${where} ORDER BY id ASC LIMIT ?`,
			params,
		);
	});
}

export async function getLanguageSrsDistribution(): Promise<QueryResult<{ srs_stage: number; count: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ srs_stage: number; count: number }[]>(
			"SELECT srs_stage, COUNT(*) as count FROM language_items WHERE srs_stage > 0 GROUP BY srs_stage ORDER BY srs_stage",
		);
	});
}
