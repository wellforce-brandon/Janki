<script lang="ts">
import { RefreshCw } from "@lucide/svelte";
import LanguageOverviewCard from "$lib/components/language/LanguageOverviewCard.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getContentTypeCounts, type ContentTypeCount } from "$lib/db/queries/language";
import { seedBuiltinItems } from "$lib/db/seed-builtin-items";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let refreshing = $state(false);
let counts = $state<ContentTypeCount[]>([]);
let showImport = $state(false);

/** Map content types to their browsing views */
const VIEW_MAP: Record<string, Parameters<typeof navigate>[0]> = {
	vocabulary: "lang-vocabulary",
	grammar: "lang-grammar",
	sentence: "lang-sentences",
	kana: "lang-kana",
	conjugation: "lang-conjugation",
};

async function loadData() {
	try {
		// Seed builtin items on first load (idempotent)
		await seedBuiltinItems();

		const result = await getContentTypeCounts();
		if (result.ok) {
			counts = result.data;
		} else {
			addToast("Failed to load content counts", "error");
		}
	} catch {
		addToast("Failed to load language overview", "error");
	} finally {
		loading = false;
		refreshing = false;
	}
}

function handleRefresh() {
	refreshing = true;
	loadData();
}

function handleCardClick(type: string) {
	const view = VIEW_MAP[type];
	if (view) {
		navigate(view);
	}
}

let totalItems = $derived(counts.reduce((sum, c) => sum + c.total, 0));
let totalDue = $derived(counts.reduce((sum, c) => sum + c.due, 0));

$effect(() => {
	loadData();
});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Language Overview</h2>
		<div class="flex items-center gap-2">
			<Button variant="outline" onclick={() => navigate("lang-decks")}>Import Deck</Button>
			{#if totalDue > 0}
				<Button onclick={() => navigate("lang-review")}>Review ({totalDue})</Button>
			{/if}
			<button
				type="button"
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				onclick={handleRefresh}
				disabled={refreshing}
				aria-label="Refresh"
			>
				<RefreshCw class={refreshing ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
			</button>
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading language data..." />
	{:else if totalItems === 0}
		<EmptyState
			title="No language content yet"
			description="Import an Anki .apkg deck to get started. Your content will be automatically categorized by type."
			actionLabel="Import Deck"
			onaction={() => navigate("lang-decks")}
		/>
	{:else}
		<!-- Summary -->
		<div class="flex gap-6 text-sm text-muted-foreground">
			<span>{totalItems} total items</span>
			{#if totalDue > 0}
				<span class="text-orange-500 dark:text-orange-400">{totalDue} due for review</span>
			{/if}
		</div>

		<!-- Content type cards -->
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each counts as count (count.type)}
				<LanguageOverviewCard
					{count}
					onclick={() => handleCardClick(count.type)}
				/>
			{/each}
		</div>

		<!-- Quick links -->
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" size="sm" onclick={() => navigate("lang-decks")}>
				Manage Decks
			</Button>
		</div>
	{/if}
</div>
