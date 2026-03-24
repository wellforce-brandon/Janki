import { withTransaction } from "../db/database";
import {
	deleteLatestLanguageReview,
	getLanguageItemById,
	logLanguageReviewExec,
	updateLanguageItemSrs,
	updateLanguageItemSrsExec,
} from "../db/queries/language";
import { updateDailyStats } from "../db/queries/stats";
import { invalidateCache } from "../db/query-cache";
import { checkAndUnlockWithinLevel } from "./language-unlock";
import { calculateDrop, calculateNextReview } from "./srs-common";

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
	durationMs: number | null = null,
	incorrectCount = 1,
): Promise<LanguageReviewResult> {
	const itemResult = await getLanguageItemById(itemId);
	if (!itemResult.ok || !itemResult.data) {
		throw new Error(`Language item ${itemId} not found`);
	}

	const item = itemResult.data;
	const currentStage = item.srs_stage;

	// Compute isNew BEFORE any DB updates -- relies on pre-update counts from the fetched item
	const isNew =
		item.correct_count === 0 && item.incorrect_count === 0 && item.lesson_completed_at !== null;

	let newStage: number;
	if (correct) {
		newStage = Math.min(9, currentStage + 1);
	} else {
		newStage = calculateDrop(currentStage, incorrectCount);
	}

	const nextReview = calculateNextReview(newStage);

	await withTransaction(async (db) => {
		await updateLanguageItemSrsExec(
			db,
			itemId,
			newStage,
			nextReview,
			item.correct_count + (correct ? 1 : 0),
			item.incorrect_count + (correct ? 0 : 1),
		);

		await logLanguageReviewExec(db, itemId, currentStage, newStage, correct, durationMs);

		const isNew_ = isNew ? 1 : 0;
		const correctVal = correct ? 1 : 0;
		const incorrectVal = correct ? 0 : 1;
		await db.execute(
			`INSERT INTO daily_stats (date, reviews_count, new_cards_count, correct_count, incorrect_count, time_spent_ms)
			VALUES (date('now'), 1, ?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				reviews_count = reviews_count + 1,
				new_cards_count = new_cards_count + ?,
				correct_count = correct_count + ?,
				incorrect_count = incorrect_count + ?,
				time_spent_ms = time_spent_ms + ?`,
			[
				isNew_,
				correctVal,
				incorrectVal,
				durationMs ?? 0,
				isNew_,
				correctVal,
				incorrectVal,
				durationMs ?? 0,
			],
		);
	});

	// Invalidate cached counts since SRS state changed
	invalidateCache("contentTypeCounts");

	// After each review, check if new items should unlock within this level
	if (item.language_level) {
		try {
			await checkAndUnlockWithinLevel(item.language_level);
		} catch (e) {
			console.error("Failed to check unlock progression:", e);
		}
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
