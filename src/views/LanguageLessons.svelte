<script lang="ts">
import LanguageLessonSession from "$lib/components/language/LanguageLessonSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	getAvailableLessonCount,
	getLanguageItemsByIds,
	type LanguageItem,
} from "$lib/db/queries/language";
import { getNextLessonBatch } from "$lib/srs/language-lessons";
import { navigate, viewParams } from "$lib/stores/navigation.svelte";

let loading = $state(true);
let availableCount = $state(0);
let batchItems = $state<LanguageItem[]>([]);
let sessionActive = $state(false);
let completedCount = $state(0);
let todayLessonCount = $state(0);
let dailyLimit = $state(0);
let remaining = $derived(dailyLimit > 0 ? Math.max(0, dailyLimit - todayLessonCount) : Infinity);
let atDailyLimit = $derived(dailyLimit > 0 && remaining === 0);

async function loadLessons() {
	loading = true;
	const params = viewParams();

	if (params.ids) {
		// Picker mode: load specific items by ID directly
		const ids = params.ids.split(",").map(Number);
		const result = await getLanguageItemsByIds(ids);
		if (result.ok) {
			batchItems = result.data;
			availableCount = batchItems.length;
		}
	} else {
		// Auto mode: get next batch of 5
		const result = await getNextLessonBatch(undefined, 5);
		if (result.ok) {
			batchItems = result.data.items;
			availableCount = result.data.totalAvailable;
			todayLessonCount = result.data.todayCompleted;
			dailyLimit = result.data.dailyLimit;
		}
	}

	if (batchItems.length > 0 && !atDailyLimit) {
		sessionActive = true;
	}
	loading = false;
}

function startSession() {
	if (batchItems.length === 0 || atDailyLimit) return;
	completedCount = 0;
	sessionActive = true;
}

async function handleComplete(count: number) {
	completedCount = count;
	sessionActive = false;
	// Reload available count and daily limits
	const batchR = await getNextLessonBatch(undefined, 5);
	if (batchR.ok) {
		batchItems = batchR.data.items;
		availableCount = batchR.data.totalAvailable;
		todayLessonCount = batchR.data.todayCompleted;
		dailyLimit = batchR.data.dailyLimit;
	}
}

$effect(() => {
	loadLessons();
});
</script>

<div class="space-y-6">
	{#if sessionActive && batchItems.length > 0}
		<LanguageLessonSession items={batchItems} oncomplete={handleComplete} />
	{:else if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Lessons</h2>
		<SkeletonCards count={3} columns={3} />
	{:else if completedCount > 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Lesson Complete</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-green-500">{completedCount}</div>
			<p class="mt-2 text-muted-foreground">
				item{completedCount > 1 ? "s" : ""} learned!
			</p>
			<p class="mt-1 text-sm text-muted-foreground">
				These items will appear in your reviews soon.
			</p>

			<div class="mt-6 flex justify-center gap-2">
				{#if availableCount > 0 && !atDailyLimit}
					<Button onclick={startSession}>
						Next Batch ({Math.min(availableCount, 5)})
					</Button>
				{:else if atDailyLimit}
					<p class="text-sm text-amber-600 dark:text-amber-400">Daily lesson limit reached</p>
				{/if}
				<Button variant="outline" onclick={() => navigate("lang-overview")}>
					Back to Overview
				</Button>
			</div>
		</div>
	{:else if atDailyLimit}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Lessons</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-amber-500">{todayLessonCount}</div>
			<p class="mt-2 font-medium text-amber-600 dark:text-amber-400">Daily limit reached</p>
			<p class="mt-1 text-sm text-muted-foreground">
				You've completed {todayLessonCount} of {dailyLimit} language lessons today.
				Your limit resets at midnight.
			</p>
			{#if availableCount > 0}
				<p class="mt-2 text-sm text-muted-foreground">
					{availableCount} lesson{availableCount > 1 ? "s" : ""} waiting for tomorrow.
				</p>
			{/if}
			<div class="mt-6">
				<Button variant="outline" onclick={() => navigate("lang-overview")}>
					Back to Overview
				</Button>
			</div>
		</div>
	{:else if availableCount === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Lessons</h2>
		<EmptyState
			title="No lessons available"
			description="All unlocked items have been learned. Complete reviews to unlock more items."
			actionLabel="Back to Overview"
			onaction={() => navigate("lang-overview")}
		/>
	{:else}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Lessons</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-violet-500">{availableCount}</div>
			<p class="mt-2 text-muted-foreground">
				lesson{availableCount > 1 ? "s" : ""} available
			</p>
			{#if dailyLimit > 0}
				<p class="mt-1 text-sm text-muted-foreground">
					{remaining} of {dailyLimit} daily lessons remaining
				</p>
			{/if}

			<div class="mt-6 flex justify-center gap-2">
				<Button onclick={startSession}>
					Start Lessons ({Math.min(availableCount, 5)})
				</Button>
				<Button variant="outline" onclick={() => navigate("lang-lesson-picker")}>
					Advanced
				</Button>
			</div>
		</div>
	{/if}
</div>
