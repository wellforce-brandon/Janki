<script lang="ts">
import { RefreshCw } from "@lucide/svelte";
import LanguageLevelProgressWidget from "$lib/components/language/LanguageLevelProgressWidget.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	getAvailableLessonCount,
	getContentTypeCounts,
	getCriticalLanguageItems,
	getDueLanguageCount,
	getLanguageSrsSummary,
	getLanguageUserLevel,
	getRecentLanguageMistakes,
	getRecentlyUnlockedItems,
	getTodayLanguageReviewCount,
	getUpcomingLanguageReviews,
	type ContentTypeCount,
	type CriticalLanguageItem,
	type LanguageItem,
	type LanguageSrsSummary,
	type RecentLanguageMistake,
} from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let refreshing = $state(false);

let lessonCount = $state(0);
let reviewCount = $state(0);
let todayReviewCount = $state(0);
let userLevel = $state(1);
let totalItems = $state(0);

let forecast = $state<{ hour: string; count: number }[]>([]);
let forecastTotal = $derived(forecast.reduce((sum, f) => sum + f.count, 0));

let srsDistribution = $state<LanguageSrsSummary[]>([]);

let recentlyUnlocked = $state<LanguageItem[]>([]);
let criticalItems = $state<CriticalLanguageItem[]>([]);
let recentMistakes = $state<RecentLanguageMistake[]>([]);

let fetchId = 0;

function getTypeColor(type: string): string {
	const colors: Record<string, string> = {
		kana: "bg-teal-500 dark:bg-teal-600",
		vocabulary: "bg-purple-500 dark:bg-purple-600",
		grammar: "bg-amber-500 dark:bg-amber-600",
		sentence: "bg-blue-500 dark:bg-blue-600",
		conjugation: "bg-rose-500 dark:bg-rose-600",
	};
	return colors[type] ?? "bg-gray-500";
}

async function loadDashboard() {
	const myId = ++fetchId;
	try {
		const [countR, lessonR, dueR, todayR, levelR, forecastR, srsR, unlockedR, criticalR, mistakesR] =
			await Promise.all([
				getContentTypeCounts(),
				getAvailableLessonCount(),
				getDueLanguageCount(),
				getTodayLanguageReviewCount(),
				getLanguageUserLevel(),
				getUpcomingLanguageReviews(24),
				getLanguageSrsSummary(),
				getRecentlyUnlockedItems(10),
				getCriticalLanguageItems(0.7, 10),
				getRecentLanguageMistakes(10),
			]);

		if (myId !== fetchId) return;
		if (countR.ok) totalItems = countR.data.reduce((sum: number, c: ContentTypeCount) => sum + c.total, 0);
		if (lessonR.ok) lessonCount = lessonR.data;
		if (dueR.ok) reviewCount = dueR.data;
		if (todayR.ok) todayReviewCount = todayR.data;
		if (levelR.ok) userLevel = levelR.data;
		if (forecastR.ok) forecast = forecastR.data;
		if (srsR.ok) srsDistribution = srsR.data;
		if (unlockedR.ok) recentlyUnlocked = unlockedR.data;
		if (criticalR.ok) criticalItems = criticalR.data;
		if (mistakesR.ok) recentMistakes = mistakesR.data;
	} catch {
		addToast("Failed to load language overview", "error");
	} finally {
		loading = false;
		refreshing = false;
	}
}

function handleRefresh() {
	refreshing = true;
	loadDashboard();
}

// Build SRS spread table
interface SrsSpreadRow {
	category: string;
	stages: number[];
	kana: number;
	grammar: number;
	vocabulary: number;
	conjugation: number;
	sentence: number;
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
		let kana = 0, grammar = 0, vocabulary = 0, conjugation = 0, sentence = 0;
		for (const d of srsDistribution) {
			if (stages.includes(d.srs_stage)) {
				if (d.content_type === "kana") kana += d.count;
				else if (d.content_type === "grammar") grammar += d.count;
				else if (d.content_type === "vocabulary") vocabulary += d.count;
				else if (d.content_type === "conjugation") conjugation += d.count;
				else if (d.content_type === "sentence") sentence += d.count;
			}
		}
		return { category, stages, kana, grammar, vocabulary, conjugation, sentence, total: kana + grammar + vocabulary + conjugation + sentence };
	});
});

$effect(() => {
	loadDashboard();
});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Language Overview</h2>
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
		<SkeletonCards count={6} columns={3} />
	{:else if totalItems === 0}
		<EmptyState
			title="No language content yet"
			description="Language data is loading. Try refreshing the page."
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
						<Button class="w-full" onclick={() => navigate("lang-lessons")}>
							Start Lessons ({Math.min(lessonCount, 5)})
						</Button>
					{:else}
						<p class="text-sm text-muted-foreground">No lessons available</p>
					{/if}
					<button
						type="button"
						class="mt-2 text-xs text-muted-foreground hover:text-foreground"
						onclick={() => navigate("lang-lesson-picker")}
					>
						Advanced picker
					</button>
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
						<Button class="w-full" onclick={() => navigate("lang-review")}>
							Start Reviews
						</Button>
					{:else}
						<p class="text-sm text-muted-foreground">No reviews due</p>
					{/if}
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
			<LanguageLevelProgressWidget {userLevel} />

			<!-- Item Spread -->
			<div class="rounded-lg border bg-card p-5">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="font-medium">Item Spread</h3>
					<div class="flex flex-wrap items-center gap-3 text-xs">
						<span class="flex items-center gap-1.5">
							<span class="inline-block h-3 w-3 rounded-sm bg-teal-500 dark:bg-teal-600"></span>
							Kana
						</span>
						<span class="flex items-center gap-1.5">
							<span class="inline-block h-3 w-3 rounded-sm bg-amber-500 dark:bg-amber-600"></span>
							Grammar
						</span>
						<span class="flex items-center gap-1.5">
							<span class="inline-block h-3 w-3 rounded-sm bg-purple-500 dark:bg-purple-600"></span>
							Vocab
						</span>
						<span class="flex items-center gap-1.5">
							<span class="inline-block h-3 w-3 rounded-sm bg-rose-500 dark:bg-rose-600"></span>
							Conj
						</span>
						<span class="flex items-center gap-1.5">
							<span class="inline-block h-3 w-3 rounded-sm bg-blue-500 dark:bg-blue-600"></span>
							Sent
						</span>
					</div>
				</div>
				<div class="space-y-1.5">
					{#each srsSpread as row}
						<div class="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
							<span class="flex-1 text-sm font-medium">{row.category}</span>
							<span class="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-teal-500 px-2 py-0.5 text-xs font-bold text-white dark:bg-teal-600">
								{row.kana}
							</span>
							<span class="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white dark:bg-amber-600">
								{row.grammar}
							</span>
							<span class="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-purple-500 px-2 py-0.5 text-xs font-bold text-white dark:bg-purple-600">
								{row.vocabulary}
							</span>
							<span class="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white dark:bg-rose-600">
								{row.conjugation}
							</span>
							<span class="inline-flex min-w-[2.25rem] items-center justify-center rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white dark:bg-blue-600">
								{row.sentence}
							</span>
							<span class="min-w-[2rem] text-right text-sm font-medium tabular-nums text-muted-foreground">
								{row.total}
							</span>
						</div>
					{/each}
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
							<button
								type="button"
								class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded px-1.5 text-sm font-bold text-white transition-all hover:brightness-110 {getTypeColor(item.content_type)}"
								title="{item.meaning ?? ''} - {STAGE_NAMES[item.srs_stage]}"
								onclick={() => navigate("lang-item-detail", { id: String(item.id), contentType: item.content_type })}
							>
								{item.primary_text}
							</button>
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
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-center gap-2 min-w-0">
									<span class="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded px-1 text-xs font-bold text-white {getTypeColor(item.content_type)}">
										{item.primary_text.slice(0, 3)}
									</span>
									<span class="truncate">{item.meaning ?? ""}</span>
								</div>
								<span class="text-xs text-destructive font-medium shrink-0 ml-2">{item.accuracy}%</span>
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
								<span class="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded px-1 text-xs font-bold text-white {getTypeColor(mistake.content_type)}">
									{mistake.primary_text.slice(0, 3)}
								</span>
								<span class="truncate">{mistake.meaning ?? ""}</span>
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
