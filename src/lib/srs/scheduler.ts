import {
	type CardWithContent,
	getDueCards,
	getNewCards,
	updateCardState,
} from "../db/queries/cards";
import { logReview } from "../db/queries/reviews";
import { updateDailyStats } from "../db/queries/stats";
import { type CardState, Rating, reviewCard } from "./fsrs";

export interface ReviewQueue {
	cards: CardWithContent[];
	dueCount: number;
	newCount: number;
}

export async function getReviewQueue(
	deckId: number,
	newCardLimit = 20,
	reviewLimit = 200,
): Promise<ReviewQueue> {
	const dueResult = await getDueCards(deckId, reviewLimit);
	const dueCards = dueResult.ok ? dueResult.data : [];

	const remainingSlots = Math.max(0, reviewLimit - dueCards.length);
	const newLimit = Math.min(newCardLimit, remainingSlots);
	const newResult = await getNewCards(deckId, newLimit);
	const newCards = newResult.ok ? newResult.data : [];

	// Interleave: due cards first, then new cards
	const cards = [...dueCards, ...newCards];

	return {
		cards,
		dueCount: dueCards.length,
		newCount: newCards.length,
	};
}

export interface ReviewResult {
	updatedCard: CardState;
	reviewLogId: number;
}

export async function processReview(
	card: CardWithContent,
	rating: Rating,
	durationMs: number,
): Promise<ReviewResult | null> {
	const currentState: CardState = {
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

	const { card: updatedCard } = reviewCard(currentState, rating);

	// Update card state in DB
	const updateResult = await updateCardState(
		card.id,
		updatedCard.state,
		updatedCard.stability,
		updatedCard.difficulty,
		updatedCard.due,
		updatedCard.last_review ?? new Date().toISOString(),
		updatedCard.reps,
		updatedCard.lapses,
		updatedCard.scheduled_days,
		updatedCard.elapsed_days,
	);

	if (!updateResult.ok) return null;

	// Log the review
	const logResult = await logReview(
		card.id,
		rating,
		updatedCard.state,
		updatedCard.scheduled_days,
		updatedCard.elapsed_days,
		updatedCard.stability,
		updatedCard.difficulty,
		durationMs,
	);

	if (!logResult.ok) return null;

	// Update daily stats
	const isCorrect = rating >= Rating.Good;
	const isNew = card.state === 0;
	await updateDailyStats(isCorrect, isNew, durationMs);

	return {
		updatedCard,
		reviewLogId: logResult.data,
	};
}
