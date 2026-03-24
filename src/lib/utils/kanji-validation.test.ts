import { describe, expect, it } from "vitest";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import {
	getAcceptedMeanings,
	getAcceptedReadings,
	getAllReadings,
	getCorrectDisplay,
	isKunReadingForKanji,
	normalizeKanjiAnswer,
	parseJsonArray,
} from "./kanji-validation";

function makeItem(overrides: Partial<KanjiLevelItem> = {}): KanjiLevelItem {
	return {
		id: 1,
		level: 1,
		item_type: "kanji",
		character: "大",
		meanings: '["Big","Large"]',
		readings_on: '["タイ","ダイ"]',
		readings_kun: '["おお"]',
		reading: null,
		radicals: null,
		mnemonic_meaning: null,
		mnemonic_reading: null,
		image_url: null,
		srs_stage: 1,
		unlocked_at: null,
		next_review: null,
		correct_count: 0,
		incorrect_count: 0,
		lesson_completed_at: null,
		wk_id: null,
		user_notes: null,
		user_synonyms: null,
		visually_similar_ids: null,
		meaning_hint: null,
		reading_hint: null,
		character_images: null,
		component_ids: null,
		parts_of_speech: null,
		context_sentences: null,
		pronunciation_audios: null,
		meaning_current_streak: 0,
		meaning_max_streak: 0,
		reading_current_streak: 0,
		reading_max_streak: 0,
		...overrides,
	};
}

describe("parseJsonArray", () => {
	it("should parse valid JSON array", () => {
		expect(parseJsonArray('["a","b","c"]')).toEqual(["a", "b", "c"]);
	});

	it("should return empty array for null", () => {
		expect(parseJsonArray(null)).toEqual([]);
	});

	it("should return empty array for empty string", () => {
		expect(parseJsonArray("")).toEqual([]);
	});

	it("should wrap non-JSON string in array", () => {
		expect(parseJsonArray("plain text")).toEqual(["plain text"]);
	});

	it("should handle single-element arrays", () => {
		expect(parseJsonArray('["only"]')).toEqual(["only"]);
	});
});

describe("normalizeKanjiAnswer", () => {
	it("should lowercase", () => {
		expect(normalizeKanjiAnswer("Big")).toBe("big");
	});

	it("should strip non-word characters", () => {
		expect(normalizeKanjiAnswer("don't")).toBe("dont");
	});

	it("should collapse whitespace and trim", () => {
		expect(normalizeKanjiAnswer("  big   dog  ")).toBe("big dog");
	});
});

describe("getAcceptedMeanings", () => {
	it("should return all meanings normalized", () => {
		const item = makeItem({ meanings: '["Big","Large"]' });
		expect(getAcceptedMeanings(item)).toEqual(["big", "large"]);
	});

	it("should include user synonyms", () => {
		const item = makeItem({
			meanings: '["Big"]',
			user_synonyms: '["Huge","Enormous"]',
		});
		expect(getAcceptedMeanings(item)).toEqual(["big", "huge", "enormous"]);
	});

	it("should handle null user_synonyms", () => {
		const item = makeItem({ meanings: '["Big"]', user_synonyms: null });
		expect(getAcceptedMeanings(item)).toEqual(["big"]);
	});
});

describe("getAcceptedReadings", () => {
	it("should return on readings for kanji", () => {
		const item = makeItem({
			item_type: "kanji",
			readings_on: '["タイ","ダイ"]',
			readings_kun: '["おお"]',
		});
		const readings = getAcceptedReadings(item);
		expect(readings).toContain("タイ");
		expect(readings).toContain("ダイ");
		expect(readings).not.toContain("おお");
	});

	it("should return both on and kun readings for vocab", () => {
		const item = makeItem({
			item_type: "vocab",
			readings_on: '["タイ"]',
			readings_kun: '["おお"]',
		});
		const readings = getAcceptedReadings(item);
		expect(readings).toContain("タイ");
		expect(readings).toContain("おお");
	});

	it("should filter out ! prefixed readings", () => {
		const item = makeItem({
			item_type: "vocab",
			readings_on: '["タイ","!ダイ"]',
			readings_kun: null,
		});
		const readings = getAcceptedReadings(item);
		expect(readings).toContain("タイ");
		expect(readings).not.toContain("ダイ");
		expect(readings).not.toContain("!ダイ");
	});

	it("should include the reading field for vocab", () => {
		const item = makeItem({
			item_type: "vocab",
			readings_on: null,
			readings_kun: null,
			reading: "おおきい",
		});
		expect(getAcceptedReadings(item)).toContain("おおきい");
	});
});

describe("getAllReadings", () => {
	it("should include all readings with ! prefix stripped", () => {
		const item = makeItem({ readings_on: '["タイ","!ダイ"]', readings_kun: '["おお"]' });
		const readings = getAllReadings(item);
		expect(readings).toContain("タイ");
		expect(readings).toContain("ダイ");
		expect(readings).toContain("おお");
		expect(readings).not.toContain("!ダイ");
	});
});

describe("isKunReadingForKanji", () => {
	it("should return true when user types a kun reading for kanji", () => {
		const item = makeItem({ item_type: "kanji", readings_kun: '["おお"]' });
		expect(isKunReadingForKanji(item, "おお")).toBe(true);
	});

	it("should return false for vocab items", () => {
		const item = makeItem({ item_type: "vocab", readings_kun: '["おお"]' });
		expect(isKunReadingForKanji(item, "おお")).toBe(false);
	});

	it("should return false for non-matching reading", () => {
		const item = makeItem({ item_type: "kanji", readings_kun: '["おお"]' });
		expect(isKunReadingForKanji(item, "タイ")).toBe(false);
	});
});

describe("getCorrectDisplay", () => {
	it("should return meanings for meaning questions", () => {
		const item = makeItem({ meanings: '["Big","Large"]' });
		expect(getCorrectDisplay(item, "meaning")).toBe("Big, Large");
	});

	it("should return accepted readings for reading questions", () => {
		const item = makeItem({ item_type: "kanji", readings_on: '["タイ","ダイ"]' });
		expect(getCorrectDisplay(item, "reading")).toBe("タイ, ダイ");
	});
});
