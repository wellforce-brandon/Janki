import type { LanguageItem } from "$lib/db/queries/language";

const MAX_SPEECH_LENGTH = 200;

/** Strip HTML, bracket annotations, and ASCII parentheticals from text for TTS */
export function sanitizeForSpeech(text: string): string {
	let result = text;

	// Strip HTML tags
	result = result.replace(/<[^>]*>/g, "");

	// Strip bracket annotations: [n], [casual], [formal], etc.
	result = result.replace(/\[[^\]]*\]/g, "");

	// Strip ASCII-only parentheticals: (n), (casual) -- but preserve Japanese in parens
	result = result.replace(/\([^)]*[a-zA-Z][^)]*\)/g, "");

	// Collapse whitespace and trim
	result = result.replace(/\s+/g, " ").trim();

	// Cap length, truncating at last natural break
	if (result.length > MAX_SPEECH_LENGTH) {
		const truncated = result.slice(0, MAX_SPEECH_LENGTH);
		const lastBreak = Math.max(
			truncated.lastIndexOf(" "),
			truncated.lastIndexOf("\u3002"), // Japanese period
			truncated.lastIndexOf("\u3001"), // Japanese comma
		);
		result = lastBreak > 0 ? truncated.slice(0, lastBreak + 1) : truncated;
	}

	return result;
}

/** Extract the right text to speak based on content type, then sanitize it */
export function extractSpeechText(item: LanguageItem): string {
	let text: string;

	if (item.content_type === "sentence") {
		text = item.sentence_ja ?? item.primary_text;
	} else {
		text = item.primary_text;
	}

	return sanitizeForSpeech(text);
}
