import { getDb, type QueryResult, safeQuery } from "../database";

export interface Deck {
	id: number;
	name: string;
	description: string | null;
	source: string | null;
	source_file: string | null;
	created_at: string;
	updated_at: string;
}

export interface DeckWithCounts extends Deck {
	card_count: number;
	due_count: number;
	new_count: number;
}

export async function getAllDecks(): Promise<QueryResult<DeckWithCounts[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<DeckWithCounts[]>(`
			SELECT d.*,
				COUNT(c.id) as card_count,
				COUNT(CASE WHEN c.state != 0 AND c.due <= datetime('now') THEN 1 END) as due_count,
				COUNT(CASE WHEN c.state = 0 THEN 1 END) as new_count
			FROM decks d
			LEFT JOIN cards c ON c.deck_id = d.id
			GROUP BY d.id
			ORDER BY d.name
		`);
	});
}

export async function getDeckById(id: number): Promise<QueryResult<DeckWithCounts | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<DeckWithCounts[]>(
			`SELECT d.*,
				COUNT(c.id) as card_count,
				COUNT(CASE WHEN c.state != 0 AND c.due <= datetime('now') THEN 1 END) as due_count,
				COUNT(CASE WHEN c.state = 0 THEN 1 END) as new_count
			FROM decks d
			LEFT JOIN cards c ON c.deck_id = d.id
			WHERE d.id = ?
			GROUP BY d.id`,
			[id],
		);
		return rows[0] ?? null;
	});
}

export async function createDeck(
	name: string,
	description?: string,
	source?: string,
	sourceFile?: string,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			"INSERT INTO decks (name, description, source, source_file) VALUES (?, ?, ?, ?)",
			[name, description ?? null, source ?? null, sourceFile ?? null],
		);
		return result.lastInsertId;
	});
}

export async function updateDeck(
	id: number,
	name: string,
	description?: string,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"UPDATE decks SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
			[name, description ?? null, id],
		);
	});
}

export async function deleteDeck(id: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		// Delete in dependency order
		await db.execute(
			"DELETE FROM review_log WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)",
			[id],
		);
		await db.execute("DELETE FROM cards WHERE deck_id = ?", [id]);
		await db.execute("DELETE FROM notes WHERE deck_id = ?", [id]);
		await db.execute("DELETE FROM media WHERE deck_id = ?", [id]);
		await db.execute("DELETE FROM decks WHERE id = ?", [id]);
	});
}
