<script lang="ts">
import BarChart from "$lib/components/stats/BarChart.svelte";
import LineChart from "$lib/components/stats/LineChart.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { type DeckWithCounts, getAllDecks } from "$lib/db/queries/decks";
import { getUserLevel } from "$lib/db/queries/kanji";
import { getKanjiReviewStats, type KanjiReviewDayStats } from "$lib/db/queries/kanji-reviews";
import {
	type ContentTypeStats,
	type DailyStats,
	getBuiltinStateDistribution,
	getCardStateDistribution,
	getKanjiStageDistribution,
	getStatsByContentType,
	getStatsByDeck,
	getStatsRange,
	getStreak,
} from "$lib/db/queries/stats";

let stats = $state<DailyStats[]>([]);
let streak = $state(0);
let totalReviews = $state(0);
let totalCorrect = $state(0);
let avgTimeMs = $state(0);
let cardStates = $state<{ label: string; value: number; color: string }[]>([]);
let kanjiStages = $state<{ label: string; value: number; color: string }[]>([]);
let builtinStates = $state<{ label: string; value: number; color: string }[]>([]);
let contentTypeStats = $state<ContentTypeStats[]>([]);
let kanjiStats = $state<KanjiReviewDayStats[]>([]);
let kanjiLevel = $state(1);
let loading = $state(true);

let dateRange = $state(30);
let decks = $state<DeckWithCounts[]>([]);
let selectedDeckId = $state<number | null>(null);

const DATE_RANGES = [
	{ label: "7d", value: 7 },
	{ label: "30d", value: 30 },
	{ label: "90d", value: 90 },
	{ label: "All", value: 3650 },
] as const;

const stateLabels = ["New", "Learning", "Review", "Relearning"];
const stateColors = ["#3b82f6", "#f97316", "#22c55e", "#ef4444"];
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

async function loadStats() {
	loading = true;

	const [
		rangeResult,
		streakResult,
		stateResult,
		kanjiResult,
		decksResult,
		kanjiStatsR,
		kanjiLevelR,
		builtinStateResult,
		contentTypeResult,
	] = await Promise.all([
		selectedDeckId ? getStatsByDeck(selectedDeckId, dateRange) : getStatsRange(dateRange),
		getStreak(),
		getCardStateDistribution(),
		getKanjiStageDistribution(),
		getAllDecks(),
		getKanjiReviewStats(dateRange),
		getUserLevel(),
		getBuiltinStateDistribution(),
		getStatsByContentType(dateRange),
	]);

	if (rangeResult.ok) stats = rangeResult.data;
	if (streakResult.ok) streak = streakResult.data;
	if (decksResult.ok) decks = decksResult.data;

	totalReviews = stats.reduce((s, d) => s + d.reviews_count, 0);
	totalCorrect = stats.reduce((s, d) => s + d.correct_count, 0);
	const totalTime = stats.reduce((s, d) => s + d.time_spent_ms, 0);
	avgTimeMs = totalReviews > 0 ? totalTime / totalReviews : 0;

	if (kanjiStatsR.ok) kanjiStats = kanjiStatsR.data;
	if (kanjiLevelR.ok) kanjiLevel = kanjiLevelR.data;

	if (stateResult.ok) {
		cardStates = stateResult.data.map((r) => ({
			label: stateLabels[r.state] ?? "Unknown",
			value: r.count,
			color: stateColors[r.state] ?? "#888",
		}));
	}

	if (kanjiResult.ok) {
		kanjiStages = kanjiResult.data.map((r) => ({
			label: stageLabels[r.srs_stage] ?? `S${r.srs_stage}`,
			value: r.count,
			color: stageColors[r.srs_stage] ?? "#888",
		}));
	}

	if (builtinStateResult.ok) {
		builtinStates = builtinStateResult.data.map((r) => ({
			label: stateLabels[r.state] ?? "Unknown",
			value: r.count,
			color: stateColors[r.state] ?? "#888",
		}));
	}

	if (contentTypeResult.ok) {
		contentTypeStats = contentTypeResult.data;
	}

	loading = false;
}

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

let kanjiReviewsData = $derived(kanjiStats.map((d) => ({ label: d.date, value: d.total })));
let kanjiAccuracyData = $derived(
	kanjiStats.map((d) => ({
		label: d.date,
		value: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
	})),
);

function changeDateRange(value: number) {
	dateRange = value;
	loadStats();
}

function changeDeckFilter(e: Event) {
	const val = (e.target as HTMLSelectElement).value;
	selectedDeckId = val === "" ? null : Number(val);
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
			<!-- Per-deck filter -->
			<select
				class="rounded border bg-background px-2 py-1 text-sm"
				onchange={changeDeckFilter}
			>
				<option value="">All Decks</option>
				{#each decks as deck}
					<option value={deck.id}>{deck.name}</option>
				{/each}
			</select>

			<!-- Date range selector -->
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
		<LoadingState message="Loading statistics..." />
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

		<!-- Charts -->
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

		<!-- Distributions -->
		<div class="grid gap-6 lg:grid-cols-2">
			{#if cardStates.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Card States</h3>
					<div class="flex gap-4">
						{#each cardStates as cs}
							<div class="flex items-center gap-2">
								<!-- Dynamic hex colors require inline style -->
							<div class="h-3 w-3 rounded-full" style="background: {cs.color}"></div>
								<span class="text-sm">{cs.label}: {cs.value}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
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
		</div>

		<!-- Builtin Items & Content Type Breakdown -->
		<div class="grid gap-6 lg:grid-cols-2">
			{#if builtinStates.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Builtin Item States</h3>
					<div class="flex gap-4">
						{#each builtinStates as bs}
							<div class="flex items-center gap-2">
								<div class="h-3 w-3 rounded-full" style="background: {bs.color}"></div>
								<span class="text-sm">{bs.label}: {bs.value}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			{#if contentTypeStats.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-3 font-medium">Reviews by Content Type ({dateRange < 3650 ? `${dateRange}d` : 'all'})</h3>
					<div class="space-y-2">
						{#each contentTypeStats as ct}
							{@const accuracy = ct.reviews_count > 0 ? Math.round((ct.correct_count / ct.reviews_count) * 100) : 0}
							<div class="flex items-center justify-between text-sm">
								<span class="capitalize">{ct.content_type}</span>
								<span class="text-muted-foreground">
									{ct.reviews_count} reviews, {accuracy}% accuracy
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

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
