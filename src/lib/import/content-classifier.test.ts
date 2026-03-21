import { describe, expect, it } from "vitest";
import { _classifyNoteType, _mapFieldsToRoles } from "./content-classifier";

describe("Content classifier", () => {
	describe("classifyNoteType", () => {
		it("should classify kana deck fields", () => {
			const results = _classifyNoteType(["Hiragana", "Romaji", "Audio"]);
			expect(results.some((r) => r.contentType === "kana")).toBe(true);
		});

		it("should classify katakana deck fields", () => {
			const results = _classifyNoteType(["Katakana", "Hiragana", "Audio"]);
			expect(results.some((r) => r.contentType === "kana")).toBe(true);
		});

		it("should classify JLPT kanji deck fields", () => {
			const results = _classifyNoteType(["Kanji", "Keyword", "On", "Kun"]);
			expect(results.some((r) => r.contentType === "kanji")).toBe(true);
		});

		it("should classify rich kanji deck fields (WaniKani style)", () => {
			const results = _classifyNoteType([
				"Kanji",
				"WkMeaning",
				"KanjidicMeaning",
				"StrokeCount",
				"Jlpt",
				"Freq",
				"On",
				"Kun",
				"Nanori",
				"Level",
				"Strokes",
				"Radical",
			]);
			expect(results.some((r) => r.contentType === "kanji")).toBe(true);
		});

		it("should classify vocabulary deck fields (Core 2k style)", () => {
			const results = _classifyNoteType([
				"Index",
				"Word",
				"Transliteration",
				"Meaning",
				"Part of Speech",
				"Example Sentence",
				"Sentence Transliteration",
				"Sentence Translation",
				"Word Audio",
				"Sentence Audio",
				"Pitch Accent URL",
				"Pitch Accent",
			]);
			expect(results.some((r) => r.contentType === "vocabulary")).toBe(true);
		});

		it("should classify Kaishi 1.5k as vocabulary", () => {
			const results = _classifyNoteType([
				"Word",
				"Word Reading",
				"Word Meaning",
				"Word Furigana",
				"Word Audio",
				"Sentence",
				"Sentence Meaning",
				"Sentence Furigana",
				"Sentence Audio",
				"Notes",
				"Pitch Accent",
				"Pitch Accent Notes",
				"Frequency",
				"Picture",
			]);
			expect(results.some((r) => r.contentType === "vocabulary")).toBe(true);
		});

		it("should classify grammar deck fields (FJSD style)", () => {
			const results = _classifyNoteType([
				"Point",
				"Reading",
				"Meaning",
				"Usage",
				"Phrases",
				"Source",
			]);
			expect(results.some((r) => r.contentType === "grammar")).toBe(true);
		});

		it("should classify sentence deck fields (Core 2k6k)", () => {
			const results = _classifyNoteType([
				"CoreIndex",
				"wk-level",
				"vocab",
				"vocab-translation",
				"part-of-speech",
				"sentence",
				"sentence-translation",
				"sentence-audio",
			]);
			expect(results.some((r) => r.contentType === "sentence")).toBe(true);
		});

		it("should classify radical deck fields", () => {
			const results = _classifyNoteType([
				"Radical",
				"Reading",
				"Meanings",
				"Mnemonic",
				"Kanji",
				"Stroke number",
				"Sources",
			]);
			expect(results.some((r) => r.contentType === "radical")).toBe(true);
		});

		it("should classify Kaishi elements/radicals deck", () => {
			const results = _classifyNoteType([
				"Number",
				"Element",
				"Meaning",
				"First seen in",
				"Is widely used itself",
				"Examples",
			]);
			expect(results.some((r) => r.contentType === "radical")).toBe(true);
		});

		it("should classify verb conjugation deck fields", () => {
			const results = _classifyNoteType([
				"Stem",
				"Meaning",
				"Group2Verb?",
				"TeTaForm",
				"Base1",
				"Base2",
				"DictionaryForm",
				"Base4",
				"Base5",
			]);
			expect(results.some((r) => r.contentType === "conjugation")).toBe(true);
		});

		it("should allow multiple content types for multi-purpose decks", () => {
			// Core 2k6k has both vocabulary and sentence characteristics
			const results = _classifyNoteType([
				"CoreIndex",
				"wk-level",
				"vocab",
				"vocab-translation",
				"part-of-speech",
				"sentence",
				"sentence-translation",
				"sentence-audio",
			]);
			const types = results.map((r) => r.contentType);
			expect(types.length).toBeGreaterThanOrEqual(1);
			expect(types).toContain("sentence");
		});

		it("should return empty for unrecognized fields", () => {
			const results = _classifyNoteType(["Front", "Back"]);
			expect(results.length).toBe(0);
		});

		it("should return confidence between 0 and 1", () => {
			const results = _classifyNoteType(["Kanji", "Keyword", "On", "Kun"]);
			for (const r of results) {
				expect(r.confidence).toBeGreaterThan(0);
				expect(r.confidence).toBeLessThanOrEqual(1);
			}
		});
	});

	describe("mapFieldsToRoles", () => {
		it("should map vocabulary fields to semantic roles", () => {
			const mappings = _mapFieldsToRoles(
				["Word", "Reading", "Meaning", "Part of Speech", "Word Audio", "Pitch Accent"],
				"vocabulary",
			);
			const roles = new Map(mappings.map((m) => [m.role, m.fieldName]));

			expect(roles.get("primary_text")).toBe("Word");
			expect(roles.get("reading")).toBe("Reading");
			expect(roles.get("meaning")).toBe("Meaning");
			expect(roles.get("pos")).toBe("Part of Speech");
			expect(roles.get("audio")).toBe("Word Audio");
			expect(roles.get("pitch_accent")).toBe("Pitch Accent");
		});

		it("should map kanji fields to semantic roles", () => {
			const mappings = _mapFieldsToRoles(
				["Kanji", "Meanings", "Onyomi", "Kunyomi", "Strokes", "Mnemonic"],
				"kanji",
			);
			const roles = new Map(mappings.map((m) => [m.role, m.fieldName]));

			expect(roles.get("primary_text")).toBe("Kanji");
			expect(roles.get("meaning")).toBe("Meanings");
			expect(roles.get("stroke_order")).toBe("Strokes");
			expect(roles.get("mnemonic")).toBe("Mnemonic");
		});

		it("should map grammar fields to semantic roles", () => {
			const mappings = _mapFieldsToRoles(
				["Point", "Reading", "Meaning", "Usage", "Phrases"],
				"grammar",
			);
			const roles = new Map(mappings.map((m) => [m.role, m.fieldName]));

			expect(roles.get("primary_text")).toBe("Point");
			expect(roles.get("reading")).toBe("Reading");
			expect(roles.get("meaning")).toBe("Meaning");
			expect(roles.get("example_sentence")).toBe("Phrases");
		});

		it("should map sentence fields to semantic roles", () => {
			const mappings = _mapFieldsToRoles(
				["sentence", "sentence-translation", "sentence-audio", "vocab"],
				"sentence",
			);
			const roles = new Map(mappings.map((m) => [m.role, m.fieldName]));

			expect(roles.get("example_sentence")).toBe("sentence");
			expect(roles.get("sentence_translation")).toBe("sentence-translation");
			expect(roles.get("audio")).toBe("sentence-audio");
		});

		it("should not assign the same role to multiple fields", () => {
			const mappings = _mapFieldsToRoles(
				["Word", "Word Reading", "Reading", "Meaning"],
				"vocabulary",
			);
			const roles = mappings.map((m) => m.role);
			const uniqueRoles = new Set(roles);
			expect(roles.length).toBe(uniqueRoles.size);
		});
	});
});
