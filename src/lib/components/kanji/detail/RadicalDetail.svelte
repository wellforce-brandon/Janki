<script lang="ts">
import { getItemsContainingComponent, type KanjiLevelItem } from "$lib/db/queries/kanji";
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

let foundInKanji = $state<KanjiLevelItem[]>([]);
let loadingRelated = $state(true);

$effect(() => {
	loadRelated(item);
});

async function loadRelated(current: KanjiLevelItem) {
	loadingRelated = true;
	foundInKanji = [];
	if (current.wk_id) {
		const result = await getItemsContainingComponent(current.wk_id, "kanji");
		if (result.ok) foundInKanji = result.data;
	}
	loadingRelated = false;
}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<ItemHeader {item} />

	<UserSynonyms itemId={item.id} synonymsJson={item.user_synonyms} />

	<MnemonicSection title="Meaning Mnemonic" html={item.mnemonic_meaning} />

	<UserNotes itemId={item.id} notes={item.user_notes} />

	<RelatedItemsGrid
		title="Found In Kanji"
		items={foundInKanji}
		loading={loadingRelated}
	/>

	<ItemProgression {item} />
</div>
