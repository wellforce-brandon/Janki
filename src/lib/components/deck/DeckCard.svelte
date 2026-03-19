<script lang="ts">
import type { DeckWithCounts } from "$lib/db/queries/decks";
import { cn } from "$lib/utils/cn";

interface Props {
	deck: DeckWithCounts;
	onclick: () => void;
}

let { deck, onclick }: Props = $props();
</script>

<button
	type="button"
	class={cn(
		"flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors",
		"hover:bg-accent hover:text-accent-foreground",
	)}
	{onclick}
>
	<div class="flex items-center justify-between">
		<h3 class="font-semibold">{deck.name}</h3>
		{#if deck.source === "imported"}
			<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Imported</span>
		{/if}
	</div>
	{#if deck.description}
		<p class="text-sm text-muted-foreground line-clamp-2">{deck.description}</p>
	{/if}
	<div class="flex gap-4 text-sm">
		<span class="text-muted-foreground">{deck.card_count} cards</span>
		{#if deck.due_count > 0}
			<span class="text-orange-500 dark:text-orange-400">{deck.due_count} due</span>
		{/if}
		{#if deck.new_count > 0}
			<span class="text-blue-500 dark:text-blue-400">{deck.new_count} new</span>
		{/if}
	</div>
</button>
