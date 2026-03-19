<script lang="ts">
import type { CardWithContent } from "$lib/db/queries/cards";
import { updateCardState } from "$lib/db/queries/cards";
import { deleteReviewLogEntry } from "$lib/db/queries/reviews";
import { getTodayStats, restoreDailyStats } from "$lib/db/queries/stats";
import type { CardState } from "$lib/srs/fsrs";
import { getNextIntervals, Rating } from "$lib/srs/fsrs";
import { processReview } from "$lib/srs/scheduler";
import { getSettings } from "$lib/stores/app-settings.svelte";
import { speakJapanese } from "$lib/tts/speech";
import FlashCard from "./FlashCard.svelte";
import RatingButtons from "./RatingButtons.svelte";
import ReviewSummary from "./ReviewSummary.svelte";

interface Props {
	cards: CardWithContent[];
}

let { cards }: Props = $props();

let currentIndex = $state(0);
let flipped = $state(false);
let reviewed = $state(0);
let correct = $state(0);
let totalTimeMs = $state(0);
let cardStartTime = $state(Date.now());
let sessionStartTime = $state(Date.now());
let isProcessing = $state(false);
let isDone = $state(false);
let elapsedSeconds = $state(0);

// Undo stack
interface UndoEntry {
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
let undoStack = $state<UndoEntry[]>([]);

let currentCard = $derived(currentIndex < cards.length ? cards[currentIndex] : null);

let currentFields = $derived.by(() => {
	if (!currentCard) return {};
	try {
		return JSON.parse(currentCard.fields) as Record<string, string>;
	} catch {
		return {};
	}
});

let currentTemplates = $derived.by(() => {
	if (!currentCard) return { front: "", back: "" };
	try {
		const templates = JSON.parse(currentCard.card_templates) as { front: string; back: string }[];
		const idx = currentCard.template_index;
		return templates[idx] ?? templates[0] ?? { front: "", back: "" };
	} catch {
		return { front: "", back: "" };
	}
});

let intervals = $derived.by(() => {
	if (!currentCard) return {};
	return getNextIntervals({
		stability: currentCard.stability,
		difficulty: currentCard.difficulty,
		due: currentCard.due,
		last_review: currentCard.last_review,
		reps: currentCard.reps,
		lapses: currentCard.lapses,
		state: currentCard.state,
		scheduled_days: currentCard.scheduled_days,
		elapsed_days: currentCard.elapsed_days,
	});
});

let settings = $derived(getSettings());

// Timer
$effect(() => {
	if (isDone) return;
	const interval = setInterval(() => {
		elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
	}, 1000);
	return () => clearInterval(interval);
});

let timerDisplay = $derived(
	`${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`,
);

function flip() {
	if (!flipped) flipped = true;
}

async function rate(rating: Rating) {
	if (!currentCard || isProcessing) return;
	isProcessing = true;

	const duration = Date.now() - cardStartTime;
	const wasCorrect = rating >= Rating.Good;

	// Snapshot previous state for undo
	const previousState: CardState = {
		stability: currentCard.stability,
		difficulty: currentCard.difficulty,
		due: currentCard.due,
		last_review: currentCard.last_review,
		reps: currentCard.reps,
		lapses: currentCard.lapses,
		state: currentCard.state,
		scheduled_days: currentCard.scheduled_days,
		elapsed_days: currentCard.elapsed_days,
	};

	// Snapshot daily stats
	const statsResult = await getTodayStats();
	const prevStats =
		statsResult.ok && statsResult.data
			? {
					reviews_count: statsResult.data.reviews_count,
					correct_count: statsResult.data.correct_count,
					incorrect_count: statsResult.data.incorrect_count,
					time_spent_ms: statsResult.data.time_spent_ms,
				}
			: null;

	const result = await processReview(currentCard, rating, duration);

	totalTimeMs += duration;
	reviewed++;
	if (wasCorrect) correct++;

	if (result) {
		undoStack = [
			...undoStack.slice(-49),
			{
				cardIndex: currentIndex,
				card: currentCard,
				previousState,
				reviewLogId: result.reviewLogId,
				prevStats,
				wasCorrect,
			},
		];
	}

	currentIndex++;
	flipped = false;
	cardStartTime = Date.now();
	isProcessing = false;

	if (currentIndex >= cards.length) {
		isDone = true;
	}
}

async function undo() {
	if (undoStack.length === 0 || isProcessing) return;
	isProcessing = true;

	const entry = undoStack[undoStack.length - 1];
	undoStack = undoStack.slice(0, -1);

	// Restore card state
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

	// Delete review log
	await deleteReviewLogEntry(entry.reviewLogId);

	// Restore daily stats
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

	// Adjust counters
	reviewed--;
	if (entry.wasCorrect) correct--;

	// Go back to that card
	isDone = false;
	currentIndex = entry.cardIndex;
	flipped = false;
	cardStartTime = Date.now();
	isProcessing = false;
}

function playTts() {
	if (!currentCard) return;
	try {
		const fields = JSON.parse(currentCard.fields) as Record<string, string>;
		const text = Object.values(fields).join(" ");
		speakJapanese(text);
	} catch {
		// Silently fail
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (isDone) return;

	if (e.key === " " && !flipped) {
		e.preventDefault();
		flip();
		return;
	}

	if (e.key === "p" || e.key === "P") {
		e.preventDefault();
		playTts();
		return;
	}

	if (e.ctrlKey && e.key === "z") {
		e.preventDefault();
		undo();
		return;
	}

	if (!flipped) return;

	const ratingMap: Record<string, Rating> = {
		"1": Rating.Again,
		"2": Rating.Hard,
		"3": Rating.Good,
		"4": Rating.Easy,
	};
	const rating = ratingMap[e.key];
	if (rating !== undefined) {
		e.preventDefault();
		rate(rating);
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isDone}
	<ReviewSummary {reviewed} {correct} timeMs={totalTimeMs} />
{:else if currentCard}
	<div class="mx-auto max-w-2xl space-y-6">
		<div class="flex items-center justify-between text-sm text-muted-foreground">
			<span>Card {currentIndex + 1} of {cards.length}</span>
			<div class="flex items-center gap-3">
				{#if settings.ttsEnabled}
					<button
						type="button"
						class="rounded p-1 hover:bg-muted"
						onclick={playTts}
						aria-label="Play pronunciation"
					>&#9654;</button>
				{/if}
				{#if undoStack.length > 0}
					<button
						type="button"
						class="rounded px-2 py-0.5 text-xs hover:bg-muted"
						onclick={undo}
						aria-label="Undo last review"
					>Undo</button>
				{/if}
				{#if settings.showReviewTimer}
					<span class="font-mono text-xs">{timerDisplay}</span>
				{/if}
			</div>
		</div>

		<FlashCard
			fields={currentFields}
			frontTemplate={currentTemplates.front}
			backTemplate={currentTemplates.back}
			css={currentCard.css}
			{flipped}
			onflip={flip}
		/>

		{#if flipped}
			<RatingButtons {intervals} onrate={rate} />
		{:else}
			<p class="text-center text-sm text-muted-foreground">
				Press <kbd class="rounded border px-1.5 py-0.5 text-xs">Space</kbd> to flip
				{#if settings.ttsEnabled}
					&middot; <kbd class="rounded border px-1.5 py-0.5 text-xs">P</kbd> to speak
				{/if}
			</p>
		{/if}
	</div>
{/if}
