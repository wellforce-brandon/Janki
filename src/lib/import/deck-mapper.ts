import { createCard } from "../db/queries/cards";
import { createDeck } from "../db/queries/decks";
import { createNote, createNoteType } from "../db/queries/notes";
import { sanitizeCardHtml } from "../utils/sanitize";
import type { AnkiPackage, ProgressCallback } from "./apkg-parser";
import { classifyDeckContent } from "./content-classifier";

export interface ImportResult {
	deckId: number;
	deckName: string;
	noteTypeCount: number;
	noteCount: number;
	cardCount: number;
	mediaCount: number;
	errors: string[];
}

export async function mapAnkiToDeck(
	pkg: AnkiPackage,
	sourceFile: string,
	onProgress?: ProgressCallback,
): Promise<ImportResult> {
	const errors: string[] = [];

	// Create deck
	const deckResult = await createDeck(pkg.deckName, undefined, "imported", sourceFile);
	if (!deckResult.ok) throw new Error(`Failed to create deck: ${deckResult.error}`);
	const deckId = deckResult.data;

	// Map Anki models to note types
	const modelToNoteType = new Map<number, number>();

	onProgress?.("Importing note types", 0, pkg.models.length);

	for (let i = 0; i < pkg.models.length; i++) {
		const model = pkg.models[i];
		onProgress?.("Importing note types", i + 1, pkg.models.length);

		const fieldNames = model.fields.map((f) => f.name);
		const cardTemplates = model.templates.map((t) => ({
			front: sanitizeCardHtml(t.qfmt),
			back: sanitizeCardHtml(t.afmt),
		}));

		const result = await createNoteType(model.name, fieldNames, cardTemplates, model.css);
		if (result.ok) {
			modelToNoteType.set(model.id, result.data);
		} else {
			errors.push(`Failed to import note type "${model.name}": ${result.error}`);
		}
	}

	// Map notes and create cards
	let cardCount = 0;
	let noteCount = 0;

	onProgress?.("Importing notes", 0, pkg.notes.length);

	for (let i = 0; i < pkg.notes.length; i++) {
		const ankiNote = pkg.notes[i];
		onProgress?.("Importing notes", i + 1, pkg.notes.length);

		const noteTypeId = modelToNoteType.get(ankiNote.mid);
		if (!noteTypeId) {
			errors.push(`Note ${ankiNote.id}: unknown model ${ankiNote.mid}`);
			continue;
		}

		// Find the model to get field names
		const model = pkg.models.find((m) => m.id === ankiNote.mid);
		if (!model) continue;

		// Map fields to a named object
		const fields: Record<string, string> = {};
		for (let j = 0; j < model.fields.length; j++) {
			fields[model.fields[j].name] = sanitizeCardHtml(ankiNote.fields[j] ?? "");
		}

		const noteResult = await createNote(noteTypeId, deckId, fields, ankiNote.tags);
		if (!noteResult.ok) {
			errors.push(`Failed to import note ${ankiNote.id}: ${noteResult.error}`);
			continue;
		}
		noteCount++;

		// Create one card per template
		const templateCount = model.templates.length;
		for (let t = 0; t < templateCount; t++) {
			const cardResult = await createCard(noteResult.data, deckId, t);
			if (cardResult.ok) {
				cardCount++;
			} else {
				errors.push(`Failed to create card for note ${ankiNote.id}: ${cardResult.error}`);
			}
		}
	}

	// Classify content types for the imported deck
	onProgress?.("Classifying content", 0, 1);
	const classifyResult = await classifyDeckContent(deckId);
	if (!classifyResult.ok) {
		errors.push(`Content classification failed: ${classifyResult.error}`);
	}
	onProgress?.("Classifying content", 1, 1);

	return {
		deckId,
		deckName: pkg.deckName,
		noteTypeCount: modelToNoteType.size,
		noteCount,
		cardCount,
		mediaCount: pkg.media.size,
		errors,
	};
}

export function renderCardContent(fields: Record<string, string>, template: string): string {
	let rendered = template;
	for (const [name, value] of Object.entries(fields)) {
		rendered = rendered.replaceAll(`{{${name}}}`, value);
	}
	// Handle {{FrontSide}} reference in back templates
	rendered = rendered.replace(/\{\{FrontSide\}\}/g, "");
	// Strip remaining unresolved mustache tags
	rendered = rendered.replace(/\{\{[^}]+\}\}/g, "");
	return rendered;
}
