<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getNotesByContentType, getSemanticFields, type NoteWithContentInfo, type SemanticFieldMapping } from "$lib/db/queries/language";
import { addToast } from "$lib/stores/toast.svelte";

type KanaType = "all" | "hiragana" | "katakana";

interface KanaItem {
	character: string;
	reading: string;
	note_id: number;
}

let loading = $state(true);
let kanaItems = $state<KanaItem[]>([]);
let kanaType = $state<KanaType>("all");
let fieldMappings = $state<Map<number, SemanticFieldMapping[]>>(new Map());

// Built-in kana for when no imports exist
const HIRAGANA = [
	"あ","い","う","え","お","か","き","く","け","こ","さ","し","す","せ","そ",
	"た","ち","つ","て","と","な","に","ぬ","ね","の","は","ひ","ふ","へ","ほ",
	"ま","み","む","め","も","や","ゆ","よ","ら","り","る","れ","ろ","わ","を","ん",
];

const KATAKANA = [
	"ア","イ","ウ","エ","オ","カ","キ","ク","ケ","コ","サ","シ","ス","セ","ソ",
	"タ","チ","ツ","テ","ト","ナ","ニ","ヌ","ネ","ノ","ハ","ヒ","フ","ヘ","ホ",
	"マ","ミ","ム","メ","モ","ヤ","ユ","ヨ","ラ","リ","ル","レ","ロ","ワ","ヲ","ン",
];

const HIRAGANA_READINGS = [
	"a","i","u","e","o","ka","ki","ku","ke","ko","sa","shi","su","se","so",
	"ta","chi","tsu","te","to","na","ni","nu","ne","no","ha","hi","fu","he","ho",
	"ma","mi","mu","me","mo","ya","yu","yo","ra","ri","ru","re","ro","wa","wo","n",
];

const KATAKANA_READINGS = [...HIRAGANA_READINGS];

async function loadKana() {
	loading = true;

	const result = await getNotesByContentType("kana", { limit: 500 });
	if (result.ok && result.data.length > 0) {
		// Load semantic field mappings
		const noteTypeIds = [...new Set(result.data.map((n) => n.note_type_id))];
		for (const ntId of noteTypeIds) {
			if (!fieldMappings.has(ntId)) {
				const fm = await getSemanticFields(ntId, "kana");
				if (fm.ok) fieldMappings = new Map([...fieldMappings, [ntId, fm.data]]);
			}
		}

		kanaItems = result.data.map((note) => {
			const fields = JSON.parse(note.fields);
			const mappings = fieldMappings.get(note.note_type_id);
			let character = "";
			let reading = "";

			if (mappings) {
				const primaryMapping = mappings.find((m) => m.semantic_role === "primary_text");
				const readingMapping = mappings.find((m) => m.semantic_role === "reading");
				if (primaryMapping) character = fields[primaryMapping.field_name] ?? "";
				if (readingMapping) reading = fields[readingMapping.field_name] ?? "";
			}

			if (!character) {
				character = fields["Character"] || fields["Kana"] || Object.values(fields)[0] || "";
			}
			if (!reading) {
				reading = fields["Reading"] || fields["Romaji"] || Object.values(fields)[1] || "";
			}

			return { character: String(character), reading: String(reading), note_id: note.note_id };
		});
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
	if (kanaItems.length > 0) {
		if (kanaType === "hiragana") return kanaItems.filter((k) => isHiragana(k.character));
		if (kanaType === "katakana") return kanaItems.filter((k) => isKatakana(k.character));
		return kanaItems;
	}

	// Fallback: show builtin kana grid
	const items: KanaItem[] = [];
	if (kanaType !== "katakana") {
		HIRAGANA.forEach((char, i) => items.push({ character: char, reading: HIRAGANA_READINGS[i], note_id: 0 }));
	}
	if (kanaType !== "hiragana") {
		KATAKANA.forEach((char, i) => items.push({ character: char, reading: KATAKANA_READINGS[i], note_id: 0 }));
	}
	return items;
});

$effect(() => {
	loadKana();
});
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Kana</h2>
		<div class="flex gap-2">
			<Button variant={kanaType === "all" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "all")}>All</Button>
			<Button variant={kanaType === "hiragana" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "hiragana")}>Hiragana</Button>
			<Button variant={kanaType === "katakana" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "katakana")}>Katakana</Button>
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading kana..." />
	{:else}
		<div class="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
			{#each displayItems as item (item.character)}
				<div class="flex flex-col items-center justify-center rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
					<span class="text-2xl font-bold">{item.character}</span>
					<span class="mt-1 text-xs text-muted-foreground">{item.reading}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
