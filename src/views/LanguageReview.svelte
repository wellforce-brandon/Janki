<script lang="ts">
import ContentTypeFilter from "$lib/components/language/ContentTypeFilter.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getContentTypeCounts, type ContentTypeCount } from "$lib/db/queries/language";
import { navigate } from "$lib/stores/navigation.svelte";

let contentTypes = $state<ContentTypeCount[]>([]);
let selectedType = $state<string>("all");
let loadingCounts = $state(true);

let availableTypes = $derived(contentTypes.filter((ct) => ct.due > 0 || ct.new_count > 0).map((ct) => ct.type));
let totalDue = $derived(contentTypes.reduce((sum, ct) => sum + ct.due, 0));
let totalNew = $derived(contentTypes.reduce((sum, ct) => sum + ct.new_count, 0));
let selectedDue = $derived(
	selectedType === "all"
		? totalDue
		: (contentTypes.find((ct) => ct.type === selectedType)?.due ?? 0),
);
let selectedNew = $derived(
	selectedType === "all"
		? totalNew
		: (contentTypes.find((ct) => ct.type === selectedType)?.new_count ?? 0),
);

async function loadCounts() {
	loadingCounts = true;
	const result = await getContentTypeCounts();
	if (result.ok) {
		contentTypes = result.data;
	}
	loadingCounts = false;
}

$effect(() => {
	loadCounts();
});
</script>

<div class="mx-auto max-w-md space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>

	{#if loadingCounts}
		<LoadingState message="Loading review counts..." />
	{:else if totalDue === 0 && totalNew === 0}
		<EmptyState
			title="Nothing to review"
			description="All items are locked. The SRS review engine is coming in Phase 2."
			actionLabel="Back to Overview"
			onaction={() => navigate("lang-overview")}
		/>
	{:else}
		<div class="space-y-4">
			<div class="space-y-2">
				<label class="text-sm font-medium">Content type</label>
				<ContentTypeFilter
					options={availableTypes}
					selected={selectedType}
					onselect={(v) => { selectedType = v; }}
				/>
			</div>

			<div class="flex gap-4 text-sm text-muted-foreground">
				<span>{selectedDue} due</span>
				<span>{selectedNew} new</span>
			</div>
		</div>

		<div class="rounded-lg border bg-card/50 p-6 text-center text-sm text-muted-foreground">
			SRS review engine coming in Phase 2. Items are seeded and ready.
		</div>
	{/if}
</div>
