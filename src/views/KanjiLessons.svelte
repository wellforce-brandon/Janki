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
import { navigate } from "$lib/stores/navigation.svelte";

let loading = $state(true);
let availableCount = $state(0);
let batchItems = $state<KanjiLevelItem[]>([]);
let sessionActive = $state(false);
let completedCount = $state(0);

async function loadLessons() {
	loading = true;
	const [countR, itemsR] = await Promise.all([getAvailableLessonCount(), getAvailableLessons(5)]);
	if (countR.ok) availableCount = countR.data;
	if (itemsR.ok) batchItems = itemsR.data;
	loading = false;
}

function startSession() {
	if (batchItems.length === 0) return;
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
				{#if availableCount > 0}
					<Button onclick={startSession}>
						Next Batch ({Math.min(availableCount, 5)})
					</Button>
				{/if}
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

			<div class="mt-6">
				<Button onclick={startSession}>
					Start Lessons ({Math.min(availableCount, 5)})
				</Button>
			</div>
		</div>
	{/if}
</div>
