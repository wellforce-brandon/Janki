<script lang="ts">
import type { ContentTypeCount } from "$lib/db/queries/language";
import ContentTypeBadge from "./ContentTypeBadge.svelte";

interface Props {
	count: ContentTypeCount;
	onclick: () => void;
}

let { count, onclick }: Props = $props();
</script>

<button
	type="button"
	class="flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
	{onclick}
>
	<div class="flex items-center justify-between">
		<ContentTypeBadge type={count.type} />
		<span class="text-2xl font-bold tabular-nums">{count.total}</span>
	</div>
	<div class="flex gap-4 text-sm">
		{#if count.due > 0}
			<span class="text-orange-500 dark:text-orange-400">{count.due} due</span>
		{/if}
		{#if count.new_count > 0}
			<span class="text-blue-500 dark:text-blue-400">{count.new_count} new</span>
		{/if}
		{#if count.due === 0 && count.new_count === 0}
			<span class="text-muted-foreground">All caught up</span>
		{/if}
	</div>
</button>
