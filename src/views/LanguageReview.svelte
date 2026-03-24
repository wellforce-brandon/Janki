<script lang="ts">
import ContentTypeFilter from "$lib/components/language/ContentTypeFilter.svelte";
import LevelUpCelebration from "$lib/components/language/LevelUpCelebration.svelte";
import LanguageReviewSession from "$lib/components/language/LanguageReviewSession.svelte";
import type { ReviewSummary } from "$lib/components/language/LanguageReviewSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	getDueLanguageItems,
	getDueLanguageCount,
	getAvailableLessonCount,
	getLanguageUserLevel,
	type ContentType,
	type LanguageItem,
} from "$lib/db/queries/language";
import { checkLevelProgression } from "$lib/srs/language-unlock";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { formatTime } from "$lib/utils/common";

let loading = $state(true);
let dueItems = $state<LanguageItem[]>([]);
let dueCount = $state(0);
let lessonCount = $state(0);
let sessionActive = $state(false);
let summary = $state<ReviewSummary | null>(null);
let selectedType = $state<string>("all");
let levelBefore = $state(1);
let showLevelUp = $state(false);
let newLevel = $state(1);

async function loadDueItems() {
	loading = true;
	const typeFilter = selectedType === "all" ? undefined : (selectedType as ContentType);
	const [dueResult, countResult, lessonResult, levelResult] = await Promise.all([
		getDueLanguageItems(typeFilter),
		getDueLanguageCount(typeFilter),
		getAvailableLessonCount(typeFilter),
		getLanguageUserLevel(),
	]);
	if (dueResult.ok) dueItems = dueResult.data;
	if (countResult.ok) dueCount = countResult.data;
	if (lessonResult.ok) lessonCount = lessonResult.data;
	if (levelResult.ok) levelBefore = levelResult.data;
	loading = false;
}

function startSession() {
	if (dueItems.length === 0) return;
	summary = null;
	sessionActive = true;
}

async function handleComplete(result: ReviewSummary) {
	summary = result;
	sessionActive = false;
	const accuracy = result.reviewed > 0 ? Math.round((result.correct / result.reviewed) * 100) : 0;
	addToast(
		`Review complete! ${result.correct}/${result.reviewed} correct (${accuracy}%)`,
		"success",
	);

	// Check level progression after batch completion
	const progressionResult = await checkLevelProgression(levelBefore);
	if (progressionResult.newLevelUnlocked) {
		newLevel = progressionResult.newLevelUnlocked;
		showLevelUp = true;
	}
	if (progressionResult.unlockedCount > 0) {
		addToast(`${progressionResult.unlockedCount} new item${progressionResult.unlockedCount > 1 ? "s" : ""} unlocked!`, "success");
	}

	await loadDueItems();
}

$effect(() => {
	loadDueItems();
});
</script>

{#if showLevelUp}
	<LevelUpCelebration level={newLevel} onclose={() => { showLevelUp = false; }} />
{/if}

<div class="space-y-6">
	{#if sessionActive}
		<LanguageReviewSession items={dueItems} oncomplete={handleComplete} />
	{:else if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>
		<SkeletonCards count={3} columns={3} />
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

				<div class="flex justify-center gap-2 pt-4">
					{#if dueCount > 0}
						<Button onclick={startSession}>Continue Reviews ({dueCount})</Button>
					{/if}
					<Button variant="outline" onclick={() => navigate("lang-overview")}>Back to Overview</Button>
				</div>
			</div>
		</div>
	{:else if dueCount === 0 && lessonCount === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>
		<EmptyState
			title="All caught up!"
			description="No reviews due right now. Complete some lessons to get started, or come back later."
			actionLabel="Back to Overview"
			onaction={() => navigate("lang-overview")}
		/>
	{:else if dueCount === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-muted-foreground">0</div>
			<p class="mt-2 text-muted-foreground">reviews due</p>
			{#if lessonCount > 0}
				<p class="mt-4 text-sm text-muted-foreground">
					You have {lessonCount} lesson{lessonCount > 1 ? "s" : ""} available.
				</p>
			{/if}
			<div class="mt-6">
				<Button variant="outline" onclick={() => navigate("lang-overview")}>Back to Overview</Button>
			</div>
		</div>
	{:else}
		<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-primary">{dueCount}</div>
			<p class="mt-2 text-muted-foreground">review{dueCount > 1 ? "s" : ""} available</p>

			{#if lessonCount > 0}
				<p class="mt-1 text-sm text-muted-foreground">
					{lessonCount} lesson{lessonCount > 1 ? "s" : ""} available
				</p>
			{/if}

			<div class="mt-6">
				<Button onclick={startSession}>Start Reviews</Button>
			</div>
		</div>
	{/if}
</div>
