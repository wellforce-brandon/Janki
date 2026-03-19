<script lang="ts">
import type { CardWithContent } from "$lib/db/queries/cards";
import { getNextIntervals, Rating } from "$lib/srs/fsrs";
import { processReview } from "$lib/srs/scheduler";
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
let isProcessing = $state(false);
let isDone = $state(false);

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

function flip() {
	if (!flipped) flipped = true;
}

async function rate(rating: Rating) {
	if (!currentCard || isProcessing) return;
	isProcessing = true;

	const duration = Date.now() - cardStartTime;
	totalTimeMs += duration;
	reviewed++;
	if (rating >= Rating.Good) correct++;

	await processReview(currentCard, rating, duration);

	// Move to next card
	currentIndex++;
	flipped = false;
	cardStartTime = Date.now();
	isProcessing = false;

	if (currentIndex >= cards.length) {
		isDone = true;
	}
}

function handleKeydown(e: KeyboardEvent) {
	if (isDone) return;

	if (e.key === " " && !flipped) {
		e.preventDefault();
		flip();
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
		<div class="text-center text-sm text-muted-foreground">
			Card {currentIndex + 1} of {cards.length}
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
				Press <kbd class="rounded border px-1.5 py-0.5 text-xs">Space</kbd> or click to flip
			</p>
		{/if}
	</div>
{/if}
