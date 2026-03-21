<script lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import RadicalDetail from "$lib/components/kanji/detail/RadicalDetail.svelte";
import KanjiItemDetail from "$lib/components/kanji/detail/KanjiItemDetail.svelte";
import VocabDetail from "$lib/components/kanji/detail/VocabDetail.svelte";
import { getAdjacentKanji, getKanjiItemById, type KanjiLevelItem } from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";

interface Props {
	itemId: number;
}

let { itemId }: Props = $props();

let item = $state<KanjiLevelItem | null>(null);
let loading = $state(true);
let prevItem = $state<KanjiLevelItem | null>(null);
let nextItem = $state<KanjiLevelItem | null>(null);

function navigateToItem(target: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(target.id), character: target.character });
}

async function loadItem(id: number) {
	loading = true;
	prevItem = null;
	nextItem = null;
	const result = await getKanjiItemById(id);
	if (result.ok) {
		item = result.data;
		if (item) {
			const adjResult = await getAdjacentKanji(item.level, item.id, item.item_type);
			if (adjResult.ok) {
				prevItem = adjResult.data.prev;
				nextItem = adjResult.data.next;
			}
		}
	} else {
		item = null;
	}
	loading = false;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
	if (e.key === "ArrowLeft" && prevItem) navigateToItem(prevItem);
	else if (e.key === "ArrowRight" && nextItem) navigateToItem(nextItem);
}

$effect(() => {
	loadItem(itemId);
});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<Button variant="ghost" onclick={() => {
			const parentView = item?.item_type === "radical" ? "kanji-radicals"
				: item?.item_type === "kanji" ? "kanji-kanji"
				: item?.item_type === "vocab" ? "kanji-vocabulary"
				: "kanji-dashboard";
			navigate(parentView);
		}}>
			&larr; Back
		</Button>
		<div class="ml-auto flex gap-1">
			{#if prevItem}
				<button
					type="button"
					class="rounded-md border px-2 py-1 text-sm hover:bg-muted"
					onclick={() => navigateToItem(prevItem!)}
					aria-label="Previous: {prevItem.character}"
				>
					<ChevronLeft class="inline h-4 w-4" /> {prevItem.character}
				</button>
			{/if}
			{#if nextItem}
				<button
					type="button"
					class="rounded-md border px-2 py-1 text-sm hover:bg-muted"
					onclick={() => navigateToItem(nextItem!)}
					aria-label="Next: {nextItem.character}"
				>
					{nextItem.character} <ChevronRight class="inline h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading item details..." />
	{:else if !item}
		<EmptyState
			title="Item not found"
			description="This item doesn't exist or may have been removed."
			actionLabel="Back to Dashboard"
			onaction={() => navigate("kanji-dashboard")}
		/>
	{:else if item.item_type === "radical"}
		<RadicalDetail {item} />
	{:else if item.item_type === "kanji"}
		<KanjiItemDetail {item} />
	{:else}
		<VocabDetail {item} />
	{/if}
</div>
