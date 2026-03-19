<script lang="ts">
import { Rating } from "$lib/srs/fsrs";
import { cn } from "$lib/utils/cn";

interface Props {
	intervals: Record<number, string>;
	onrate: (rating: Rating) => void;
}

let { intervals, onrate }: Props = $props();

const buttons = [
	{
		rating: Rating.Again,
		label: "Again",
		key: "1",
		color: "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600",
	},
	{
		rating: Rating.Hard,
		label: "Hard",
		key: "2",
		color: "bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600",
	},
	{
		rating: Rating.Good,
		label: "Good",
		key: "3",
		color: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600",
	},
	{
		rating: Rating.Easy,
		label: "Easy",
		key: "4",
		color: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600",
	},
];
</script>

<div class="flex justify-center gap-3">
	{#each buttons as btn}
		<button
			type="button"
			class={cn(
				"flex min-w-[80px] flex-col items-center rounded-md px-4 py-3 text-white transition-colors",
				btn.color,
			)}
			onclick={() => onrate(btn.rating)}
			aria-label="{btn.label} ({btn.key})"
		>
			<span class="text-xs opacity-80">{intervals[btn.rating] ?? ""}</span>
			<span class="font-medium">{btn.label}</span>
			<span class="text-xs opacity-60">{btn.key}</span>
		</button>
	{/each}
</div>
