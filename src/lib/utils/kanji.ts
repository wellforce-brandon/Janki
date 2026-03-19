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

export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
