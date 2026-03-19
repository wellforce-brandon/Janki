<script lang="ts">
import BarChart from "$lib/components/stats/BarChart.svelte";
import LineChart from "$lib/components/stats/LineChart.svelte";
import { getDb } from "$lib/db/database";
import { type DailyStats, getStatsRange, getStreak } from "$lib/db/queries/stats";

let stats = $state<DailyStats[]>([]);
let streak = $state(0);
let totalReviews = $state(0);
let totalCorrect = $state(0);
let avgTimeMs = $state(0);
let cardStates = $state<{ label: string; value: number; color: string }[]>([]);
let kanjiStages = $state<{ label: string; value: number; color: string }[]>([]);

async function loadStats() {
	const [rangeResult, streakResult] = await Promise.all([getStatsRange(30), getStreak()]);

	if (rangeResult.ok) stats = rangeResult.data;
	if (streakResult.ok) streak = streakResult.data;

	totalReviews = stats.reduce((s, d) => s + d.reviews_count, 0);
	totalCorrect = stats.reduce((s, d) => s + d.correct_count, 0);
	const totalTime = stats.reduce((s, d) => s + d.time_spent_ms, 0);
	avgTimeMs = totalReviews > 0 ? totalTime / totalReviews : 0;

	// Load card state distribution
	const db = await getDb();
	const stateRows = await db.select<{ state: number; count: number }[]>(
		"SELECT state, COUNT(*) as count FROM cards GROUP BY state",
	);
	const stateLabels = ["New", "Learning", "Review", "Relearning"];
	const stateColors = ["#3b82f6", "#f97316", "#22c55e", "#ef4444"];
	cardStates = stateRows.map((r) => ({
		label: stateLabels[r.state] ?? "Unknown",
		value: r.count,
		color: stateColors[r.state] ?? "#888",
	}));

	// Load kanji SRS distribution
	const kanjiRows = await db.select<{ srs_stage: number; count: number }[]>(
		"SELECT srs_stage, COUNT(*) as count FROM kanji_levels WHERE srs_stage > 0 GROUP BY srs_stage ORDER BY srs_stage",
	);
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
	kanjiStages = kanjiRows.map((r) => ({
		label: stageLabels[r.srs_stage] ?? `S${r.srs_stage}`,
		value: r.count,
		color: stageColors[r.srs_stage] ?? "#888",
	}));
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

$effect(() => {
	loadStats();
});
</script>

<div class="space-y-8">
	<h2 class="text-2xl font-bold">Statistics</h2>

	<!-- Summary cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg border bg-card p-4">
			<div class="text-sm text-muted-foreground">Total Reviews (30d)</div>
			<div class="mt-1 text-3xl font-bold">{totalReviews}</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-sm text-muted-foreground">Accuracy (30d)</div>
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
		<p class="text-center text-muted-foreground">No review data yet. Start reviewing to see your stats.</p>
	{/if}

	<!-- Distributions -->
	<div class="grid gap-6 lg:grid-cols-2">
		{#if cardStates.length > 0}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-3 font-medium">Card States</h3>
				<div class="flex gap-4">
					{#each cardStates as cs}
						<div class="flex items-center gap-2">
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
							<div class="h-3 w-3 rounded-full" style="background: {ks.color}"></div>
							<span class="text-sm">{ks.label}: {ks.value}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
