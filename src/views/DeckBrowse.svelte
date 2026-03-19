<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { type CardWithContent, getCardsByDeck } from "$lib/db/queries/cards";
import { renderCardContent } from "$lib/import/deck-mapper";
import { navigate } from "$lib/stores/navigation.svelte";

interface Props {
	deckId: number;
	deckName: string;
}

let { deckId, deckName }: Props = $props();

let cards = $state<CardWithContent[]>([]);
let sortBy = $state<"due" | "created_at" | "state" | "stability">("due");
let loading = $state(true);

const stateLabels = ["New", "Learning", "Review", "Relearning"];

async function loadCards() {
	loading = true;
	const result = await getCardsByDeck(deckId, sortBy, 200);
	if (result.ok) cards = result.data;
	loading = false;
}

function getPreview(card: CardWithContent, side: "front" | "back"): string {
	try {
		const fields = JSON.parse(card.fields) as Record<string, string>;
		const templates = JSON.parse(card.card_templates) as { front: string; back: string }[];
		const tmpl = templates[card.template_index] ?? templates[0];
		if (!tmpl) return "";
		const html = renderCardContent(fields, side === "front" ? tmpl.front : tmpl.back);
		// Strip HTML tags for preview
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

$effect(() => {
	loadCards();
});
</script>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<Button variant="ghost" onclick={() => navigate("decks")}>
			&larr; Back
		</Button>
		<h2 class="text-2xl font-bold">{deckName}</h2>
		<span class="text-sm text-muted-foreground">({cards.length} cards)</span>
	</div>

	<div class="flex gap-2">
		<label class="text-sm text-muted-foreground" for="sort-select">Sort by:</label>
		<select
			id="sort-select"
			class="rounded border bg-background px-2 py-1 text-sm"
			bind:value={sortBy}
			onchange={loadCards}
		>
			<option value="due">Due Date</option>
			<option value="created_at">Created</option>
			<option value="state">State</option>
			<option value="stability">Stability</option>
		</select>
	</div>

	{#if loading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if cards.length === 0}
		<p class="text-muted-foreground">No cards in this deck.</p>
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
					{#each cards as card}
						<tr class="border-b last:border-0 hover:bg-muted/30">
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
	{/if}
</div>
