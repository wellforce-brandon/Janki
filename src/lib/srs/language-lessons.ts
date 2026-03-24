import {
	getAvailableLessons,
	getAvailableLessonCount,
	getTodayLanguageLessonCount,
	markLessonsBatchCompleted,
	type ContentType,
	type LanguageItem,
} from "../db/queries/language";
import { calculateNextReview } from "./language-srs";
import { checkAndUnlockWithinLevel } from "./language-unlock";
import type { QueryResult } from "../db/database";
import { getSettings } from "../stores/app-settings.svelte";

const DEFAULT_BATCH_SIZE = 5;

export interface LessonBatch {
	items: LanguageItem[];
	totalAvailable: number;
	todayCompleted: number;
	dailyLimit: number;
}

/**
 * Get the next batch of lessons to study.
 * Returns unlocked items that haven't had their lesson completed yet,
 * capped by the daily lesson limit.
 */
export async function getNextLessonBatch(
	contentType?: ContentType,
	batchSize = DEFAULT_BATCH_SIZE,
): Promise<QueryResult<LessonBatch>> {
	const dailyLimit = getSettings().languageMaxDailyLessons;

	const [itemsResult, countResult, todayResult] = await Promise.all([
		getAvailableLessons(contentType, batchSize),
		getAvailableLessonCount(contentType),
		getTodayLanguageLessonCount(),
	]);

	if (!itemsResult.ok) return { ok: false, error: itemsResult.error };
	if (!countResult.ok) return { ok: false, error: countResult.error };
	const todayCompleted = todayResult.ok ? todayResult.data : 0;

	const remaining = dailyLimit > 0 ? Math.max(0, dailyLimit - todayCompleted) : Infinity;
	const cappedItems = itemsResult.data.slice(0, remaining);

	return {
		ok: true,
		data: {
			items: cappedItems,
			totalAvailable: countResult.data,
			todayCompleted,
			dailyLimit,
		},
	};
}

/**
 * Complete a lesson batch: set lesson_completed_at and schedule first review.
 * First review is at Apprentice 1 interval (4 hours, rounded to top of hour).
 * Pass the full items array to avoid re-fetching by ID for level info.
 */
export async function completeLessonBatch(
	items: LanguageItem[],
): Promise<QueryResult<void>> {
	const nextReview = calculateNextReview(1); // Apprentice 1 = 4 hours
	if (!nextReview) {
		return { ok: false, error: "Failed to calculate next review time" };
	}

	const itemIds = items.map((i) => i.id);
	const result = await markLessonsBatchCompleted(itemIds, nextReview);

	// After completing lessons, check if more items should unlock in those levels
	if (result.ok) {
		const levelsToCheck = new Set<number>();
		for (const item of items) {
			if (item.language_level) {
				levelsToCheck.add(item.language_level);
			}
		}
		for (const level of levelsToCheck) {
			try {
				await checkAndUnlockWithinLevel(level);
			} catch (e) {
				console.error("Failed to check unlock progression:", e);
			}
		}
	}

	return result;
}
