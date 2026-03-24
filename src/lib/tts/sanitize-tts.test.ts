import { describe, expect, it } from "vitest";
import type { LanguageItem } from "$lib/db/queries/language";
import { extractSpeechText, sanitizeForSpeech } from "./sanitize-tts";

describe("sanitizeForSpeech", () => {
	it("should strip HTML tags", () => {
		expect(sanitizeForSpeech("<b>食べる</b>")).toBe("食べる");
	});

	it("should strip bracket annotations", () => {
		expect(sanitizeForSpeech("食べる[n]")).toBe("食べる");
		expect(sanitizeForSpeech("[casual] する")).toBe("する");
		expect(sanitizeForSpeech("行く[formal][polite]")).toBe("行く");
	});

	it("should strip ASCII parentheticals", () => {
		expect(sanitizeForSpeech("する(casual)")).toBe("する");
		expect(sanitizeForSpeech("食べる(n)")).toBe("食べる");
	});

	it("should preserve Japanese text in parentheses", () => {
		expect(sanitizeForSpeech("食べる(たべる)")).toBe("食べる(たべる)");
	});

	it("should collapse whitespace", () => {
		expect(sanitizeForSpeech("食べ   る")).toBe("食べ る");
		expect(sanitizeForSpeech("  食べる  ")).toBe("食べる");
	});

	it("should cap length at 200 characters", () => {
		const long = "あ".repeat(250);
		const result = sanitizeForSpeech(long);
		expect(result.length).toBeLessThanOrEqual(200);
	});

	it("should truncate at last natural break", () => {
		const text = `${"あ".repeat(100)}。${"い".repeat(150)}`;
		const result = sanitizeForSpeech(text);
		expect(result.endsWith("。")).toBe(true);
	});

	it("should return empty string for empty input", () => {
		expect(sanitizeForSpeech("")).toBe("");
	});

	it("should handle combined junk", () => {
		expect(sanitizeForSpeech("<span>[n]食べる(casual)</span>")).toBe("食べる");
	});
});

describe("extractSpeechText", () => {
	function makeItem(overrides: Partial<LanguageItem>): LanguageItem {
		return {
			id: 1,
			content_type: "vocabulary",
			item_key: "test",
			primary_text: "食べる",
			reading: null,
			meaning: null,
			part_of_speech: null,
			pitch_accent: null,
			frequency_rank: null,
			audio_file: null,
			formation: null,
			explanation: null,
			sentence_ja: null,
			sentence_en: null,
			sentence_reading: null,
			sentence_audio: null,
			romaji: null,
			stroke_order: null,
			conjugation_forms: null,
			verb_group: null,
			example_sentences: null,
			related_items: null,
			images: null,
			context_notes: null,
			source_decks: null,
			jlpt_level: null,
			wk_level: null,
			tags: null,
			srs_stage: 0,
			correct_count: 0,
			incorrect_count: 0,
			next_review: null,
			unlocked: 0,
			lesson_group: null,
			lesson_order: null,
			prerequisite_keys: null,
			mnemonic: null,
			...overrides,
		} as LanguageItem;
	}

	it("should return primary_text for vocabulary", () => {
		const item = makeItem({ content_type: "vocabulary", primary_text: "食べる" });
		expect(extractSpeechText(item)).toBe("食べる");
	});

	it("should return primary_text for kana", () => {
		const item = makeItem({ content_type: "kana", primary_text: "あ" });
		expect(extractSpeechText(item)).toBe("あ");
	});

	it("should return sentence_ja for sentence type when available", () => {
		const item = makeItem({
			content_type: "sentence",
			primary_text: "食べる",
			sentence_ja: "私は食べます",
		});
		expect(extractSpeechText(item)).toBe("私は食べます");
	});

	it("should fall back to primary_text for sentence type when no sentence_ja", () => {
		const item = makeItem({
			content_type: "sentence",
			primary_text: "食べる",
			sentence_ja: null,
		});
		expect(extractSpeechText(item)).toBe("食べる");
	});

	it("should sanitize brackets in primary_text", () => {
		const item = makeItem({ content_type: "grammar", primary_text: "ている[progressive]" });
		expect(extractSpeechText(item)).toBe("ている");
	});
});
