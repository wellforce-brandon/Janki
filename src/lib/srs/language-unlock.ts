import {
	type ContentType,
	unlockLanguageItems,
	getPendingLessonCount,
	getLevelContentTypeProgress,
	getLevelAllContentTypeProgress,
	getLockedItemsByLevelAndType,
	getLevelOverallProgress,
	unlockSentencesWithMetPrerequisites,
} from "../db/queries/language";
import { invalidateCache } from "../db/query-cache";
import { getSettings } from "../stores/app-settings.svelte";

/** 90% guru+ threshold for all unlock gates */
const GURU_GATE_THRESHOLD = 0.9;

/** Maximum language level (may vary by path, but 100 is the upper bound) */
const MAX_LEVEL = 100;

export interface UnlockResult {
	unlockedCount: number;
	newLevelUnlocked: number | null;
}

/**
 * Check and unlock items within a single level using the cascade:
 *   kana guru'd -> vocab unlocks
 *   vocab guru'd -> grammar + conjugation unlock
 *   grammar guru'd -> sentences unlock
 *
 * Respects per-type pending lesson caps from settings.
 * Call after each review answer is processed.
 */
export async function checkAndUnlockWithinLevel(level: number): Promise<number> {
	let totalUnlocked = 0;

	// Fetch all content type progress for this level in one query
	const allProgress = await getLevelAllContentTypeProgress(level);
	if (!allProgress.ok) return 0;

	const progress = allProgress.data;
	const isGatePassed = (type: string) => {
		const p = progress[type];
		return !p || p.total === 0 || (p.guru_plus / p.total) >= GURU_GATE_THRESHOLD;
	};

	// Step 1: If 90% of level's kana are guru+, unlock vocabulary
	if (isGatePassed("kana")) {
		totalUnlocked += await unlockTypeInLevel(level, "vocabulary", "vocabLessonCap");
	}

	// Step 2: If 90% of level's vocabulary are guru+, unlock grammar + conjugation
	if (isGatePassed("vocabulary")) {
		totalUnlocked += await unlockTypeInLevel(level, "grammar", "grammarLessonCap");
		totalUnlocked += await unlockTypeInLevel(level, "conjugation", "conjugationLessonCap");
	}

	// Step 3: If 90% of level's grammar are guru+, unlock sentences
	if (isGatePassed("grammar")) {
		// First try prerequisite-based sentence unlocking
		const prereqResult = await unlockSentencesWithMetPrerequisites(level);
		if (prereqResult.ok) totalUnlocked += prereqResult.data;

		// Also unlock any remaining locked sentences up to the cap
		totalUnlocked += await unlockTypeInLevel(level, "sentence", "sentenceLessonCap");
	}

	if (totalUnlocked > 0) {
		invalidateCache("contentTypeCounts");
	}

	return totalUnlocked;
}

/**
 * Check if a level is complete (90% of ALL items at guru+) and unlock
 * the next level's kana (or vocab if the next level has no kana).
 *
 * Call after a review batch completes.
 * Returns the new level number if unlocked, or null.
 */
// TODO: Wire up after review batches -- currently unused, intended for level-up gating
export async function checkLevelProgression(level: number): Promise<UnlockResult> {
	const result: UnlockResult = { unlockedCount: 0, newLevelUnlocked: null };

	const progress = await getLevelOverallProgress(level);
	if (!progress.ok) return result;

	const { total, guru_plus } = progress.data;
	if (total === 0 || (guru_plus / total) < GURU_GATE_THRESHOLD) return result;

	const nextLevel = level + 1;
	if (nextLevel > MAX_LEVEL) return result;

	// Check if next level has any items at all
	const nextProgress = await getLevelOverallProgress(nextLevel);
	if (!nextProgress.ok || nextProgress.data.total === 0) return result;

	// Check if next level has kana
	const nextKana = await getLevelContentTypeProgress(nextLevel, "kana");
	if (!nextKana.ok) return result;

	if (nextKana.data.total > 0) {
		// Unlock next level's kana
		const locked = await getLockedItemsByLevelAndType(nextLevel, "kana", nextKana.data.total);
		if (locked.ok && locked.data.length > 0) {
			const ids = locked.data.map((r) => r.id);
			await unlockLanguageItems(ids);
			result.unlockedCount = ids.length;
			result.newLevelUnlocked = nextLevel;
			console.log(`[language-unlock] Level ${level} complete! Unlocked ${ids.length} kana in level ${nextLevel}`);
		}
	} else {
		// No kana in next level -- unlock vocabulary directly (respecting cap)
		const unlocked = await unlockTypeInLevel(nextLevel, "vocabulary", "vocabLessonCap");
		if (unlocked > 0) {
			result.unlockedCount = unlocked;
			result.newLevelUnlocked = nextLevel;
			console.log(`[language-unlock] Level ${level} complete! Unlocked ${unlocked} vocab in level ${nextLevel} (no kana)`);
		}
	}

	if (result.unlockedCount > 0) {
		invalidateCache("contentTypeCounts");
	}

	return result;
}

/**
 * Unlock locked items of a content type within a level, respecting
 * the global pending lesson cap for that type.
 */
async function unlockTypeInLevel(
	level: number,
	contentType: ContentType,
	capKey: "vocabLessonCap" | "grammarLessonCap" | "sentenceLessonCap" | "conjugationLessonCap",
): Promise<number> {
	const pendingResult = await getPendingLessonCount(contentType);
	if (!pendingResult.ok) return 0;

	const cap = getSettings()[capKey];
	if (pendingResult.data >= cap) return 0;

	const remaining = cap - pendingResult.data;

	const locked = await getLockedItemsByLevelAndType(level, contentType, remaining);
	if (!locked.ok || locked.data.length === 0) return 0;

	const ids = locked.data.map((r) => r.id);
	await unlockLanguageItems(ids);
	console.log(`[language-unlock] Unlocked ${ids.length} ${contentType} items in level ${level}`);
	return ids.length;
}
