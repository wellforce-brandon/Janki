<script lang="ts">
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getAllLanguageLevelProgress, getLanguageUserLevel, type LanguageLevelProgress } from "$lib/db/queries/language";
import { navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

const TIERS = [
	{ kanji: "快", en: "Pleasant", start: 1, end: 10, color: "bg-emerald-500 dark:bg-emerald-600" },
	{ kanji: "苦", en: "Painful", start: 11, end: 20, color: "bg-yellow-500 dark:bg-yellow-600" },
	{ kanji: "死", en: "Death", start: 21, end: 30, color: "bg-orange-500 dark:bg-orange-600" },
	{ kanji: "地獄", en: "Hell", start: 31, end: 40, color: "bg-red-500 dark:bg-red-600" },
	{ kanji: "天国", en: "Paradise", start: 41, end: 50, color: "bg-sky-500 dark:bg-sky-600" },
	{ kanji: "現実", en: "Reality", start: 51, end: 60, color: "bg-purple-500 dark:bg-purple-600" },
];

let loading = $state(true);
let levelProgress = $state<LanguageLevelProgress[]>([]);
let userLevel = $state(1);

function getProgressForLevel(level: number): LanguageLevelProgress | undefined {
	return levelProgress.find((p) => p.level === level);
}

function getLevelStatus(level: number): "current" | "completed" | "started" | "locked" {
	if (level === userLevel) return "current";
	const progress = getProgressForLevel(level);
	if (!progress) return "locked";
	if (progress.percentage >= 90) return "completed";
	if (progress.unlocked > 0) return "started";
	return "locked";
}

function getLevelClasses(level: number): string {
	const status = getLevelStatus(level);
	switch (status) {
		case "current":
			return "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background font-bold";
		case "completed":
			return "bg-green-500 dark:bg-green-600 text-white font-semibold";
		case "started":
			return "bg-accent text-accent-foreground font-medium";
		case "locked":
			return "bg-muted text-muted-foreground";
	}
}

async function load() {
	loading = true;
	const [progressResult, levelResult] = await Promise.all([
		getAllLanguageLevelProgress(),
		getLanguageUserLevel(),
	]);
	if (progressResult.ok) levelProgress = progressResult.data;
	else addToast("Failed to load level progress", "error");
	if (levelResult.ok) userLevel = levelResult.data;
	loading = false;
}

let initialTier = $derived(Number(viewParams().tier) || 0);

$effect(() => {
	load().then(() => {
		if (initialTier > 0 && initialTier < TIERS.length) {
			requestAnimationFrame(() => {
				const el = document.getElementById(`lang-tier-section-${initialTier}`);
				if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	});
});
</script>

<div class="space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Language Levels</h2>

	{#if loading}
		<LoadingState message="Loading levels..." />
	{:else}
		<div class="space-y-8">
			{#each TIERS as tier, tierIdx}
				<section id="lang-tier-section-{tierIdx}" class="space-y-3">
					<div class="flex items-center gap-3">
						<span class="text-2xl font-bold">{tier.kanji}</span>
						<div>
							<h3 class="text-lg font-semibold">{tier.en}</h3>
							<p class="text-sm text-muted-foreground">Levels {tier.start}-{tier.end}</p>
						</div>
					</div>

					<div class="grid grid-cols-5 gap-2 sm:grid-cols-10">
						{#each { length: tier.end - tier.start + 1 } as _, i}
							{@const level = tier.start + i}
							{@const progress = getProgressForLevel(level)}
							<button
								type="button"
								class="group relative flex flex-col items-center justify-center rounded-lg p-3 transition-all hover:brightness-110 {getLevelClasses(level)}"
								onclick={() => navigate("lang-level", { level: String(level) })}
								aria-label="Level {level}{progress ? `, ${progress.percentage}% complete` : ''}"
							>
								<span class="text-lg">{String(level).padStart(2, "0")}</span>
								{#if progress && progress.percentage > 0}
									<div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/20">
										<div
											class="h-full rounded-full bg-white/70 transition-all"
											style="width: {progress.percentage}%"
										></div>
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
			<div class="flex items-center gap-1.5">
				<div class="h-3 w-3 rounded bg-primary"></div>
				<span>Current</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-3 w-3 rounded bg-green-500 dark:bg-green-600"></div>
				<span>Completed</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-3 w-3 rounded bg-accent"></div>
				<span>Started</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-3 w-3 rounded bg-muted"></div>
				<span>Locked</span>
			</div>
		</div>
	{/if}
</div>
