import { getDb, type QueryResult, safeQuery, sqlPlaceholders, withTransaction } from "../database";

import { calculateNextReview, STANDARD_INTERVALS, ACCELERATED_INTERVALS } from "$lib/srs/srs-common";

export function computeFirstReviewTime(level: number): string {
	const intervals = level <= 2 ? ACCELERATED_INTERVALS : STANDARD_INTERVALS;
	return calculateNextReview(1, intervals) ?? "";
}

export interface KanjiLevelItem {
	id: number;
	level: number;
	item_type: string;
	character: string;
	meanings: string;
	readings_on: string | null;
	readings_kun: string | null;
	reading: string | null;
	radicals: string | null;
	mnemonic_meaning: string | null;
	mnemonic_reading: string | null;
	srs_stage: number;
	unlocked_at: string | null;
	next_review: string | null;
	correct_count: number;
	incorrect_count: number;
	lesson_completed_at: string | null;
	user_notes: string | null;
	user_synonyms: string | null;
	image_url: string | null;
	wk_id: number | null;
	component_ids: string | null;
	parts_of_speech: string | null;
	context_sentences: string | null;
	pronunciation_audios: string | null;
	visually_similar_ids: string | null;
	character_images: string | null;
	meaning_hint: string | null;
	reading_hint: string | null;
	meaning_current_streak: number;
	meaning_max_streak: number;
	reading_current_streak: number;
	reading_max_streak: number;
}

export interface LevelProgress {
	level: number;
	total: number;
	guru_plus: number;
	unlocked: number;
	percentage: number;
}

export async function getKanjiByLevel(level: number): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			"SELECT * FROM kanji_levels WHERE level = ? ORDER BY item_type, character",
			[level],
		);
	});
}

export async function getKanjiItemById(id: number): Promise<QueryResult<KanjiLevelItem | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<KanjiLevelItem[]>("SELECT * FROM kanji_levels WHERE id = ?", [id]);
		return rows[0] ?? null;
	});
}

export async function getKanjiByCharacter(
	character: string,
): Promise<QueryResult<KanjiLevelItem | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<KanjiLevelItem[]>(
			"SELECT * FROM kanji_levels WHERE character = ? AND item_type = 'kanji'",
			[character],
		);
		return rows[0] ?? null;
	});
}

export async function getDueKanjiReviews(
	order: "due-first" | "apprentice-first" | "lower-srs" | "lower-level" = "due-first",
): Promise<QueryResult<KanjiLevelItem[]>> {
	// SAFE: Intentional SQL interpolation from static allowlist -- ORDER_CLAUSES values are hardcoded strings only
	const ORDER_CLAUSES: Record<string, string> = {
		"due-first": "next_review ASC",
		"apprentice-first": "CASE WHEN srs_stage <= 4 THEN 0 ELSE 1 END, srs_stage ASC",
		"lower-srs": "srs_stage ASC, next_review ASC",
		"lower-level": "level ASC, next_review ASC",
	};
	if (!(order in ORDER_CLAUSES)) {
		throw new Error(`Invalid review order: ${order}`);
	}
	const orderBy = ORDER_CLAUSES[order];
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE srs_stage > 0 AND srs_stage < 9
			AND lesson_completed_at IS NOT NULL
			AND next_review IS NOT NULL AND next_review <= datetime('now')
			ORDER BY ${orderBy}`,
		);
	});
}

export async function getUnlockedItems(level?: number): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		if (level !== undefined) {
			return db.select<KanjiLevelItem[]>(
				"SELECT * FROM kanji_levels WHERE level = ? AND srs_stage > 0 ORDER BY item_type, character",
				[level],
			);
		}
		return db.select<KanjiLevelItem[]>(
			"SELECT * FROM kanji_levels WHERE srs_stage > 0 ORDER BY level, item_type, character",
		);
	});
}

export async function getLevelProgress(level: number): Promise<QueryResult<LevelProgress>> {
	return safeQuery(async () => {
		const db = await getDb();
		// Kanji-only counts for level-up calculation (WK levels up based on kanji only)
		const rows = await db.select<{ total: number; guru_plus: number; unlocked: number }[]>(
			`SELECT
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked
			FROM kanji_levels WHERE level = ? AND item_type = 'kanji'`,
			[level],
		);
		const { total, guru_plus, unlocked } = rows[0] ?? { total: 0, guru_plus: 0, unlocked: 0 };
		return {
			level,
			total,
			guru_plus,
			unlocked,
			percentage: total > 0 ? Math.round((guru_plus / total) * 100) : 0,
		};
	});
}

export interface LevelProgressByType {
	level: number;
	radicals: { total: number; guru_plus: number; unlocked: number };
	kanji: { total: number; guru_plus: number; unlocked: number };
	vocab: { total: number; guru_plus: number; unlocked: number };
}

export async function getLevelProgressByType(level: number): Promise<QueryResult<LevelProgressByType>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ item_type: string; total: number; guru_plus: number; unlocked: number }[]>(
			`SELECT item_type,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked
			FROM kanji_levels WHERE level = ?
			GROUP BY item_type`,
			[level],
		);
		const empty = { total: 0, guru_plus: 0, unlocked: 0 };
		const result: LevelProgressByType = { level, radicals: { ...empty }, kanji: { ...empty }, vocab: { ...empty } };
		for (const row of rows) {
			const counts = { total: row.total, guru_plus: row.guru_plus, unlocked: row.unlocked };
			if (row.item_type === "radical") result.radicals = counts;
			else if (row.item_type === "kanji") result.kanji = counts;
			else if (row.item_type === "vocab") result.vocab = counts;
		}
		return result;
	});
}

// WK level = lowest level where <90% of kanji are at Guru+
export async function getUserLevel(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ current_level: number }[]>(
			`SELECT COALESCE(
				(SELECT MIN(level) FROM (
					SELECT level,
						COUNT(*) as total,
						COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru
					FROM kanji_levels
					WHERE item_type = 'kanji'
					GROUP BY level
				) WHERE total > 0 AND (guru * 1.0 / total) < 0.9),
				60
			) as current_level`,
		);
		return rows[0]?.current_level ?? 1;
	});
}

export async function updateKanjiSrsState(
	id: number,
	srsStage: number,
	nextReview: string | null,
	correctDelta: number,
	incorrectDelta: number,
	meaningIncorrect = 0,
	readingIncorrect = 0,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`UPDATE kanji_levels SET
				srs_stage = ?,
				next_review = ?,
				correct_count = correct_count + ?,
				incorrect_count = incorrect_count + ?,
				meaning_current_streak = CASE WHEN ? = 0 THEN meaning_current_streak + 1 ELSE 0 END,
				meaning_max_streak = CASE WHEN ? = 0 THEN MAX(meaning_max_streak, meaning_current_streak + 1) ELSE meaning_max_streak END,
				reading_current_streak = CASE WHEN ? = 0 THEN reading_current_streak + 1 ELSE 0 END,
				reading_max_streak = CASE WHEN ? = 0 THEN MAX(reading_max_streak, reading_current_streak + 1) ELSE reading_max_streak END
			WHERE id = ?`,
			[srsStage, nextReview, correctDelta, incorrectDelta,
				meaningIncorrect, meaningIncorrect,
				readingIncorrect, readingIncorrect,
				id],
		);
	});
}

export async function unlockItems(ids: number[]): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		const placeholders = sqlPlaceholders(ids.length);
		await db.execute(
			`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
			WHERE id IN (${placeholders}) AND srs_stage = 0`,
			ids,
		);
	});
}

export async function checkAndUnlockLevel(level: number): Promise<QueryResult<number[]>> {
	return safeQuery(async () => {
		return await withTransaction(async (db) => {
			const unlockedIds: number[] = [];

			// 1. If 90%+ radicals at Guru -> unlock kanji for this level
			const radicalProgress = await db.select<{ total: number; guru: number }[]>(
				`SELECT COUNT(*) as total,
					COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru
				FROM kanji_levels WHERE level = ? AND item_type = 'radical'`,
				[level],
			);
			const rp = radicalProgress[0];
			if (rp.total > 0 && rp.guru / rp.total >= 0.9) {
				const lockedKanji = await db.select<{ id: number }[]>(
					"SELECT id FROM kanji_levels WHERE level = ? AND item_type = 'kanji' AND srs_stage = 0",
					[level],
				);
				const kanjiIds = lockedKanji.map((r) => r.id);
				if (kanjiIds.length > 0) {
					const ph = sqlPlaceholders(kanjiIds.length);
					await db.execute(
						`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
						WHERE id IN (${ph})`,
						kanjiIds,
					);
					unlockedIds.push(...kanjiIds);
				}
			}

			// 2. Per-item vocab unlock: unlock vocab whose component kanji are ALL at Guru+
			// Use SQL subquery to avoid materializing all guru items into JS
			const vocabToUnlock = await db.select<{ id: number }[]>(
				`SELECT kl.id FROM kanji_levels kl
				WHERE kl.item_type = 'vocab' AND kl.srs_stage = 0 AND kl.component_ids IS NOT NULL
				AND NOT EXISTS (
					SELECT 1 FROM json_each(kl.component_ids) je
					WHERE NOT EXISTS (
						SELECT 1 FROM kanji_levels kl2
						WHERE kl2.wk_id = CAST(je.value AS INTEGER) AND kl2.srs_stage >= 5
					)
				)`,
			);
			const vocabIds = vocabToUnlock.map((r) => r.id);
			if (vocabIds.length > 0) {
				const ph = sqlPlaceholders(vocabIds.length);
				await db.execute(
					`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
					WHERE id IN (${ph})`,
					vocabIds,
				);
				unlockedIds.push(...vocabIds);
			}

			// 3. If 90%+ kanji at Guru -> unlock next level radicals (level progression)
			const kanjiProgress = await db.select<{ total: number; guru: number }[]>(
				`SELECT COUNT(*) as total,
					COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru
				FROM kanji_levels WHERE level = ? AND item_type = 'kanji'`,
				[level],
			);
			const kp = kanjiProgress[0];
			if (kp.total > 0 && kp.guru / kp.total >= 0.9) {
				const nextLevel = level + 1;
				if (nextLevel <= 60) {
					const lockedNextRadicals = await db.select<{ id: number }[]>(
						"SELECT id FROM kanji_levels WHERE level = ? AND item_type = 'radical' AND srs_stage = 0",
						[nextLevel],
					);
					const nextRadicalIds = lockedNextRadicals.map((r) => r.id);
					if (nextRadicalIds.length > 0) {
						const ph = sqlPlaceholders(nextRadicalIds.length);
						await db.execute(
							`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
							WHERE id IN (${ph})`,
							nextRadicalIds,
						);
						unlockedIds.push(...nextRadicalIds);
					}
				}
			}

			return unlockedIds;
		});
	});
}

export async function getAllLevelProgress(): Promise<QueryResult<LevelProgress[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		// Kanji-only for level progression (WK levels up based on kanji guru %)
		const rows = await db.select<
			{ level: number; total: number; guru_plus: number; unlocked: number }[]
		>(
			`SELECT level,
				COUNT(*) as total,
				COUNT(CASE WHEN srs_stage >= 5 THEN 1 END) as guru_plus,
				COUNT(CASE WHEN srs_stage > 0 THEN 1 END) as unlocked
			FROM kanji_levels
			WHERE item_type = 'kanji'
			GROUP BY level
			ORDER BY level`,
		);
		return rows.map((r) => ({
			level: r.level,
			total: r.total,
			guru_plus: r.guru_plus,
			unlocked: r.unlocked,
			percentage: r.total > 0 ? Math.round((r.guru_plus / r.total) * 100) : 0,
		}));
	});
}

export async function getAdjacentKanji(
	level: number,
	currentId: number,
	itemType: string,
): Promise<QueryResult<{ prev: KanjiLevelItem | null; next: KanjiLevelItem | null }>> {
	return safeQuery(async () => {
		const db = await getDb();
		// Get current item's sort key for alphabetical navigation
		const currentRows = await db.select<{ sort_key: string }[]>(
			"SELECT json_extract(meanings, '$[0]') as sort_key FROM kanji_levels WHERE id = ?",
			[currentId],
		);
		const currentKey = currentRows[0]?.sort_key ?? "";

		// Previous: same level + type, alphabetically before current
		const prevRows = await db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE level = ? AND item_type = ?
			AND (json_extract(meanings, '$[0]') < ? OR (json_extract(meanings, '$[0]') = ? AND id < ?))
			ORDER BY json_extract(meanings, '$[0]') DESC, id DESC LIMIT 1`,
			[level, itemType, currentKey, currentKey, currentId],
		);
		// Next: same level + type, alphabetically after current
		const nextRows = await db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE level = ? AND item_type = ?
			AND (json_extract(meanings, '$[0]') > ? OR (json_extract(meanings, '$[0]') = ? AND id > ?))
			ORDER BY json_extract(meanings, '$[0]') ASC, id ASC LIMIT 1`,
			[level, itemType, currentKey, currentKey, currentId],
		);
		return {
			prev: prevRows[0] ?? null,
			next: nextRows[0] ?? null,
		};
	});
}

export async function getDueKanjiCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM kanji_levels
			WHERE srs_stage > 0 AND srs_stage < 9
			AND lesson_completed_at IS NOT NULL
			AND next_review IS NOT NULL AND next_review <= datetime('now')`,
		);
		return rows[0]?.count ?? 0;
	});
}

export async function getAvailableLessons(limit = 5): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE srs_stage >= 1 AND lesson_completed_at IS NULL
			ORDER BY level ASC,
				CASE item_type WHEN 'radical' THEN 0 WHEN 'kanji' THEN 1 WHEN 'vocab' THEN 2 ELSE 3 END,
				character ASC
			LIMIT ?`,
			[limit],
		);
	});
}

export async function getAvailableLessonCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM kanji_levels
			WHERE srs_stage >= 1 AND lesson_completed_at IS NULL`,
		);
		return rows[0]?.count ?? 0;
	});
}

export async function markLessonCompleted(ids: number[], level = 1): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		const nextReview = computeFirstReviewTime(level);
		const placeholders = sqlPlaceholders(ids.length);
		await db.execute(
			`UPDATE kanji_levels
			SET lesson_completed_at = datetime('now'),
				next_review = ?
			WHERE id IN (${placeholders})`,
			[nextReview, ...ids],
		);
	});
}

export async function getUpcomingReviews(
	hours = 24,
): Promise<QueryResult<{ hour: string; count: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ hour: string; count: number }[]>(
			`SELECT strftime('%Y-%m-%d %H:00', next_review) as hour, COUNT(*) as count
			FROM kanji_levels
			WHERE srs_stage > 0 AND srs_stage < 9
			AND lesson_completed_at IS NOT NULL
			AND next_review IS NOT NULL
			AND next_review > datetime('now')
			AND next_review <= datetime('now', '+' || ? || ' hours')
			GROUP BY strftime('%Y-%m-%d %H:00', next_review)
			ORDER BY hour ASC`,
			[hours],
		);
	});
}

export async function getSrsDistribution(): Promise<
	QueryResult<{ item_type: string; srs_stage: number; count: number }[]>
> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ item_type: string; srs_stage: number; count: number }[]>(
			`SELECT item_type, srs_stage, COUNT(*) as count
			FROM kanji_levels
			WHERE srs_stage > 0
			GROUP BY item_type, srs_stage
			ORDER BY srs_stage, item_type`,
		);
	});
}

export async function getCriticalItems(
	threshold = 0.7,
	limit = 10,
): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE (correct_count + incorrect_count) >= 4
			AND CAST(correct_count AS REAL) / (correct_count + incorrect_count) < ?
			AND srs_stage > 0 AND srs_stage < 9
			ORDER BY CAST(correct_count AS REAL) / (correct_count + incorrect_count) ASC
			LIMIT ?`,
			[threshold, limit],
		);
	});
}

export async function getRecentlyUnlocked(limit = 10): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE unlocked_at IS NOT NULL AND srs_stage > 0
			ORDER BY unlocked_at DESC
			LIMIT ?`,
			[limit],
		);
	});
}

export async function initializeKanjiProgression(): Promise<QueryResult<number[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		// Check if any items already have srs_stage > 0
		const existing = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM kanji_levels WHERE srs_stage > 0",
		);
		if (existing[0].count > 0) return [];

		// Unlock all level 1 radicals
		const radicals = await db.select<{ id: number }[]>(
			"SELECT id FROM kanji_levels WHERE level = 1 AND item_type = 'radical' AND srs_stage = 0",
		);
		const ids = radicals.map((r) => r.id);
		if (ids.length === 0) return [];

		const placeholders = sqlPlaceholders(ids.length);
		await db.execute(
			`UPDATE kanji_levels SET srs_stage = 1, unlocked_at = datetime('now'), next_review = datetime('now')
			WHERE id IN (${placeholders})`,
			ids,
		);
		return ids;
	});
}

export interface ItemsByLevel {
	level: number;
	total: number;
	unlocked: number;
	items: KanjiLevelItem[];
}

export async function getItemsByTypeAndTier(
	itemType: string,
	startLevel: number,
	endLevel: number,
): Promise<QueryResult<ItemsByLevel[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const items = await db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE item_type = ? AND level >= ? AND level <= ?
			ORDER BY level ASC, json_extract(meanings, '$[0]') ASC`,
			[itemType, startLevel, endLevel],
		);

		// Group by level
		const byLevel = new Map<number, KanjiLevelItem[]>();
		for (let lvl = startLevel; lvl <= endLevel; lvl++) {
			byLevel.set(lvl, []);
		}
		for (const item of items) {
			const arr = byLevel.get(item.level);
			if (arr) arr.push(item);
		}

		const result: ItemsByLevel[] = [];
		for (const [level, levelItems] of byLevel) {
			if (levelItems.length === 0) continue;
			result.push({
				level,
				total: levelItems.length,
				unlocked: levelItems.filter((i) => i.srs_stage > 0).length,
				items: levelItems,
			});
		}
		return result;
	});
}

export interface LevelItemsByType {
	radicals: KanjiLevelItem[];
	kanji: KanjiLevelItem[];
	vocab: KanjiLevelItem[];
}

export async function getItemsByLevel(level: number): Promise<QueryResult<LevelItemsByType>> {
	return safeQuery(async () => {
		const db = await getDb();
		const items = await db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE level = ?
			ORDER BY CASE item_type WHEN 'radical' THEN 0 WHEN 'kanji' THEN 1 WHEN 'vocab' THEN 2 ELSE 3 END,
				json_extract(meanings, '$[0]') ASC`,
			[level],
		);
		const result: LevelItemsByType = { radicals: [], kanji: [], vocab: [] };
		for (const item of items) {
			if (item.item_type === "radical") result.radicals.push(item);
			else if (item.item_type === "kanji") result.kanji.push(item);
			else if (item.item_type === "vocab") result.vocab.push(item);
		}
		return result;
	});
}

export async function getAllAvailableLessons(limit = 200): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE srs_stage >= 1 AND lesson_completed_at IS NULL
			ORDER BY level ASC,
				CASE item_type WHEN 'radical' THEN 0 WHEN 'kanji' THEN 1 WHEN 'vocab' THEN 2 ELSE 3 END,
				character ASC
			LIMIT ?`,
			[limit],
		);
	});
}

export async function getRecentLessonItems(limit = 50): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE lesson_completed_at IS NOT NULL
			ORDER BY lesson_completed_at DESC
			LIMIT ?`,
			[limit],
		);
	});
}

export async function getBurnedItems(limit = 100): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE srs_stage = 9
			ORDER BY level ASC, item_type ASC, character ASC
			LIMIT ?`,
			[limit],
		);
	});
}

export async function getRecentMistakeItems(limit = 50): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT kl.* FROM kanji_levels kl
			WHERE kl.id IN (
				SELECT DISTINCT kanji_level_id FROM kanji_review_log WHERE correct = 0
			)
			ORDER BY (
				SELECT MAX(reviewed_at) FROM kanji_review_log
				WHERE kanji_level_id = kl.id AND correct = 0
			) DESC
			LIMIT ?`,
			[limit],
		);
	});
}

export async function isKanjiSeeded(): Promise<QueryResult<boolean>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = 'kanji_seeded'",
		);
		return rows.length > 0 && rows[0].value === "true";
	});
}

export async function markKanjiSeeded(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"INSERT OR REPLACE INTO settings (key, value) VALUES ('kanji_seeded', 'true')",
		);
	});
}

/** Reset all kanji learning progress (SRS state, review logs). Does NOT delete items. */
export async function resetAllKanjiProgress(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		await withTransaction(async (db) => {
			await db.execute("DELETE FROM kanji_review_log");
			await db.execute(`UPDATE kanji_levels SET
				srs_stage = 0,
				unlocked_at = NULL,
				next_review = NULL,
				correct_count = 0,
				incorrect_count = 0,
				lesson_completed_at = NULL
			`);
		});
	});
}

export async function getItemsByWkIds(
	wkIds: number[],
): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		if (wkIds.length === 0) return [];
		const db = await getDb();
		const placeholders = sqlPlaceholders(wkIds.length);
		return db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels WHERE wk_id IN (${placeholders})`,
			wkIds,
		);
	});
}

export async function getItemsContainingComponent(
	wkId: number,
	targetType: string,
): Promise<QueryResult<KanjiLevelItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiLevelItem[]>(
			`SELECT kl.* FROM kanji_levels kl
			WHERE kl.item_type = ? AND kl.component_ids IS NOT NULL
			AND EXISTS (SELECT 1 FROM json_each(kl.component_ids) je WHERE CAST(je.value AS INTEGER) = ?)`,
			[targetType, wkId],
		);
	});
}

export async function updateUserSynonyms(
	id: number,
	synonyms: string[],
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("UPDATE kanji_levels SET user_synonyms = ? WHERE id = ?", [
			synonyms.length > 0 ? JSON.stringify(synonyms) : null,
			id,
		]);
	});
}

export async function updateUserNotes(
	id: number,
	notes: string,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("UPDATE kanji_levels SET user_notes = ? WHERE id = ?", [
			notes.trim() || null,
			id,
		]);
	});
}

/** Search kanji items via FTS5, falling back to LIKE on FTS failure */
export async function searchKanjiItems(
	query: string,
	limit = 50,
): Promise<QueryResult<KanjiLevelItem[]>> {
	const trimmed = query.trim();
	if (!trimmed) return { ok: true, data: [] };

	return safeQuery(async () => {
		const db = await getDb();
		const ftsQuery = `"${trimmed.replace(/"/g, '""')}"*`;
		try {
			return await db.select<KanjiLevelItem[]>(
				`SELECT kl.* FROM kanji_levels kl
				JOIN kanji_fts ON kanji_fts.rowid = kl.id
				WHERE kanji_fts MATCH ?
				ORDER BY rank
				LIMIT ?`,
				[ftsQuery, limit],
			);
		} catch (ftsError) {
			console.warn("[Kanji FTS] Falling back to LIKE search:", ftsError);
			const likeQuery = `%${trimmed}%`;
			return db.select<KanjiLevelItem[]>(
				`SELECT * FROM kanji_levels
				WHERE character LIKE ? OR meanings LIKE ? OR readings_on LIKE ? OR readings_kun LIKE ?
				ORDER BY level ASC
				LIMIT ?`,
				[likeQuery, likeQuery, likeQuery, likeQuery, limit],
			);
		}
	});
}

export async function rebuildKanjiFtsIndex(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("DELETE FROM kanji_fts");
		await db.execute(
			`INSERT INTO kanji_fts(rowid, character, meanings, readings)
			SELECT id, character, meanings,
				COALESCE(readings_on, '') || ' ' || COALESCE(readings_kun, '') || ' ' || COALESCE(reading, '')
			FROM kanji_levels`,
		);
	});
}
