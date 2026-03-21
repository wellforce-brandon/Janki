import type { BuiltinItem } from "../db/queries/language";
import {
	logBuiltinReview,
	updateBuiltinItemState,
} from "../db/queries/language";
import { updateDailyStats } from "../db/queries/stats";
import type { CardState } from "./fsrs";
import { Rating, reviewCard } from "./fsrs";

export interface BuiltinReviewResult {
	updatedState: CardState;
	reviewLogId: number;
}

export async function processBuiltinReview(
	item: BuiltinItem,
	rating: Rating,
	durationMs: number,
): Promise<BuiltinReviewResult | null> {
	const currentState: CardState = {
		stability: item.stability,
		difficulty: item.difficulty,
		due: item.due,
		last_review: item.last_review,
		reps: item.reps,
		lapses: item.lapses,
		state: item.state,
		scheduled_days: item.scheduled_days,
		elapsed_days: item.elapsed_days,
	};

	const { card: updatedState } = reviewCard(currentState, rating);

	const updateResult = await updateBuiltinItemState(
		item.id,
		updatedState.state,
		updatedState.stability,
		updatedState.difficulty,
		updatedState.due,
		updatedState.last_review ?? new Date().toISOString(),
		updatedState.reps,
		updatedState.lapses,
		updatedState.scheduled_days,
		updatedState.elapsed_days,
	);

	if (!updateResult.ok) return null;

	const logResult = await logBuiltinReview(
		item.id,
		rating,
		updatedState.state,
		updatedState.scheduled_days,
		updatedState.elapsed_days,
		updatedState.stability,
		updatedState.difficulty,
		durationMs,
	);

	if (!logResult.ok) return null;

	const isCorrect = rating >= Rating.Good;
	const isNew = item.state === 0;
	await updateDailyStats(isCorrect, isNew, durationMs);

	return {
		updatedState,
		reviewLogId: logResult.data,
	};
}
