import { checkAndUnlockLevel, updateKanjiSrsState } from "../db/queries/kanji";
import { logKanjiReview } from "../db/queries/kanji-reviews";
import { invalidateCache } from "../db/query-cache";
import {
	calculateNextReview as calculateNextReviewBase,
	calculateDrop,
	STANDARD_INTERVALS,
	ACCELERATED_INTERVALS,
} from "./srs-common";

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
	const intervals = level <= 2 ? ACCELERATED_INTERVALS : STANDARD_INTERVALS;
	return calculateNextReviewBase(stage, intervals);
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
