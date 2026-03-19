import JSZip from "jszip";
import initSqlJs, { type Database as SqlJsDb } from "sql.js";

export interface AnkiNote {
	id: number;
	mid: number; // model (note type) id
	fields: string[];
	tags: string[];
}

export interface AnkiModel {
	id: number;
	name: string;
	fields: { name: string; ord: number }[];
	templates: { name: string; qfmt: string; afmt: string; ord: number }[];
	css: string;
}

export interface AnkiPackage {
	notes: AnkiNote[];
	models: AnkiModel[];
	media: Map<string, Uint8Array>;
	mediaNameMap: Record<string, string>;
	deckName: string;
}

export type ProgressCallback = (step: string, current: number, total: number) => void;

export async function parseApkg(
	fileBytes: Uint8Array,
	onProgress?: ProgressCallback,
): Promise<AnkiPackage> {
	onProgress?.("Extracting archive", 0, 4);

	const zip = await JSZip.loadAsync(fileBytes);

	// Find the Anki database file
	const dbFile = zip.file("collection.anki21") ?? zip.file("collection.anki2");
	if (!dbFile) {
		throw new Error("Invalid .apkg file: no collection.anki2 or collection.anki21 found");
	}

	onProgress?.("Reading database", 1, 4);

	const dbBytes = await dbFile.async("uint8array");
	const SQL = await initSqlJs();
	const ankiDb = new SQL.Database(dbBytes);

	try {
		const models = extractModels(ankiDb);
		const notes = extractNotes(ankiDb);

		onProgress?.("Extracting media", 2, 4);

		const { media, mediaNameMap } = await extractMedia(zip);

		// Try to get deck name from the database
		const deckName = extractDeckName(ankiDb);

		onProgress?.("Complete", 4, 4);

		return { notes, models, media, mediaNameMap, deckName };
	} finally {
		ankiDb.close();
	}
}

function extractModels(db: SqlJsDb): AnkiModel[] {
	// In Anki, models are stored as JSON in the 'col' table
	const result = db.exec("SELECT models FROM col LIMIT 1");
	if (result.length === 0 || result[0].values.length === 0) return [];

	const modelsJson = JSON.parse(result[0].values[0][0] as string);
	const models: AnkiModel[] = [];

	for (const [id, model] of Object.entries(modelsJson)) {
		const m = model as Record<string, unknown>;
		models.push({
			id: Number(id),
			name: m.name as string,
			fields: ((m.flds as Array<Record<string, unknown>>) ?? [])
				.sort((a, b) => (a.ord as number) - (b.ord as number))
				.map((f) => ({ name: f.name as string, ord: f.ord as number })),
			templates: ((m.tmpls as Array<Record<string, unknown>>) ?? [])
				.sort((a, b) => (a.ord as number) - (b.ord as number))
				.map((t) => ({
					name: t.name as string,
					qfmt: t.qfmt as string,
					afmt: t.afmt as string,
					ord: t.ord as number,
				})),
			css: (m.css as string) ?? "",
		});
	}

	return models;
}

function extractNotes(db: SqlJsDb): AnkiNote[] {
	const result = db.exec("SELECT id, mid, flds, tags FROM notes");
	if (result.length === 0) return [];

	return result[0].values.map((row) => ({
		id: row[0] as number,
		mid: row[1] as number,
		fields: (row[2] as string).split("\x1f"),
		tags: (row[3] as string)
			.trim()
			.split(/\s+/)
			.filter((t) => t.length > 0),
	}));
}

function extractDeckName(db: SqlJsDb): string {
	try {
		const result = db.exec("SELECT decks FROM col LIMIT 1");
		if (result.length === 0) return "Imported Deck";
		const decksJson = JSON.parse(result[0].values[0][0] as string);
		// Get the first non-default deck name, or the first deck
		for (const deck of Object.values(decksJson)) {
			const d = deck as Record<string, unknown>;
			const name = d.name as string;
			if (name && name !== "Default") return name;
		}
		return "Imported Deck";
	} catch {
		return "Imported Deck";
	}
}

async function extractMedia(
	zip: JSZip,
): Promise<{ media: Map<string, Uint8Array>; mediaNameMap: Record<string, string> }> {
	const media = new Map<string, Uint8Array>();
	let mediaNameMap: Record<string, string> = {};

	// Media mapping file maps numbered files to their original names
	const mediaFile = zip.file("media");
	if (mediaFile) {
		try {
			const mediaJson = await mediaFile.async("string");
			mediaNameMap = JSON.parse(mediaJson);
		} catch {
			// No media mapping, proceed without
		}
	}

	// Extract each numbered media file
	for (const [index, originalName] of Object.entries(mediaNameMap)) {
		const file = zip.file(index);
		if (file) {
			const bytes = await file.async("uint8array");
			media.set(originalName, bytes);
		}
	}

	return { media, mediaNameMap };
}
