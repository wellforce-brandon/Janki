import {
	getLanguageItemById,
	updateLanguageItemSrs,
	logLanguageReview,
	deleteLatestLanguageReview,
} from "../db/queries/language";
import { invalidateCache } from "../db/query-cache";
import { updateDailyStats } from "../db/queries/stats";
import { calculateNextReview, calculateDrop } from "./srs-common";
import { checkAndUnlockWithinLevel } from "./language-unlock";

export { calculateNextReview };

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

	// Compute isNew BEFORE any DB updates -- relies on pre-update counts from the fetched item
	const isNew = item.correct_count === 0 && item.incorrect_count === 0 && item.lesson_completed_at !== null;

	let newStage: number;
	if (correct) {
		newStage = Math.min(9, currentStage + 1);
	} else {
		newStage = calculateDrop(currentStage, incorrectCount);
	}

	const nextReview = calculateNextReview(newStage);

	await updateLanguageItemSrs(
		itemId,
		newStage,
		nextReview,
		item.correct_count + (correct ? 1 : 0),
		item.incorrect_count + (correct ? 0 : 1),
	);

	await logLanguageReview(itemId, currentStage, newStage, correct, durationMs);

	await updateDailyStats(correct, isNew, durationMs);

	// Invalidate cached counts since SRS state changed
	invalidateCache("contentTypeCounts");

	// After each review, check if new items should unlock within this level
	if (item.language_level) {
		checkAndUnlockWithinLevel(item.language_level).catch(console.error);
	}

	return { newStage, nextReview };
}

/**
 * Undo the last review of a language item.
 * Reverts SRS state, daily stats, and review log.
 */
export async function undoLanguageReview(
	itemId: number,
	prevStage: number,
	prevNextReview: string | null,
	prevCorrectCount: number,
	prevIncorrectCount: number,
	wasCorrect: boolean,
	durationMs: number,
): Promise<void> {
	await updateLanguageItemSrs(
		itemId,
		prevStage,
		prevNextReview,
		prevCorrectCount,
		prevIncorrectCount,
	);

	await deleteLatestLanguageReview(itemId);

	await updateDailyStats(wasCorrect, false, -durationMs);

	invalidateCache("contentTypeCounts");
}
