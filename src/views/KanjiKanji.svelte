<script lang="ts">
import ItemTypeBrowser from "$lib/components/kanji/ItemTypeBrowser.svelte";

const colors = {
	locked:
		"border-2 border-dashed border-pink-500 dark:border-pink-400 bg-transparent text-muted-foreground",
	lesson:
		"bg-pink-500/30 dark:bg-pink-400/30 text-pink-600 dark:text-pink-400 border border-pink-500/50 dark:border-pink-400/50",
	review: "bg-pink-500 dark:bg-pink-600 text-white border border-transparent",
	legendLesson: "bg-pink-500/30 dark:bg-pink-400/30 border border-pink-500/50",
	legendReview: "bg-pink-500 dark:bg-pink-600",
};
</script>

<ItemTypeBrowser itemType="kanji" title="Kanji" {colors} />
