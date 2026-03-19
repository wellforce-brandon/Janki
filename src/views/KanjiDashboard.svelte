<script lang="ts">
import { RefreshCw } from "@lucide/svelte";
import LevelProgressBar from "$lib/components/kanji/LevelProgress.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getAvailableLessonCount,
	getCriticalItems,
	getDueKanjiCount,
	getLevelProgress,
	getRecentlyUnlocked,
	getSrsDistribution,
	getUpcomingReviews,
	getUserLevel,
	initializeKanjiProgression,
	isKanjiSeeded,
	type KanjiLevelItem,
	type LevelProgress,
} from "$lib/db/queries/kanji";
import { getRecentMistakes, getTodayKanjiReviewCount } from "$lib/db/queries/kanji-reviews";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { getTypeColor, parseMeanings } from "$lib/utils/kanji";

let loading = $state(true);
let refreshing = $state(false);
let seeded = $state(false);

// Core counts
let lessonCount = $state(0);
let reviewCount = $state(0);
let todayReviewCount = $state(0);
let userLevel = $state(1);
let levelProgress = $state<LevelProgress | null>(null);

// Forecast
let forecast = $state<{ hour: string; count: number }[]>([]);
let forecastTotal = $derived(forecast.reduce((sum, f) => sum + f.count, 0));

// SRS distribution
let srsDistribution = $state<{ item_type: string; srs_stage: number; count: number }[]>([]);

// History widgets
let recentlyUnlocked = $state<KanjiLevelItem[]>([]);
let criticalItems = $state<KanjiLevelItem[]>([]);
let recentMistakes = $state<
	{ character: string; meanings: string; item_type: string; reviewed_at: string }[]
>([]);

async function loadDashboard() {
	try {
		const seededR = await isKanjiSeeded();
		seeded = seededR.ok && seededR.data;
		if (!seeded) {
			loading = false;
			return;
		}

		const [lessonR, reviewR, todayR, levelR, forecastR, srsR, unlockedR, criticalR, mistakesR] =
			await Promise.all([
				getAvailableLessonCount(),
				getDueKanjiCount(),
				getTodayKanjiReviewCount(),
				getUserLevel(),
				getUpcomingReviews(24),
				getSrsDistribution(),
				getRecentlyUnlocked(10),
				getCriticalItems(0.7, 10),
				getRecentMistakes(10),
			]);

		if (lessonR.ok) lessonCount = lessonR.data;
		if (reviewR.ok) reviewCount = reviewR.data;
		if (todayR.ok) todayReviewCount = todayR.data;
		if (levelR.ok) userLevel = levelR.data;
		if (forecastR.ok) forecast = forecastR.data;
		if (srsR.ok) srsDistribution = srsR.data;
		if (unlockedR.ok) recentlyUnlocked = unlockedR.data;
		if (criticalR.ok) criticalItems = criticalR.data;
		if (mistakesR.ok) recentMistakes = mistakesR.data;

		const lpR = await getLevelProgress(userLevel);
		if (lpR.ok) levelProgress = lpR.data;
	} catch (e) {
		addToast("Failed to load kanji dashboard", "error");
	} finally {
		loading = false;
		refreshing = false;
	}
}

async function handleStartLearning() {
	const result = await initializeKanjiProgression();
	if (result.ok && result.data.length > 0) {
		addToast(
			`Unlocked ${result.data.length} level 1 radical${result.data.length > 1 ? "s" : ""}!`,
			"success",
		);
		await loadDashboard();
	} else if (result.ok) {
		addToast("Kanji progression already started", "info");
		await loadDashboard();
	} else {
		addToast("Failed to initialize kanji progression", "error");
	}
}

function handleRefresh() {
	refreshing = true;
	loadDashboard();
}

// Build SRS spread table data
interface SrsSpreadRow {
	category: string;
	stages: number[];
	radical: number;
	kanji: number;
	vocab: number;
	total: number;
}

let srsSpread = $derived.by((): SrsSpreadRow[] => {
	const categories = [
		{ category: "Apprentice", stages: [1, 2, 3, 4] },
		{ category: "Guru", stages: [5, 6] },
		{ category: "Master", stages: [7] },
		{ category: "Enlightened", stages: [8] },
		{ category: "Burned", stages: [9] },
	];
	return categories.map(({ category, stages }) => {
		let radical = 0;
		let kanji = 0;
		let vocab = 0;
		for (const d of srsDistribution) {
			if (stages.includes(d.srs_stage)) {
				if (d.item_type === "radical") radical += d.count;
				else if (d.item_type === "kanji") kanji += d.count;
				else if (d.item_type === "vocab") vocab += d.count;
			}
		}
		return { category, stages, radical, kanji, vocab, total: radical + kanji + vocab };
	});
});

function getCategoryColor(category: string): string {
	switch (category) {
		case "Apprentice":
			return "text-pink-500 dark:text-pink-400";
		case "Guru":
			return "text-purple-500 dark:text-purple-400";
		case "Master":
			return "text-blue-500 dark:text-blue-400";
		case "Enlightened":
			return "text-sky-500 dark:text-sky-400";
		case "Burned":
			return "text-amber-500 dark:text-amber-400";
		default:
			return "";
	}
}

$effect(() => {
	loadDashboard();
});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Kanji Overview</h2>
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
		<LoadingState message="Loading kanji dashboard..." />
	{:else if !seeded}
		<EmptyState
			title="Kanji data not loaded"
			description="Import kanji data first by seeding the database, then come back to start learning."
			actionLabel="Back to Dashboard"
			onaction={() => navigate("dashboard")}
		/>
	{:else if lessonCount === 0 && reviewCount === 0 && srsSpread.every((r) => r.total === 0)}
		<!-- New user: no progression started -->
		<EmptyState
			title="Start Learning Kanji"
			description="Begin your kanji journey by unlocking Level 1 radicals. Learn them in lessons, then review to unlock kanji and vocabulary."
			actionLabel="Start Learning"
			onaction={handleStartLearning}
			secondaryLabel="Kanji Map"
			onsecondary={() => navigate("kanji-radicals")}
		/>
	{:else}
		<!-- Row 1: Core Actions -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Lessons widget -->
			<div class="rounded-lg border bg-card p-5">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-muted-foreground">Lessons</h3>
					<span class="text-2xl font-bold text-pink-500">{lessonCount}</span>
				</div>
				<div class="mt-4">
					{#if lessonCount > 0}
						<Button class="w-full" onclick={() => navigate("kanji-lessons")}>
							Start Lessons ({Math.min(lessonCount, 5)})
						</Button>
					{:else}
						<button
							type="button"
							class="mt-2 text-xs text-muted-foreground hover:text-foreground"
							onclick={() => navigate("kanji-lesson-picker")}
						>
							Advanced picker
						</button>
						<p class="text-sm text-muted-foreground">No lessons available</p>
					{/if}
				</div>
			</div>

			<!-- Reviews widget -->
			<div class="rounded-lg border bg-card p-5">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-muted-foreground">Reviews</h3>
					<span class="text-2xl font-bold text-blue-500">{reviewCount}</span>
				</div>
				{#if todayReviewCount > 0}
					<p class="mt-1 text-xs text-muted-foreground">{todayReviewCount} completed today</p>
				{/if}
				<div class="mt-4">
					{#if reviewCount > 0}
						<Button class="w-full" onclick={() => navigate("kanji-review")}>
							Start Reviews
						</Button>
					{:else}
						<p class="text-sm text-muted-foreground">No reviews due</p>
					{/if}
					<button
						type="button"
						class="mt-2 text-xs text-muted-foreground hover:text-foreground"
						onclick={() => navigate("kanji-extra-study")}
					>
						Extra study
					</button>
				</div>
			</div>

			<!-- Forecast widget -->
			<div class="rounded-lg border bg-card p-5 sm:col-span-2 lg:col-span-1">
				<h3 class="text-sm font-medium text-muted-foreground">Next 24 Hours</h3>
				<div class="mt-1 text-2xl font-bold">+{forecastTotal}</div>
				{#if forecast.length > 0}
					{@const maxCount = Math.max(...forecast.map((f) => f.count), 1)}
					<div class="mt-3 flex items-end gap-0.5" style="height: 48px">
						{#each forecast as bucket}
							<div
								class="flex-1 rounded-t bg-blue-500/60 dark:bg-blue-400/60 transition-all"
								style="height: {Math.max((bucket.count / maxCount) * 100, 8)}%"
								title="{bucket.hour}: {bucket.count} review{bucket.count > 1 ? 's' : ''}"
							></div>
						{/each}
					</div>
				{:else}
					<p class="mt-3 text-sm text-muted-foreground">No upcoming reviews</p>
				{/if}
			</div>
		</div>

		<!-- Row 2: Progress -->
		<div class="grid gap-4 lg:grid-cols-2">
			<!-- Level Progress -->
			<div class="rounded-lg border bg-card p-5">
				<h3 class="mb-3 font-medium">Level {userLevel} Progress</h3>
				{#if levelProgress}
					<LevelProgressBar progress={levelProgress} />
					{@const kanjiNeeded = Math.ceil(levelProgress.total * 0.9) - levelProgress.guru_plus}
					{#if kanjiNeeded > 0}
						<p class="mt-3 text-sm text-muted-foreground">
							Guru {kanjiNeeded} more kanji to level up
						</p>
					{/if}
				{/if}
				<div class="mt-3 flex gap-2">
					<Button size="sm" variant="outline" onclick={() => navigate("kanji-radicals")}>
						Radicals
					</Button>
					<Button size="sm" variant="outline" onclick={() => navigate("kanji-kanji")}>
						Kanji
					</Button>
					<Button size="sm" variant="outline" onclick={() => navigate("kanji-vocabulary")}>
						Vocabulary
					</Button>
				</div>
			</div>

			<!-- Item Spread -->
			<div class="rounded-lg border bg-card p-5">
				<h3 class="mb-3 font-medium">Item Spread</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b text-left text-xs text-muted-foreground">
								<th class="pb-2 pr-4">Stage</th>
								<th class="pb-2 pr-3 text-right">Rad</th>
								<th class="pb-2 pr-3 text-right">Kan</th>
								<th class="pb-2 pr-3 text-right">Voc</th>
								<th class="pb-2 text-right">Total</th>
							</tr>
						</thead>
						<tbody>
							{#each srsSpread as row}
								<tr class="border-b last:border-0">
									<td class="py-1.5 pr-4 font-medium {getCategoryColor(row.category)}">
										{row.category}
									</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{row.radical || "-"}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{row.kanji || "-"}</td>
									<td class="py-1.5 pr-3 text-right tabular-nums">{row.vocab || "-"}</td>
									<td class="py-1.5 text-right font-medium tabular-nums">{row.total || "-"}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Row 3: History -->
		<div class="grid gap-4 lg:grid-cols-3">
			<!-- Recently Unlocked -->
			<div class="rounded-lg border bg-card p-5">
				<h3 class="mb-3 text-sm font-medium text-muted-foreground">Recently Unlocked</h3>
				{#if recentlyUnlocked.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each recentlyUnlocked as item}
							<span
								class="inline-flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-white {getTypeColor(item.item_type)}"
								title="{parseMeanings(item.meanings).join(', ')} - {STAGE_NAMES[item.srs_stage]}"
							>
								{item.character}
							</span>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">No recently unlocked items</p>
				{/if}
			</div>

			<!-- Critical Items -->
			<div class="rounded-lg border bg-card p-5">
				<h3 class="mb-3 text-sm font-medium text-muted-foreground">Critical Condition</h3>
				{#if criticalItems.length > 0}
					<div class="space-y-1.5">
						{#each criticalItems.slice(0, 6) as item}
							{@const accuracy = item.correct_count + item.incorrect_count > 0
								? Math.round((item.correct_count / (item.correct_count + item.incorrect_count)) * 100)
								: 0}
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-center gap-2">
									<span class="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white {getTypeColor(item.item_type)}">
										{item.character}
									</span>
									<span class="truncate">{parseMeanings(item.meanings).join(", ")}</span>
								</div>
								<span class="text-xs text-destructive font-medium">{accuracy}%</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">No critical items</p>
				{/if}
			</div>

			<!-- Recent Mistakes -->
			<div class="rounded-lg border bg-card p-5">
				<h3 class="mb-3 text-sm font-medium text-muted-foreground">Recent Mistakes</h3>
				{#if recentMistakes.length > 0}
					<div class="space-y-1.5">
						{#each recentMistakes.slice(0, 6) as mistake}
							<div class="flex items-center gap-2 text-sm">
								<span class="inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white {getTypeColor(mistake.item_type)}">
									{mistake.character}
								</span>
								<span class="truncate">{parseMeanings(mistake.meanings).join(", ")}</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">No recent mistakes</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
