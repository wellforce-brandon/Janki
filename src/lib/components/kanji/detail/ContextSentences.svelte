<script lang="ts">
import type { ContextSentence } from "$lib/utils/kanji";

interface Props {
	sentences: ContextSentence[];
}

let { sentences }: Props = $props();
</script>

{#if sentences.length > 0}
	<div class="rounded-lg border bg-card p-4 space-y-4">
		<h3 class="text-sm font-medium text-muted-foreground">Context Sentences</h3>

		{#each sentences as sentence, i}
			<div class="space-y-1 {i > 0 ? 'border-t pt-3' : ''}">
				<p class="text-base font-medium">{sentence.ja}</p>
				<p class="text-sm text-muted-foreground">{sentence.en}</p>
			</div>
		{/each}
	</div>
{/if}
