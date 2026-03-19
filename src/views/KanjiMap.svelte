<script lang="ts">
import LevelProgressBar from "$lib/components/kanji/LevelProgress.svelte";
import SrsStageIndicator from "$lib/components/kanji/SrsStageIndicator.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import {
	getAllLevelProgress,
	getKanjiByLevel,
	getUserLevel,
	type KanjiLevelItem,
	type LevelProgress,
} from "$lib/db/queries/kanji";
import { currentView, navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { cn } from "$lib/utils/cn";
import KanjiDetail from "./KanjiDetail.svelte";

let userLevel = $state(1);
let levels = $state<LevelProgress[]>([]);
let expandedLevel = $state<number | null>(null);
let expandedItems = $state<KanjiLevelItem[]>([]);
let loading = $state(true);

let totalLearned = $derived(levels.reduce((sum, lp) => sum + lp.guru_plus, 0));
let totalKanji = $derived(levels.reduce((sum, lp) => sum + lp.total, 0));
let overallPercent = $derived(totalKanji > 0 ? Math.round((totalLearned / totalKanji) * 100) : 0);

async function loadLevels() {
	loading = true;
	try {
		const levelResult = await getUserLevel();
		if (levelResult.ok) userLevel = levelResult.data;

		const allResult = await getAllLevelProgress();
		if (allResult.ok) {
			levels = allResult.data;
		} else {
			addToast("Failed to load kanji levels", "error");
		}
	} catch (e) {
		addToast(e instanceof Error ? e.message : "Failed to load kanji map", "error");
	} finally {
		loading = false;
	}
}

async function toggleLevel(level: number) {
	if (expandedLevel === level) {
		expandedLevel = null;
		expandedItems = [];
		return;
	}
	expandedLevel = level;
	const result = await getKanjiByLevel(level);
	if (result.ok) expandedItems = result.data;
}

function openKanjiDetail(item: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(item.id), character: item.character });
}

function getLevelColor(lp: LevelProgress, current: number): string {
	if (lp.total === 0) return "border-muted bg-muted/20 text-muted-foreground";
	if (lp.percentage === 100) return "border-amber-500/50 bg-amber-500/10 text-amber-500";
	if (lp.level <= current && lp.unlocked > 0)
		return "border-purple-500/50 bg-purple-500/10 text-purple-400";
	return "border-muted bg-muted/20 text-muted-foreground";
}

$effect(() => {
	loadLevels();
});
</script>

{#if currentView() === "kanji-detail" && viewParams().id}
	<KanjiDetail itemId={Number(viewParams().id)} />
{:else}
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h2 class="text-2xl font-bold">Kanji Map</h2>
			<span class="text-sm text-muted-foreground">Level {userLevel}</span>
		</div>

		{#if loading}
			<!-- Skeleton grid -->
			<div class="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
				{#each Array(60) as _}
					<div class="animate-pulse rounded-lg border border-muted bg-muted/20 p-2">
						<div class="mx-auto h-6 w-6 rounded bg-muted"></div>
						<div class="mx-auto mt-1 h-3 w-8 rounded bg-muted"></div>
					</div>
				{/each}
			</div>
		{:else if levels.length === 0}
			<EmptyState
				title="No kanji data"
				description="Restart the app to seed the kanji database."
			/>
		{:else}
			<!-- Summary stats bar -->
			<div class="flex items-center gap-6 rounded-lg border bg-card px-4 py-3 text-sm">
				<div>
					<span class="text-muted-foreground">Learned:</span>
					<span class="ml-1 font-medium">{totalLearned} / {totalKanji}</span>
				</div>
				<div>
					<span class="text-muted-foreground">Progress:</span>
					<span class="ml-1 font-medium">{overallPercent}%</span>
				</div>
				<div>
					<span class="text-muted-foreground">Current Level:</span>
					<span class="ml-1 font-medium">{userLevel}</span>
				</div>
			</div>

			<div class="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
				{#each levels as lp}
					<button
						type="button"
						class={cn(
							"flex flex-col items-center rounded-lg border p-2 transition-colors hover:brightness-110",
							getLevelColor(lp, userLevel),
						)}
						onclick={() => toggleLevel(lp.level)}
						aria-label="Level {lp.level}, {lp.percentage}% complete"
					>
						<span class="text-lg font-bold">{lp.level}</span>
						<span class="text-xs opacity-70">{lp.percentage}%</span>
					</button>
				{/each}
			</div>

			{#if expandedLevel !== null}
				<div class="space-y-4 rounded-lg border bg-card p-4">
					<LevelProgressBar progress={levels[expandedLevel - 1]} />

					{#each ["radical", "kanji", "vocab"] as itemType}
						{@const items = expandedItems.filter((i) => i.item_type === itemType)}
						{#if items.length > 0}
							<div class="space-y-2">
								<h4 class="text-sm font-medium capitalize">{itemType}s</h4>
								<div class="flex flex-wrap gap-2">
									{#each items as item}
										<button
											type="button"
											class={cn(
												"flex flex-col items-center rounded-md border px-3 py-2 transition-colors hover:bg-accent",
												item.srs_stage === 0 ? "opacity-40" : "",
											)}
											onclick={() => openKanjiDetail(item)}
											disabled={item.srs_stage === 0}
										>
											<span class={itemType === "kanji" ? "text-2xl" : "text-lg"}>
												{item.character}
											</span>
											<SrsStageIndicator stage={item.srs_stage} />
										</button>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}
