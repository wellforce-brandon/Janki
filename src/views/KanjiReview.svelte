<script lang="ts">
import type { ReviewSummary } from "$lib/components/kanji/KanjiReviewSession.svelte";
import KanjiReviewSession from "$lib/components/kanji/KanjiReviewSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getDueKanjiReviews, type KanjiLevelItem } from "$lib/db/queries/kanji";
import { getTodayKanjiReviewCount } from "$lib/db/queries/kanji-reviews";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let dueItems = $state<KanjiLevelItem[]>([]);
let todayCount = $state(0);
let sessionActive = $state(false);
let summary = $state<ReviewSummary | null>(null);

async function loadDueItems() {
	loading = true;
	const [dueResult, countResult] = await Promise.all([
		getDueKanjiReviews(),
		getTodayKanjiReviewCount(),
	]);
	if (dueResult.ok) dueItems = dueResult.data;
	if (countResult.ok) todayCount = countResult.data;
	loading = false;
}

function startSession() {
	if (dueItems.length === 0) return;
	summary = null;
	sessionActive = true;
}

function handleComplete(result: ReviewSummary) {
	summary = result;
	sessionActive = false;
	const accuracy = result.reviewed > 0 ? Math.round((result.correct / result.reviewed) * 100) : 0;
	addToast(
		`Review complete! ${result.correct}/${result.reviewed} correct (${accuracy}%)`,
		"success",
	);
	loadDueItems();
}

function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${minutes}:${String(secs).padStart(2, "0")}`;
}

$effect(() => {
	loadDueItems();
});
</script>

<div class="space-y-6">
	{#if sessionActive}
		<KanjiReviewSession items={dueItems} oncomplete={handleComplete} />
	{:else if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Reviews</h2>
		<LoadingState message="Loading reviews..." />
	{:else if summary}
		<!-- Review Summary -->
		<h2 class="text-2xl font-bold" tabindex="-1">Review Complete</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8">
			<div class="space-y-4 text-center">
				<div class="text-5xl font-bold text-primary">
					{summary.reviewed > 0 ? Math.round((summary.correct / summary.reviewed) * 100) : 0}%
				</div>
				<p class="text-muted-foreground">Accuracy</p>

				<div class="grid grid-cols-3 gap-4 pt-4">
					<div>
						<div class="text-2xl font-bold">{summary.reviewed}</div>
						<div class="text-xs text-muted-foreground">Reviewed</div>
					</div>
					<div>
						<div class="text-2xl font-bold text-green-500">{summary.correct}</div>
						<div class="text-xs text-muted-foreground">Correct</div>
					</div>
					<div>
						<div class="text-2xl font-bold">{formatTime(summary.totalTimeMs)}</div>
						<div class="text-xs text-muted-foreground">Time</div>
					</div>
				</div>

				{#if summary.unlockedCount > 0}
					<div class="mt-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
						{summary.unlockedCount} new item{summary.unlockedCount > 1 ? "s" : ""} unlocked!
					</div>
				{/if}

				<div class="flex justify-center gap-2 pt-4">
					{#if dueItems.length > 0}
						<Button onclick={startSession}>Continue Reviews ({dueItems.length})</Button>
					{/if}
					<Button variant="outline" onclick={() => navigate("kanji-dashboard")}>Back to Overview</Button>
				</div>
			</div>
		</div>
	{:else if dueItems.length === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Reviews</h2>
		<EmptyState
			title="All caught up!"
			description="You have no kanji reviews due right now. Come back later when more items are ready."
			actionLabel="Back to Overview"
			onaction={() => navigate("kanji-dashboard")}
		/>
		{#if todayCount > 0}
			<p class="text-center text-sm text-muted-foreground">
				You've completed {todayCount} review{todayCount > 1 ? "s" : ""} today.
			</p>
		{/if}
	{:else}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Reviews</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-primary">{dueItems.length}</div>
			<p class="mt-2 text-muted-foreground">review{dueItems.length > 1 ? "s" : ""} available</p>

			{#if todayCount > 0}
				<p class="mt-1 text-sm text-muted-foreground">
					{todayCount} completed today
				</p>
			{/if}

			<div class="mt-6">
				<Button onclick={startSession}>Start Reviews</Button>
			</div>
		</div>
	{/if}
</div>
