import { describe, expect, it } from "vitest";
import {
	containsKanji,
	furiganaToHtml,
	isHiragana,
	isKana,
	isKanji,
	isKatakana,
	simpleFurigana,
} from "./japanese";

describe("isKanji", () => {
	it("should detect kanji characters", () => {
		expect(isKanji("漢")).toBe(true);
		expect(isKanji("字")).toBe(true);
		expect(isKanji("食")).toBe(true);
	});

	it("should reject non-kanji characters", () => {
		expect(isKanji("あ")).toBe(false);
		expect(isKanji("ア")).toBe(false);
		expect(isKanji("a")).toBe(false);
		expect(isKanji("1")).toBe(false);
	});
});

describe("isHiragana", () => {
	it("should detect hiragana characters", () => {
		expect(isHiragana("あ")).toBe(true);
		expect(isHiragana("ん")).toBe(true);
	});

	it("should reject non-hiragana characters", () => {
		expect(isHiragana("ア")).toBe(false);
		expect(isHiragana("漢")).toBe(false);
	});
});

describe("isKatakana", () => {
	it("should detect katakana characters", () => {
		expect(isKatakana("ア")).toBe(true);
		expect(isKatakana("ン")).toBe(true);
	});

	it("should reject non-katakana characters", () => {
		expect(isKatakana("あ")).toBe(false);
		expect(isKatakana("漢")).toBe(false);
	});
});

describe("isKana", () => {
	it("should detect both hiragana and katakana", () => {
		expect(isKana("あ")).toBe(true);
		expect(isKana("ア")).toBe(true);
	});

	it("should reject kanji and ASCII", () => {
		expect(isKana("漢")).toBe(false);
		expect(isKana("a")).toBe(false);
	});
});

describe("containsKanji", () => {
	it("should detect kanji in mixed text", () => {
		expect(containsKanji("食べる")).toBe(true);
		expect(containsKanji("日本語")).toBe(true);
	});

	it("should return false for kana-only text", () => {
		expect(containsKanji("たべる")).toBe(false);
		expect(containsKanji("アイウ")).toBe(false);
	});

	it("should return false for ASCII text", () => {
		expect(containsKanji("hello")).toBe(false);
	});
});

describe("simpleFurigana", () => {
	it("should return plain text for kana-only input", () => {
		const result = simpleFurigana("たべる", "たべる");
		expect(result).toEqual([{ text: "たべる" }]);
	});

	it("should wrap all-kanji text with reading", () => {
		const result = simpleFurigana("日本", "にほん");
		expect(result).toEqual([{ text: "日本", reading: "にほん" }]);
	});

	it("should split kanji and kana for verb forms", () => {
		const result = simpleFurigana("食べる", "たべる");
		expect(result.length).toBeGreaterThan(1);
		// The kanji portion should have a reading
		const kanjiSeg = result.find((s) => s.text === "食");
		expect(kanjiSeg?.reading).toBe("た");
	});
});

describe("furiganaToHtml", () => {
	it("should generate ruby tags for segments with readings", () => {
		const html = furiganaToHtml([{ text: "漢字", reading: "かんじ" }]);
		expect(html).toContain("<ruby>");
		expect(html).toContain("<rt>かんじ</rt>");
		expect(html).toContain("漢字");
	});

	it("should pass through segments without readings", () => {
		const html = furiganaToHtml([{ text: "です" }]);
		expect(html).toBe("です");
	});

	it("should combine mixed segments", () => {
		const html = furiganaToHtml([{ text: "食", reading: "た" }, { text: "べる" }]);
		expect(html).toContain("<ruby>食");
		expect(html).toContain("べる");
	});
});
