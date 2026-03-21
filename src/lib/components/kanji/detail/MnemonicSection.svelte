<script lang="ts">
import { sanitizeMnemonicHtml } from "$lib/utils/sanitize";

interface Props {
	title: string;
	html: string | null;
	hint?: string | null;
}

let { title, html, hint = null }: Props = $props();

let sanitizedHtml = $derived(html ? sanitizeMnemonicHtml(html) : "");
let sanitizedHint = $derived(hint ? sanitizeMnemonicHtml(hint) : "");
</script>

{#if html}
	<div class="rounded-lg border bg-card p-4 space-y-3">
		<h3 class="text-sm font-medium text-muted-foreground">{title}</h3>
		<div class="text-sm leading-relaxed mnemonic-text">
			{@html sanitizedHtml}
		</div>

		{#if hint}
			<div class="rounded-md bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
				<span class="font-medium">Hint:</span>
				{@html sanitizedHint}
			</div>
		{/if}
	</div>
{/if}
