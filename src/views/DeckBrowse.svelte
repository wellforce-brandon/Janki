<script lang="ts">
import CardEditor from "$lib/components/deck/CardEditor.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { type CardWithContent, getCardCountByDeck, getCardsByDeck } from "$lib/db/queries/cards";
import { renderCardContent } from "$lib/import/deck-mapper";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

interface Props {
	deckId: number;
	deckName: string;
}

let { deckId, deckName }: Props = $props();

let cards = $state<CardWithContent[]>([]);
let totalCount = $state(0);
let sortBy = $state<"due" | "created_at" | "state" | "stability">("due");
let stateFilter = $state<number | undefined>(undefined);
let searchQuery = $state("");
let loading = $state(true);
let editingCard = $state<CardWithContent | null>(null);

const PAGE_SIZE = 200;
const STATE_TABS = [
	{ label: "All", value: undefined },
	{ label: "New", value: 0 },
	{ label: "Learning", value: 1 },
	{ label: "Review", value: 2 },
	{ label: "Relearning", value: 3 },
] as const;

const stateLabels = ["New", "Learning", "Review", "Relearning"];

let filteredCards = $derived.by(() => {
	if (!searchQuery.trim()) return cards;
	const q = searchQuery.toLowerCase();
	return cards.filter((card) => {
		try {
			const fields = JSON.parse(card.fields) as Record<string, string>;
			return Object.values(fields).some((v) => v.toLowerCase().includes(q));
		} catch {
			return false;
		}
	});
});

let hasMore = $derived(cards.length < totalCount);

async function loadCards(append = false) {
	if (!append) loading = true;
	const offset = append ? cards.length : 0;
	const [result, countResult] = await Promise.all([
		getCardsByDeck(deckId, sortBy, PAGE_SIZE, offset, stateFilter),
		append ? Promise.resolve(null) : getCardCountByDeck(deckId, stateFilter),
	]);
	if (result.ok) {
		cards = append ? [...cards, ...result.data] : result.data;
	}
	if (countResult?.ok) {
		totalCount = countResult.data;
	}
	loading = false;
}

function changeStateFilter(value: number | undefined) {
	stateFilter = value;
	loadCards();
}

function getPreview(card: CardWithContent, side: "front" | "back"): string {
	try {
		const fields = JSON.parse(card.fields) as Record<string, string>;
		const templates = JSON.parse(card.card_templates) as { front: string; back: string }[];
		const tmpl = templates[card.template_index] ?? templates[0];
		if (!tmpl) return "";
		const html = renderCardContent(fields, side === "front" ? tmpl.front : tmpl.back);
		return html.replace(/<[^>]+>/g, "").slice(0, 80);
	} catch {
		return "";
	}
}

function formatDue(due: string): string {
	const d = new Date(due);
	const now = new Date();
	const diff = d.getTime() - now.getTime();
	if (diff <= 0) return "Now";
	const hours = Math.round(diff / 3600000);
	if (hours < 24) return `${hours}h`;
	const days = Math.round(hours / 24);
	return `${days}d`;
}

function handleCardSaved() {
	editingCard = null;
	addToast("Card saved", "success");
	loadCards();
}

$effect(() => {
	loadCards();
});
</script>

{#if editingCard}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
		<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border bg-card p-6 shadow-lg">
			<CardEditor
				card={editingCard}
				onclose={() => (editingCard = null)}
				onsaved={handleCardSaved}
			/>
		</div>
	</div>
{/if}

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<Button variant="ghost" onclick={() => navigate("decks")}>
			&larr; Back
		</Button>
		<h2 class="text-2xl font-bold">{deckName}</h2>
		<span class="text-sm text-muted-foreground">({totalCount} cards)</span>
	</div>

	<!-- State filter tabs -->
	<div class="flex gap-1 rounded-lg border bg-muted/50 p-1">
		{#each STATE_TABS as tab}
			<button
				type="button"
				class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {stateFilter === tab.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				onclick={() => changeStateFilter(tab.value)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Search + Sort controls -->
	<div class="flex gap-3">
		<input
			type="text"
			class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground"
			placeholder="Search cards..."
			bind:value={searchQuery}
		/>
		<div class="flex items-center gap-2">
			<label class="text-sm text-muted-foreground" for="sort-select">Sort:</label>
			<select
				id="sort-select"
				class="rounded border bg-background px-2 py-1 text-sm"
				bind:value={sortBy}
				onchange={() => loadCards()}
			>
				<option value="due">Due Date</option>
				<option value="created_at">Created</option>
				<option value="state">State</option>
				<option value="stability">Stability</option>
			</select>
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading cards..." />
	{:else if filteredCards.length === 0}
		<EmptyState
			title={searchQuery ? "No matching cards" : "No cards in this deck"}
			description={searchQuery ? "Try a different search term." : "Import cards or add them manually."}
		/>
	{:else}
		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="border-b bg-muted/50">
					<tr>
						<th class="px-3 py-2 text-left font-medium">Front</th>
						<th class="px-3 py-2 text-left font-medium">Back</th>
						<th class="px-3 py-2 text-left font-medium">State</th>
						<th class="px-3 py-2 text-left font-medium">Due</th>
						<th class="px-3 py-2 text-right font-medium">Reps</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredCards as card}
						<tr
							class="cursor-pointer border-b last:border-0 hover:bg-muted/30"
							onclick={() => (editingCard = card)}
						>
							<td class="max-w-[200px] truncate px-3 py-2">{getPreview(card, "front")}</td>
							<td class="max-w-[200px] truncate px-3 py-2">{getPreview(card, "back")}</td>
							<td class="px-3 py-2">{stateLabels[card.state] ?? "Unknown"}</td>
							<td class="px-3 py-2">{formatDue(card.due)}</td>
							<td class="px-3 py-2 text-right">{card.reps}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if hasMore}
			<div class="flex justify-center">
				<Button variant="outline" onclick={() => loadCards(true)}>Load More</Button>
			</div>
		{/if}
	{/if}
</div>
