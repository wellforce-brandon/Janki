/** Normalize a language answer for comparison: lowercase, trim, collapse whitespace, strip punctuation */
export function normalizeLanguageAnswer(answer: string): string {
	return answer
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[.,!?;:'"()\[\]{}]/g, "");
}

/** Fuzzy match: checks if strings share enough words for longer answers (60%+ overlap for 3+ words) */
export function fuzzyMatch(userAnswer: string, expected: string): boolean {
	if (userAnswer === expected) return true;

	// Substring match: only accept when both are >= 3 chars and the shorter is at least 60% of the longer
	if (userAnswer.length >= 3 && expected.length >= 3) {
		const shorter = Math.min(userAnswer.length, expected.length);
		const longer = Math.max(userAnswer.length, expected.length);
		if (shorter / longer >= 0.6) {
			if (userAnswer.includes(expected) || expected.includes(userAnswer)) return true;
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
