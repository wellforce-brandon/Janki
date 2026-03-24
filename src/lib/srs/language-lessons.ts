import {
	getAvailableLessons,
	getAvailableLessonCount,
	getLanguageItemById,
	markLessonsBatchCompleted,
	type ContentType,
	type LanguageItem,
} from "../db/queries/language";
import { calculateNextReview } from "./language-srs";
import { checkAndUnlockWithinLevel } from "./language-unlock";
import type { QueryResult } from "../db/database";

const DEFAULT_BATCH_SIZE = 5;

export interface LessonBatch {
	items: LanguageItem[];
	totalAvailable: number;
}

/**
 * Get the next batch of lessons to study.
 * Returns unlocked items that haven't had their lesson completed yet.
 */
export async function getNextLessonBatch(
	contentType?: ContentType,
	batchSize = DEFAULT_BATCH_SIZE,
): Promise<QueryResult<LessonBatch>> {
	const [itemsResult, countResult] = await Promise.all([
		getAvailableLessons(contentType, batchSize),
		getAvailableLessonCount(contentType),
	]);

	if (!itemsResult.ok) return { ok: false, error: itemsResult.error };
	if (!countResult.ok) return { ok: false, error: countResult.error };

	return {
		ok: true,
		data: {
			items: itemsResult.data,
			totalAvailable: countResult.data,
		},
	};
}

/**
 * Complete a lesson batch: set lesson_completed_at and schedule first review.
 * First review is at Apprentice 1 interval (4 hours, rounded to top of hour).
 */
export async function completeLessonBatch(
	itemIds: number[],
): Promise<QueryResult<void>> {
	const nextReview = calculateNextReview(1); // Apprentice 1 = 4 hours
	if (!nextReview) {
		return { ok: false, error: "Failed to calculate next review time" };
	}

	const result = await markLessonsBatchCompleted(itemIds, nextReview);

	// After completing lessons, check if more items should unlock in those levels
	if (result.ok) {
		const levelsToCheck = new Set<number>();
		for (const id of itemIds) {
			const itemResult = await getLanguageItemById(id);
			if (itemResult.ok && itemResult.data?.language_level) {
				levelsToCheck.add(itemResult.data.language_level);
			}
		}
		for (const level of levelsToCheck) {
			checkAndUnlockWithinLevel(level).catch(console.error);
		}
	}

	return result;
}
