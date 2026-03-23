<script lang="ts">
interface Props {
	character: string;
}

let { character }: Props = $props();

let svgContent = $state<string | null>(null);
let loading = $state(true);
let error = $state(false);

function getCodepoint(char: string): string {
	return char.codePointAt(0)?.toString(16).padStart(5, "0") ?? "";
}

$effect(() => {
	loading = true;
	error = false;
	const controller = new AbortController();
	const codepoint = getCodepoint(character);
	// Load SVG from data/kanjivg/ directory
	fetch(`/data/kanjivg/${codepoint}.svg`, { signal: controller.signal })
		.then((r) => {
			if (!r.ok) throw new Error("Not found");
			return r.text();
		})
		.then((text) => {
			svgContent = text;
			loading = false;
		})
		.catch((e) => {
			if (e.name !== "AbortError") {
				error = true;
				loading = false;
			}
		});
	return () => controller.abort();
});
</script>

<div class="flex flex-col items-center gap-2">
	{#if loading}
		<div class="flex h-48 w-48 items-center justify-center rounded-lg border bg-muted/30">
			<span class="text-sm text-muted-foreground">Loading...</span>
		</div>
	{:else if error || !svgContent}
		<div class="flex h-48 w-48 items-center justify-center rounded-lg border bg-muted/30">
			<span class="text-8xl">{character}</span>
		</div>
		<span class="text-xs text-muted-foreground">Stroke order not available</span>
	{:else}
		<div class="h-48 w-48 rounded-lg border bg-white p-2 dark:bg-gray-900">
			{@html svgContent}
		</div>
	{/if}
</div>
