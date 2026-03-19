<script lang="ts">
import LevelProgressBar from "$lib/components/kanji/LevelProgress.svelte";
import SrsStageIndicator from "$lib/components/kanji/SrsStageIndicator.svelte";
import {
	getKanjiByLevel,
	getLevelProgress,
	getUserLevel,
	type KanjiLevelItem,
	type LevelProgress,
} from "$lib/db/queries/kanji";
import { currentView, navigate, viewParams } from "$lib/stores/navigation.svelte";
import { cn } from "$lib/utils/cn";
import KanjiDetail from "./KanjiDetail.svelte";

let userLevel = $state(1);
let levels = $state<LevelProgress[]>([]);
let expandedLevel = $state<number | null>(null);
let expandedItems = $state<KanjiLevelItem[]>([]);
let loading = $state(true);

async function loadLevels() {
	loading = true;
	const levelResult = await getUserLevel();
	if (levelResult.ok) userLevel = levelResult.data;

	const allLevels: LevelProgress[] = [];
	for (let i = 1; i <= 60; i++) {
		const result = await getLevelProgress(i);
		if (result.ok) allLevels.push(result.data);
	}
	levels = allLevels;
	loading = false;
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
			<p class="text-muted-foreground">Loading levels...</p>
		{:else if levels.length === 0}
			<p class="text-muted-foreground">No kanji data. Restart the app to seed the database.</p>
		{:else}
			<div class="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
				{#each levels as lp}
					<button
						type="button"
						class={cn(
							"flex flex-col items-center rounded-lg border p-2 transition-colors hover:brightness-110",
							getLevelColor(lp, userLevel),
						)}
						onclick={() => toggleLevel(lp.level)}
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
