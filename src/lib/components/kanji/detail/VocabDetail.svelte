<script lang="ts">
import { getItemsByWkIds, type KanjiLevelItem } from "$lib/db/queries/kanji";
import { parseContextSentences, parsePronunciationAudios, parseWkIdArray } from "$lib/utils/kanji";
import AudioPlayer from "./AudioPlayer.svelte";
import ContextSentences from "./ContextSentences.svelte";
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

let componentKanji = $state<KanjiLevelItem[]>([]);
let loadingRelated = $state(true);

let contextSentences = $derived(parseContextSentences(item.context_sentences));
let pronunciationAudios = $derived(parsePronunciationAudios(item.pronunciation_audios));

$effect(() => {
	loadRelated(item);
});

async function loadRelated(current: KanjiLevelItem) {
	loadingRelated = true;
	componentKanji = [];

	const componentIds = parseWkIdArray(current.component_ids);
	if (componentIds.length > 0) {
		const result = await getItemsByWkIds(componentIds);
		if (result.ok) componentKanji = result.data;
	}
	loadingRelated = false;
}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<ItemHeader {item} />

	<UserSynonyms itemId={item.id} synonymsJson={item.user_synonyms} />

	<!-- Reading -->
	{#if item.reading}
		<div class="rounded-lg border bg-card p-4">
			<h3 class="mb-2 text-sm font-medium text-muted-foreground">Reading</h3>
			<p class="text-xl">{item.reading}</p>
		</div>
	{/if}

	<AudioPlayer audios={pronunciationAudios} />

	<RelatedItemsGrid
		title="Kanji Composition"
		items={componentKanji}
		loading={loadingRelated}
	/>

	<MnemonicSection title="Meaning Explanation" html={item.mnemonic_meaning} />

	<MnemonicSection title="Reading Mnemonic" html={item.mnemonic_reading} />

	<UserNotes itemId={item.id} notes={item.user_notes} />

	<ContextSentences sentences={contextSentences} />

	<ItemProgression {item} />
</div>
