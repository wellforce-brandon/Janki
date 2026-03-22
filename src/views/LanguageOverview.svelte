<script lang="ts">
import { RefreshCw } from "@lucide/svelte";
import LanguageOverviewCard from "$lib/components/language/LanguageOverviewCard.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	getContentTypeCounts,
	getAvailableLessonCount,
	getLanguageSrsSummary,
	getRecentlyUnlockedItems,
	type ContentTypeCount,
	type LanguageSrsSummary,
	type LanguageItem,
} from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let refreshing = $state(false);
let counts = $state<ContentTypeCount[]>([]);
let lessonCount = $state(0);
let srsSummary = $state<LanguageSrsSummary[]>([]);
let recentUnlocks = $state<LanguageItem[]>([]);
let detailsLoaded = $state(false);

/** Map content types to their browsing views */
const VIEW_MAP: Record<string, Parameters<typeof navigate>[0]> = {
	vocabulary: "lang-vocabulary",
	grammar: "lang-grammar",
	sentence: "lang-sentences",
	kana: "lang-kana",
	conjugation: "lang-conjugation",
};

/** SRS stage colors */
function getStageColor(stage: number): string {
	if (stage <= 0) return "bg-gray-400";
	if (stage <= 4) return "bg-pink-500";
	if (stage <= 6) return "bg-purple-500";
	if (stage === 7) return "bg-blue-500";
	if (stage === 8) return "bg-amber-500";
	return "bg-green-500";
}

/** Content type color for badges */
function getTypeColor(type: string): string {
	const colors: Record<string, string> = {
		kana: "bg-teal-500",
		vocabulary: "bg-purple-500",
		grammar: "bg-amber-500",
		sentence: "bg-blue-500",
		conjugation: "bg-rose-500",
	};
	return colors[type] ?? "bg-gray-500";
}

async function loadData() {
	try {
		// Load critical data first (counts + lesson count)
		const [countR, lessonR] = await Promise.all([
			getContentTypeCounts(),
			getAvailableLessonCount(),
		]);
		if (countR.ok) counts = countR.data;
		if (lessonR.ok) lessonCount = lessonR.data;

		loading = false;
		refreshing = false;

		// Lazy-load secondary data (SRS distribution + recently unlocked)
		const [srsR, recentR] = await Promise.all([
			getLanguageSrsSummary(),
			getRecentlyUnlockedItems(10),
		]);
		if (srsR.ok) srsSummary = srsR.data;
		if (recentR.ok) recentUnlocks = recentR.data;
		detailsLoaded = true;
	} catch {
		addToast("Failed to load language overview", "error");
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
	if (view) navigate(view);
}

let totalItems = $derived(counts.reduce((sum, c) => sum + c.total, 0));
let totalDue = $derived(counts.reduce((sum, c) => sum + c.due, 0));

// Aggregate SRS stages across all content types
let srsDistribution = $derived.by(() => {
	const map = new Map<number, number>();
	for (const row of srsSummary) {
		if (row.srs_stage > 0) {
			map.set(row.srs_stage, (map.get(row.srs_stage) ?? 0) + row.count);
		}
	}
	return Array.from(map.entries())
		.sort(([a], [b]) => a - b)
		.map(([stage, count]) => ({ stage, count, name: STAGE_NAMES[stage] ?? `Stage ${stage}` }));
});

let srsTotal = $derived(srsDistribution.reduce((sum, r) => sum + r.count, 0));

$effect(() => {
	loadData();
});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Language Overview</h2>
		<div class="flex items-center gap-2">
			{#if lessonCount > 0}
				<Button onclick={() => navigate("lang-lessons")}>
					Lessons ({lessonCount})
				</Button>
			{/if}
			{#if totalDue > 0}
				<Button variant={lessonCount > 0 ? "outline" : "default"} onclick={() => navigate("lang-review")}>
					Review ({totalDue})
				</Button>
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
		<SkeletonCards count={5} columns={3} />
	{:else if totalItems === 0}
		<EmptyState
			title="No language content yet"
			description="Language data is loading. Try refreshing the page."
		/>
	{:else}
		<!-- Summary -->
		<div class="flex flex-wrap gap-6 text-sm text-muted-foreground">
			<span>{totalItems} total items</span>
			{#if totalDue > 0}
				<span class="text-orange-500 dark:text-orange-400">{totalDue} due for review</span>
			{/if}
			{#if lessonCount > 0}
				<span class="text-violet-500 dark:text-violet-400">{lessonCount} lessons available</span>
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

		<!-- SRS Stage Distribution -->
		{#if !detailsLoaded && srsDistribution.length === 0}
			<div class="space-y-3">
				<div class="h-4 w-32 animate-pulse rounded bg-muted"></div>
				<div class="h-32 animate-pulse rounded-lg border bg-muted/50"></div>
			</div>
		{:else if srsDistribution.length > 0}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">SRS Distribution</h3>
				<div class="rounded-lg border bg-card p-4">
					<!-- Bar chart -->
					<div class="flex h-24 items-end gap-1">
						{#each srsDistribution as entry}
							{@const height = srsTotal > 0 ? Math.max(4, (entry.count / srsTotal) * 100) : 0}
							<div class="group relative flex flex-1 flex-col items-center">
								<div
									class="w-full rounded-t {getStageColor(entry.stage)} transition-all"
									style="height: {height}%"
									aria-label="{entry.name}: {entry.count}"
								></div>
								<div class="absolute -top-6 hidden rounded bg-popover px-2 py-0.5 text-xs shadow group-hover:block">
									{entry.count}
								</div>
							</div>
						{/each}
					</div>
					<div class="mt-2 flex gap-1">
						{#each srsDistribution as entry}
							<div class="flex-1 text-center text-[10px] text-muted-foreground">
								{entry.name.replace("Apprentice ", "A").replace("Guru ", "G").replace("Master", "M").replace("Enlightened", "E").replace("Burned", "B")}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Recently Unlocked -->
		{#if recentUnlocks.length > 0}
			<div class="space-y-3">
				<h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recently Unlocked</h3>
				<div class="flex flex-wrap gap-2">
					{#each recentUnlocks as item}
						<div class="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5">
							<span class="inline-block h-2 w-2 rounded-full {getTypeColor(item.content_type)}"></span>
							<span class="text-sm font-medium">{item.primary_text}</span>
							{#if item.meaning}
								<span class="text-xs text-muted-foreground">{item.meaning}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
