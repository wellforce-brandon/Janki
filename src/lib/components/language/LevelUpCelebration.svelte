<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";

interface Props {
	level: number;
	onclose: () => void;
}

let { level, onclose }: Props = $props();

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		e.preventDefault();
		onclose();
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
	role="dialog"
	aria-modal="true"
	aria-label="Level up celebration"
>
	<div class="mx-4 max-w-sm rounded-xl border bg-card p-8 text-center shadow-2xl">
		<div class="text-6xl">🎉</div>
		<h2 class="mt-4 text-3xl font-bold text-primary">Level Up!</h2>
		<p class="mt-2 text-lg text-muted-foreground">
			You've reached <span class="font-bold text-foreground">Level {level}</span>
		</p>
		<p class="mt-1 text-sm text-muted-foreground">
			New vocabulary, grammar, and more are now available to learn.
		</p>
		<div class="mt-6">
			<Button autofocus onclick={onclose}>Continue</Button>
		</div>
	</div>
</div>
