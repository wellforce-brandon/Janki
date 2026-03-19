<script lang="ts">
import { renderCardContent } from "$lib/import/deck-mapper";
import { sanitizeCardHtml } from "$lib/utils/sanitize";

interface Props {
	fields: Record<string, string>;
	frontTemplate: string;
	backTemplate: string;
	css?: string | null;
	flipped: boolean;
	onflip: () => void;
}

let { fields, frontTemplate, backTemplate, css = null, flipped, onflip }: Props = $props();

let frontHtml = $derived(sanitizeCardHtml(renderCardContent(fields, frontTemplate)));
let backHtml = $derived(sanitizeCardHtml(renderCardContent(fields, backTemplate)));
</script>

<button
	type="button"
	class="perspective-1000 mx-auto h-80 w-full max-w-2xl cursor-pointer"
	onclick={onflip}
	aria-label={flipped ? "Card back side" : "Card front side, click to flip"}
>
	<div
		class="relative h-full w-full transition-transform duration-300 ease-in-out"
		class:rotate-y-180={flipped}
		style="transform-style: preserve-3d;"
	>
		<!-- Front -->
		<div
			class="absolute inset-0 flex items-center justify-center rounded-lg border bg-card p-8 text-card-foreground backface-hidden"
		>
			{#if css}<style>{css}</style>{/if}
			<div class="text-center text-xl">{@html frontHtml}</div>
		</div>

		<!-- Back -->
		<div
			class="absolute inset-0 flex items-center justify-center rounded-lg border bg-card p-8 text-card-foreground backface-hidden rotate-y-180"
		>
			{#if css}<style>{css}</style>{/if}
			<div class="text-center text-xl">{@html backHtml}</div>
		</div>
	</div>
</button>

<style>
	.perspective-1000 {
		perspective: 1000px;
	}
	.backface-hidden {
		backface-visibility: hidden;
	}
	.rotate-y-180 {
		transform: rotateY(180deg);
	}
</style>
