<script lang="ts">
import LevelProgressBar from "$lib/components/kanji/LevelProgress.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { getTotalCardCount, getTotalDueCount } from "$lib/db/queries/cards";
import {
	getDueKanjiCount,
	getLevelProgress,
	getUserLevel,
	type LevelProgress,
} from "$lib/db/queries/kanji";
import { type DailyStats, getStreak, getTodayStats } from "$lib/db/queries/stats";
import { navigate } from "$lib/stores/navigation.svelte";

let dueCount = $state(0);
let kanjiDueCount = $state(0);
let totalCards = $state(0);
let streak = $state(0);
let userLevel = $state(1);
let levelProgress = $state<LevelProgress | null>(null);
let todayStats = $state<DailyStats | null>(null);

async function loadDashboard() {
	const [dueR, kanjiR, totalR, streakR, levelR, statsR] = await Promise.all([
		getTotalDueCount(),
		getDueKanjiCount(),
		getTotalCardCount(),
		getStreak(),
		getUserLevel(),
		getTodayStats(),
	]);

	if (dueR.ok) dueCount = dueR.data;
	if (kanjiR.ok) kanjiDueCount = kanjiR.data;
	if (totalR.ok) totalCards = totalR.data;
	if (streakR.ok) streak = streakR.data;
	if (levelR.ok) userLevel = levelR.data;
	if (statsR.ok) todayStats = statsR.data;

	const lpResult = await getLevelProgress(userLevel);
	if (lpResult.ok) levelProgress = lpResult.data;
}

$effect(() => {
	loadDashboard();
});
</script>

<div class="space-y-6">
	<h2 class="text-2xl font-bold">Dashboard</h2>

	<!-- Summary cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg border bg-card p-4">
			<div class="text-sm text-muted-foreground">Cards Due</div>
			<div class="mt-1 text-3xl font-bold">{dueCount}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-sm text-muted-foreground">Kanji Due</div>
			<div class="mt-1 text-3xl font-bold">{kanjiDueCount}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-sm text-muted-foreground">Streak</div>
			<div class="mt-1 text-3xl font-bold">{streak} days</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-sm text-muted-foreground">Total Cards</div>
			<div class="mt-1 text-3xl font-bold">{totalCards}</div>
		</div>
	</div>

	<!-- Kanji level progress -->
	{#if levelProgress}
		<div class="rounded-lg border bg-card p-4">
			<h3 class="mb-3 font-medium">Kanji Progress</h3>
			<LevelProgressBar progress={levelProgress} />
		</div>
	{/if}

	<!-- Today's stats -->
	{#if todayStats}
		<div class="rounded-lg border bg-card p-4">
			<h3 class="mb-3 font-medium">Today</h3>
			<div class="grid grid-cols-3 gap-4 text-sm">
				<div>
					<span class="text-muted-foreground">Reviews</span>
					<span class="ml-1 font-medium">{todayStats.reviews_count}</span>
				</div>
				<div>
					<span class="text-muted-foreground">Correct</span>
					<span class="ml-1 font-medium">{todayStats.correct_count}</span>
				</div>
				<div>
					<span class="text-muted-foreground">Time</span>
					<span class="ml-1 font-medium">{Math.round(todayStats.time_spent_ms / 60000)}m</span>
				</div>
			</div>
		</div>
	{/if}

	<!-- Quick actions -->
	<div class="flex flex-wrap gap-3">
		<Button onclick={() => navigate("review")} disabled={dueCount === 0}>
			Start Review {#if dueCount > 0}({dueCount}){/if}
		</Button>
		<Button variant="outline" onclick={() => navigate("kanji")}>
			Kanji Map
		</Button>
		<Button variant="outline" onclick={() => navigate("decks")}>
			Manage Decks
		</Button>
	</div>
</div>
