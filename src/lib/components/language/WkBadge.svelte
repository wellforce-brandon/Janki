<script lang="ts">
import { navigate } from "$lib/stores/navigation.svelte";

interface Props {
	srsStage: number;
	character: string;
	kanjiId: number;
}

let { srsStage, character, kanjiId }: Props = $props();

const SRS_COLORS: Record<number, string> = {
	0: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
	1: "bg-pink-200 text-pink-800 dark:bg-pink-800 dark:text-pink-200",
	2: "bg-pink-300 text-pink-900 dark:bg-pink-700 dark:text-pink-100",
	3: "bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200",
	4: "bg-purple-300 text-purple-900 dark:bg-purple-700 dark:text-purple-100",
	5: "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200",
	6: "bg-blue-300 text-blue-900 dark:bg-blue-700 dark:text-blue-100",
	7: "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200",
	8: "bg-emerald-300 text-emerald-900 dark:bg-emerald-700 dark:text-emerald-100",
	9: "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200",
};

const SRS_LABELS: Record<number, string> = {
	0: "Locked",
	1: "Apprentice 1",
	2: "Apprentice 2",
	3: "Apprentice 3",
	4: "Apprentice 4",
	5: "Guru 1",
	6: "Guru 2",
	7: "Master",
	8: "Enlightened",
	9: "Burned",
};

let colorClass = $derived(SRS_COLORS[srsStage] ?? SRS_COLORS[0]);
let label = $derived(SRS_LABELS[srsStage] ?? "Unknown");

function goToDetail(e: MouseEvent) {
	e.stopPropagation();
	navigate("kanji-detail", { id: String(kanjiId) });
}
</script>

<button
	type="button"
	class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 {colorClass}"
	onclick={goToDetail}
	title="WaniKani: {character} - {label}"
	aria-label="WaniKani {character} ({label})"
>
	WK
</button>
