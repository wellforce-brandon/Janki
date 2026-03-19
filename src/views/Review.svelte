<script lang="ts">
import ReviewSession from "$lib/components/review/ReviewSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { type DeckWithCounts, getAllDecks } from "$lib/db/queries/decks";
import { getReviewQueue, type ReviewQueue } from "$lib/srs/scheduler";

let decks = $state<DeckWithCounts[]>([]);
let selectedDeckId = $state<number | null>(null);
let queue = $state<ReviewQueue | null>(null);
let loading = $state(false);
let error = $state<string | null>(null);

async function loadDecks() {
	const result = await getAllDecks();
	if (result.ok) {
		decks = result.data;
		// Auto-select first deck with due cards
		const dueDecks = decks.filter((d) => d.due_count > 0 || d.new_count > 0);
		if (dueDecks.length > 0) selectedDeckId = dueDecks[0].id;
	}
}

async function startReview() {
	if (!selectedDeckId) return;
	loading = true;
	error = null;

	try {
		queue = await getReviewQueue(selectedDeckId);
		if (queue.cards.length === 0) {
			error = "No cards due for review in this deck.";
			queue = null;
		}
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to load review queue";
	} finally {
		loading = false;
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

		{#if decks.length === 0}
			<p class="text-muted-foreground">No decks yet. Import or create a deck to start reviewing.</p>
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

			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}

			<Button onclick={startReview} disabled={loading || !selectedDeckId} class="w-full">
				{loading ? "Loading..." : "Start Review"}
			</Button>
		{/if}
	</div>
{/if}
