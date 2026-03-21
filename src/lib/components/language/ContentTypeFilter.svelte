<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";

interface Props {
	options: string[];
	selected: string;
	onselect: (value: string) => void;
}

let { options, selected, onselect }: Props = $props();
</script>

<div class="flex flex-wrap gap-2">
	<Button
		variant={selected === "all" ? "default" : "outline"}
		size="sm"
		onclick={() => onselect("all")}
	>
		All
	</Button>
	{#each options as option}
		<Button
			variant={selected === option ? "default" : "outline"}
			size="sm"
			onclick={() => onselect(option)}
		>
			<span class="capitalize">{option}</span>
		</Button>
	{/each}
</div>
