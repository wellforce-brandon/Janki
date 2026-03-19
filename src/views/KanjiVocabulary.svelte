<script lang="ts">
import ItemTypeBrowser from "$lib/components/kanji/ItemTypeBrowser.svelte";

const colors = {
	locked:
		"border-2 border-dashed border-purple-500 dark:border-purple-400 bg-transparent text-muted-foreground",
	lesson:
		"bg-purple-500/30 dark:bg-purple-400/30 text-purple-600 dark:text-purple-400 border border-purple-500/50 dark:border-purple-400/50",
	review: "bg-purple-500 dark:bg-purple-600 text-white border border-transparent",
	legendLesson: "bg-purple-500/30 dark:bg-purple-400/30 border border-purple-500/50",
	legendReview: "bg-purple-500 dark:bg-purple-600",
};
</script>

<ItemTypeBrowser itemType="vocab" title="Vocabulary" {colors} />
