import { describe, expect, it } from "vitest";
import { normalizeAnswer, fuzzyMatch } from "./answer-validation";

describe("Answer Validation", () => {
	describe("normalizeAnswer", () => {
		it("should lowercase input", () => {
			expect(normalizeAnswer("Hello")).toBe("hello");
		});

		it("should trim whitespace", () => {
			expect(normalizeAnswer("  hello  ")).toBe("hello");
		});

		it("should collapse multiple spaces", () => {
			expect(normalizeAnswer("hello   world")).toBe("hello world");
		});

		it("should strip punctuation", () => {
			expect(normalizeAnswer("hello, world!")).toBe("hello world");
			expect(normalizeAnswer("(test)")).toBe("test");
			expect(normalizeAnswer("it's")).toBe("its");
			expect(normalizeAnswer("a; b; c")).toBe("a b c");
		});

		it("should handle empty string", () => {
			expect(normalizeAnswer("")).toBe("");
		});

		it("should handle complex input", () => {
			expect(normalizeAnswer("  Hello,  WORLD!  (test)  ")).toBe("hello world test");
		});

		it("should preserve numbers and underscores", () => {
			expect(normalizeAnswer("test_123")).toBe("test_123");
		});
	});

	describe("fuzzyMatch", () => {
		it("should match exact strings", () => {
			expect(fuzzyMatch("hello", "hello")).toBe(true);
		});

		it("should match when user answer contains expected", () => {
			expect(fuzzyMatch("the big hello world", "hello world")).toBe(true);
		});

		it("should match when expected contains user answer", () => {
			expect(fuzzyMatch("hello", "hello world")).toBe(true);
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
			expect(fuzzyMatch("quick brown jumps", "the quick brown fox jumps")).toBe(true); // 3/5
			// "quick brown" is a substring of "the quick brown fox jumps" so it still matches
			expect(fuzzyMatch("quick brown", "the quick brown fox jumps")).toBe(true);
			// truly partial non-substring, 1/5 match
			expect(fuzzyMatch("only jumps here now", "the quick brown fox jumps")).toBe(false);
		});

		it("should not fuzzy match for 2-word expected (falls through to false)", () => {
			// Less than 3 expected words, no fuzzy - only exact/substring
			expect(fuzzyMatch("big dog", "big cat")).toBe(false);
		});

		it("should handle empty strings", () => {
			expect(fuzzyMatch("", "")).toBe(true);
			expect(fuzzyMatch("hello", "")).toBe(true); // "" includes ""
		});
	});
});
