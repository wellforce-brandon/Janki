<script lang="ts">
import SrsStageIndicator from "$lib/components/kanji/SrsStageIndicator.svelte";
import StrokeOrder from "$lib/components/kanji/StrokeOrder.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { getKanjiItemById, type KanjiLevelItem } from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { speakJapanese } from "$lib/tts/speech";

interface Props {
	itemId: number;
}

let { itemId }: Props = $props();

let item = $state<KanjiLevelItem | null>(null);
let loading = $state(true);

function parseMeanings(json: string): string[] {
	try {
		return JSON.parse(json);
	} catch {
		return [json];
	}
}

function parseReadings(json: string | null): string[] {
	if (!json) return [];
	try {
		return JSON.parse(json);
	} catch {
		return [];
	}
}

$effect(() => {
	loading = true;
	getKanjiItemById(itemId).then((result) => {
		if (result.ok) item = result.data;
		loading = false;
	});
});
</script>

<div class="space-y-6">
	<Button variant="ghost" onclick={() => navigate("kanji")}>
		&larr; Back to Kanji Map
	</Button>

	{#if loading}
		<p class="text-muted-foreground">Loading...</p>
	{:else if !item}
		<p class="text-muted-foreground">Item not found.</p>
	{:else}
		<div class="mx-auto max-w-2xl space-y-8">
			<!-- Character display -->
			<div class="text-center">
				<div class="text-8xl font-bold">{item.character}</div>
				<div class="mt-2 flex items-center justify-center gap-3">
					<SrsStageIndicator stage={item.srs_stage} nextReview={item.next_review} />
					<button
						type="button"
						class="rounded-md border px-3 py-1 text-sm hover:bg-muted"
						onclick={() => speakJapanese(item.character)}
						aria-label="Pronounce"
					>&#9654; Speak</button>
				</div>
			</div>

			<!-- Meanings -->
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Meanings</h3>
				<p class="text-lg">{parseMeanings(item.meanings).join(", ")}</p>
			</div>

			<!-- Readings (kanji only) -->
			{#if item.item_type === "kanji"}
				<div class="grid grid-cols-2 gap-4">
					<div class="rounded-lg border bg-card p-4">
						<h3 class="mb-2 text-sm font-medium text-muted-foreground">On'yomi</h3>
						<p class="text-lg">{parseReadings(item.readings_on).join(", ") || "None"}</p>
					</div>
					<div class="rounded-lg border bg-card p-4">
						<h3 class="mb-2 text-sm font-medium text-muted-foreground">Kun'yomi</h3>
						<p class="text-lg">{parseReadings(item.readings_kun).join(", ") || "None"}</p>
					</div>
				</div>
			{/if}

			<!-- Vocab reading -->
			{#if item.item_type === "vocab" && item.reading}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Reading</h3>
					<p class="text-lg">{item.reading}</p>
				</div>
			{/if}

			<!-- Stroke order (kanji only) -->
			{#if item.item_type === "kanji"}
				<div class="flex flex-col items-center">
					<h3 class="mb-3 text-sm font-medium text-muted-foreground">Stroke Order</h3>
					<StrokeOrder character={item.character} />
				</div>
			{/if}

			<!-- Component radicals -->
			{#if item.radicals}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Radicals</h3>
					<div class="flex gap-2 text-xl">
						{#each parseReadings(item.radicals) as radical}
							<span class="rounded border px-2 py-1">{radical}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Mnemonics -->
			{#if item.mnemonic_meaning}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Meaning Mnemonic</h3>
					<p class="text-sm">{item.mnemonic_meaning}</p>
				</div>
			{/if}
			{#if item.mnemonic_reading}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Reading Mnemonic</h3>
					<p class="text-sm">{item.mnemonic_reading}</p>
				</div>
			{/if}

			<!-- Stats -->
			<div class="grid grid-cols-2 gap-4 text-sm">
				<div class="rounded-lg border bg-card p-4">
					<span class="text-muted-foreground">Level</span>
					<span class="ml-2 font-medium">{item.level}</span>
				</div>
				<div class="rounded-lg border bg-card p-4">
					<span class="text-muted-foreground">Correct</span>
					<span class="ml-2 font-medium">{item.correct_count} / {item.correct_count + item.incorrect_count}</span>
				</div>
			</div>
		</div>
	{/if}
</div>
