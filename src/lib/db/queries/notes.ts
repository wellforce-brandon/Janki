import { getDb, type QueryResult, safeQuery } from "../database";

export interface Note {
	id: number;
	note_type_id: number;
	deck_id: number;
	fields: string;
	tags: string | null;
	created_at: string;
	updated_at: string;
}

export interface NoteType {
	id: number;
	name: string;
	fields: string;
	card_templates: string;
	css: string | null;
}

export async function createNoteType(
	name: string,
	fields: string[],
	cardTemplates: { front: string; back: string }[],
	css?: string,
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			"INSERT INTO note_types (name, fields, card_templates, css) VALUES (?, ?, ?, ?)",
			[name, JSON.stringify(fields), JSON.stringify(cardTemplates), css ?? null],
		);
		return result.lastInsertId;
	});
}

export async function getNoteTypeById(id: number): Promise<QueryResult<NoteType | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<NoteType[]>("SELECT * FROM note_types WHERE id = ?", [id]);
		return rows[0] ?? null;
	});
}

export async function createNote(
	noteTypeId: number,
	deckId: number,
	fields: Record<string, string>,
	tags?: string[],
): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		const db = await getDb();
		const result = await db.execute(
			"INSERT INTO notes (note_type_id, deck_id, fields, tags) VALUES (?, ?, ?, ?)",
			[noteTypeId, deckId, JSON.stringify(fields), tags ? JSON.stringify(tags) : null],
		);
		return result.lastInsertId;
	});
}

export async function getNoteById(id: number): Promise<QueryResult<Note | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<Note[]>("SELECT * FROM notes WHERE id = ?", [id]);
		return rows[0] ?? null;
	});
}

export async function updateNote(
	id: number,
	fields: Record<string, string>,
	tags?: string[],
): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"UPDATE notes SET fields = ?, tags = ?, updated_at = datetime('now') WHERE id = ?",
			[JSON.stringify(fields), tags ? JSON.stringify(tags) : null, id],
		);
	});
}

export async function deleteNote(id: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();
		await db.execute(
			"DELETE FROM review_log WHERE card_id IN (SELECT id FROM cards WHERE note_id = ?)",
			[id],
		);
		await db.execute("DELETE FROM cards WHERE note_id = ?", [id]);
		await db.execute("DELETE FROM notes WHERE id = ?", [id]);
	});
}
