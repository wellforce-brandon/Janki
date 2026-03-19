import { getDb, type QueryResult, safeQuery } from "../database";

export interface Card {
	id: number;
	note_id: number;
	deck_id: number;
	template_index: number;
	stability: number;
	difficulty: number;
	due: string;
	last_review: string | null;
	reps: number;
	lapses: number;
	state: number;
	scheduled_days: number;
	elapsed_days: number;
	created_at: string;
	updated_at: string;
}

export interface CardWithContent extends Card {
	fields: string;
	card_templates: string;
	css: string | null;
	tags: string | null;
}

export async function getDueCards(
	deckId: number,
	limit: number,
): Promise<QueryResult<CardWithContent[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<CardWithContent[]>(
			`SELECT c.*, n.fields, n.tags, nt.card_templates, nt.css
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN note_types nt ON nt.id = n.note_type_id
			WHERE c.deck_id = ? AND c.state != 0 AND c.due <= datetime('now')
			ORDER BY c.due ASC
			LIMIT ?`,
			[deckId, limit],
		);
	});
}

export async function getNewCards(
	deckId: number,
	limit: number,
): Promise<QueryResult<CardWithContent[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<CardWithContent[]>(
			`SELECT c.*, n.fields, n.tags, nt.card_templates, nt.css
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN note_types nt ON nt.id = n.note_type_id
			WHERE c.deck_id = ? AND c.state = 0
			ORDER BY c.created_at ASC
			LIMIT ?`,
			[deckId, limit],
		);
	});
}

export async function getCardById(id: number): Promise<QueryResult<CardWithContent | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<CardWithContent[]>(
			`SELECT c.*, n.fields, n.tags, nt.card_templates, nt.css
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN note_types nt ON nt.id = n.note_type_id
			WHERE c.id = ?`,
			[id],
		);
		return rows[0] ?? null;
	});
}

export async function getCardsByDeck(
	deckId: number,
	sortBy: "due" | "created_at" | "state" | "stability" = "due",
	limit = 100,
	offset = 0,
	stateFilter?: number,
): Promise<QueryResult<CardWithContent[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (number | string)[] = [deckId];
		let stateClause = "";
		if (stateFilter !== undefined) {
			stateClause = " AND c.state = ?";
			params.push(stateFilter);
		}
		params.push(limit, offset);
		return db.select<CardWithContent[]>(
			`SELECT c.*, n.fields, n.tags, nt.card_templates, nt.css
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN note_types nt ON nt.id = n.note_type_id
			WHERE c.deck_id = ?${stateClause}
			ORDER BY c.${sortBy} ASC
			LIMIT ? OFFSET ?`,
			params,
		);
	});
}

export async function getCardCountByDeck(
	deckId: number,
	stateFilter?: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: number[] = [deckId];
		let stateClause = "";
		if (stateFilter !== undefined) {
			stateClause = " AND state = ?";
			params.push(stateFilter);
		}
		const rows = await db.select<{ count: number }[]>(
			`SELECT COUNT(*) as count FROM cards WHERE deck_id = ?${stateClause}`,
			params,
		);
		return rows[0].count;
	});
}

export async function updateCardState(
	id: number,
	state: number,
	stability: number,
	difficulty: number,
	due: string,
	lastReview: string,
	reps: number,
	lapses: number,
	scheduledDays: number,
	elapsedDays: number,
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			`UPDATE cards SET
				state = ?, stability = ?, difficulty = ?, due = ?,
				last_review = ?, reps = ?, lapses = ?, scheduled_days = ?,
				elapsed_days = ?, updated_at = datetime('now')
			WHERE id = ?`,
			[state, stability, difficulty, due, lastReview, reps, lapses, scheduledDays, elapsedDays, id],
		);
	});
}

export async function createCard(
	noteId: number,
	deckId: number,
	templateIndex: number,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			"INSERT INTO cards (note_id, deck_id, template_index) VALUES (?, ?, ?)",
			[noteId, deckId, templateIndex],
		);
		return result.lastInsertId;
	});
}

export async function deleteCard(id: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("DELETE FROM review_log WHERE card_id = ?", [id]);
		await db.execute("DELETE FROM cards WHERE id = ?", [id]);
	});
}

export interface CardSearchResult {
	id: number;
	deck_id: number;
	fields: string;
	state: number;
	due: string;
	deck_name: string;
}

export async function searchCards(
	query: string,
	limit = 50,
): Promise<QueryResult<CardSearchResult[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const like = `%${query.trim()}%`;
		return db.select<CardSearchResult[]>(
			`SELECT c.id, c.deck_id, n.fields, c.state, c.due, d.name as deck_name
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN decks d ON d.id = c.deck_id
			WHERE n.fields LIKE ?
			ORDER BY c.due ASC
			LIMIT ?`,
			[like, limit],
		);
	});
}

export async function getTotalCardCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM cards");
		return rows[0].count;
	});
}

export async function getTotalDueCount(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM cards WHERE state != 0 AND due <= datetime('now')",
		);
		return rows[0].count;
	});
}
