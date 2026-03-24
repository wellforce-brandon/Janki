import { getDb, type QueryResult, safeQuery } from "../database";

export interface KanjiReviewLogEntry {
	id: number;
	kanji_level_id: number;
	correct: number;
	srs_stage_before: number;
	srs_stage_after: number;
	duration_ms: number | null;
	reviewed_at: string;
}

export interface KanjiReviewDayStats {
	date: string;
	total: number;
	correct: number;
	incorrect: number;
}

export async function logKanjiReview(
	kanjiLevelId: number,
	correct: boolean,
	stageBefore: number,
	stageAfter: number,
	durationMs: number | null,
	meaningIncorrect = 0,
	readingIncorrect = 0,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`INSERT INTO kanji_review_log (kanji_level_id, correct, srs_stage_before, srs_stage_after, duration_ms, meaning_incorrect, reading_incorrect)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				kanjiLevelId,
				correct ? 1 : 0,
				stageBefore,
				stageAfter,
				durationMs,
				meaningIncorrect,
				readingIncorrect,
			],
		);
	});
}

export async function getTodayKanjiReviewCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM kanji_review_log
			WHERE date(reviewed_at) = date('now')`,
		);
		return rows[0].count;
	});
}

export async function getTodayKanjiLessonCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM kanji_levels
			WHERE date(lesson_completed_at) = date('now')`,
		);
		return rows[0]?.count ?? 0;
	});
}

export async function getKanjiReviewStats(
	days: number,
): Promise<QueryResult<KanjiReviewDayStats[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiReviewDayStats[]>(
			`SELECT
				date(reviewed_at) as date,
				COUNT(*) as total,
				SUM(correct) as correct,
				COUNT(*) - SUM(correct) as incorrect
			FROM kanji_review_log
			WHERE reviewed_at >= datetime('now', ? || ' days')
			GROUP BY date(reviewed_at)
			ORDER BY date(reviewed_at)`,
			[`-${days}`],
		);
	});
}

export async function getRecentMistakes(
	limit = 10,
): Promise<
	QueryResult<(KanjiReviewLogEntry & { character: string; meanings: string; item_type: string })[]>
> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<
			(KanjiReviewLogEntry & { character: string; meanings: string; item_type: string })[]
		>(
			`SELECT r.*, k.character, k.meanings, k.item_type
			FROM kanji_review_log r
			JOIN kanji_levels k ON r.kanji_level_id = k.id
			WHERE r.correct = 0
			ORDER BY r.reviewed_at DESC
			LIMIT ?`,
			[limit],
		);
	});
}
