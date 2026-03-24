<script lang="ts">
import StrokeOrder from "$lib/components/kanji/StrokeOrder.svelte";
import {
	getItemsByWkIds,
	getItemsContainingComponent,
	type KanjiLevelItem,
} from "$lib/db/queries/kanji";
import { parseReadings, parseWkIdArray } from "$lib/utils/kanji";
import ItemHeader from "./ItemHeader.svelte";
import ItemProgression from "./ItemProgression.svelte";
import MnemonicSection from "./MnemonicSection.svelte";
import RelatedItemsGrid from "./RelatedItemsGrid.svelte";
import UserNotes from "./UserNotes.svelte";
import UserSynonyms from "./UserSynonyms.svelte";

interface Props {
	item: KanjiLevelItem;
}

let { item }: Props = $props();

let componentRadicals = $state<KanjiLevelItem[]>([]);
let similarKanji = $state<KanjiLevelItem[]>([]);
let foundInVocab = $state<KanjiLevelItem[]>([]);
let loadingRelated = $state(true);

let onReadings = $derived(parseReadings(item.readings_on));
let kunReadings = $derived(parseReadings(item.readings_kun));

// Extract nanori from readings_kun with ! prefix convention, or separate field
// For now, nanori isn't stored separately -- could parse from full readings data

$effect(() => {
	loadRelated(item);
});

async function loadRelated(current: KanjiLevelItem) {
	loadingRelated = true;
	componentRadicals = [];
	similarKanji = [];
	foundInVocab = [];

	const componentIds = parseWkIdArray(current.component_ids);
	const similarIds = parseWkIdArray(current.visually_similar_ids);

	const [compResult, simResult, vocabResult] = await Promise.all([
		componentIds.length > 0
			? getItemsByWkIds(componentIds)
			: Promise.resolve({ ok: true as const, data: [] }),
		similarIds.length > 0
			? getItemsByWkIds(similarIds)
			: Promise.resolve({ ok: true as const, data: [] }),
		current.wk_id
			? getItemsContainingComponent(current.wk_id, "vocab")
			: Promise.resolve({ ok: true as const, data: [] }),
	]);

	if (compResult.ok) componentRadicals = compResult.data;
	if (simResult.ok) similarKanji = simResult.data;
	if (vocabResult.ok) foundInVocab = vocabResult.data;
	loadingRelated = false;
}

function formatReading(r: string): string {
	return r.startsWith("!") ? r.slice(1) : r;
}

function isAccepted(r: string): boolean {
	return !r.startsWith("!");
}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<ItemHeader {item} />

	<UserSynonyms itemId={item.id} synonymsJson={item.user_synonyms} />

	<!-- Readings -->
	<div class="grid grid-cols-2 gap-4">
		<div class="rounded-lg border bg-card p-4">
			<h3 class="mb-2 text-sm font-medium text-muted-foreground">On'yomi</h3>
			<p class="text-lg">
				{#each onReadings as r, i}
					<span class={isAccepted(r) ? "" : "text-muted-foreground"}>{formatReading(r)}</span>{#if i < onReadings.length - 1}, {/if}
				{:else}
					<span class="text-muted-foreground">None</span>
				{/each}
			</p>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<h3 class="mb-2 text-sm font-medium text-muted-foreground">Kun'yomi</h3>
			<p class="text-lg">
				{#each kunReadings as r, i}
					<span class={isAccepted(r) ? "" : "text-muted-foreground"}>{formatReading(r)}</span>{#if i < kunReadings.length - 1}, {/if}
				{:else}
					<span class="text-muted-foreground">None</span>
				{/each}
			</p>
		</div>
	</div>

	<RelatedItemsGrid
		title="Radical Combination"
		items={componentRadicals}
		loading={loadingRelated}
		separator="+"
	/>

	<MnemonicSection
		title="Meaning Mnemonic"
		html={item.mnemonic_meaning}
		hint={item.meaning_hint}
	/>

	<MnemonicSection
		title="Reading Mnemonic"
		html={item.mnemonic_reading}
		hint={item.reading_hint}
	/>

	<UserNotes itemId={item.id} notes={item.user_notes} />

	<div class="flex flex-col items-center">
		<h3 class="mb-3 text-sm font-medium text-muted-foreground">Stroke Order</h3>
		<StrokeOrder character={item.character} />
	</div>

	{#if similarKanji.length > 0}
		<RelatedItemsGrid
			title="Visually Similar Kanji"
			items={similarKanji}
			loading={loadingRelated}
		/>
	{/if}

	<RelatedItemsGrid
		title="Found In Vocabulary"
		items={foundInVocab}
		loading={loadingRelated}
	/>

	<ItemProgression {item} />
</div>
