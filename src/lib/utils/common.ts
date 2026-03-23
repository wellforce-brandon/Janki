export function safeParseJson<T>(json: string | null, fallback: T): T {
	if (!json) return fallback;
	try {
		return JSON.parse(json) as T;
	} catch {
		return fallback;
	}
}

export function toSqliteDateTime(date: Date): string {
	return date
		.toISOString()
		.replace("T", " ")
		.replace(/\.\d{3}Z$/, "");
}

export function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
