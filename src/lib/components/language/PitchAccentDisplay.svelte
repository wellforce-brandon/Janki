<script lang="ts">
import { sanitizeCardHtml } from "$lib/utils/sanitize";

interface Props {
	/** Raw pitch accent HTML from deck fields (e.g., OJAD tables from Core 2k/6k) */
	html: string;
	class?: string;
}

let { html, class: className = "" }: Props = $props();

let sanitized = $derived(sanitizeCardHtml(html));
let hasContent = $derived(sanitized.trim().length > 0);
</script>

{#if hasContent}
	<div class="pitch-accent inline-block {className}">
		{@html sanitized}
	</div>
{/if}

<!-- Style block required: Tailwind can't target OJAD pitch table HTML injected via {@html} -->
<style>
	.pitch-accent :global(table) {
		border-collapse: collapse;
		font-size: 0.75rem;
	}
	.pitch-accent :global(td) {
		padding: 0 2px;
		text-align: center;
	}
	/* Common OJAD pitch styling overrides for dark mode compatibility */
	:global(.dark) .pitch-accent :global(span[style*="color"]) {
		color: inherit !important;
	}
</style>
