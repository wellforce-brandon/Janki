import { checkAndUnlockLevel, updateKanjiSrsState } from "../db/queries/kanji";
import { logKanjiReview } from "../db/queries/kanji-reviews";
import { invalidateCache } from "../db/query-cache";
import { toSqliteDateTime } from "../utils/common";

// WaniKani SRS stages (intervals match WK API: /v2/spaced_repetition_systems)
// Stage 0: Locked | Stage 1-4: Apprentice | Stage 5-6: Guru
// Stage 7: Master | Stage 8: Enlightened | Stage 9: Burned

const STAGE_INTERVALS_HOURS: Record<number, number> = {
	1: 4, // 14400s
	2: 8, // 28800s
	3: 23, // 82800s
	4: 47, // 169200s
	5: 167, // 601200s
	6: 335, // 1206000s
	7: 719, // 2588400s
	8: 2879, // 10364400s
};

// Accelerated intervals for levels 1-2 (stages 1-4 halved, 5-8 unchanged)
const ACCELERATED_INTERVALS_HOURS: Record<number, number> = {
	1: 2, // 7200s
	2: 4, // 14400s
	3: 8, // 28800s
	4: 23, // 82800s
	5: 167,
	6: 335,
	7: 719,
	8: 2879,
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

function calculateNextReview(stage: number, level: number): string | null {
	if (stage <= 0 || stage >= 9) return null;
	const intervals = level <= 2 ? ACCELERATED_INTERVALS_HOURS : STAGE_INTERVALS_HOURS;
	const hours = intervals[stage] ?? 4;
	const next = new Date();
	next.setTime(next.getTime() + hours * 60 * 60 * 1000);
	// Round up to top of next hour (WK behavior)
	next.setMinutes(0, 0, 0);
	if (next.getTime() <= Date.now()) {
		next.setTime(next.getTime() + 3600000);
	}
	return toSqliteDateTime(next);
}

// WK drop formula: new_stage = current - ceil(incorrectCount / 2) * penaltyFactor
// penaltyFactor = 2 for Guru+ (stage >= 5), 1 otherwise. Min stage = 1.
function calculateDrop(currentStage: number, incorrectCount: number): number {
	const penaltyFactor = currentStage >= 5 ? 2 : 1;
	const adjustment = Math.ceil(incorrectCount / 2) * penaltyFactor;
	return Math.max(1, currentStage - adjustment);
}

export async function reviewKanjiItem(
	id: number,
	correct: boolean,
	currentStage: number,
	level: number,
	durationMs: number | null = null,
	incorrectCount = 1,
	meaningIncorrect = 0,
	readingIncorrect = 0,
): Promise<{ newStage: number; nextReview: string | null; unlockedIds: number[] }> {
	let newStage: number;

	if (correct) {
		newStage = Math.min(9, currentStage + 1);
	} else {
		newStage = calculateDrop(currentStage, incorrectCount);
	}

	const nextReview = calculateNextReview(newStage, level);

	await updateKanjiSrsState(id, newStage, nextReview, correct ? 1 : 0, correct ? 0 : 1, meaningIncorrect, readingIncorrect);

	await logKanjiReview(
		id,
		correct,
		currentStage,
		newStage,
		durationMs,
		meaningIncorrect,
		readingIncorrect,
	);

	// Trigger unlock cascade when item is promoted (correct answer)
	let unlockedIds: number[] = [];
	if (correct && newStage > currentStage) {
		const unlockResult = await checkAndUnlockLevel(level);
		if (unlockResult.ok) {
			unlockedIds = unlockResult.data;
		} else {
			console.error("[WK-SRS] Unlock cascade failed:", unlockResult.error);
		}
	}

	invalidateCache("contentTypeCounts");

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
