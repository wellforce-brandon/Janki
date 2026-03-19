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
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`INSERT INTO kanji_review_log (kanji_level_id, correct, srs_stage_before, srs_stage_after, duration_ms)
			VALUES (?, ?, ?, ?, ?)`,
			[kanjiLevelId, correct ? 1 : 0, stageBefore, stageAfter, durationMs],
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

export async function updateUserNotes(id: number, notes: string): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("UPDATE kanji_levels SET user_notes = ? WHERE id = ?", [notes, id]);
	});
}

export async function updateUserSynonyms(id: number, synonyms: string): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("UPDATE kanji_levels SET user_synonyms = ? WHERE id = ?", [synonyms, id]);
	});
}
