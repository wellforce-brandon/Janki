import type { CardWithContent } from "$lib/db/queries/cards";
import { updateCardState } from "$lib/db/queries/cards";
import { deleteReviewLogEntry } from "$lib/db/queries/reviews";
import { getTodayStats, restoreDailyStats } from "$lib/db/queries/stats";
import type { CardState } from "./fsrs";

export interface UndoEntry {
	cardIndex: number;
	card: CardWithContent;
	previousState: CardState;
	reviewLogId: number;
	prevStats: {
		reviews_count: number;
		correct_count: number;
		incorrect_count: number;
		time_spent_ms: number;
	} | null;
	wasCorrect: boolean;
}

const MAX_UNDO_STACK = 50;

export function createUndoStack(): UndoEntry[] {
	return [];
}

export async function snapshotStats(): Promise<UndoEntry["prevStats"]> {
	const statsResult = await getTodayStats();
	if (!statsResult.ok || !statsResult.data) return null;
	return {
		reviews_count: statsResult.data.reviews_count,
		correct_count: statsResult.data.correct_count,
		incorrect_count: statsResult.data.incorrect_count,
		time_spent_ms: statsResult.data.time_spent_ms,
	};
}

export function snapshotCardState(card: CardWithContent): CardState {
	return {
		stability: card.stability,
		difficulty: card.difficulty,
		due: card.due,
		last_review: card.last_review,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		scheduled_days: card.scheduled_days,
		elapsed_days: card.elapsed_days,
	};
}

export function pushUndo(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
	return [...stack.slice(-(MAX_UNDO_STACK - 1)), entry];
}

export async function performUndo(entry: UndoEntry): Promise<void> {
	await updateCardState(
		entry.card.id,
		entry.previousState.state,
		entry.previousState.stability,
		entry.previousState.difficulty,
		entry.previousState.due,
		entry.previousState.last_review ?? "",
		entry.previousState.reps,
		entry.previousState.lapses,
		entry.previousState.scheduled_days,
		entry.previousState.elapsed_days,
	);

	await deleteReviewLogEntry(entry.reviewLogId);

	if (entry.prevStats) {
		const today = new Date().toISOString().split("T")[0];
		await restoreDailyStats(
			today,
			entry.prevStats.reviews_count,
			entry.prevStats.correct_count,
			entry.prevStats.incorrect_count,
			entry.prevStats.time_spent_ms,
		);
	}
}
