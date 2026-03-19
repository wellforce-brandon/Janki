import { getDb, type QueryResult, safeQuery } from "../database";

export interface DailyStats {
	date: string;
	reviews_count: number;
	new_cards_count: number;
	correct_count: number;
	incorrect_count: number;
	time_spent_ms: number;
	kanji_learned: number;
}

export async function updateDailyStats(
	isCorrect: boolean,
	isNewCard: boolean,
	durationMs: number,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`INSERT INTO daily_stats (date, reviews_count, new_cards_count, correct_count, incorrect_count, time_spent_ms)
			VALUES (date('now'), 1, ?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				reviews_count = reviews_count + 1,
				new_cards_count = new_cards_count + ?,
				correct_count = correct_count + ?,
				incorrect_count = incorrect_count + ?,
				time_spent_ms = time_spent_ms + ?`,
			[
				isNewCard ? 1 : 0,
				isCorrect ? 1 : 0,
				isCorrect ? 0 : 1,
				durationMs,
				isNewCard ? 1 : 0,
				isCorrect ? 1 : 0,
				isCorrect ? 0 : 1,
				durationMs,
			],
		);
	});
}

export async function getTodayStats(): Promise<QueryResult<DailyStats | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<DailyStats[]>(
			"SELECT * FROM daily_stats WHERE date = date('now')",
		);
		return rows[0] ?? null;
	});
}

export async function getStatsRange(days: number): Promise<QueryResult<DailyStats[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<DailyStats[]>(
			"SELECT * FROM daily_stats WHERE date >= date('now', ? || ' days') ORDER BY date ASC",
			[`-${days}`],
		);
	});
}

export async function getStreak(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ date: string }[]>(
			"SELECT date FROM daily_stats WHERE reviews_count > 0 ORDER BY date DESC",
		);
		if (rows.length === 0) return 0;

		let streak = 0;
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let i = 0; i < rows.length; i++) {
			const expected = new Date(today);
			expected.setDate(expected.getDate() - i);
			const expectedStr = expected.toISOString().split("T")[0];

			if (rows[i].date === expectedStr) {
				streak++;
			} else {
				break;
			}
		}
		return streak;
	});
}

export interface CardStateCount {
	state: number;
	count: number;
}

export async function getCardStateDistribution(): Promise<QueryResult<CardStateCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<CardStateCount[]>("SELECT state, COUNT(*) as count FROM cards GROUP BY state");
	});
}

export interface KanjiStageCount {
	srs_stage: number;
	count: number;
}

export async function getKanjiStageDistribution(): Promise<QueryResult<KanjiStageCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<KanjiStageCount[]>(
			"SELECT srs_stage, COUNT(*) as count FROM kanji_levels WHERE srs_stage > 0 GROUP BY srs_stage ORDER BY srs_stage",
		);
	});
}

export async function getAverageTimePerCard(days = 30): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ avg_ms: number }[]>(
			`SELECT CASE WHEN SUM(reviews_count) > 0
				THEN CAST(SUM(time_spent_ms) AS REAL) / SUM(reviews_count)
				ELSE 0 END as avg_ms
			FROM daily_stats WHERE date >= date('now', ? || ' days')`,
			[`-${days}`],
		);
		return rows[0]?.avg_ms ?? 0;
	});
}

export async function getStatsByDeck(
	deckId: number,
	days: number,
): Promise<QueryResult<DailyStats[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<DailyStats[]>(
			`SELECT date(rl.reviewed_at) as date,
				COUNT(*) as reviews_count,
				0 as new_cards_count,
				SUM(CASE WHEN rl.rating >= 3 THEN 1 ELSE 0 END) as correct_count,
				SUM(CASE WHEN rl.rating < 3 THEN 1 ELSE 0 END) as incorrect_count,
				SUM(rl.duration_ms) as time_spent_ms,
				0 as kanji_learned
			FROM review_log rl
			JOIN cards c ON c.id = rl.card_id
			WHERE c.deck_id = ? AND date(rl.reviewed_at) >= date('now', ? || ' days')
			GROUP BY date(rl.reviewed_at)
			ORDER BY date ASC`,
			[deckId, `-${days}`],
		);
	});
}

export async function restoreDailyStats(
	date: string,
	reviewsCount: number,
	correctCount: number,
	incorrectCount: number,
	timeSpentMs: number,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`UPDATE daily_stats SET reviews_count = ?, correct_count = ?, incorrect_count = ?, time_spent_ms = ?
			WHERE date = ?`,
			[reviewsCount, correctCount, incorrectCount, timeSpentMs, date],
		);
	});
}
