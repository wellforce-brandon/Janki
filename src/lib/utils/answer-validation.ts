/** Normalize a language answer for comparison: lowercase, trim, collapse whitespace, strip punctuation */
export function normalizeLanguageAnswer(answer: string): string {
	return answer
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[.,!?;:'"()\[\]{}]/g, "");
}

/**
 * Fuzzy match for language answer validation.
 * Tolerance policy: accepts answers that are close enough to avoid penalizing
 * minor typos or omitted particles, while rejecting clearly wrong answers.
 * - Substring: accepts when one string contains the other and the shorter is >= 75% of the longer
 * - Word overlap: for 3+ word answers, accepts when 60% of expected words appear in the user's answer
 */
export function fuzzyMatch(userAnswer: string, expected: string): boolean {
	if (userAnswer === expected) return true;

	// Substring match: both strings must be >= 3 chars and within 75% length of each other.
	// Then only accept if the expected answer contains the user's answer (user wrote a subset).
	// The length ratio guard rejects wildly different lengths before the includes check.
	if (userAnswer.length >= 3 && expected.length >= 3) {
		const shorter = Math.min(userAnswer.length, expected.length);
		const longer = Math.max(userAnswer.length, expected.length);
		if (shorter / longer >= 0.75) {
			if (expected.includes(userAnswer)) return true;
		}
	}

	const userWords = userAnswer.split(" ").filter(Boolean);
	const expectedWords = expected.split(" ").filter(Boolean);
	if (expectedWords.length >= 3) {
		const matching = userWords.filter((w) => expectedWords.includes(w));
		return matching.length >= Math.ceil(expectedWords.length * 0.6);
	}
	return false;
}
