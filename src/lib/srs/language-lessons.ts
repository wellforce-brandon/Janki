import {
	getAvailableLessons,
	getAvailableLessonCount,
	markLessonCompleted,
	type ContentType,
	type LanguageItem,
} from "../db/queries/language";
import { calculateNextReview } from "./language-srs";
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

	for (const id of itemIds) {
		const result = await markLessonCompleted(id, nextReview);
		if (!result.ok) return result;
	}

	return { ok: true, data: undefined };
}
