import { getDb, safeQuery, type QueryResult } from "../database";
import type { ContentType, SemanticRole } from "../../import/content-classifier";

export interface ContentTypeCount {
	type: string;
	total: number;
	due: number;
	new_count: number;
}

export interface NoteWithContentInfo {
	note_id: number;
	note_type_id: number;
	deck_id: number;
	deck_name: string;
	fields: string;
	content_type: string;
	card_id: number | null;
	state: number | null;
	due: string | null;
}

export interface SemanticFieldMapping {
	field_name: string;
	semantic_role: SemanticRole;
}

export interface BuiltinItem {
	id: number;
	content_type: string;
	item_key: string;
	data: string;
	jlpt_level: string | null;
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

export interface WkCrossReference {
	id: number;
	character: string;
	item_type: string;
	srs_stage: number;
	level: number;
	meanings: string;
}

export async function getContentTypeCounts(): Promise<QueryResult<ContentTypeCount[]>> {
	return safeQuery(async () => {
		const db = await getDb();

		const deckCounts = await db.select<{ content_type: string; total: number; due: number; new_count: number }[]>(`
			SELECT
				ct.content_type,
				COUNT(DISTINCT ct.note_id) as total,
				COUNT(DISTINCT CASE WHEN c.state != 0 AND c.due <= datetime('now') THEN ct.note_id END) as due,
				COUNT(DISTINCT CASE WHEN c.state = 0 THEN ct.note_id END) as new_count
			FROM content_tags ct
			JOIN notes n ON n.id = ct.note_id
			LEFT JOIN cards c ON c.note_id = n.id
			GROUP BY ct.content_type
		`);

		const builtinCounts = await db.select<{ content_type: string; total: number; due: number; new_count: number }[]>(`
			SELECT
				content_type,
				COUNT(*) as total,
				COUNT(CASE WHEN state != 0 AND due <= datetime('now') THEN 1 END) as due,
				COUNT(CASE WHEN state = 0 THEN 1 END) as new_count
			FROM builtin_items
			GROUP BY content_type
		`);

		const merged = new Map<string, ContentTypeCount>();
		for (const row of deckCounts) {
			merged.set(row.content_type, {
				type: row.content_type,
				total: row.total,
				due: row.due,
				new_count: row.new_count,
			});
		}
		for (const row of builtinCounts) {
			const existing = merged.get(row.content_type);
			if (existing) {
				existing.total += row.total;
				existing.due += row.due;
				existing.new_count += row.new_count;
			} else {
				merged.set(row.content_type, {
					type: row.content_type,
					total: row.total,
					due: row.due,
					new_count: row.new_count,
				});
			}
		}

		return Array.from(merged.values());
	});
}

export async function getNotesByContentType(
	contentType: ContentType,
	options: {
		limit?: number;
		offset?: number;
		sortBy?: "due" | "created_at";
		stateFilter?: number;
		deckFilter?: number;
		searchQuery?: string;
	} = {},
): Promise<QueryResult<NoteWithContentInfo[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [contentType];
		let where = "ct.content_type = ?";

		if (options.stateFilter !== undefined) {
			where += " AND c.state = ?";
			params.push(options.stateFilter);
		}
		if (options.deckFilter !== undefined) {
			where += " AND n.deck_id = ?";
			params.push(options.deckFilter);
		}
		if (options.searchQuery) {
			where += " AND n.fields LIKE ?";
			params.push(`%${options.searchQuery}%`);
		}

		let orderBy = "n.created_at DESC";
		if (options.sortBy === "due") {
			orderBy = "c.due ASC";
		}

		const limit = options.limit ?? 50;
		const offset = options.offset ?? 0;

		params.push(limit, offset);

		return db.select<NoteWithContentInfo[]>(`
			SELECT
				n.id as note_id,
				n.note_type_id,
				n.deck_id,
				d.name as deck_name,
				n.fields,
				ct.content_type,
				c.id as card_id,
				c.state,
				c.due
			FROM content_tags ct
			JOIN notes n ON n.id = ct.note_id
			JOIN decks d ON d.id = n.deck_id
			LEFT JOIN cards c ON c.note_id = n.id AND c.template_index = 0
			WHERE ${where}
			ORDER BY ${orderBy}
			LIMIT ? OFFSET ?
		`);
	});
}

export async function getSemanticFields(
	noteTypeId: number,
	contentType: ContentType,
): Promise<QueryResult<SemanticFieldMapping[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<SemanticFieldMapping[]>(
			`SELECT field_name, semantic_role
			 FROM content_type_fields
			 WHERE note_type_id = ? AND content_type = ?`,
			[noteTypeId, contentType],
		);
	});
}

export async function getBuiltinItems(
	contentType: ContentType,
	options: {
		limit?: number;
		offset?: number;
		stateFilter?: number;
		jlptFilter?: string;
	} = {},
): Promise<QueryResult<BuiltinItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [contentType];
		let where = "content_type = ?";

		if (options.stateFilter !== undefined) {
			where += " AND state = ?";
			params.push(options.stateFilter);
		}
		if (options.jlptFilter) {
			where += " AND jlpt_level = ?";
			params.push(options.jlptFilter);
		}

		const limit = options.limit ?? 50;
		const offset = options.offset ?? 0;
		params.push(limit, offset);

		return db.select<BuiltinItem[]>(
			`SELECT * FROM builtin_items WHERE ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
			params,
		);
	});
}

export async function getDueBuiltinItems(
	contentType?: ContentType,
	limit?: number,
): Promise<QueryResult<BuiltinItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "state != 0 AND due <= datetime('now')";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		if (limit) {
			params.push(limit);
			return db.select<BuiltinItem[]>(
				`SELECT * FROM builtin_items WHERE ${where} ORDER BY due ASC LIMIT ?`,
				params,
			);
		}

		return db.select<BuiltinItem[]>(
			`SELECT * FROM builtin_items WHERE ${where} ORDER BY due ASC`,
			params,
		);
	});
}

export async function createBuiltinItem(
	contentType: ContentType,
	itemKey: string,
	data: Record<string, unknown>,
	jlptLevel?: string,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			`INSERT OR IGNORE INTO builtin_items (content_type, item_key, data, jlpt_level)
			 VALUES (?, ?, ?, ?)`,
			[contentType, itemKey, JSON.stringify(data), jlptLevel ?? null],
		);
		return result.lastInsertId;
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

export async function getDeckContentTypes(
	deckId: number,
): Promise<QueryResult<{ content_type: string; count: number }[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		return db.select<{ content_type: string; count: number }[]>(
			`SELECT ct.content_type, COUNT(*) as count
			 FROM content_tags ct
			 JOIN notes n ON n.id = ct.note_id
			 WHERE n.deck_id = ?
			 GROUP BY ct.content_type`,
			[deckId],
		);
	});
}

export async function updateBuiltinItemState(
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
			`UPDATE builtin_items SET
				state = ?, stability = ?, difficulty = ?, due = ?,
				last_review = ?, reps = ?, lapses = ?, scheduled_days = ?,
				elapsed_days = ?, updated_at = datetime('now')
			WHERE id = ?`,
			[state, stability, difficulty, due, lastReview, reps, lapses, scheduledDays, elapsedDays, id],
		);
	});
}

export async function logBuiltinReview(
	builtinItemId: number,
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
			`INSERT INTO builtin_review_log (builtin_item_id, rating, state, scheduled_days, elapsed_days, stability, difficulty, duration_ms)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[builtinItemId, rating, state, scheduledDays, elapsedDays, stability, difficulty, durationMs ?? null],
		);
		return result.lastInsertId;
	});
}

export async function getBuiltinItemById(id: number): Promise<QueryResult<BuiltinItem | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<BuiltinItem[]>(
			"SELECT * FROM builtin_items WHERE id = ?",
			[id],
		);
		return rows[0] ?? null;
	});
}

export async function deleteBuiltinReviewLogEntry(id: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute("DELETE FROM builtin_review_log WHERE id = ?", [id]);
	});
}

export async function getNewBuiltinItems(
	contentType?: ContentType,
	limit = 20,
): Promise<QueryResult<BuiltinItem[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let where = "state = 0";

		if (contentType) {
			where += " AND content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<BuiltinItem[]>(
			`SELECT * FROM builtin_items WHERE ${where} ORDER BY id ASC LIMIT ?`,
			params,
		);
	});
}

/** Get due cards from the cards table filtered by content type */
export async function getDueCardsByContentType(
	contentType?: ContentType,
	limit = 200,
): Promise<QueryResult<DueCardWithType[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let typeFilter = "";

		if (contentType) {
			typeFilter = " AND ct.content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<DueCardWithType[]>(
			`SELECT c.*, n.fields, n.tags, nt.card_templates, nt.css, ct.content_type
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN note_types nt ON nt.id = n.note_type_id
			JOIN content_tags ct ON ct.note_id = n.id
			WHERE c.state != 0 AND c.due <= datetime('now')${typeFilter}
			GROUP BY c.id
			ORDER BY c.due ASC
			LIMIT ?`,
			params,
		);
	});
}

/** Get new cards from the cards table filtered by content type */
export async function getNewCardsByContentType(
	contentType?: ContentType,
	limit = 20,
): Promise<QueryResult<DueCardWithType[]>> {
	return safeQuery(async () => {
		const db = await getDb();
		const params: (string | number)[] = [];
		let typeFilter = "";

		if (contentType) {
			typeFilter = " AND ct.content_type = ?";
			params.push(contentType);
		}

		params.push(limit);
		return db.select<DueCardWithType[]>(
			`SELECT c.*, n.fields, n.tags, nt.card_templates, nt.css, ct.content_type
			FROM cards c
			JOIN notes n ON n.id = c.note_id
			JOIN note_types nt ON nt.id = n.note_type_id
			JOIN content_tags ct ON ct.note_id = n.id
			WHERE c.state = 0${typeFilter}
			GROUP BY c.id
			ORDER BY c.created_at ASC
			LIMIT ?`,
			params,
		);
	});
}

export interface DueCardWithType {
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
	fields: string;
	card_templates: string;
	css: string | null;
	tags: string | null;
	content_type: string;
}

/** Batch lookup WK cross-references for multiple characters */
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
