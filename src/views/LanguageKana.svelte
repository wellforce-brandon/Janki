<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getLanguageItems, type LanguageItem } from "$lib/db/queries/language";
import { addToast } from "$lib/stores/toast.svelte";

type KanaType = "all" | "hiragana" | "katakana";

let loading = $state(true);
let items = $state<LanguageItem[]>([]);
let kanaType = $state<KanaType>("all");

async function loadKana() {
	loading = true;
	const result = await getLanguageItems("kana", { limit: 500 });
	if (result.ok) {
		items = result.data;
	} else {
		addToast("Failed to load kana", "error");
	}
	loading = false;
}

function isHiragana(char: string): boolean {
	const code = char.charCodeAt(0);
	return code >= 0x3040 && code <= 0x309F;
}

function isKatakana(char: string): boolean {
	const code = char.charCodeAt(0);
	return code >= 0x30A0 && code <= 0x30FF;
}

let displayItems = $derived.by(() => {
	if (kanaType === "hiragana") return items.filter((k) => isHiragana(k.primary_text));
	if (kanaType === "katakana") return items.filter((k) => isKatakana(k.primary_text));
	return items;
});

$effect(() => {
	loadKana();
});
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Kana</h2>
		<div class="flex items-center gap-3">
			<div class="flex gap-2">
				<Button variant={kanaType === "all" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "all")}>All</Button>
				<Button variant={kanaType === "hiragana" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "hiragana")}>Hiragana</Button>
				<Button variant={kanaType === "katakana" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "katakana")}>Katakana</Button>
			</div>
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading kana..." />
	{:else}
		<div class="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
			{#each displayItems as item (item.id)}
				<div class="flex flex-col items-center justify-center rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
					<span class="text-2xl font-bold">{item.primary_text}</span>
					{#if item.romaji}
						<span class="mt-1 text-xs text-muted-foreground">{item.romaji}</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
