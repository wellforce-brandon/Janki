<script lang="ts">
import ItemTypeBrowser from "$lib/components/kanji/ItemTypeBrowser.svelte";
import { viewParams } from "$lib/stores/navigation.svelte";

const colors = {
	locked:
		"border-2 border-dashed border-blue-500 dark:border-blue-400 bg-transparent text-muted-foreground",
	lesson:
		"bg-blue-500/30 dark:bg-blue-400/30 text-blue-600 dark:text-blue-400 border border-blue-500/50 dark:border-blue-400/50",
	review: "bg-blue-500 dark:bg-blue-600 text-white border border-transparent",
	legendLesson: "bg-blue-500/30 dark:bg-blue-400/30 border border-blue-500/50",
	legendReview: "bg-blue-500 dark:bg-blue-600",
};

let initialTier = $derived(Number(viewParams().tier) || 0);
</script>

<ItemTypeBrowser itemType="radical" title="Radicals" {colors} {initialTier} />
