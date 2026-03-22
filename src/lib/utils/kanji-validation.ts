import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { romajiToHiragana } from "./romaji-to-hiragana";

function parseJsonArray(json: string | null): string[] {
	if (!json) return [];
	try {
		return JSON.parse(json) as string[];
	} catch {
		return json ? [json] : [];
	}
}

// Normalize kanji answer text: strip non-word chars, collapse whitespace, lowercase
export function normalizeKanjiAnswer(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

// Meanings accepted in reviews: all meanings + user synonyms
export function getAcceptedMeanings(item: KanjiLevelItem): string[] {
	const meanings = parseJsonArray(item.meanings);
	if (item.user_synonyms) {
		meanings.push(...parseJsonArray(item.user_synonyms));
	}
	return meanings.map((m) => normalizeKanjiAnswer(m));
}

// Readings accepted in reviews (filters out ! prefix, kanji = on'yomi only)
export function getAcceptedReadings(item: KanjiLevelItem): string[] {
	const readings: string[] = [];

	// On'yomi readings (accepted for kanji and vocab)
	const onReadings = parseJsonArray(item.readings_on)
		.filter((r) => !r.startsWith("!"))
		.map((r) => r.trim());
	readings.push(...onReadings);

	// Kun'yomi readings: only accepted for vocab, NOT for kanji
	if (item.item_type !== "kanji") {
		const kunReadings = parseJsonArray(item.readings_kun)
			.filter((r) => !r.startsWith("!"))
			.map((r) => r.trim());
		readings.push(...kunReadings);
	}

	// Single reading field (vocab)
	if (item.reading) {
		readings.push(item.reading.trim());
	}

	return readings;
}

// All readings for display in lessons (includes non-accepted, strips ! prefix)
export function getAllReadings(item: KanjiLevelItem): string[] {
	const readings: string[] = [];
	const onReadings = parseJsonArray(item.readings_on).map((r) =>
		r.startsWith("!") ? r.slice(1).trim() : r.trim(),
	);
	const kunReadings = parseJsonArray(item.readings_kun).map((r) =>
		r.startsWith("!") ? r.slice(1).trim() : r.trim(),
	);
	readings.push(...onReadings, ...kunReadings);
	if (item.reading) readings.push(item.reading.trim());
	return readings;
}

// Check if the user typed a valid kun'yomi for a kanji reading question
// Returns true if the answer is a kun reading but we want on'yomi (triggers shake, not wrong)
export function isKunReadingForKanji(item: KanjiLevelItem, userInput: string): boolean {
	if (item.item_type !== "kanji") return false;
	const userHiragana = romajiToHiragana(userInput).trim();
	const kunReadings = parseJsonArray(item.readings_kun)
		.filter((r) => !r.startsWith("!"))
		.map((r) => r.trim());
	return kunReadings.includes(userHiragana);
}

export function getCorrectDisplay(
	item: KanjiLevelItem,
	questionType: "meaning" | "reading",
): string {
	if (questionType === "meaning") {
		return parseJsonArray(item.meanings).join(", ");
	}
	return getAcceptedReadings(item).join(", ");
}
