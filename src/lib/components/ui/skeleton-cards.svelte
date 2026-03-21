<script lang="ts">
interface Props {
	count?: number;
	columns?: 2 | 3 | 4;
}

let { count = 4, columns = 4 }: Props = $props();

let gridClass = $derived(
	columns === 2 ? "sm:grid-cols-2" :
	columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" :
	"sm:grid-cols-2 lg:grid-cols-4"
);
</script>

<div class="grid gap-4 {gridClass}">
	{#each Array(count) as _}
		<div class="animate-pulse rounded-lg border bg-card p-4">
			<div class="h-4 w-20 rounded bg-muted"></div>
			<div class="mt-3 h-8 w-16 rounded bg-muted"></div>
		</div>
	{/each}
</div>
