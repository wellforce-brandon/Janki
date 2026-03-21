<script lang="ts">
import type { CardState } from "$lib/srs/fsrs";
import { getNextIntervals, Rating } from "$lib/srs/fsrs";
import { processReview } from "$lib/srs/scheduler";
import { processBuiltinReview } from "$lib/srs/builtin-scheduler";
import type { UnifiedReviewItem } from "$lib/srs/language-scheduler";
import { getCardById } from "$lib/db/queries/cards";
import { getBuiltinItemById, deleteBuiltinReviewLogEntry } from "$lib/db/queries/language";
import { updateCardState } from "$lib/db/queries/cards";
import { updateBuiltinItemState } from "$lib/db/queries/language";
import { deleteReviewLogEntry } from "$lib/db/queries/reviews";
import { getTodayStats, restoreDailyStats } from "$lib/db/queries/stats";
import { getSettings } from "$lib/stores/app-settings.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { speakJapanese } from "$lib/tts/speech";
import ContentTypeBadge from "$lib/components/language/ContentTypeBadge.svelte";
import UnifiedFlashCard from "./UnifiedFlashCard.svelte";
import RatingButtons from "./RatingButtons.svelte";
import ReviewSummary from "./ReviewSummary.svelte";

interface Props {
	items: UnifiedReviewItem[];
}

let { items }: Props = $props();

interface UndoEntry {
	itemIndex: number;
	item: UnifiedReviewItem;
	previousState: CardState;
	reviewLogId: number;
	prevStats: { reviews_count: number; correct_count: number; incorrect_count: number; time_spent_ms: number } | null;
	wasCorrect: boolean;
}

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
let paused = $state(false);
let undoStack = $state<UndoEntry[]>([]);

let currentItem = $derived(currentIndex < items.length ? items[currentIndex] : null);
let progressPercent = $derived(Math.round((currentIndex / items.length) * 100));

let intervals = $derived.by(() => {
	if (!currentItem) return {};
	return getNextIntervals({
		stability: currentItem.stability,
		difficulty: currentItem.difficulty,
		due: currentItem.due,
		last_review: currentItem.last_review,
		reps: currentItem.reps,
		lapses: currentItem.lapses,
		state: currentItem.state,
		scheduled_days: currentItem.scheduled_days,
		elapsed_days: currentItem.elapsed_days,
	});
});

let settings = $derived(getSettings());

$effect(() => {
	if (isDone || paused) return;
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
	if (!currentItem || isProcessing) return;
	isProcessing = true;

	const duration = Date.now() - cardStartTime;
	const wasCorrect = rating >= Rating.Good;

	const previousState: CardState = {
		stability: currentItem.stability,
		difficulty: currentItem.difficulty,
		due: currentItem.due,
		last_review: currentItem.last_review,
		reps: currentItem.reps,
		lapses: currentItem.lapses,
		state: currentItem.state,
		scheduled_days: currentItem.scheduled_days,
		elapsed_days: currentItem.elapsed_days,
	};

	const prevStats = await snapshotStats();
	let reviewLogId = 0;

	if (currentItem.source === "card") {
		const cardResult = await getCardById(currentItem.sourceId);
		if (cardResult.ok && cardResult.data) {
			const result = await processReview(cardResult.data, rating, duration);
			if (result) reviewLogId = result.reviewLogId;
		}
	} else {
		const builtinResult = await getBuiltinItemById(currentItem.sourceId);
		if (builtinResult.ok && builtinResult.data) {
			const result = await processBuiltinReview(builtinResult.data, rating, duration);
			if (result) reviewLogId = result.reviewLogId;
		}
	}

	totalTimeMs += duration;
	reviewed++;
	if (wasCorrect) correct++;

	if (reviewLogId) {
		undoStack = [...undoStack.slice(-49), {
			itemIndex: currentIndex,
			item: currentItem,
			previousState,
			reviewLogId,
			prevStats,
			wasCorrect,
		}];
	}

	currentIndex++;
	flipped = false;
	cardStartTime = Date.now();
	isProcessing = false;

	if (currentIndex >= items.length) {
		isDone = true;
	}
}

async function snapshotStats() {
	const statsResult = await getTodayStats();
	if (!statsResult.ok || !statsResult.data) return null;
	return {
		reviews_count: statsResult.data.reviews_count,
		correct_count: statsResult.data.correct_count,
		incorrect_count: statsResult.data.incorrect_count,
		time_spent_ms: statsResult.data.time_spent_ms,
	};
}

async function undo() {
	if (undoStack.length === 0 || isProcessing) return;
	isProcessing = true;

	const entry = undoStack[undoStack.length - 1];
	undoStack = undoStack.slice(0, -1);

	// Restore state
	if (entry.item.source === "card") {
		await updateCardState(
			entry.item.sourceId,
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
	} else {
		await updateBuiltinItemState(
			entry.item.sourceId,
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
		await deleteBuiltinReviewLogEntry(entry.reviewLogId);
	}

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

	reviewed--;
	if (entry.wasCorrect) correct--;

	isDone = false;
	currentIndex = entry.itemIndex;
	flipped = false;
	cardStartTime = Date.now();
	isProcessing = false;

	addToast("Review undone", "info");
}

function playTts() {
	if (!currentItem) return;
	const text = Object.values(currentItem.fields).join(" ");
	speakJapanese(text);
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		e.preventDefault();
		paused = !paused;
		return;
	}

	if (isDone || paused) return;

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

{#if paused}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
		<div class="text-center space-y-4">
			<h2 class="text-2xl font-bold">Paused</h2>
			<p class="text-muted-foreground">Press <kbd class="rounded border px-1.5 py-0.5 text-xs">Esc</kbd> to resume</p>
		</div>
	</div>
{/if}

{#if isDone}
	<ReviewSummary {reviewed} {correct} timeMs={totalTimeMs} />
{:else if currentItem}
	<div class="mx-auto max-w-2xl space-y-6">
		<!-- Progress bar -->
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-primary transition-all duration-300"
				style="width: {progressPercent}%"
			></div>
		</div>

		<div class="flex items-center justify-between text-sm text-muted-foreground">
			<div class="flex items-center gap-2">
				<span>Card {currentIndex + 1} of {items.length}</span>
				<ContentTypeBadge type={currentItem.contentType} />
			</div>
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

		<UnifiedFlashCard
			fields={currentItem.fields}
			frontTemplate={currentItem.frontHtml}
			backTemplate={currentItem.backHtml}
			preRendered={currentItem.source === "builtin"}
			css={currentItem.css}
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
