import {
	type Database,
	executeBatch,
	getDb,
	type QueryResult,
	safeQuery,
	sqlPlaceholders,
} from "../database";
import { CACHE_KEYS, getCached, setCache } from "../query-cache";

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
	language_level: number | null;
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
			where +=
				" AND (primary_text LIKE ? ESCAPE '\\' OR reading LIKE ? ESCAPE '\\' OR meaning LIKE ? ESCAPE '\\' OR item_key LIKE ? ESCAPE '\\')";
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
		const rows = await db.select<LanguageItem[]>("SELECT * FROM language_items WHERE id = ?", [id]);
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

export async function updateLanguageItemSrsExec(
	dbHandle: Database,
	id: number,
	srsStage: number,
	nextReview: string | null,
	correctCount: number,
	incorrectCount: number,
): Promise<void> {
	await dbHandle.execute(
		`UPDATE language_items SET
			srs_stage = ?, next_review = ?, correct_count = ?, incorrect_count = ?,
			updated_at = datetime('now')
		WHERE id = ?`,
		[srsStage, nextReview, correctCount, incorrectCount, id],
	);
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
		await updateLanguageItemSrsExec(db, id, srsStage, nextReview, correctCount, incorrectCount);
	});
}

export async function logLanguageReviewExec(
	dbHandle: Database,
	itemId: number,
	srsStageBefore: number,
	srsStageAfter: number,
	correct: boolean,
	durationMs?: number | null,
): Promise<number> {
	const result = await dbHandle.execute(
		`INSERT INTO language_review_log (item_id, srs_stage_before, srs_stage_after, correct, duration_ms)
		VALUES (?, ?, ?, ?, ?)`,
		[itemId, srsStageBefore, srsStageAfter, correct ? 1 : 0, durationMs ?? null],
	);
	return result.lastInsertId ?? 0;
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
		return logLanguageReviewExec(db, itemId, srsStageBefore, srsStageAfter, correct, durationMs);
	});
}

export async function deleteLatestLanguageReview(itemId: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`DELETE FROM language_review_log WHERE id = (
				SELECT id FROM language_review_log WHERE item_id = ? ORDER BY id DESC LIMIT 1
			)`,
			[itemId],
		);
	});
}

export async function getDueLanguageItems(
	contentType?: ContentType,
	limit = 200,
): Promise<QueryResult<LanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where =
			"srs_stage > 0 AND srs_stage < 9 AND lesson_completed_at IS NOT NULL AND next_review IS NOT NULL AND next_review <= datetime('now')";

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

export async function getLanguageSrsDistribution(): Promise<
	QueryResult<{ srs_stage: number; count: number }[]>
> {
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
export async function getDueLanguageCount(contentType?: ContentType): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where =
			"srs_stage > 0 AND srs_stage < 9 AND lesson_completed_at IS NOT NULL AND next_review IS NOT NULL AND next_review <= datetime('now')";

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
export async function getItemKeyStages(
	itemKeys: string[],
): Promise<QueryResult<{ item_key: string; srs_stage: number }[]>> {
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

// ===================== Dashboard Queries =====================

/** Count reviews completed today */
export async function getTodayLanguageReviewCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM language_review_log WHERE created_at >= date('now', 'start of day')",
		);
		return rows[0]?.count ?? 0;
	});
}

/** Count lessons completed today */
export async function getTodayLanguageLessonCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM language_items WHERE date(lesson_completed_at) = date('now')",
		);
		return rows[0]?.count ?? 0;
	});
}

/** Forecast: upcoming reviews bucketed by hour for next N hours */
export async function getUpcomingLanguageReviews(
	hours: number,
): Promise<QueryResult<{ hour: string; count: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ hour: string; count: number }[]>(
			`SELECT strftime('%Y-%m-%d %H:00', next_review) as hour, COUNT(*) as count
			FROM language_items
			WHERE srs_stage BETWEEN 1 AND 8
				AND lesson_completed_at IS NOT NULL
				AND next_review > datetime('now')
				AND next_review <= datetime('now', '+' || ? || ' hours')
			GROUP BY hour ORDER BY hour`,
			[hours],
		);
	});
}

export interface CriticalLanguageItem {
	id: number;
	content_type: string;
	primary_text: string;
	reading: string | null;
	meaning: string | null;
	srs_stage: number;
	correct_count: number;
	incorrect_count: number;
	accuracy: number;
}

/** Items with accuracy below threshold (at least 4 reviews) */
export async function getCriticalLanguageItems(
	threshold: number,
	limit: number,
): Promise<QueryResult<CriticalLanguageItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<CriticalLanguageItem[]>(
			`SELECT id, content_type, primary_text, reading, meaning, srs_stage,
				correct_count, incorrect_count,
				ROUND(CAST(correct_count AS REAL) / (correct_count + incorrect_count) * 100) as accuracy
			FROM language_items
			WHERE srs_stage BETWEEN 1 AND 8
				AND (correct_count + incorrect_count) >= 4
				AND CAST(correct_count AS REAL) / (correct_count + incorrect_count) < ?
			ORDER BY accuracy ASC
			LIMIT ?`,
			[threshold, limit],
		);
	});
}

export interface RecentLanguageMistake {
	id: number;
	content_type: string;
	primary_text: string;
	reading: string | null;
	meaning: string | null;
	srs_stage: number;
	last_mistake: string;
}

/** Items answered incorrectly, most recent first */
export async function getRecentLanguageMistakes(
	limit: number,
): Promise<QueryResult<RecentLanguageMistake[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<RecentLanguageMistake[]>(
			`SELECT li.id, li.content_type, li.primary_text, li.reading, li.meaning, li.srs_stage,
				MAX(lr.created_at) as last_mistake
			FROM language_review_log lr
			JOIN language_items li ON li.id = lr.item_id
			WHERE lr.correct = 0
			GROUP BY li.id
			ORDER BY last_mistake DESC
			LIMIT ?`,
			[limit],
		);
	});
}

export interface LanguageLevelProgressByType {
	content_type: string;
	total: number;
	guru_plus: number;
	unlocked: number;
}

/** Get level progress broken down by content type */
export async function getLanguageLevelProgressByType(
	level: number,
): Promise<QueryResult<LanguageLevelProgressByType[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LanguageLevelProgressByType[]>(
			`SELECT content_type,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked
			FROM language_items
			WHERE language_level = ?
			GROUP BY content_type`,
			[level],
		);
	});
}

/** Read the user's selected learning path from the settings table. Returns null if not set. */
export async function getLanguagePath(): Promise<QueryResult<string | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = 'language_path'",
		);
		return rows.length > 0 ? rows[0].value : null;
	});
}

/** Write the selected learning path to the settings table. */
export async function setLanguagePath(pathId: string): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('language_path', ?)", [
			pathId,
		]);
	});
}

/** Delete the language_levels_v5_paths seed flag so assignLanguageLevels() re-runs. */
export async function clearLanguageLevelsSeed(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("DELETE FROM settings WHERE key = 'language_levels_v5_paths'");
	});
}

/** Reset all language learning progress (SRS state, review logs, path selection). Does NOT delete items. */
export async function resetAllLanguageProgress(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		await executeBatch([
			"DELETE FROM language_review_log",
			`UPDATE language_items SET
				srs_stage = 0,
				unlocked_at = NULL,
				next_review = NULL,
				correct_count = 0,
				incorrect_count = 0,
				lesson_completed_at = NULL`,
			"DELETE FROM settings WHERE key = 'language_path'",
			"DELETE FROM settings WHERE key = 'language_levels_v5_paths'",
		]);
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
export async function getJlptLevelProgress(
	jlptLevel: string,
): Promise<QueryResult<{ total: number; guru_plus: number }>> {
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
export async function getNextLockedKanaGroup(): Promise<
	QueryResult<{ lesson_group: string; lesson_order: number } | null>
> {
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
export async function getLockedKanaByGroup(
	lessonGroup: string,
): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			"SELECT id FROM language_items WHERE content_type = 'kana' AND srs_stage = 0 AND lesson_group = ?",
			[lessonGroup],
		);
	});
}

/** Get progress for a kana lesson_group: total items and how many are at Apprentice 4+ */
export async function getKanaGroupProgress(
	lessonGroup: string,
): Promise<QueryResult<{ total: number; at_apprentice4_plus: number }>> {
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
export async function getPreviousKanaGroup(
	lessonOrder: number,
): Promise<QueryResult<string | null>> {
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
export async function getPendingLessonCount(
	contentType: ContentType,
): Promise<QueryResult<number>> {
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

/** Get a batch of locked vocabulary items for a JLPT level, ordered by topic then frequency */
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
			ORDER BY COALESCE(lesson_order, 999) ASC, COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			params,
		);
	});
}

/** Get a batch of locked grammar items for a JLPT level, ordered by lesson_order then frequency.
 *  Excludes items with lesson_group (those are handled by group-based progression). */
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
			WHERE content_type = 'grammar' AND srs_stage = 0 AND lesson_group IS NULL AND ${levelClause}
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			params,
		);
	});
}

/** Get a batch of locked sentences for a JLPT level, ordered by frequency */
export async function getLockedSentenceBatch(
	jlptLevel: string | null,
	limit: number,
): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const levelClause = jlptLevel === null ? "jlpt_level IS NULL" : "jlpt_level = ?";
		const params = jlptLevel === null ? [limit] : [jlptLevel, limit];
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			WHERE content_type = 'sentence' AND srs_stage = 0 AND ${levelClause}
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			params,
		);
	});
}

/** Get a batch of locked conjugation items ordered by lesson_order then frequency/id */
export async function getLockedConjugationBatch(
	limit: number,
): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			WHERE content_type = 'conjugation' AND srs_stage = 0
			ORDER BY COALESCE(lesson_order, 999) ASC, COALESCE(frequency_rank, 999999) ASC, id ASC
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

// --- Browse page queries ---

export interface JlptGroupCount {
	jlpt_level: string;
	total: number;
	unlocked: number;
	guru_plus: number;
}

/** Counts per JLPT level for a content type (for tier progress display) */
export async function getLanguageItemCountsByJlpt(
	contentType: ContentType,
): Promise<QueryResult<JlptGroupCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<JlptGroupCount[]>(
			`SELECT
				COALESCE(jlpt_level, 'None') as jlpt_level,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items
			WHERE content_type = ?
			GROUP BY COALESCE(jlpt_level, 'None')
			ORDER BY
				CASE COALESCE(jlpt_level, 'None')
					WHEN 'N5' THEN 1 WHEN 'N4' THEN 2 WHEN 'N3' THEN 3
					WHEN 'N2' THEN 4 WHEN 'N1' THEN 5 ELSE 6
				END`,
			[contentType],
		);
	});
}

export interface JlptSubGroup {
	groupIndex: number;
	groupKey: string | null;
	groupLabel: string;
	items: LanguageItem[];
	unlocked: number;
	total: number;
}

const GROUP_LABELS: Record<string, string> = {
	// Grammar (Tae Kim sections)
	"grammar-copula": "Copula / State-of-Being",
	"grammar-particles": "Basic Particles",
	"grammar-adjectives": "Adjectives",
	"grammar-verb-basics": "Verb Basics",
	"grammar-negative-verbs": "Negative Verbs",
	"grammar-past-tense": "Past Tense",
	"grammar-verb-particles": "Particles with Verbs",
	"grammar-transitivity": "Transitive / Intransitive",
	"grammar-clauses": "Subordinate Clauses",
	"grammar-noun-particles": "Noun-Related Particles",
	"grammar-adverbs-gobi": "Adverbs & Sentence-Enders",
	"grammar-supplemental": "Supplemental",
	// N5 Vocabulary topics
	"vocab-pronouns": "Pronouns",
	"vocab-numbers": "Numbers",
	"vocab-days": "Days of the Week",
	"vocab-months": "Months",
	"vocab-hours": "Hours",
	"vocab-minutes": "Minutes",
	"vocab-day-numbers": "Day Numbers",
	"vocab-hundreds": "Hundreds",
	"vocab-thousands": "Thousands",
	"vocab-year-students": "Year Students",
	"vocab-age": "Age Counters",
	"vocab-people-counters": "People Counters",
	"vocab-seasons": "Seasons",
	"vocab-family": "Family",
	"vocab-places": "Countries & Places",
	// Expanded vocabulary topics
	"vocab-greetings": "Greetings & Expressions",
	"vocab-question-words": "Question Words",
	"vocab-food": "Food & Drink",
	"vocab-body": "Body & Health",
	"vocab-school": "School & Education",
	"vocab-house": "House & Home",
	"vocab-transport": "Transportation",
	"vocab-nature": "Nature & Weather",
	"vocab-clothes": "Clothing & Accessories",
	"vocab-colors": "Colors",
	"vocab-animals": "Animals",
	"vocab-work": "Work & Office",
	"vocab-location": "Places & Directions",
	"vocab-time": "Time Expressions",
	"vocab-actions": "Common Verbs",
	"vocab-descriptors": "Descriptors",
	"vocab-general": "General",
};

/** Get items for a JLPT level, grouped by lesson_group then chunked */
export async function getLanguageItemsByJlptAndRange(
	contentType: ContentType,
	jlptLevel: string,
): Promise<QueryResult<JlptSubGroup[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const levelClause = jlptLevel === "None" ? "jlpt_level IS NULL" : "jlpt_level = ?";
		const params: (string | number)[] =
			jlptLevel === "None" ? [contentType] : [contentType, jlptLevel];

		const items = await db.select<LanguageItem[]>(
			`SELECT * FROM language_items
			WHERE content_type = ? AND ${levelClause}
			ORDER BY COALESCE(lesson_order, 9999) ASC,
				COALESCE(frequency_rank, 999999) ASC, id ASC`,
			params,
		);

		// Group by lesson_group, preserving order
		const grouped = new Map<string | null, LanguageItem[]>();
		for (const item of items) {
			const key = item.lesson_group ?? null;
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)?.push(item);
		}

		const groups: JlptSubGroup[] = [];
		let idx = 0;
		const GROUP_SIZE = 50;

		for (const [key, groupItems] of grouped) {
			if (key !== null) {
				// Named group: keep as one section
				groups.push({
					groupIndex: idx++,
					groupKey: key,
					groupLabel: GROUP_LABELS[key] ?? key,
					items: groupItems,
					total: groupItems.length,
					unlocked: groupItems.filter((i) => i.srs_stage > 0).length,
				});
			} else {
				// Ungrouped: chunk by 50
				for (let i = 0; i < groupItems.length; i += GROUP_SIZE) {
					const chunk = groupItems.slice(i, i + GROUP_SIZE);
					const start = i + 1;
					const end = i + chunk.length;
					groups.push({
						groupIndex: idx++,
						groupKey: null,
						groupLabel: `Items ${start}-${end}`,
						items: chunk,
						total: chunk.length,
						unlocked: chunk.filter((item) => item.srs_stage > 0).length,
					});
				}
			}
		}
		return groups;
	});
}

/** Get adjacent language items for keyboard navigation in detail view */
export async function getAdjacentLanguageItem(
	contentType: string,
	jlptLevel: string | null,
	currentId: number,
): Promise<QueryResult<{ prev: LanguageItem | null; next: LanguageItem | null }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const levelClause = jlptLevel === null ? "jlpt_level IS NULL" : "jlpt_level = ?";
		const levelParams = jlptLevel === null ? [] : [jlptLevel];

		// Get current item's sort position
		const currentRows = await db.select<{ freq: number; item_id: number }[]>(
			"SELECT COALESCE(frequency_rank, 999999) as freq, id as item_id FROM language_items WHERE id = ?",
			[currentId],
		);
		const currentFreq = currentRows[0]?.freq ?? 999999;

		// Previous: same type + level, ordered before current by frequency then id
		const prevRows = await db.select<LanguageItem[]>(
			`SELECT * FROM language_items
			WHERE content_type = ? AND ${levelClause}
			AND (COALESCE(frequency_rank, 999999) < ? OR (COALESCE(frequency_rank, 999999) = ? AND id < ?))
			ORDER BY COALESCE(frequency_rank, 999999) DESC, id DESC LIMIT 1`,
			[contentType, ...levelParams, currentFreq, currentFreq, currentId],
		);

		// Next: same type + level, ordered after current by frequency then id
		const nextRows = await db.select<LanguageItem[]>(
			`SELECT * FROM language_items
			WHERE content_type = ? AND ${levelClause}
			AND (COALESCE(frequency_rank, 999999) > ? OR (COALESCE(frequency_rank, 999999) = ? AND id > ?))
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC LIMIT 1`,
			[contentType, ...levelParams, currentFreq, currentFreq, currentId],
		);

		return {
			prev: prevRows[0] ?? null,
			next: nextRows[0] ?? null,
		};
	});
}

// --- Grammar group progression queries ---

/** Get the next locked grammar lesson_group (lowest lesson_order with locked items) */
export async function getNextLockedGrammarGroup(): Promise<
	QueryResult<{ lesson_group: string; lesson_order: number } | null>
> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ lesson_group: string; lesson_order: number }[]>(
			`SELECT DISTINCT lesson_group, lesson_order FROM language_items
			WHERE content_type = 'grammar' AND srs_stage = 0 AND lesson_group IS NOT NULL
			ORDER BY lesson_order ASC
			LIMIT 1`,
		);
		return rows.length > 0 ? rows[0] : null;
	});
}

/** Get locked grammar items for a specific lesson_group, ordered by frequency */
export async function getLockedGrammarByGroup(
	lessonGroup: string,
	limit: number,
): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			WHERE content_type = 'grammar' AND srs_stage = 0 AND lesson_group = ?
			ORDER BY COALESCE(frequency_rank, 999999) ASC, id ASC
			LIMIT ?`,
			[lessonGroup, limit],
		);
	});
}

/** Get progress for a grammar lesson_group: total items and how many at Apprentice 4+ */
export async function getGrammarGroupProgress(
	lessonGroup: string,
): Promise<QueryResult<{ total: number; at_apprentice4_plus: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; at_apprentice4_plus: number }[]>(
			`SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 4 THEN 1 END) as at_apprentice4_plus
			FROM language_items WHERE content_type = 'grammar' AND lesson_group = ?`,
			[lessonGroup],
		);
		return rows[0] ?? { total: 0, at_apprentice4_plus: 0 };
	});
}

/** Get the grammar lesson_group just before a given lesson_order */
export async function getPreviousGrammarGroup(
	lessonOrder: number,
): Promise<QueryResult<string | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ lesson_group: string }[]>(
			`SELECT DISTINCT lesson_group FROM language_items
			WHERE content_type = 'grammar' AND lesson_order = ? AND lesson_group IS NOT NULL
			LIMIT 1`,
			[lessonOrder - 1],
		);
		return rows.length > 0 ? rows[0].lesson_group : null;
	});
}

// ===================== Language Level Queries =====================

export interface LanguageLevelProgress {
	level: number;
	total: number;
	guru_plus: number;
	unlocked: number;
	percentage: number;
}

/** Get progress for all language levels (1-60) */
export async function getAllLanguageLevelProgress(): Promise<QueryResult<LanguageLevelProgress[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LanguageLevelProgress[]>(`
			SELECT
				language_level as level,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked,
				CASE WHEN COUNT(*) > 0
					THEN ROUND(COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) * 100.0 / COUNT(*))
					ELSE 0
				END as percentage
			FROM language_items
			WHERE language_level IS NOT NULL
			GROUP BY language_level
			ORDER BY language_level
		`);
	});
}

/** Get progress for a single language level */
export async function getLanguageLevelProgress(
	level: number,
): Promise<QueryResult<LanguageLevelProgress>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<LanguageLevelProgress[]>(
			`
			SELECT
				language_level as level,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked,
				CASE WHEN COUNT(*) > 0
					THEN ROUND(COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) * 100.0 / COUNT(*))
					ELSE 0
				END as percentage
			FROM language_items
			WHERE language_level = ?
		`,
			[level],
		);
		return rows[0] ?? { level, total: 0, guru_plus: 0, unlocked: 0, percentage: 0 };
	});
}

export interface TierLevelCount {
	level: number;
	total: number;
	unlocked: number;
}

/** Get lightweight counts per level for a content type within a tier (fast aggregate) */
export async function getLanguageTierLevelCounts(
	contentType: ContentType,
	startLevel: number,
	endLevel: number,
): Promise<QueryResult<TierLevelCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<TierLevelCount[]>(
			`
			SELECT
				language_level as level,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked
			FROM language_items
			WHERE content_type = ? AND language_level >= ? AND language_level <= ?
			GROUP BY language_level
			ORDER BY language_level ASC
		`,
			[contentType, startLevel, endLevel],
		);
	});
}

export interface LanguageLevelItem {
	id: number;
	content_type: string;
	primary_text: string;
	reading: string | null;
	meaning: string | null;
	srs_stage: number;
	lesson_completed_at: string | null;
	language_level: number;
}

/** Get all items for a language level, grouped by content type */
export async function getLanguageLevelItems(
	level: number,
): Promise<QueryResult<LanguageLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LanguageLevelItem[]>(
			`
			SELECT id, content_type, primary_text, reading, meaning,
				srs_stage, lesson_completed_at, language_level
			FROM language_items
			WHERE language_level = ?
			ORDER BY
				CASE content_type
					WHEN 'kana' THEN 1
					WHEN 'grammar' THEN 2
					WHEN 'vocabulary' THEN 3
					WHEN 'conjugation' THEN 4
					WHEN 'sentence' THEN 5
				END,
				COALESCE(frequency_rank, 999999), id
		`,
			[level],
		);
	});
}

/** Get the user's current language level (lowest level with <90% at Guru+) */
export async function getLanguageUserLevel(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ level: number }[]>(`
			SELECT language_level as level
			FROM language_items
			WHERE language_level IS NOT NULL
			GROUP BY language_level
			HAVING ROUND(COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) * 100.0 / COUNT(*)) < 90
			ORDER BY language_level ASC
			LIMIT 1
		`);
		return rows.length > 0 ? rows[0].level : 1;
	});
}

// ===================== Level-Based Unlock Helpers =====================

/** Get guru+ progress for a content type within a specific level */
export async function getLevelContentTypeProgress(
	level: number,
	contentType: ContentType,
): Promise<QueryResult<{ total: number; guru_plus: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; guru_plus: number }[]>(
			`
			SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items
			WHERE language_level = ? AND content_type = ?
		`,
			[level, contentType],
		);
		return rows[0] ?? { total: 0, guru_plus: 0 };
	});
}

/** Get guru+ progress for all content types in a level in one query */
export async function getLevelAllContentTypeProgress(
	level: number,
): Promise<QueryResult<Record<string, { total: number; guru_plus: number }>>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ content_type: string; total: number; guru_plus: number }[]>(
			`
			SELECT content_type, COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items
			WHERE language_level = ?
			GROUP BY content_type
		`,
			[level],
		);
		const result: Record<string, { total: number; guru_plus: number }> = {};
		for (const row of rows) {
			result[row.content_type] = { total: row.total, guru_plus: row.guru_plus };
		}
		return result;
	});
}

/** Get locked items of a content type within a level, up to a limit */
export async function getLockedItemsByLevelAndType(
	level: number,
	contentType: ContentType,
	limit: number,
): Promise<QueryResult<{ id: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ id: number }[]>(
			`SELECT id FROM language_items
			 WHERE language_level = ? AND content_type = ? AND srs_stage = 0
			 ORDER BY COALESCE(lesson_order, 9999), COALESCE(frequency_rank, 999999), id
			 LIMIT ?`,
			[level, contentType, limit],
		);
	});
}

/** Get overall guru+ progress for ALL items in a level */
export async function getLevelOverallProgress(
	level: number,
): Promise<QueryResult<{ total: number; guru_plus: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ total: number; guru_plus: number }[]>(
			`
			SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items
			WHERE language_level = ?
		`,
			[level],
		);
		return rows[0] ?? { total: 0, guru_plus: 0 };
	});
}

/** Check if a level has 90% Guru+ and unlock the next level's KANA only */
export async function checkAndUnlockLanguageLevel(
	currentLevel: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();

		// Check if current level has 90% at Guru+
		const progress = await db.select<{ total: number; guru_plus: number }[]>(
			`
			SELECT COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items
			WHERE language_level = ?
		`,
			[currentLevel],
		);

		const { total, guru_plus } = progress[0] ?? { total: 0, guru_plus: 0 };
		if (total === 0 || guru_plus / total < 0.9) return 0;

		const nextLevel = currentLevel + 1;
		if (nextLevel > 60) return 0;

		// Unlock next level's KANA only -- vocab unlocks after kana lessons are done
		const result = await db.execute(
			`UPDATE language_items
			 SET srs_stage = 1, unlocked_at = datetime('now')
			 WHERE language_level = ? AND srs_stage = 0 AND content_type = 'kana'`,
			[nextLevel],
		);

		// Also check if the next level has no kana (levels 10+ may be vocab-only)
		// If so, unlock all items in that level directly
		const kanaCount = await db.select<{ cnt: number }[]>(
			"SELECT COUNT(*) as cnt FROM language_items WHERE language_level = ? AND content_type = 'kana'",
			[nextLevel],
		);
		if (kanaCount[0].cnt === 0) {
			// No kana in this level -- unlock everything except sentences
			const vocabResult = await db.execute(
				`UPDATE language_items
				 SET srs_stage = 1, unlocked_at = datetime('now')
				 WHERE language_level = ? AND srs_stage = 0 AND content_type != 'sentence'`,
				[nextLevel],
			);
			return result.rowsAffected + vocabResult.rowsAffected;
		}

		return result.rowsAffected;
	});
}

/**
 * Unlock vocab in a level after all kana in that level have completed lessons.
 * Call this after lesson completion and after reviews.
 */
export async function unlockLevelVocabIfKanaReviewed(level: number): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();

		// Check if all kana in this level have lesson_completed_at set
		const kanaStatus = await db.select<{ total: number; lessoned: number }[]>(
			`
			SELECT COUNT(*) as total,
				COUNT(CASE WHEN lesson_completed_at IS NOT NULL THEN 1 END) as lessoned
			FROM language_items
			WHERE language_level = ? AND content_type = 'kana'
		`,
			[level],
		);

		const { total, lessoned } = kanaStatus[0] ?? { total: 0, lessoned: 0 };
		// If no kana in level or not all lessoned yet, skip
		if (total === 0 || lessoned < total) return 0;

		// All kana lessoned -- unlock non-kana, non-sentence items in this level
		// Sentences have their own per-word gating via prerequisite_keys
		const result = await db.execute(
			`UPDATE language_items
			 SET srs_stage = 1, unlocked_at = datetime('now')
			 WHERE language_level = ? AND srs_stage = 0 AND content_type NOT IN ('kana', 'sentence')`,
			[level],
		);

		if (result.rowsAffected > 0) {
			console.log(
				`[language-levels] Unlocked ${result.rowsAffected} vocab items in level ${level} (kana gate passed)`,
			);
		}

		return result.rowsAffected;
	});
}

// ===================== Level-Based Browsing Queries =====================

export interface LevelGroupCount {
	level: number;
	total: number;
	unlocked: number;
	guru_plus: number;
}

/** Counts per language_level for a content type (for level-based browser) */
export async function getLanguageItemCountsByLevel(
	contentType: ContentType,
): Promise<QueryResult<LevelGroupCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<LevelGroupCount[]>(
			`SELECT
				language_level as level,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus
			FROM language_items
			WHERE content_type = ? AND language_level IS NOT NULL
			GROUP BY language_level
			ORDER BY language_level`,
			[contentType],
		);
	});
}

export interface LanguageItemsByLevel {
	level: number;
	total: number;
	unlocked: number;
	items: LanguageItem[];
	subGroups: { key: string | null; label: string }[];
}

/** Get items for a content type within a tier (startLevel to endLevel), grouped by level */
export async function getLanguageItemsByTypeAndTier(
	contentType: ContentType,
	startLevel: number,
	endLevel: number,
	options?: { limit?: number; offset?: number },
): Promise<QueryResult<LanguageItemsByLevel[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		let sql = `SELECT * FROM language_items
			WHERE content_type = ? AND language_level >= ? AND language_level <= ?
			ORDER BY language_level ASC, COALESCE(lesson_order, 9999) ASC,
				COALESCE(frequency_rank, 999999) ASC, id ASC`;
		const params: (string | number)[] = [contentType, startLevel, endLevel];
		if (options?.limit) {
			sql += ` LIMIT ?`;
			params.push(options.limit);
			if (options.offset) {
				sql += ` OFFSET ?`;
				params.push(options.offset);
			}
		}
		const items = await db.select<LanguageItem[]>(sql, params);

		// Group by level
		const byLevel = new Map<number, LanguageItem[]>();
		for (let lvl = startLevel; lvl <= endLevel; lvl++) {
			byLevel.set(lvl, []);
		}
		for (const item of items) {
			const arr = item.language_level != null ? byLevel.get(item.language_level) : undefined;
			if (arr) arr.push(item);
		}

		const result: LanguageItemsByLevel[] = [];
		for (const [level, levelItems] of byLevel) {
			if (levelItems.length === 0) continue;

			// Collect unique sub-groups for this level
			const seen = new Set<string | null>();
			const subGroups: { key: string | null; label: string }[] = [];
			for (const item of levelItems) {
				const key = item.lesson_group ?? null;
				if (!seen.has(key)) {
					seen.add(key);
					subGroups.push({
						key,
						label: key ? (GROUP_LABELS[key] ?? key) : "Other",
					});
				}
			}

			result.push({
				level,
				total: levelItems.length,
				unlocked: levelItems.filter((i) => i.srs_stage > 0).length,
				items: levelItems,
				subGroups: subGroups.filter((g) => g.key !== null),
			});
		}
		return result;
	});
}

// ===================== Sentence Prerequisite Gating =====================

/**
 * Unlock sentences in a level whose prerequisite vocab/kanji have all been reviewed.
 * Each sentence's prerequisite_keys (JSON array of item_keys) must all have
 * lesson_completed_at set in either language_items or kanji_levels.
 */
export async function unlockSentencesWithMetPrerequisites(
	level: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();

		// Get locked sentences in this level that have prerequisites
		const sentences = await db.select<{ id: number; prerequisite_keys: string | null }[]>(
			`SELECT id, prerequisite_keys FROM language_items
			 WHERE language_level = ? AND content_type = 'sentence' AND srs_stage = 0
			 AND prerequisite_keys IS NOT NULL AND prerequisite_keys != '[]'`,
			[level],
		);

		if (sentences.length === 0) return 0;

		// Also get locked sentences WITHOUT prerequisites -- unlock them directly
		const noPrereqResult = await db.execute(
			`UPDATE language_items
			 SET srs_stage = 1, unlocked_at = datetime('now')
			 WHERE language_level = ? AND content_type = 'sentence' AND srs_stage = 0
			 AND (prerequisite_keys IS NULL OR prerequisite_keys = '[]')`,
			[level],
		);

		// For sentences with prerequisites, check each one
		const toUnlock: number[] = [];

		for (const sentence of sentences) {
			let keys: string[];
			try {
				keys = JSON.parse(sentence.prerequisite_keys ?? "[]");
			} catch {
				continue;
			}
			if (keys.length === 0) {
				toUnlock.push(sentence.id);
				continue;
			}

			// Check if all prerequisite keys have been lessoned
			const placeholders = keys.map(() => "?").join(",");

			// Check language_items
			const langResult = await db.select<{ cnt: number }[]>(
				`SELECT COUNT(*) as cnt FROM language_items
				 WHERE item_key IN (${placeholders}) AND lesson_completed_at IS NOT NULL`,
				keys,
			);

			// Check kanji_levels (for kanji prerequisites)
			const kanjiKeys = keys.filter((k) => k.startsWith("kanji:"));
			let kanjiMet = 0;
			if (kanjiKeys.length > 0) {
				const kanjiChars = kanjiKeys.map((k) => k.replace("kanji:", ""));
				const kPlaceholders = kanjiChars.map(() => "?").join(",");
				const kanjiResult = await db.select<{ cnt: number }[]>(
					`SELECT COUNT(*) as cnt FROM kanji_levels
					 WHERE character IN (${kPlaceholders}) AND lesson_completed_at IS NOT NULL`,
					kanjiChars,
				);
				kanjiMet = kanjiResult[0]?.cnt ?? 0;
			}

			const langMet = langResult[0]?.cnt ?? 0;
			const nonKanjiKeys = keys.filter((k) => !k.startsWith("kanji:")).length;

			if (langMet >= nonKanjiKeys && kanjiMet >= kanjiKeys.length) {
				toUnlock.push(sentence.id);
			}
		}

		if (toUnlock.length > 0) {
			for (let i = 0; i < toUnlock.length; i += 500) {
				const chunk = toUnlock.slice(i, i + 500);
				const placeholders = chunk.map(() => "?").join(",");
				await db.execute(
					`UPDATE language_items SET srs_stage = 1, unlocked_at = datetime('now')
					 WHERE id IN (${placeholders})`,
					chunk,
				);
			}
			console.log(
				`[language-levels] Unlocked ${toUnlock.length} sentences in level ${level} (prerequisites met)`,
			);
		}

		return noPrereqResult.rowsAffected + toUnlock.length;
	});
}
