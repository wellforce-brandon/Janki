<script lang="ts">
import BarChart from "$lib/components/stats/BarChart.svelte";
import LineChart from "$lib/components/stats/LineChart.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import { getUserLevel } from "$lib/db/queries/kanji";
import { getKanjiReviewStats, type KanjiReviewDayStats } from "$lib/db/queries/kanji-reviews";
import { getLanguageSrsDistribution } from "$lib/db/queries/language";
import {
	type ContentTypeStats,
	type DailyStats,
	type LanguageDayStats,
	getKanjiStageDistribution,
	getLanguageReviewStats,
	getStatsByContentType,
	getStatsRange,
	getStreak,
} from "$lib/db/queries/stats";

let stats = $state<DailyStats[]>([]);
let streak = $state(0);
let totalReviews = $state(0);
let totalCorrect = $state(0);
let avgTimeMs = $state(0);
let kanjiStages = $state<{ label: string; value: number; color: string }[]>([]);
let langStages = $state<{ label: string; value: number; color: string }[]>([]);
let contentTypeStats = $state<ContentTypeStats[]>([]);
let kanjiStats = $state<KanjiReviewDayStats[]>([]);
let langStats = $state<LanguageDayStats[]>([]);
let kanjiLevel = $state(1);
let loading = $state(true);

let dateRange = $state(30);

const DATE_RANGES = [
	{ label: "7d", value: 7 },
	{ label: "30d", value: 30 },
	{ label: "90d", value: 90 },
	{ label: "All", value: 3650 },
] as const;

const stageLabels: Record<number, string> = {
	1: "App 1",
	2: "App 2",
	3: "App 3",
	4: "App 4",
	5: "Guru 1",
	6: "Guru 2",
	7: "Master",
	8: "Enlight",
	9: "Burned",
};
const stageColors: Record<number, string> = {
	1: "#ec4899",
	2: "#ec4899",
	3: "#ec4899",
	4: "#ec4899",
	5: "#a855f7",
	6: "#a855f7",
	7: "#3b82f6",
	8: "#0ea5e9",
	9: "#f59e0b",
};

const contentTypeColors: Record<string, string> = {
	kana: "#14b8a6",
	vocabulary: "#a855f7",
	grammar: "#f59e0b",
	sentence: "#3b82f6",
	conjugation: "#f43f5e",
};

async function loadStats() {
	loading = true;

	const [
		rangeResult,
		streakResult,
		kanjiStageResult,
		kanjiStatsR,
		kanjiLevelR,
		contentTypeResult,
		langStatsR,
		langSrsR,
	] = await Promise.all([
		getStatsRange(dateRange),
		getStreak(),
		getKanjiStageDistribution(),
		getKanjiReviewStats(dateRange),
		getUserLevel(),
		getStatsByContentType(dateRange),
		getLanguageReviewStats(dateRange),
		getLanguageSrsDistribution(),
	]);

	if (rangeResult.ok) stats = rangeResult.data;
	if (streakResult.ok) streak = streakResult.data;

	totalReviews = stats.reduce((s, d) => s + d.reviews_count, 0);
	totalCorrect = stats.reduce((s, d) => s + d.correct_count, 0);
	const totalTime = stats.reduce((s, d) => s + d.time_spent_ms, 0);
	avgTimeMs = totalReviews > 0 ? totalTime / totalReviews : 0;

	if (kanjiStatsR.ok) kanjiStats = kanjiStatsR.data;
	if (kanjiLevelR.ok) kanjiLevel = kanjiLevelR.data;
	if (langStatsR.ok) langStats = langStatsR.data;

	if (kanjiStageResult.ok) {
		kanjiStages = kanjiStageResult.data.map((r) => ({
			label: stageLabels[r.srs_stage] ?? `S${r.srs_stage}`,
			value: r.count,
			color: stageColors[r.srs_stage] ?? "#888",
		}));
	}

	if (langSrsR.ok) {
		langStages = langSrsR.data.map((r) => ({
			label: stageLabels[r.srs_stage] ?? `S${r.srs_stage}`,
			value: r.count,
			color: stageColors[r.srs_stage] ?? "#888",
		}));
	}

	if (contentTypeResult.ok) {
		contentTypeStats = contentTypeResult.data;
	}

	loading = false;
}

// Combined daily reviews data (general daily_stats)
let reviewsData = $derived(stats.map((d) => ({ label: d.date, value: d.reviews_count })));
let accuracyData = $derived(
	stats.map((d) => ({
		label: d.date,
		value: d.reviews_count > 0 ? Math.round((d.correct_count / d.reviews_count) * 100) : 0,
	})),
);
let timeData = $derived(
	stats.map((d) => ({ label: d.date, value: Math.round(d.time_spent_ms / 60000) })),
);
let accuracy = $derived(totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0);

// Language review charts
let langReviewsData = $derived(langStats.map((d) => ({ label: d.date, value: d.total })));
let langAccuracyData = $derived(
	langStats.map((d) => ({
		label: d.date,
		value: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
	})),
);
let langTotalReviews = $derived(langStats.reduce((s, d) => s + d.total, 0));
let langTotalCorrect = $derived(langStats.reduce((s, d) => s + d.correct, 0));
let langAccuracy = $derived(langTotalReviews > 0 ? Math.round((langTotalCorrect / langTotalReviews) * 100) : 0);

// Kanji review charts
let kanjiReviewsData = $derived(kanjiStats.map((d) => ({ label: d.date, value: d.total })));
let kanjiAccuracyData = $derived(
	kanjiStats.map((d) => ({
		label: d.date,
		value: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
	})),
);

// Combined heatmap: merge kanji + language daily reviews into one grid
let heatmapData = $derived.by(() => {
	const map = new Map<string, { kanji: number; language: number }>();
	for (const d of kanjiStats) {
		const entry = map.get(d.date) ?? { kanji: 0, language: 0 };
		entry.kanji = d.total;
		map.set(d.date, entry);
	}
	for (const d of langStats) {
		const entry = map.get(d.date) ?? { kanji: 0, language: 0 };
		entry.language = d.total;
		map.set(d.date, entry);
	}
	return Array.from(map.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, counts]) => ({ date, total: counts.kanji + counts.language, kanji: counts.kanji, language: counts.language }));
});

let heatmapMax = $derived(Math.max(1, ...heatmapData.map((d) => d.total)));

function heatColor(value: number, max: number): string {
	if (value === 0) return "var(--color-muted, #e5e7eb)";
	const intensity = Math.min(value / max, 1);
	if (intensity < 0.25) return "#c4b5fd";
	if (intensity < 0.5) return "#a78bfa";
	if (intensity < 0.75) return "#8b5cf6";
	return "#7c3aed";
}

function changeDateRange(value: number) {
	dateRange = value;
	loadStats();
}

$effect(() => {
	loadStats();
});
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Statistics</h2>
		<div class="flex items-center gap-3">
			<div class="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
				{#each DATE_RANGES as range}
					<button
						type="button"
						class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {dateRange === range.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
						onclick={() => changeDateRange(range.value)}
					>
						{range.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	{#if loading}
		<SkeletonCards count={4} columns={4} />
	{:else}
		<!-- Summary cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-lg border bg-card p-4">
				<div class="text-sm text-muted-foreground">Total Reviews ({dateRange < 3650 ? `${dateRange}d` : 'all'})</div>
				<div class="mt-1 text-3xl font-bold">{totalReviews}</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-sm text-muted-foreground">Accuracy</div>
				<div class="mt-1 text-3xl font-bold">{accuracy}%</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-sm text-muted-foreground">Streak</div>
				<div class="mt-1 text-3xl font-bold">{streak} days</div>
			</div>
			<div class="rounded-lg border bg-card p-4">
				<div class="text-sm text-muted-foreground">Avg Time/Card</div>
				<div class="mt-1 text-3xl font-bold">{(avgTimeMs / 1000).toFixed(1)}s</div>
			</div>
		</div>

		<!-- Combined Review Heatmap -->
		{#if heatmapData.length > 0}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-3 font-medium">Review Activity</h3>
				<div class="flex flex-wrap gap-1">
					{#each heatmapData as day}
						<div
							class="h-4 w-4 rounded-sm"
							style="background: {heatColor(day.total, heatmapMax)}"
							title="{day.date}: {day.total} reviews ({day.kanji} kanji, {day.language} language)"
						></div>
					{/each}
				</div>
				<div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
					<span>Less</span>
					<div class="h-3 w-3 rounded-sm" style="background: var(--color-muted, #e5e7eb)"></div>
					<div class="h-3 w-3 rounded-sm" style="background: #c4b5fd"></div>
					<div class="h-3 w-3 rounded-sm" style="background: #a78bfa"></div>
					<div class="h-3 w-3 rounded-sm" style="background: #8b5cf6"></div>
					<div class="h-3 w-3 rounded-sm" style="background: #7c3aed"></div>
					<span>More</span>
				</div>
			</div>
		{/if}

		<!-- General Charts -->
		{#if stats.length > 0}
			<div class="grid gap-6 lg:grid-cols-2">
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Reviews per Day</h3>
					<BarChart data={reviewsData} color="#8b5cf6" />
				</div>
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Accuracy Trend</h3>
					<LineChart data={accuracyData} color="#22c55e" maxY={100} yLabel="%" />
				</div>
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Time Spent (minutes)</h3>
					<BarChart data={timeData} color="#0ea5e9" />
				</div>
			</div>
		{:else}
			<EmptyState
				title="No review data yet"
				description="Start reviewing cards to see your statistics here."
			/>
		{/if}

		<!-- SRS Distributions -->
		<div class="grid gap-6 lg:grid-cols-2">
			{#if kanjiStages.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Kanji SRS Stages</h3>
					<div class="flex flex-wrap gap-3">
						{#each kanjiStages as ks}
							<div class="flex items-center gap-1.5">
								<!-- Dynamic hex colors require inline style -->
								<div class="h-3 w-3 rounded-full" style="background: {ks.color}"></div>
								<span class="text-sm">{ks.label}: {ks.value}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			{#if langStages.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Language SRS Stages</h3>
					<div class="flex flex-wrap gap-3">
						{#each langStages as ls}
							<div class="flex items-center gap-1.5">
								<!-- Dynamic hex colors require inline style -->
								<div class="h-3 w-3 rounded-full" style="background: {ls.color}"></div>
								<span class="text-sm">{ls.label}: {ls.value}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Content Type Breakdown -->
		{#if contentTypeStats.length > 0}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-3 font-medium">Reviews by Content Type ({dateRange < 3650 ? `${dateRange}d` : 'all'})</h3>
				<div class="space-y-3">
					{#each contentTypeStats as ct}
						{@const ctAccuracy = ct.reviews_count > 0 ? Math.round((ct.correct_count / ct.reviews_count) * 100) : 0}
						{@const barWidth = langTotalReviews > 0 ? Math.max(2, (ct.reviews_count / langTotalReviews) * 100) : 0}
						<div class="space-y-1">
							<div class="flex items-center justify-between text-sm">
								<span class="capitalize font-medium">{ct.content_type}</span>
								<span class="text-muted-foreground">
									{ct.reviews_count} reviews, {ctAccuracy}% accuracy
								</span>
							</div>
							<div class="h-2 w-full rounded-full bg-muted">
								<div
									class="h-full rounded-full transition-all"
									style="width: {barWidth}%; background: {contentTypeColors[ct.content_type] ?? '#888'}"
								></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Language Review Charts -->
		{#if langStats.length > 0}
			<div class="space-y-4">
				<div class="flex items-baseline gap-3">
					<h3 class="text-lg font-semibold">Language Reviews</h3>
					<span class="text-sm text-muted-foreground">{langTotalReviews} total, {langAccuracy}% accuracy</span>
				</div>
				<div class="grid gap-6 lg:grid-cols-2">
					<div class="rounded-lg border bg-card p-4">
						<h3 class="mb-3 font-medium">Language Reviews per Day</h3>
						<BarChart data={langReviewsData} color="#a855f7" />
					</div>
					<div class="rounded-lg border bg-card p-4">
						<h3 class="mb-3 font-medium">Language Accuracy Trend</h3>
						<LineChart data={langAccuracyData} color="#22c55e" maxY={100} yLabel="%" />
					</div>
				</div>
			</div>
		{/if}

		<!-- Kanji Review Charts -->
		{#if kanjiStats.length > 0}
			<h3 class="mt-2 text-lg font-semibold">Kanji Reviews <span class="text-sm font-normal text-muted-foreground">(Level {kanjiLevel})</span></h3>
			<div class="grid gap-6 lg:grid-cols-2">
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Kanji Reviews per Day</h3>
					<BarChart data={kanjiReviewsData} color="#ec4899" />
				</div>
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Kanji Accuracy Trend</h3>
					<LineChart data={kanjiAccuracyData} color="#a855f7" maxY={100} yLabel="%" />
				</div>
			</div>
		{/if}
	{/if}
</div>
