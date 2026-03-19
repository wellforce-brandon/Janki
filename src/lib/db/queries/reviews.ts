import { getDb, type QueryResult, safeQuery } from "../database";

export interface ReviewLogEntry {
	id: number;
	card_id: number;
	rating: number;
	state: number;
	scheduled_days: number;
	elapsed_days: number;
	stability: number;
	difficulty: number;
	duration_ms: number | null;
	reviewed_at: string;
}

export async function logReview(
	cardId: number,
	rating: number,
	state: number,
	scheduledDays: number,
	elapsedDays: number,
	stability: number,
	difficulty: number,
	durationMs?: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			`INSERT INTO review_log (card_id, rating, state, scheduled_days, elapsed_days, stability, difficulty, duration_ms)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				cardId,
				rating,
				state,
				scheduledDays,
				elapsedDays,
				stability,
				difficulty,
				durationMs ?? null,
			],
		);
		return result.lastInsertId;
	});
}

export async function deleteReviewLogEntry(id: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("DELETE FROM review_log WHERE id = ?", [id]);
	});
}

export async function getReviewsByCard(cardId: number): Promise<QueryResult<ReviewLogEntry[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<ReviewLogEntry[]>(
			"SELECT * FROM review_log WHERE card_id = ? ORDER BY reviewed_at DESC",
			[cardId],
		);
	});
}

export async function getTodayReviewCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM review_log WHERE date(reviewed_at) = date('now')",
		);
		return rows[0].count;
	});
}
