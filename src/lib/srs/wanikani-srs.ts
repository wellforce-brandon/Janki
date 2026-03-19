import { checkAndUnlockLevel, updateKanjiSrsState } from "../db/queries/kanji";
import { logKanjiReview } from "../db/queries/kanji-reviews";

// WaniKani-style fixed-interval SRS stages
// Stage 0: Locked (not yet unlocked)
// Stage 1: Apprentice 1 (4 hours)
// Stage 2: Apprentice 2 (8 hours)
// Stage 3: Apprentice 3 (1 day)
// Stage 4: Apprentice 4 (2 days)
// Stage 5: Guru 1 (1 week)
// Stage 6: Guru 2 (2 weeks)
// Stage 7: Master (1 month)
// Stage 8: Enlightened (4 months)
// Stage 9: Burned (done)

const STAGE_INTERVALS_HOURS: Record<number, number> = {
	1: 4,
	2: 8,
	3: 24,
	4: 48,
	5: 168, // 1 week
	6: 336, // 2 weeks
	7: 720, // ~1 month
	8: 2880, // ~4 months
};

export const STAGE_NAMES: Record<number, string> = {
	0: "Locked",
	1: "Apprentice 1",
	2: "Apprentice 2",
	3: "Apprentice 3",
	4: "Apprentice 4",
	5: "Guru 1",
	6: "Guru 2",
	7: "Master",
	8: "Enlightened",
	9: "Burned",
};

export const STAGE_CATEGORIES: Record<number, string> = {
	0: "locked",
	1: "apprentice",
	2: "apprentice",
	3: "apprentice",
	4: "apprentice",
	5: "guru",
	6: "guru",
	7: "master",
	8: "enlightened",
	9: "burned",
};

function toSqliteDateTime(date: Date): string {
	return date
		.toISOString()
		.replace("T", " ")
		.replace(/\.\d{3}Z$/, "");
}

function calculateNextReview(stage: number): string | null {
	if (stage <= 0 || stage >= 9) return null;
	const hours = STAGE_INTERVALS_HOURS[stage] ?? 4;
	const next = new Date();
	next.setTime(next.getTime() + hours * 60 * 60 * 1000);
	return toSqliteDateTime(next);
}

function calculateDrop(currentStage: number): number {
	// Wrong answer drops by more for higher stages
	if (currentStage <= 2) return Math.max(1, currentStage - 1);
	if (currentStage <= 4) return currentStage - 2;
	// Guru+ drops to Apprentice range
	return Math.max(1, currentStage - 2);
}

export async function reviewKanjiItem(
	id: number,
	correct: boolean,
	currentStage: number,
	level: number,
	durationMs: number | null = null,
): Promise<{ newStage: number; nextReview: string | null; unlockedIds: number[] }> {
	let newStage: number;

	if (correct) {
		newStage = Math.min(9, currentStage + 1);
	} else {
		newStage = calculateDrop(currentStage);
	}

	const nextReview = calculateNextReview(newStage);

	await updateKanjiSrsState(id, newStage, nextReview, correct ? 1 : 0, correct ? 0 : 1);

	// Log the review to kanji_review_log
	await logKanjiReview(id, correct, currentStage, newStage, durationMs);

	// Trigger unlock cascade when item is promoted (correct answer)
	let unlockedIds: number[] = [];
	if (correct && newStage > currentStage) {
		const unlockResult = await checkAndUnlockLevel(level);
		if (unlockResult.ok) {
			unlockedIds = unlockResult.data;
		}
	}

	return { newStage, nextReview, unlockedIds };
}

export function getStageColor(stage: number): string {
	const category = STAGE_CATEGORIES[stage] ?? "locked";
	const colors: Record<string, string> = {
		locked: "bg-gray-500/20 text-gray-400",
		apprentice: "bg-pink-500/20 text-pink-400",
		guru: "bg-purple-500/20 text-purple-400",
		master: "bg-blue-500/20 text-blue-400",
		enlightened: "bg-sky-500/20 text-sky-400",
		burned: "bg-amber-500/20 text-amber-400",
	};
	return colors[category];
}
