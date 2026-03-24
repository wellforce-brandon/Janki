<script lang="ts">
import KanjiLessonSession from "$lib/components/kanji/KanjiLessonSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getAvailableLessonCount,
	getAvailableLessons,
	type KanjiLevelItem,
} from "$lib/db/queries/kanji";
import { getTodayKanjiLessonCount } from "$lib/db/queries/kanji-reviews";
import { getSettings } from "$lib/stores/app-settings.svelte";
import { navigate } from "$lib/stores/navigation.svelte";

let loading = $state(true);
let availableCount = $state(0);
let batchItems = $state<KanjiLevelItem[]>([]);
let sessionActive = $state(false);
let completedCount = $state(0);
let todayLessonCount = $state(0);
let dailyLimit = $derived(getSettings().kanjiMaxDailyLessons);
let remaining = $derived(Math.max(0, dailyLimit - todayLessonCount));
let atDailyLimit = $derived(dailyLimit > 0 && remaining === 0);

async function loadLessons() {
	loading = true;
	const batchSize = getSettings().kanjiBatchSize;
	const [countR, itemsR, todayR] = await Promise.all([
		getAvailableLessonCount(),
		getAvailableLessons(batchSize),
		getTodayKanjiLessonCount(),
	]);
	if (countR.ok) availableCount = countR.data;
	if (itemsR.ok) batchItems = itemsR.data;
	if (todayR.ok) todayLessonCount = todayR.data;
	loading = false;
}

function startSession() {
	if (batchItems.length === 0 || atDailyLimit) return;
	completedCount = 0;
	sessionActive = true;
}

function handleComplete(count: number) {
	completedCount = count;
	sessionActive = false;
	loadLessons();
}

$effect(() => {
	loadLessons();
});
</script>

<div class="space-y-6">
	{#if sessionActive}
		<KanjiLessonSession items={batchItems} oncomplete={handleComplete} />
	{:else if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Lessons</h2>
		<LoadingState message="Loading lessons..." />
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
						Next Batch ({Math.min(availableCount, getSettings().kanjiBatchSize)})
					</Button>
				{:else if atDailyLimit}
					<p class="text-sm text-amber-600 dark:text-amber-400">Daily lesson limit reached</p>
				{/if}
				<Button variant="outline" onclick={() => navigate("kanji-dashboard")}>
					Back to Overview
				</Button>
			</div>
		</div>
	{:else if atDailyLimit}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Lessons</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-amber-500">{todayLessonCount}</div>
			<p class="mt-2 font-medium text-amber-600 dark:text-amber-400">Daily limit reached</p>
			<p class="mt-1 text-sm text-muted-foreground">
				You've completed {todayLessonCount} of {dailyLimit} kanji lessons today.
				Your limit resets at midnight.
			</p>
			{#if availableCount > 0}
				<p class="mt-2 text-sm text-muted-foreground">
					{availableCount} lesson{availableCount > 1 ? "s" : ""} waiting for tomorrow.
				</p>
			{/if}
			<div class="mt-6">
				<Button variant="outline" onclick={() => navigate("kanji-dashboard")}>
					Back to Overview
				</Button>
			</div>
		</div>
	{:else if availableCount === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Lessons</h2>
		<EmptyState
			title="No lessons available"
			description="All unlocked items have been learned. Complete reviews to unlock more items."
			actionLabel="Back to Overview"
			onaction={() => navigate("kanji-dashboard")}
		/>
	{:else}
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Lessons</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-pink-500">{availableCount}</div>
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
					Start Lessons ({Math.min(availableCount, getSettings().kanjiBatchSize)})
				</Button>
				<Button variant="outline" onclick={() => navigate("kanji-lesson-picker")}>
					Advanced
				</Button>
			</div>
		</div>
	{/if}
</div>
