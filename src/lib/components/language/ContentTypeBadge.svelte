<script lang="ts">
import { getKanaScriptLabel } from "$lib/data/kana-groups";

interface Props {
	type: string;
	primaryText?: string;
	class?: string;
}

let { type, primaryText, class: className = "" }: Props = $props();

const COLORS: Record<string, string> = {
	kana: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
	kanji: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
	vocabulary: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	grammar: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
	sentence: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	radical: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
	conjugation: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

let colorClass = $derived(COLORS[type] ?? "bg-muted text-muted-foreground");
let displayLabel = $derived(
	type === "kana" && primaryText ? getKanaScriptLabel(primaryText) : type,
);
</script>

<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize {colorClass} {className}">
	{displayLabel}
</span>
