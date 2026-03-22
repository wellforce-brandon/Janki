import { toSqliteDateTime } from "../utils/common";

/** Standard WK SRS intervals (hours per stage) */
export const STANDARD_INTERVALS: Record<number, number> = {
	1: 4,
	2: 8,
	3: 23,
	4: 47,
	5: 167,
	6: 335,
	7: 719,
	8: 2879,
};

/** Accelerated intervals for WK levels 1-2 (stages 1-4 halved) */
export const ACCELERATED_INTERVALS: Record<number, number> = {
	1: 2,
	2: 4,
	3: 8,
	4: 23,
	5: 167,
	6: 335,
	7: 719,
	8: 2879,
};

/**
 * Calculate the next review datetime for a given SRS stage.
 * Rounds up to the top of the next hour (WK behavior).
 * Returns null for locked (<=0) or burned (>=9) stages.
 */
export function calculateNextReview(
	stage: number,
	intervals: Record<number, number> = STANDARD_INTERVALS,
): string | null {
	if (stage <= 0 || stage >= 9) return null;
	const hours = intervals[stage] ?? 4;
	const next = new Date();
	next.setTime(next.getTime() + hours * 60 * 60 * 1000);
	next.setMinutes(0, 0, 0);
	if (next.getTime() <= Date.now()) {
		next.setTime(next.getTime() + 3600000);
	}
	return toSqliteDateTime(next);
}

/**
 * WK drop formula: new_stage = current - ceil(incorrectCount/2) * penaltyFactor.
 * penaltyFactor = 2 for Guru+ (stage >= 5), 1 otherwise. Min stage = 1.
 */
export function calculateDrop(currentStage: number, incorrectCount: number): number {
	const penaltyFactor = currentStage >= 5 ? 2 : 1;
	const adjustment = Math.ceil(incorrectCount / 2) * penaltyFactor;
	return Math.max(1, currentStage - adjustment);
}
