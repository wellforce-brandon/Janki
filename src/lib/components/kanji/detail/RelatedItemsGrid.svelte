<script lang="ts">
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { getTileClasses, parseMeanings } from "$lib/utils/kanji";

interface Props {
	title: string;
	items: KanjiLevelItem[];
	loading?: boolean;
	separator?: string;
}

let { title, items, loading = false, separator = "" }: Props = $props();

function openItem(item: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(item.id), character: item.character });
}
</script>

<div class="rounded-lg border bg-card p-4 space-y-3">
	<h3 class="text-sm font-medium text-muted-foreground">{title}</h3>

	{#if loading}
		<p class="text-sm text-muted-foreground">Loading...</p>
	{:else if items.length === 0}
		<p class="text-sm text-muted-foreground">None</p>
	{:else}
		<div class="flex flex-wrap gap-2 items-center">
			{#each items as item, i}
				{#if separator && i > 0}
					<span class="text-lg text-muted-foreground font-bold">{separator}</span>
				{/if}
				<button
					type="button"
					class="flex flex-col items-center rounded-lg px-3 py-2 hover:opacity-80 transition-all min-w-[4rem] {getTileClasses(item)}"
					onclick={() => openItem(item)}
					aria-label="{item.character} - {parseMeanings(item.meanings)[0]}"
				>
					<span class="text-xl font-bold">{item.character}</span>
					{#if item.reading}
						<span class="text-xs opacity-80">{item.reading}</span>
					{/if}
					<span class="text-xs opacity-80 truncate max-w-[6rem]">
						{parseMeanings(item.meanings)[0]}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
