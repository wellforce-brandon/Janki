<script lang="ts">
import ReviewSession from "$lib/components/review/ReviewSession.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { type DeckWithCounts, getAllDecks } from "$lib/db/queries/decks";
import { getAverageTimePerCard } from "$lib/db/queries/stats";
import { getReviewQueue, type ReviewQueue } from "$lib/srs/scheduler";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let decks = $state<DeckWithCounts[]>([]);
let selectedDeckId = $state<number | null>(null);
let queue = $state<ReviewQueue | null>(null);
let loadingDecks = $state(true);
let loadingQueue = $state(false);
let allCaughtUp = $state(false);
let avgTimeMs = $state(0);

let selectedDeck = $derived(decks.find((d) => d.id === selectedDeckId) ?? null);
let estimatedMinutes = $derived.by(() => {
	if (!selectedDeck || avgTimeMs <= 0) return 0;
	const totalCards = selectedDeck.due_count + selectedDeck.new_count;
	return Math.max(1, Math.round((totalCards * avgTimeMs) / 60000));
});

async function loadDecks() {
	loadingDecks = true;
	const [result, avgResult] = await Promise.all([getAllDecks(), getAverageTimePerCard()]);

	if (result.ok) {
		decks = result.data;
		const dueDecks = decks.filter((d) => d.due_count > 0 || d.new_count > 0);
		if (dueDecks.length > 0) selectedDeckId = dueDecks[0].id;
	} else {
		addToast("Failed to load decks", "error");
	}

	if (avgResult.ok) avgTimeMs = avgResult.data;
	loadingDecks = false;
}

async function startReview() {
	if (!selectedDeckId) return;
	loadingQueue = true;
	allCaughtUp = false;

	try {
		queue = await getReviewQueue(selectedDeckId);
		if (queue.cards.length === 0) {
			allCaughtUp = true;
			queue = null;
		}
	} catch (e) {
		addToast(e instanceof Error ? e.message : "Failed to load review queue", "error");
	} finally {
		loadingQueue = false;
	}
}

$effect(() => {
	loadDecks();
});
</script>

{#if queue && queue.cards.length > 0}
	<ReviewSession cards={queue.cards} />
{:else}
	<div class="mx-auto max-w-md space-y-6">
		<h2 class="text-2xl font-bold">Review</h2>

		{#if loadingDecks}
			<LoadingState message="Loading decks..." />
		{:else if decks.length === 0}
			<EmptyState
				title="No decks yet"
				description="Import an Anki .apkg file or create a new deck to start reviewing."
				actionLabel="Create Deck"
				onaction={() => navigate("decks")}
				secondaryLabel="Import Deck"
				onsecondary={() => navigate("decks")}
			/>
		{:else if allCaughtUp}
			<div class="flex flex-col items-center gap-3 rounded-lg border bg-card/50 py-12 text-center">
				<span class="text-4xl">&#10003;</span>
				<h3 class="text-lg font-medium">All caught up!</h3>
				<p class="text-sm text-muted-foreground">No cards due for review in this deck. Check back later.</p>
			</div>
		{:else}
			<div class="space-y-3">
				<label class="text-sm font-medium" for="deck-select">Select Deck</label>
				<select
					id="deck-select"
					class="w-full rounded-md border bg-background px-3 py-2"
					bind:value={selectedDeckId}
				>
					{#each decks as deck}
						<option value={deck.id}>
							{deck.name} ({deck.due_count} due, {deck.new_count} new)
						</option>
					{/each}
				</select>
			</div>

			{#if selectedDeck && estimatedMinutes > 0}
				<p class="text-sm text-muted-foreground">
					{selectedDeck.due_count + selectedDeck.new_count} cards -- ~{estimatedMinutes} min
				</p>
			{/if}

			<button
				type="button"
				class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				onclick={startReview}
				disabled={loadingQueue || !selectedDeckId}
			>
				{loadingQueue ? "Loading..." : "Start Review"}
			</button>
		{/if}
	</div>
{/if}
