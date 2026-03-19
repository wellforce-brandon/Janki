<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";

interface Props {
	title: string;
	description?: string;
	actionLabel?: string;
	onaction?: () => void;
	secondaryLabel?: string;
	onsecondary?: () => void;
}

let { title, description, actionLabel, onaction, secondaryLabel, onsecondary }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-card/50 px-8 py-12 text-center">
	<h3 class="text-lg font-medium">{title}</h3>
	{#if description}
		<p class="max-w-sm text-sm text-muted-foreground">{description}</p>
	{/if}
	{#if actionLabel && onaction}
		<div class="flex gap-2">
			<Button onclick={onaction}>{actionLabel}</Button>
			{#if secondaryLabel && onsecondary}
				<Button variant="outline" onclick={onsecondary}>{secondaryLabel}</Button>
			{/if}
		</div>
	{/if}
</div>
