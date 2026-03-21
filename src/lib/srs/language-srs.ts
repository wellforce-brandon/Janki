import {
	getLanguageItemById,
	updateLanguageItemSrs,
	logLanguageReview,
} from "../db/queries/language";
import { updateDailyStats } from "../db/queries/stats";

// Reuse WK SRS stages: 0=Locked, 1-4=Apprentice, 5-6=Guru, 7=Master, 8=Enlightened, 9=Burned
const STAGE_INTERVALS_HOURS: Record<number, number> = {
	1: 4,
	2: 8,
	3: 23,
	4: 47,
	5: 167,
	6: 335,
	7: 719,
	8: 2879,
};

export function toSqliteDateTime(date: Date): string {
	return date
		.toISOString()
		.replace("T", " ")
		.replace(/\.\d{3}Z$/, "");
}

export function calculateNextReview(stage: number): string | null {
	if (stage <= 0 || stage >= 9) return null;
	const hours = STAGE_INTERVALS_HOURS[stage] ?? 4;
	const next = new Date();
	next.setTime(next.getTime() + hours * 60 * 60 * 1000);
	// Round up to top of next hour (WK behavior)
	next.setMinutes(0, 0, 0);
	if (next.getTime() <= Date.now()) {
		next.setTime(next.getTime() + 3600000);
	}
	return toSqliteDateTime(next);
}

/** WK drop formula: new_stage = current - ceil(incorrectCount/2) * penaltyFactor */
function calculateDrop(currentStage: number, incorrectCount: number): number {
	const penaltyFactor = currentStage >= 5 ? 2 : 1;
	const adjustment = Math.ceil(incorrectCount / 2) * penaltyFactor;
	return Math.max(1, currentStage - adjustment);
}

export interface LanguageReviewResult {
	newStage: number;
	nextReview: string | null;
}

/**
 * Process a single language item review.
 * Single dimension (not meaning+reading split like kanji).
 */
export async function reviewLanguageItem(
	itemId: number,
	correct: boolean,
	durationMs: number = 0,
	incorrectCount = 1,
): Promise<LanguageReviewResult> {
	const itemResult = await getLanguageItemById(itemId);
	if (!itemResult.ok || !itemResult.data) {
		throw new Error(`Language item ${itemId} not found`);
	}

	const item = itemResult.data;
	const currentStage = item.srs_stage;

	let newStage: number;
	if (correct) {
		newStage = Math.min(9, currentStage + 1);
	} else {
		newStage = calculateDrop(currentStage, incorrectCount);
	}

	const nextReview = calculateNextReview(newStage);

	// Update item SRS state
	await updateLanguageItemSrs(
		itemId,
		newStage,
		nextReview,
		item.correct_count + (correct ? 1 : 0),
		item.incorrect_count + (correct ? 0 : 1),
	);

	// Log the review
	await logLanguageReview(itemId, currentStage, newStage, correct, durationMs);

	// Update daily stats
	const isNew = currentStage <= 1 && item.lesson_completed_at !== null;
	await updateDailyStats(correct, isNew, durationMs);

	return { newStage, nextReview };
}
