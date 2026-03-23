import { describe, expect, it } from "vitest";
import { romajiToHiragana } from "./romaji-to-hiragana";

describe("romajiToHiragana", () => {
	it("should convert basic vowels", () => {
		expect(romajiToHiragana("a")).toBe("あ");
		expect(romajiToHiragana("i")).toBe("い");
		expect(romajiToHiragana("u")).toBe("う");
		expect(romajiToHiragana("e")).toBe("え");
		expect(romajiToHiragana("o")).toBe("お");
	});

	it("should convert basic consonant-vowel syllables", () => {
		expect(romajiToHiragana("ka")).toBe("か");
		expect(romajiToHiragana("ki")).toBe("き");
		expect(romajiToHiragana("ku")).toBe("く");
		expect(romajiToHiragana("ke")).toBe("け");
		expect(romajiToHiragana("ko")).toBe("こ");
	});

	it("should convert shi/chi/tsu variants", () => {
		expect(romajiToHiragana("shi")).toBe("し");
		expect(romajiToHiragana("si")).toBe("し");
		expect(romajiToHiragana("chi")).toBe("ち");
		expect(romajiToHiragana("ti")).toBe("ち");
		expect(romajiToHiragana("tsu")).toBe("つ");
		expect(romajiToHiragana("tu")).toBe("つ");
	});

	it("should convert multi-syllable words", () => {
		expect(romajiToHiragana("ichi")).toBe("いち");
		expect(romajiToHiragana("sake")).toBe("さけ");
		expect(romajiToHiragana("sushi")).toBe("すし");
		expect(romajiToHiragana("karate")).toBe("からて");
	});

	it("should handle double consonants with small tsu", () => {
		expect(romajiToHiragana("kitte")).toBe("きって");
		expect(romajiToHiragana("kekka")).toBe("けっか");
		expect(romajiToHiragana("motto")).toBe("もっと");
		expect(romajiToHiragana("nippon")).toBe("にっぽん");
	});

	it("should handle n before consonant as ん", () => {
		expect(romajiToHiragana("kantan")).toBe("かんたん");
		expect(romajiToHiragana("sanpo")).toBe("さんぽ");
		expect(romajiToHiragana("shinbun")).toBe("しんぶん");
	});

	it("should handle nn as ん", () => {
		expect(romajiToHiragana("onna")).toBe("おんな");
		expect(romajiToHiragana("konnichi")).toBe("こんにち");
	});

	it("should handle n before vowel correctly (na, ni, etc.)", () => {
		expect(romajiToHiragana("nai")).toBe("ない");
		expect(romajiToHiragana("neko")).toBe("ねこ");
	});

	it("should handle trailing n as ん", () => {
		expect(romajiToHiragana("san")).toBe("さん");
		expect(romajiToHiragana("hon")).toBe("ほん");
	});

	it("should convert combination syllables", () => {
		expect(romajiToHiragana("kya")).toBe("きゃ");
		expect(romajiToHiragana("sho")).toBe("しょ");
		expect(romajiToHiragana("chu")).toBe("ちゅ");
		expect(romajiToHiragana("nya")).toBe("にゃ");
		expect(romajiToHiragana("ryu")).toBe("りゅ");
	});

	it("should convert dakuten syllables", () => {
		expect(romajiToHiragana("ga")).toBe("が");
		expect(romajiToHiragana("za")).toBe("ざ");
		expect(romajiToHiragana("da")).toBe("だ");
		expect(romajiToHiragana("ba")).toBe("ば");
		expect(romajiToHiragana("pa")).toBe("ぱ");
	});

	it("should handle long dash", () => {
		expect(romajiToHiragana("-")).toBe("ー");
	});

	it("should be case-insensitive", () => {
		expect(romajiToHiragana("KA")).toBe("か");
		expect(romajiToHiragana("Shi")).toBe("し");
	});

	it("should handle fu/hu variants", () => {
		expect(romajiToHiragana("fu")).toBe("ふ");
		expect(romajiToHiragana("hu")).toBe("ふ");
	});

	it("should handle ji/zu variants", () => {
		expect(romajiToHiragana("ji")).toBe("じ");
		expect(romajiToHiragana("zi")).toBe("じ");
	});

	it("should handle complete words", () => {
		expect(romajiToHiragana("kyou")).toBe("きょう");
		expect(romajiToHiragana("gakkou")).toBe("がっこう");
		expect(romajiToHiragana("jouzu")).toBe("じょうず");
	});

	it("should convert nn at end of input to んん", () => {
		expect(romajiToHiragana("nn")).toBe("んん");
	});

	it("should convert nna to んな", () => {
		expect(romajiToHiragana("nna")).toBe("んな");
	});
});
