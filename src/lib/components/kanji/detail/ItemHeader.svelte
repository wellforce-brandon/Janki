<script lang="ts">
import SrsStageIndicator from "$lib/components/kanji/SrsStageIndicator.svelte";
import Badge from "$lib/components/ui/badge/badge.svelte";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { speakJapanese } from "$lib/tts/speech.svelte";
import {
	getTileClasses,
	parseCharacterImages,
	parseMeanings,
	parsePartsOfSpeech,
} from "$lib/utils/kanji";

interface Props {
	item: KanjiLevelItem;
}

let { item }: Props = $props();

let meanings = $derived(parseMeanings(item.meanings));
let partsOfSpeech = $derived(parsePartsOfSpeech(item.parts_of_speech));
let characterImages = $derived(parseCharacterImages(item.character_images));
let hasCharacter = $derived(
	item.character !== item.character?.toLowerCase() || item.item_type !== "radical",
);
let svgImage = $derived(characterImages.find((img) => img.content_type === "image/svg+xml"));
let pngImage = $derived(characterImages.find((img) => img.content_type === "image/png"));
</script>

<div class="text-center space-y-3">
	<div class="inline-block rounded-xl px-6 py-4 {getTileClasses(item)}">
		{#if item.character && item.item_type !== "radical"}
			<div class="text-8xl font-bold">{item.character}</div>
		{:else if item.character && !svgImage}
			<div class="text-8xl font-bold">{item.character}</div>
		{:else if svgImage}
			<img src={svgImage.url} alt={meanings[0] ?? "radical"} class="mx-auto h-24 w-24 dark:invert" />
		{:else if pngImage}
			<img src={pngImage.url} alt={meanings[0] ?? "radical"} class="mx-auto h-24 w-24" />
		{:else}
			<div class="text-8xl font-bold">{item.character}</div>
		{/if}
	</div>

	<div class="flex items-center justify-center gap-3">
		<SrsStageIndicator stage={item.srs_stage} nextReview={item.next_review} />
		{#if item.item_type !== "radical"}
			<button
				type="button"
				class="rounded-md border px-3 py-1 text-sm hover:bg-muted"
				onclick={() => speakJapanese(item.character)}
				aria-label="Pronounce {item.character}"
			>&#9654; Speak</button>
		{/if}
	</div>

	<h2 class="text-2xl font-bold">{meanings.join(", ")}</h2>

	{#if partsOfSpeech.length > 0}
		<div class="flex justify-center gap-1.5">
			{#each partsOfSpeech as pos}
				<Badge variant="secondary">{pos.replace(/_/g, " ")}</Badge>
			{/each}
		</div>
	{/if}

	<div class="text-sm text-muted-foreground">Level {item.level}</div>
</div>
