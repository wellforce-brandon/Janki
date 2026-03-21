export function getTypeColor(itemType: string): string {
	switch (itemType) {
		case "radical":
			return "bg-blue-500 dark:bg-blue-600";
		case "kanji":
			return "bg-pink-500 dark:bg-pink-600";
		case "vocab":
			return "bg-purple-500 dark:bg-purple-600";
		default:
			return "bg-gray-500";
	}
}

export function parseMeanings(json: string): string[] {
	try {
		return JSON.parse(json) as string[];
	} catch {
		return [json];
	}
}

export interface ContextSentence {
	en: string;
	ja: string;
}

export interface PronunciationAudio {
	url: string;
	content_type: string;
	metadata: {
		gender: string;
		source_id: number;
		pronunciation: string;
		voice_actor_id: number;
		voice_actor_name: string;
		voice_description: string;
	};
}

export interface CharacterImage {
	url: string;
	content_type: string;
	metadata: Record<string, unknown>;
}

function safeParseJson<T>(json: string | null, fallback: T): T {
	if (!json) return fallback;
	try {
		return JSON.parse(json) as T;
	} catch {
		return fallback;
	}
}

export function parseReadings(json: string | null): string[] {
	return safeParseJson<string[]>(json, []);
}

export function parseContextSentences(json: string | null): ContextSentence[] {
	return safeParseJson<ContextSentence[]>(json, []);
}

export function parsePronunciationAudios(json: string | null): PronunciationAudio[] {
	return safeParseJson<PronunciationAudio[]>(json, []);
}

export function parsePartsOfSpeech(json: string | null): string[] {
	return safeParseJson<string[]>(json, []);
}

export function parseCharacterImages(json: string | null): CharacterImage[] {
	return safeParseJson<CharacterImage[]>(json, []);
}

export function parseWkIdArray(json: string | null): number[] {
	return safeParseJson<number[]>(json, []);
}

const ITEM_SRS_COLORS: Record<string, { locked: string; lesson: string; review: string }> = {
	radical: {
		locked: "border-2 border-dashed border-blue-500 dark:border-blue-400 bg-transparent text-muted-foreground",
		lesson: "bg-blue-500/30 dark:bg-blue-400/30 text-blue-600 dark:text-blue-400 border border-blue-500/50 dark:border-blue-400/50",
		review: "bg-blue-500 dark:bg-blue-600 text-white border border-transparent",
	},
	kanji: {
		locked: "border-2 border-dashed border-pink-500 dark:border-pink-400 bg-transparent text-muted-foreground",
		lesson: "bg-pink-500/30 dark:bg-pink-400/30 text-pink-600 dark:text-pink-400 border border-pink-500/50 dark:border-pink-400/50",
		review: "bg-pink-500 dark:bg-pink-600 text-white border border-transparent",
	},
	vocab: {
		locked: "border-2 border-dashed border-purple-500 dark:border-purple-400 bg-transparent text-muted-foreground",
		lesson: "bg-purple-500/30 dark:bg-purple-400/30 text-purple-600 dark:text-purple-400 border border-purple-500/50 dark:border-purple-400/50",
		review: "bg-purple-500 dark:bg-purple-600 text-white border border-transparent",
	},
};

export function getTileClasses(item: { item_type: string; srs_stage: number; lesson_completed_at: string | null }): string {
	const colorSet = ITEM_SRS_COLORS[item.item_type] ?? ITEM_SRS_COLORS.kanji;
	if (item.srs_stage === 0) return colorSet.locked;
	if (item.srs_stage === 9) return "bg-zinc-700 dark:bg-zinc-600 text-zinc-300 border border-transparent";
	if (!item.lesson_completed_at) return colorSet.lesson;
	return colorSet.review;
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
