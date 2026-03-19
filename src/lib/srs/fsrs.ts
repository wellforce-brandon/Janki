import {
	createEmptyCard,
	type Card as FsrsCard,
	fsrs,
	generatorParameters,
	Rating,
	type RecordLogItem,
	State,
} from "ts-fsrs";

const params = generatorParameters();
const f = fsrs(params);

export type { FsrsCard };
export { Rating, State };

export interface CardState {
	stability: number;
	difficulty: number;
	due: string;
	last_review: string | null;
	reps: number;
	lapses: number;
	state: number;
	scheduled_days: number;
	elapsed_days: number;
}

export function createNewCard(): CardState {
	const card = createEmptyCard();
	return fsrsCardToState(card);
}

export function reviewCard(
	cardState: CardState,
	rating: Rating,
): { card: CardState; log: RecordLogItem } {
	const card = stateToFsrsCard(cardState);
	const now = new Date();
	const recordLog = f.repeat(card, now);
	const result = recordLog[rating];
	return {
		card: fsrsCardToState(result.card),
		log: result,
	};
}

export function getNextIntervals(cardState: CardState): Record<Rating, string> {
	const card = stateToFsrsCard(cardState);
	const now = new Date();
	const recordLog = f.repeat(card, now);

	return {
		[Rating.Again]: formatInterval(recordLog[Rating.Again].card),
		[Rating.Hard]: formatInterval(recordLog[Rating.Hard].card),
		[Rating.Good]: formatInterval(recordLog[Rating.Good].card),
		[Rating.Easy]: formatInterval(recordLog[Rating.Easy].card),
	};
}

function formatInterval(card: FsrsCard): string {
	const days = card.scheduled_days;
	if (days === 0) {
		// Learning step -- show minutes
		const now = new Date();
		const diffMs = card.due.getTime() - now.getTime();
		const minutes = Math.max(1, Math.round(diffMs / 60000));
		if (minutes < 60) return `${minutes}m`;
		return `${Math.round(minutes / 60)}h`;
	}
	if (days < 30) return `${days}d`;
	if (days < 365) return `${Math.round(days / 30)}mo`;
	return `${(days / 365).toFixed(1)}y`;
}

function fsrsCardToState(card: FsrsCard): CardState {
	return {
		stability: card.stability,
		difficulty: card.difficulty,
		due: card.due.toISOString(),
		last_review: card.last_review ? card.last_review.toISOString() : null,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		scheduled_days: card.scheduled_days,
		elapsed_days: card.elapsed_days,
	};
}

function stateToFsrsCard(state: CardState): FsrsCard {
	return {
		stability: state.stability,
		difficulty: state.difficulty,
		due: new Date(state.due),
		last_review: state.last_review ? new Date(state.last_review) : undefined,
		reps: state.reps,
		lapses: state.lapses,
		state: state.state as State,
		scheduled_days: state.scheduled_days,
		elapsed_days: state.elapsed_days,
	} as FsrsCard;
}
