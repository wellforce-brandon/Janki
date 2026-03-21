import { getDb, safeQuery, type QueryResult } from "../database";
import { getCached, setCache } from "../query-cache";

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
	const cached = getCached<ContentTypeCount[]>("contentTypeCounts");
	if (cached) return { ok: true, data: cached };

	return safeQuery(async () => {
		const db = await getDb();
		const data = await db.select<ContentTypeCount[]>(`
			SELECT
				content_type as type,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage > 0 AND srs_stage < 9 AND lesson_completed_at IS NOT NULL AND next_review IS NOT NULL AND next_review <= datetime('now') THEN 1 END) as due,
				COUNT(CASE WHEN srs_stage >= 1 AND lesson_completed_at IS NULL THEN 1 END) as new_count
			FROM language_items
			GROUP BY content_type
		`);
		setCache("contentTypeCounts", data, 30_000);
		return data;
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
		const trimmed = query.trim();

		// Try FTS5 first, fall back to LIKE
		try {
			const ftsQuery = `${trimmed.replace(/['"]/g, "")}*`;
			const params: (string | number)[] = [ftsQuery];
			let typeWhere = "";

			if (contentType) {
				typeWhere = " AND li.content_type = ?";
				params.push(contentType);
			}

			params.push(limit);
			return await db.select<LanguageItem[]>(
				`SELECT li.* FROM language_items li
				JOIN language_fts ON language_fts.rowid = li.id
				WHERE language_fts MATCH ?${typeWhere}
				ORDER BY rank
				LIMIT ?`,
				params,
			);
		} catch {
			// FTS5 table may not exist yet or query syntax issue -- fall back to LIKE
			const like = `%${trimmed}%`;
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
		}
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
		let where = "srs_stage > 0 AND srs_stage < 9 AND lesson_completed_at IS NOT NULL AND next_review IS NOT NULL AND next_review <= datetime('now')";

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

/** Items unlocked (srs_stage >= 1) but lesson not yet completed */
export async function getAvailableLessons(
	contentType?: ContentType,
	limit = 5,
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "srs_stage >= 1 AND lesson_completed_at IS NULL";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items WHERE ${where}
			ORDER BY
				CASE content_type WHEN 'kana' THEN 0 WHEN 'vocabulary' THEN 1 WHEN 'grammar' THEN 2 WHEN 'conjugation' THEN 3 WHEN 'sentence' THEN 4 ELSE 5 END,
				COALESCE(frequency_rank, 999999) ASC,
				id ASC
			LIMIT ?`,
			params,
		);
	});
}

export async function getAvailableLessonCount(
	contentType?: ContentType,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "srs_stage >= 1 AND lesson_completed_at IS NULL";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM language_items WHERE ${where}`,
			params,
		);
		return rows[0].count;
	});
}

export interface LanguageSrsSummary {
	content_type: string;
	srs_stage: number;
	count: number;
}

/** Counts by content_type and srs_stage (for overview displays) */
export async function getLanguageSrsSummary(): Promise<QueryResult<LanguageSrsSummary[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LanguageSrsSummary[]>(
			`SELECT content_type, srs_stage, COUNT(*) as count
			FROM language_items
			GROUP BY content_type, srs_stage
			ORDER BY content_type, srs_stage`,
		);
	});
}

/** Mark a lesson batch as completed and schedule first review */
export async function markLessonCompleted(
	id: number,
	nextReview: string,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`UPDATE language_items
			SET lesson_completed_at = datetime('now'), next_review = ?
			WHERE id = ?`,
			[nextReview, id],
		);
	});
}

/** Find vocabulary items containing a specific kanji character */
export async function getLanguageItemsByKanji(
	character: string,
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items
			WHERE content_type = 'vocabulary' AND primary_text LIKE ?
			ORDER BY COALESCE(frequency_rank, 999999) ASC`,
			[`%${character}%`],
		);
	});
}

/** Get due language items count */
export async function getDueLanguageCount(
	contentType?: ContentType,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "srs_stage > 0 AND srs_stage < 9 AND lesson_completed_at IS NOT NULL AND next_review IS NOT NULL AND next_review <= datetime('now')";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM language_items WHERE ${where}`,
			params,
		);
		return rows[0].count;
	});
}

/** Bulk unlock items by setting srs_stage = 1 and unlocked_at */
export async function unlockLanguageItems(ids: number[]): Promise<QueryResult<void>> {
	if (ids.length === 0) return { ok: true, data: undefined };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = ids.map(() => "?").join(",");
		await db.execute(
			`UPDATE language_items SET srs_stage = 1, unlocked_at = datetime('now')
			WHERE id IN (${placeholders}) AND srs_stage = 0`,
			ids,
		);
	});
}

/** Get all kana items that are still locked */
export async function getLockedKanaItems(): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			"SELECT id FROM language_items WHERE content_type = 'kana' AND srs_stage = 0",
		);
	});
}

/** Get locked vocabulary items with their primary_text for kanji checking */
export async function getLockedVocabularyItems(): Promise<QueryResult<{ id: number; primary_text: string }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number; primary_text: string }[]>(
			"SELECT id, primary_text FROM language_items WHERE content_type = 'vocabulary' AND srs_stage = 0",
		);
	});
}

/** Get locked grammar items for unlock checking */
export async function getLockedGrammarItems(): Promise<QueryResult<{ id: number; jlpt_level: string | null; frequency_rank: number | null }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number; jlpt_level: string | null; frequency_rank: number | null }[]>(
			"SELECT id, jlpt_level, frequency_rank FROM language_items WHERE content_type = 'grammar' AND srs_stage = 0 ORDER BY COALESCE(frequency_rank, 999999) ASC",
		);
	});
}

/** Get locked sentence items with their prerequisite_keys */
export async function getLockedSentenceItems(): Promise<QueryResult<{ id: number; prerequisite_keys: string | null }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number; prerequisite_keys: string | null }[]>(
			"SELECT id, prerequisite_keys FROM language_items WHERE content_type = 'sentence' AND srs_stage = 0",
		);
	});
}

/** Get locked conjugation items with their prerequisite_keys */
export async function getLockedConjugationItems(): Promise<QueryResult<{ id: number; prerequisite_keys: string | null }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number; prerequisite_keys: string | null }[]>(
			"SELECT id, prerequisite_keys FROM language_items WHERE content_type = 'conjugation' AND srs_stage = 0",
		);
	});
}

/** Check if items with given item_keys have reached a minimum SRS stage */
export async function getItemKeyStages(itemKeys: string[]): Promise<QueryResult<{ item_key: string; srs_stage: number }[]>> {
	if (itemKeys.length === 0) return { ok: true, data: [] };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = itemKeys.map(() => "?").join(",");
		return db.select<{ item_key: string; srs_stage: number }[]>(
			`SELECT item_key, srs_stage FROM language_items WHERE item_key IN (${placeholders})`,
			itemKeys,
		);
	});
}

/** Recently unlocked items (last 7 days) */
export async function getRecentlyUnlockedItems(limit = 10): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items
			WHERE unlocked_at IS NOT NULL AND unlocked_at >= datetime('now', '-7 days')
			ORDER BY unlocked_at DESC
			LIMIT ?`,
			[limit],
		);
	});
}

/** Count items at Guru+ (srs_stage >= 5) for a given JLPT level */
export async function getJlptLevelProgress(jlptLevel: string): Promise<QueryResult<{ total: number; guru_plus: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; guru_plus: number }[]>(
			`SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items WHERE jlpt_level = ?`,
			[jlptLevel],
		);
		return rows[0];
	});
}
