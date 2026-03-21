<script lang="ts">
import { RefreshCw } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import {
	getAvailableLessonCount,
	getDueKanjiCount,
	getLevelProgress,
	getUserLevel,
	type LevelProgress,
} from "$lib/db/queries/kanji";
import {
	getContentTypeCounts,
	getAvailableLessonCount as getLangLessonCount,
	getLanguageSrsDistribution,
	type ContentTypeCount,
} from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { type DailyStats, getStreak, getTodayStats } from "$lib/db/queries/stats";
import { checkAndUnlockItems } from "$lib/srs/language-unlock";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let error = $state<string | null>(null);
let kanjiDueCount = $state(0);
let kanjiLessonCount = $state(0);
let streak = $state(0);
let userLevel = $state(1);
let levelProgress = $state<LevelProgress | null>(null);
let todayStats = $state<DailyStats | null>(null);
let contentCounts = $state<ContentTypeCount[]>([]);
let langDueTotal = $state(0);
let langNewTotal = $state(0);
let langLessonCount = $state(0);
let langSrsDistribution = $state<{ srs_stage: number; count: number }[]>([]);
let refreshing = $state(false);

async function loadDashboard() {
	error = null;
	try {
		const [kanjiR, lessonR, streakR, levelR, statsR, contentR, langLessonR, langSrsR] = await Promise.all([
			getDueKanjiCount(),
			getAvailableLessonCount(),
			getStreak(),
			getUserLevel(),
			getTodayStats(),
			getContentTypeCounts(),
			getLangLessonCount(),
			getLanguageSrsDistribution(),
		]);

		if (kanjiR.ok) kanjiDueCount = kanjiR.data;
		if (lessonR.ok) kanjiLessonCount = lessonR.data;
		if (streakR.ok) streak = streakR.data;
		if (levelR.ok) userLevel = levelR.data;
		if (statsR.ok) todayStats = statsR.data;
		if (contentR.ok) {
			contentCounts = contentR.data;
			langDueTotal = contentR.data.reduce((s, c) => s + c.due, 0);
			langNewTotal = contentR.data.reduce((s, c) => s + c.new_count, 0);
		}
		if (langLessonR.ok) langLessonCount = langLessonR.data;
		if (langSrsR.ok) langSrsDistribution = langSrsR.data;

		const anyFailed = [kanjiR, lessonR, streakR, levelR, statsR, contentR, langLessonR, langSrsR].some((r) => !r.ok);
		if (anyFailed) {
			error = "Some stats failed to load.";
		}

		// Run language item unlock check on dashboard load (catches up on kanji progress)
		await checkAndUnlockItems();

		const lpResult = await getLevelProgress(userLevel);
		if (lpResult.ok) levelProgress = lpResult.data;
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to load dashboard";
		addToast(error, "error");
	} finally {
		loading = false;
		refreshing = false;
	}
}

function handleRefresh() {
	refreshing = true;
	loadDashboard();
}

$effect(() => {
	loadDashboard();
});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Dashboard</h2>
		<button
			type="button"
			class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			onclick={handleRefresh}
			disabled={refreshing}
			aria-label="Refresh dashboard"
		>
			<RefreshCw class={refreshing ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
		</button>
	</div>

	{#if loading}
		<!-- Skeleton loading cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}
				<div class="animate-pulse rounded-lg border bg-card p-4">
					<div class="h-4 w-20 rounded bg-muted"></div>
					<div class="mt-3 h-8 w-16 rounded bg-muted"></div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
			<p class="text-sm text-destructive">{error}</p>
			<Button variant="outline" class="mt-3" onclick={handleRefresh}>Retry</Button>
		</div>
	{:else if kanjiDueCount === 0 && kanjiLessonCount === 0 && langDueTotal === 0 && langNewTotal === 0 && langLessonCount === 0}
		<EmptyState
			title="Welcome to Janki!"
			description="Start with Kanji lessons or explore the Language section."
			actionLabel="Start Kanji"
			onaction={() => navigate("kanji-dashboard")}
			secondaryLabel="Language Overview"
			onsecondary={() => navigate("lang-overview")}
		/>
	{:else}
		<!-- Kanji Section -->
		<div class="space-y-3">
			<h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kanji</h3>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="rounded-lg border bg-card p-4" aria-label="Lessons available: {kanjiLessonCount}">
					<div class="text-sm text-muted-foreground">Lessons</div>
					<div class="mt-1 text-3xl font-bold text-pink-500">{kanjiLessonCount}</div>
				</div>
				<div class="rounded-lg border bg-card p-4" aria-label="Reviews due: {kanjiDueCount}">
					<div class="text-sm text-muted-foreground">Reviews Due</div>
					<div class="mt-1 text-3xl font-bold text-blue-500">{kanjiDueCount}</div>
				</div>
				<div class="rounded-lg border bg-card p-4" aria-label="Current level: {userLevel}">
					<div class="text-sm text-muted-foreground">Level</div>
					<div class="mt-1 text-3xl font-bold">{userLevel}</div>
				</div>
			</div>
			{#if levelProgress}
				<div class="rounded-lg border bg-card p-4">
					<div class="space-y-2">
					<div class="flex items-center justify-between text-sm">
						<span>Level {levelProgress.level}</span>
						<span class="text-muted-foreground">{levelProgress.guru_plus} / {levelProgress.total} at Guru+</span>
					</div>
					<div class="h-2 rounded-full bg-muted">
						<div
							class="h-full rounded-full bg-purple-500 transition-all"
							style="width: {levelProgress.percentage}%"
						></div>
					</div>
				</div>
				</div>
			{/if}
			<div class="flex gap-2">
				{#if kanjiLessonCount > 0}
					<Button size="sm" onclick={() => navigate("kanji-lessons")}>
						Start Lessons ({Math.min(kanjiLessonCount, 5)})
					</Button>
				{/if}
				{#if kanjiDueCount > 0}
					<Button size="sm" variant="outline" onclick={() => navigate("kanji-review")}>
						Start Reviews ({kanjiDueCount})
					</Button>
				{/if}
				<Button size="sm" variant="outline" onclick={() => navigate("kanji-dashboard")}>
					Kanji Overview
				</Button>
			</div>
		</div>

		<!-- Language Section -->
		<div class="space-y-3">
			<h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Language</h3>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="rounded-lg border bg-card p-4" aria-label="Language lessons: {langLessonCount}">
					<div class="text-sm text-muted-foreground">Lessons</div>
					<div class="mt-1 text-3xl font-bold text-violet-500">{langLessonCount}</div>
				</div>
				<div class="rounded-lg border bg-card p-4" aria-label="Language due: {langDueTotal}">
					<div class="text-sm text-muted-foreground">Reviews Due</div>
					<div class="mt-1 text-3xl font-bold text-blue-500">{langDueTotal}</div>
				</div>
				<div class="rounded-lg border bg-card p-4" aria-label="Content types: {contentCounts.length}">
					<div class="text-sm text-muted-foreground">Content Types</div>
					<div class="mt-1 text-3xl font-bold">{contentCounts.length}</div>
				</div>
			</div>
			{#if langSrsDistribution.length > 0}
				<div class="flex flex-wrap gap-2 text-xs">
					{#each langSrsDistribution as entry}
						<span class="rounded-full border bg-muted px-2.5 py-1">
							{STAGE_NAMES[entry.srs_stage] ?? `Stage ${entry.srs_stage}`}: {entry.count}
						</span>
					{/each}
				</div>
			{:else if contentCounts.length > 0}
				<div class="flex flex-wrap gap-2 text-xs">
					{#each contentCounts as ct}
						<span class="rounded-full border bg-muted px-2.5 py-1 capitalize">
							{ct.type}: {ct.total}
							{#if ct.due > 0}
								<span class="text-violet-500">({ct.due} due)</span>
							{/if}
						</span>
					{/each}
				</div>
			{/if}
			<div class="flex gap-2">
				{#if langLessonCount > 0}
					<Button size="sm" onclick={() => navigate("lang-lessons")}>
						Start Lessons ({Math.min(langLessonCount, 5)})
					</Button>
				{/if}
				{#if langDueTotal > 0}
					<Button size="sm" variant={langLessonCount > 0 ? "outline" : "default"} onclick={() => navigate("lang-review")}>
						Start Reviews ({langDueTotal})
					</Button>
				{/if}
				<Button size="sm" variant="outline" onclick={() => navigate("lang-overview")}>
					Language Overview
				</Button>
			</div>
		</div>

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
	{/if}
</div>
