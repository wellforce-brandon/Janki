import { getDb, safeQuery, type QueryResult } from "../db/database";

export type ContentType =
	| "kana"
	| "kanji"
	| "vocabulary"
	| "grammar"
	| "sentence"
	| "radical"
	| "conjugation";

export type SemanticRole =
	| "primary_text"
	| "reading"
	| "meaning"
	| "audio"
	| "example_sentence"
	| "sentence_translation"
	| "pitch_accent"
	| "stroke_order"
	| "mnemonic"
	| "pos"
	| "jlpt_level"
	| "frequency"
	| "image";

interface ClassifierRule {
	contentType: ContentType;
	strongIndicators: RegExp[];
	weakIndicators: RegExp[];
	threshold: number;
}

const RULES: ClassifierRule[] = [
	{
		contentType: "kana",
		strongIndicators: [/^romaji$/i, /^stroke/i, /^hiragana$/i, /^katakana$/i],
		weakIndicators: [/^character$/i, /^reading$/i, /^audio$/i],
		threshold: 3,
	},
	{
		contentType: "kanji",
		strongIndicators: [
			/on(yomi)?$/i,
			/kun(yomi)?$/i,
			/nanori/i,
			/component/i,
			/^jlpt$/i,
			/^radical$/i,
			/similar.?looking/i,
			/^keisei$/i,
			/^wk/i,
		],
		weakIndicators: [/^kanji$/i, /meaning/i, /stroke/i, /^freq/i, /^level$/i],
		threshold: 3,
	},
	{
		contentType: "vocabulary",
		strongIndicators: [
			/part.?of.?speech/i,
			/^pos$/i,
			/pitch.?accent/i,
			/word.?audio/i,
			/^frequency$/i,
			/^freq$/i,
			/^transliteration$/i,
		],
		weakIndicators: [/^word$/i, /^reading$/i, /^meaning$/i, /^translation$/i, /^audio$/i],
		threshold: 3,
	},
	{
		contentType: "grammar",
		strongIndicators: [/^point$/i, /^usage$/i, /^phrases$/i, /^formation$/i, /grammar/i],
		weakIndicators: [/^meaning$/i, /^reading$/i, /example/i, /^expression$/i],
		threshold: 3,
	},
	{
		contentType: "sentence",
		strongIndicators: [
			/^sentence$/i,
			/sentence.?audio/i,
			/sentence.?translat/i,
			/sentence.?meaning/i,
			/^source$/i,
			/^jlab/i,
		],
		weakIndicators: [/translat/i, /^image$/i, /^audio$/i],
		threshold: 3,
	},
	{
		contentType: "radical",
		strongIndicators: [/^radical$/i, /^element$/i, /related.?kanji/i, /first.?seen/i],
		weakIndicators: [/^meaning$/i, /mnemonic/i, /stroke/i],
		threshold: 3,
	},
	{
		contentType: "conjugation",
		strongIndicators: [
			/^stem$/i,
			/te.?ta.?form/i,
			/^base[1-5]$/i,
			/dictionary.?form/i,
			/group.?2?.?verb/i,
		],
		weakIndicators: [/^meaning$/i],
		threshold: 3,
	},
];

const FIELD_ROLE_PATTERNS: [SemanticRole, RegExp[]][] = [
	[
		"primary_text",
		[
			/^(kanji|character|word|vocab|japanese|expression|radical|point|pattern|stem|kana|hiragana|katakana|element)$/i,
			/^kanji.?form/i,
		],
	],
	[
		"reading",
		[
			/^(reading|transliteration|kana|hiragana|furigana|romaji|pronunciation)$/i,
			/^word.?reading$/i,
			/reading$/i,
		],
	],
	[
		"meaning",
		[
			/^(meaning|english|translation|keyword|definition)s?$/i,
			/^word.?meaning$/i,
			/^vocab.?translat/i,
		],
	],
	["audio", [/audio/i, /^sound$/i]],
	[
		"example_sentence",
		[/^(sentence|example|phrases|jp.?sentence)$/i, /^example.?sentence$/i],
	],
	[
		"sentence_translation",
		[/sentence.?translat/i, /sentence.?meaning/i, /^en.?sentence$/i],
	],
	["pitch_accent", [/pitch/i, /accent/i]],
	["stroke_order", [/stroke/i]],
	["mnemonic", [/mnemonic/i, /hint/i]],
	["pos", [/^(pos|type|part.?of.?speech|conjugation)$/i]],
	["jlpt_level", [/^jlpt$/i, /^wk.?level$/i, /^level$/i]],
	["frequency", [/^(frequency|freq)$/i, /^core.?index$/i]],
	["image", [/^(image|picture|photo)$/i]],
];

interface ClassificationResult {
	contentType: ContentType;
	confidence: number;
}

function classifyNoteType(fieldNames: string[]): ClassificationResult[] {
	const results: ClassificationResult[] = [];

	for (const rule of RULES) {
		let score = 0;
		let maxPossible = rule.strongIndicators.length * 3 + rule.weakIndicators.length;

		for (const pattern of rule.strongIndicators) {
			if (fieldNames.some((f) => pattern.test(f))) {
				score += 3;
			}
		}
		for (const pattern of rule.weakIndicators) {
			if (fieldNames.some((f) => pattern.test(f))) {
				score += 1;
			}
		}

		if (score >= rule.threshold) {
			const confidence = Math.min(score / Math.max(maxPossible, 1), 1.0);
			results.push({ contentType: rule.contentType, confidence });
		}
	}

	return results;
}

function mapFieldsToRoles(
	fieldNames: string[],
	contentType: ContentType,
): { fieldName: string; role: SemanticRole }[] {
	const mappings: { fieldName: string; role: SemanticRole }[] = [];
	const assignedRoles = new Set<SemanticRole>();

	for (const fieldName of fieldNames) {
		for (const [role, patterns] of FIELD_ROLE_PATTERNS) {
			if (assignedRoles.has(role)) continue;
			if (patterns.some((p) => p.test(fieldName))) {
				mappings.push({ fieldName, role });
				assignedRoles.add(role);
				break;
			}
		}
	}

	return mappings;
}

export async function classifyDeckContent(deckId: number): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();

		const noteTypes = await db.select<{ id: number; name: string; fields: string }[]>(
			`SELECT DISTINCT nt.id, nt.name, nt.fields
			 FROM note_types nt
			 JOIN notes n ON n.note_type_id = nt.id
			 WHERE n.deck_id = ?`,
			[deckId],
		);

		for (const nt of noteTypes) {
			const fieldNames: string[] = JSON.parse(nt.fields);
			const classifications = classifyNoteType(fieldNames);

			if (classifications.length === 0) continue;

			const noteIds = await db.select<{ id: number }[]>(
				"SELECT id FROM notes WHERE note_type_id = ? AND deck_id = ?",
				[nt.id, deckId],
			);

			for (const classification of classifications) {
				for (const note of noteIds) {
					await db.execute(
						`INSERT OR IGNORE INTO content_tags (note_id, content_type, confidence, source)
						 VALUES (?, ?, ?, 'auto')`,
						[note.id, classification.contentType, classification.confidence],
					);
				}

				const fieldMappings = mapFieldsToRoles(fieldNames, classification.contentType);
				for (const mapping of fieldMappings) {
					await db.execute(
						`INSERT OR IGNORE INTO content_type_fields (note_type_id, content_type, field_name, semantic_role)
						 VALUES (?, ?, ?, ?)`,
						[nt.id, classification.contentType, mapping.fieldName, mapping.role],
					);
				}
			}
		}
	});
}

export async function reclassifyAllContent(): Promise<QueryResult<void>> {
	return safeQuery(async () => {
		const db = await getDb();

		await db.execute("DELETE FROM content_tags WHERE source = 'auto'");
		await db.execute("DELETE FROM content_type_fields");

		const deckIds = await db.select<{ id: number }[]>("SELECT id FROM decks");
		for (const deck of deckIds) {
			const result = await classifyDeckContent(deck.id);
			if (!result.ok) {
				console.error(`Failed to classify deck ${deck.id}: ${result.error}`);
			}
		}
	});
}

// Exported for testing
export { classifyNoteType as _classifyNoteType, mapFieldsToRoles as _mapFieldsToRoles };
