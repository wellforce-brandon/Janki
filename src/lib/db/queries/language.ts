import { getDb, safeQuery, sqlPlaceholders, type QueryResult } from "../database";
import { getCached, setCache, CACHE_KEYS } from "../query-cache";

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
	lesson_group: string | null;
	lesson_order: number | null;
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
			const escaped = options.searchQuery.replace(/[%_\\]/g, "\\$&");
			where += " AND (primary_text LIKE ? ESCAPE '\\' OR reading LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\' OR item_key LIKE ? ESCAPE '\\')";
			const like = `%${escaped}%`;
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

/** Get multiple language items by their IDs */
export async function getLanguageItemsByIds(ids: number[]): Promise<QueryResult<LanguageItem[]>> {
	if (ids.length === 0) return { ok: true, data: [] };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = sqlPlaceholders(ids.length);
		return db.select<LanguageItem[]>(
			`SELECT * FROM language_items WHERE id IN (${placeholders})`,
			ids,
		);
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
		const placeholders = sqlPlaceholders(characters.length);
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
			const ftsQuery = `"${trimmed.replace(/"/g, '""')}"*`;
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
	srsStageBefore: number,
	srsStageAfter: number,
	correct: boolean,
	durationMs?: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			`INSERT INTO language_review_log (item_id, srs_stage_before, srs_stage_after, correct, duration_ms)
			VALUES (?, ?, ?, ?, ?)`,
			[itemId, srsStageBefore, srsStageAfter, correct ? 1 : 0, durationMs ?? null],
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

export async function getLanguageSrsDistribution(): Promise<QueryResult<{ srs_stage: number; count: number }[]>> {
	const cached = getCached<{ srs_stage: number; count: number }[]>(CACHE_KEYS.srsSummary);
	if (cached) return { ok: true, data: cached };

	return safeQuery(async () => {
		const db = await getDb();
		const data = await db.select<{ srs_stage: number; count: number }[]>(
			"SELECT srs_stage, COUNT(*) as count FROM language_items WHERE srs_stage > 0 GROUP BY srs_stage ORDER BY srs_stage",
		);
		setCache(CACHE_KEYS.srsSummary, data, 30_000);
		return data;
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
				COALESCE(lesson_order, 999) ASC,
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
		return rows[0]?.count ?? 0;
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

/**
 * Batch mark lessons completed: set lesson_completed_at and schedule first review.
 * Items stay at srs_stage=1 (Apprentice 1) -- lesson_completed_at IS NOT NULL is the
 * canonical "lesson done" flag. First review advances to srs_stage=2+.
 */
export async function markLessonsBatchCompleted(
	ids: number[],
	nextReview: string,
): Promise<QueryResult<void>> {
	if (ids.length === 0) return { ok: true, data: undefined };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = sqlPlaceholders(ids.length);
		await db.execute(
			`UPDATE language_items
			SET lesson_completed_at = datetime('now'), next_review = ?
			WHERE id IN (${placeholders})`,
			[nextReview, ...ids],
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
		return rows[0]?.count ?? 0;
	});
}

/** Bulk unlock items by setting srs_stage = 1 and unlocked_at */
export async function unlockLanguageItems(ids: number[]): Promise<QueryResult<void>> {
	if (ids.length === 0) return { ok: true, data: undefined };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = sqlPlaceholders(ids.length);
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

/** Check if items with given item_keys have reached a minimum SRS stage */
export async function getItemKeyStages(itemKeys: string[]): Promise<QueryResult<{ item_key: string; srs_stage: number }[]>> {
	if (itemKeys.length === 0) return { ok: true, data: [] };
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = sqlPlaceholders(itemKeys.length);
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

/** Rebuild FTS5 search index from language_items table */
export async function rebuildFtsIndex(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("DELETE FROM language_fts");
		await db.execute(
			`INSERT INTO language_fts(rowid, primary_text, reading, meaning, explanation)
			SELECT id, primary_text, COALESCE(reading, ''), COALESCE(meaning, ''), COALESCE(explanation, '')
			FROM language_items`,
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
		return rows[0] ?? { total: 0, guru_plus: 0 };
	});
}

// --- Kana group progression queries ---

/** Get the next locked kana lesson_group (lowest lesson_order with locked items) */
export async function getNextLockedKanaGroup(): Promise<QueryResult<{ lesson_group: string; lesson_order: number } | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ lesson_group: string; lesson_order: number }[]>(
			`SELECT DISTINCT lesson_group, lesson_order FROM language_items
			WHERE content_type = 'kana' AND srs_stage = 0 AND lesson_group IS NOT NULL
			ORDER BY lesson_order ASC
			LIMIT 1`,
		);
		return rows.length > 0 ? rows[0] : null;
	});
}

/** Get locked kana items for a specific lesson_group */
export async function getLockedKanaByGroup(lessonGroup: string): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			"SELECT id FROM language_items WHERE content_type = 'kana' AND srs_stage = 0 AND lesson_group = ?",
			[lessonGroup],
		);
	});
}

/** Get progress for a kana lesson_group: total items and how many are at Apprentice 4+ */
export async function getKanaGroupProgress(lessonGroup: string): Promise<QueryResult<{ total: number; at_apprentice4_plus: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; at_apprentice4_plus: number }[]>(
			`SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 4 THEN 1 END) as at_apprentice4_plus
			FROM language_items WHERE content_type = 'kana' AND lesson_group = ?`,
			[lessonGroup],
		);
		return rows[0] ?? { total: 0, at_apprentice4_plus: 0 };
	});
}

/** Get the lesson_group just before a given lesson_order */
export async function getPreviousKanaGroup(lessonOrder: number): Promise<QueryResult<string | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ lesson_group: string }[]>(
			`SELECT DISTINCT lesson_group FROM language_items
			WHERE content_type = 'kana' AND lesson_order = ? AND lesson_group IS NOT NULL
			LIMIT 1`,
			[lessonOrder - 1],
		);
		return rows.length > 0 ? rows[0].lesson_group : null;
	});
}

// --- Cap-based unlock queries ---

/** Count unlocked-but-not-yet-learned items for a specific content type */
export async function getPendingLessonCount(contentType: ContentType): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM language_items
			WHERE content_type = ? AND srs_stage >= 1 AND lesson_completed_at IS NULL`,
			[contentType],
		);
		return rows[0]?.count ?? 0;
	});
}

/** Get a batch of locked vocabulary items for a JLPT level, ordered by frequency */
export async function getLockedVocabularyBatch(
	jlptLevel: string | null,
	limit: number,
): Promise<QueryResult<{ id: number; primary_text: string }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const levelClause = jlptLevel === null ? "jlpt_level IS NULL" : "jlpt_level = ?";
		const params = jlptLevel === null ? [limit] : [jlptLevel, limit];
		return db.select<{ id: number; primary_text: string }[]>(
			`SELECT id, primary_text FROM language_items
			WHERE content_type = 'vocabulary' AND srs_stage = 0 AND ${levelClause}
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			params,
		);
	});
}

/** Get a batch of locked grammar items for a JLPT level, ordered by frequency */
export async function getLockedGrammarBatch(
	jlptLevel: string | null,
	limit: number,
): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const levelClause = jlptLevel === null ? "jlpt_level IS NULL" : "jlpt_level = ?";
		const params = jlptLevel === null ? [limit] : [jlptLevel, limit];
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			WHERE content_type = 'grammar' AND srs_stage = 0 AND ${levelClause}
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			params,
		);
	});
}

/** Get a batch of locked sentences ordered by frequency (corrupted values cleaned by migration) */
export async function getLockedSentenceBatch(limit: number): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			WHERE content_type = 'sentence' AND srs_stage = 0
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			[limit],
		);
	});
}

/** Get a batch of locked conjugation items ordered by frequency/id */
export async function getLockedConjugationBatch(limit: number): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			WHERE content_type = 'conjugation' AND srs_stage = 0
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			[limit],
		);
	});
}

/** Count items at Guru+ (srs_stage >= 5) for a given JLPT level, filtered by content type */
export async function getJlptLevelProgressByType(
	jlptLevel: string,
	contentType: ContentType,
): Promise<QueryResult<{ total: number; guru_plus: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; guru_plus: number }[]>(
			`SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items WHERE jlpt_level = ? AND content_type = ?`,
			[jlptLevel, contentType],
		);
		return rows[0] ?? { total: 0, guru_plus: 0 };
	});
}

/** Count items of a content type at or above a minimum SRS stage (with lesson completed) */
export async function getContentTypeMilestone(
	contentType: ContentType,
	minStage: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM language_items
			WHERE content_type = ? AND srs_stage >= ? AND lesson_completed_at IS NOT NULL`,
			[contentType, minStage],
		);
		return rows[0]?.count ?? 0;
	});
}

/** Check if there are any locked items for a given content type and JLPT level */
export async function hasLockedItemsForJlptLevel(
	contentType: ContentType,
	jlptLevel: string | null,
): Promise<QueryResult<boolean>> {
	return safeQuery(async () => {
		const db = await getDb();
		const levelClause = jlptLevel === null ? "jlpt_level IS NULL" : "jlpt_level = ?";
		const params = jlptLevel === null ? [] : [jlptLevel];
		const rows = await db.select<{ id: number }[]>(
			`SELECT 1 as id FROM language_items
			WHERE content_type = ? AND srs_stage = 0 AND ${levelClause}
			LIMIT 1`,
			[contentType, ...params],
		);
		return rows.length > 0;
	});
}
