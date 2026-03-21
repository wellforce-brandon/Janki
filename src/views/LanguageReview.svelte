<script lang="ts">
import LanguageReviewSession from "$lib/components/review/LanguageReviewSession.svelte";
import ContentTypeFilter from "$lib/components/language/ContentTypeFilter.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getContentTypeCounts, type ContentTypeCount } from "$lib/db/queries/language";
import { getLanguageReviewQueue, type UnifiedReviewItem, type UnifiedReviewQueue } from "$lib/srs/language-scheduler";
import type { ContentType } from "$lib/import/content-classifier";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let contentTypes = $state<ContentTypeCount[]>([]);
let selectedType = $state<string>("all");
let queue = $state<UnifiedReviewQueue | null>(null);
let loadingCounts = $state(true);
let loadingQueue = $state(false);
let allCaughtUp = $state(false);

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

async function startReview() {
	loadingQueue = true;
	allCaughtUp = false;

	try {
		const typeFilter = selectedType === "all" ? undefined : selectedType as ContentType;
		queue = await getLanguageReviewQueue(typeFilter);
		if (queue.items.length === 0) {
			allCaughtUp = true;
			queue = null;
		}
	} catch (e) {
		addToast(e instanceof Error ? e.message : "Failed to load review queue", "error");
	} finally {
		loadingQueue = false;
	}
}

$effect(() => {
	loadCounts();
});
</script>

{#if queue && queue.items.length > 0}
	<LanguageReviewSession items={queue.items} />
{:else}
	<div class="mx-auto max-w-md space-y-6">
		<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>

		{#if loadingCounts}
			<LoadingState message="Loading review counts..." />
		{:else if totalDue === 0 && totalNew === 0}
			<EmptyState
				title="Nothing to review"
				description="Import some decks or promote builtin content to start reviewing."
				actionLabel="Back to Overview"
				onaction={() => navigate("lang-overview")}
			/>
		{:else if allCaughtUp}
			<div class="flex flex-col items-center gap-3 rounded-lg border bg-card/50 py-12 text-center">
				<span class="text-4xl">&#10003;</span>
				<h3 class="text-lg font-medium">All caught up!</h3>
				<p class="text-sm text-muted-foreground">
					No {selectedType === "all" ? "" : selectedType + " "}cards due for review. Check back later.
				</p>
			</div>
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

			<button
				type="button"
				class="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				onclick={startReview}
				disabled={loadingQueue}
			>
				{loadingQueue ? "Loading..." : "Start Review"}
			</button>
		{/if}
	</div>
{/if}
