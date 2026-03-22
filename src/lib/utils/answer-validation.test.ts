import { describe, expect, it } from "vitest";
import { normalizeLanguageAnswer, fuzzyMatch } from "./answer-validation";

describe("Answer Validation", () => {
	describe("normalizeLanguageAnswer", () => {
		it("should lowercase input", () => {
			expect(normalizeLanguageAnswer("Hello")).toBe("hello");
		});

		it("should trim whitespace", () => {
			expect(normalizeLanguageAnswer("  hello  ")).toBe("hello");
		});

		it("should collapse multiple spaces", () => {
			expect(normalizeLanguageAnswer("hello   world")).toBe("hello world");
		});

		it("should strip punctuation", () => {
			expect(normalizeLanguageAnswer("hello, world!")).toBe("hello world");
			expect(normalizeLanguageAnswer("(test)")).toBe("test");
			expect(normalizeLanguageAnswer("it's")).toBe("its");
			expect(normalizeLanguageAnswer("a; b; c")).toBe("a b c");
		});

		it("should handle empty string", () => {
			expect(normalizeLanguageAnswer("")).toBe("");
		});

		it("should handle complex input", () => {
			expect(normalizeLanguageAnswer("  Hello,  WORLD!  (test)  ")).toBe("hello world test");
		});

		it("should preserve numbers and underscores", () => {
			expect(normalizeLanguageAnswer("test_123")).toBe("test_123");
		});
	});

	describe("fuzzyMatch", () => {
		it("should match exact strings", () => {
			expect(fuzzyMatch("hello", "hello")).toBe(true);
		});

		it("should match when user answer contains expected with similar length", () => {
			// "hello world" (11) in "the big hello world" (19): 11/19 = 58% -- below 60% threshold
			expect(fuzzyMatch("the big hello world", "hello world")).toBe(false);
			// But similar-length substring works: "hello world" (11) in "hello world!" (12): 11/12 = 92%
			expect(fuzzyMatch("hello world!", "hello world")).toBe(true);
		});

		it("should not match short substring in long string", () => {
			// "hello" (5) in "hello world" (11): 5/11 = 45% -- below threshold
			expect(fuzzyMatch("hello", "hello world")).toBe(false);
		});

		it("should not match completely different strings", () => {
			expect(fuzzyMatch("cat", "dog")).toBe(false);
		});

		it("should fuzzy match with 60%+ word overlap for 3+ word answers", () => {
			// 3 words expected, need ceil(3*0.6) = 2 matching
			expect(fuzzyMatch("to eat food", "to eat food")).toBe(true);
			expect(fuzzyMatch("to eat", "to eat food")).toBe(true); // substring match
			expect(fuzzyMatch("to eat something", "to eat food")).toBe(true); // 2/3 match
		});

		it("should reject fuzzy match below 60% threshold", () => {
			// 5 words expected, need ceil(5*0.6) = 3 matching
			expect(fuzzyMatch("the x y z w", "the quick brown fox jumps")).toBe(false); // 1/5
		});

		it("should handle 60% boundary for longer phrases", () => {
			// 5 expected words, need ceil(5*0.6) = 3 matching words
			expect(fuzzyMatch("quick brown jumps", "the quick brown fox jumps")).toBe(true); // 3/5 word overlap
			// "quick brown" is short (11) vs "the quick brown fox jumps" (25): 11/25 = 44% -- no substring match
			// but word overlap: 2/5 = 40% < 60% threshold -- fails
			expect(fuzzyMatch("quick brown", "the quick brown fox jumps")).toBe(false);
			// truly partial non-substring, 1/5 match
			expect(fuzzyMatch("only jumps here now", "the quick brown fox jumps")).toBe(false);
		});

		it("should not fuzzy match for 2-word expected (falls through to false)", () => {
			// Less than 3 expected words, no fuzzy - only exact/substring
			expect(fuzzyMatch("big dog", "big cat")).toBe(false);
		});

		it("should handle empty strings", () => {
			expect(fuzzyMatch("", "")).toBe(true); // exact match
			expect(fuzzyMatch("hello", "")).toBe(false); // short strings below 3-char threshold
		});
	});
});
