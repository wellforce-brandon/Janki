<script lang="ts">
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getItemsByLevel,
	getLevelProgress,
	type KanjiLevelItem,
	type LevelItemsByType,
	type LevelProgress,
} from "$lib/db/queries/kanji";
import { navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { getStageDots, getTileClasses } from "$lib/utils/kanji";

let loading = $state(true);
let items = $state<LevelItemsByType>({ radicals: [], kanji: [], vocab: [] });
let progress = $state<LevelProgress>({ level: 1, total: 0, guru_plus: 0, unlocked: 0, percentage: 0 });

let level = $derived(Number(viewParams().level) || 1);

function getMeaningDisplay(item: KanjiLevelItem): string {
	try {
		const arr = JSON.parse(item.meanings) as string[];
		return arr[0] ?? "";
	} catch {
		return item.meanings;
	}
}

function getReadingDisplay(item: KanjiLevelItem): string {
	if (item.item_type === "radical") return "";
	if (item.reading) return item.reading;
	if (item.readings_on) {
		try {
			const parsed = JSON.parse(item.readings_on) as string[];
			const accepted = parsed.filter((r) => !r.startsWith("!"));
			if (accepted.length > 0) return accepted[0];
		} catch {
			return item.readings_on;
		}
	}
	return "";
}

function openDetail(item: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(item.id), character: item.character });
}

async function load(lvl: number) {
	loading = true;
	const [itemsResult, progressResult] = await Promise.all([
		getItemsByLevel(lvl),
		getLevelProgress(lvl),
	]);
	if (itemsResult.ok) items = itemsResult.data;
	else addToast("Failed to load level data", "error");
	if (progressResult.ok) progress = progressResult.data;
	loading = false;
}

$effect(() => {
	load(level);
});

const sections = $derived([
	{ title: "Radicals", items: items.radicals, color: "text-blue-500 dark:text-blue-400" },
	{ title: "Kanji", items: items.kanji, color: "text-pink-500 dark:text-pink-400" },
	{ title: "Vocabulary", items: items.vocab, color: "text-purple-500 dark:text-purple-400" },
]);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
				onclick={() => navigate("kanji-levels")}
				aria-label="Back to levels"
			>
				&larr; Levels
			</button>
			<h2 class="text-2xl font-bold" tabindex="-1">Level {level}</h2>
		</div>

		<div class="flex items-center gap-3">
			<button
				type="button"
				class="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-30"
				disabled={level <= 1}
				onclick={() => navigate("kanji-level", { level: String(level - 1) })}
				aria-label="Previous level"
			>
				&larr; {level - 1}
			</button>
			<button
				type="button"
				class="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-30"
				disabled={level >= 60}
				onclick={() => navigate("kanji-level", { level: String(level + 1) })}
				aria-label="Next level"
			>
				{level + 1} &rarr;
			</button>
		</div>
	</div>

	<!-- Progress bar -->
	{#if !loading}
		<div class="flex items-center gap-3">
			<div class="h-3 flex-1 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-green-500 transition-all"
					style="width: {progress.percentage}%"
				></div>
			</div>
			<span class="text-sm font-medium text-muted-foreground">
				{progress.guru_plus}/{progress.total} kanji passed
				({progress.percentage}%)
			</span>
		</div>
	{/if}

	{#if loading}
		<LoadingState message="Loading level {level}..." />
	{:else}
		{#each sections as section}
			{#if section.items.length > 0}
				<section class="space-y-3">
					<h3 class="text-lg font-semibold {section.color}">
						{section.title}
						<span class="text-sm font-normal text-muted-foreground">
							({section.items.length})
						</span>
					</h3>

					<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
						{#each section.items as item}
							{@const dots = getStageDots(item.srs_stage)}
							<button
								type="button"
								class="flex flex-col items-center rounded-lg p-2 transition-all hover:brightness-110 {getTileClasses(item)}"
								onclick={() => openDetail(item)}
								aria-label="{item.character} - {getMeaningDisplay(item)}"
							>
								{#if item.image_url}
									<img
										src={item.image_url}
										alt={getMeaningDisplay(item)}
										class="h-6 w-6 invert dark:invert-0 opacity-90"
									/>
								{:else}
									<span class="text-lg font-bold leading-tight">{item.character}</span>
								{/if}
								{#if item.item_type !== "radical" && getReadingDisplay(item)}
									<span class="mt-0.5 truncate text-[10px] leading-tight opacity-80">
										{getReadingDisplay(item)}
									</span>
								{/if}
								<span class="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-70">
									{getMeaningDisplay(item)}
								</span>
								<!-- SRS stage dots -->
								{#if item.srs_stage > 0 && item.srs_stage < 9}
									<div class="mt-1 flex gap-0.5">
										{#each { length: dots.total } as _, i}
											<div
												class="h-0.5 w-2 rounded-full {i < dots.filled ? 'bg-green-400' : 'bg-current opacity-30'}"
											></div>
										{/each}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</section>
			{/if}
		{/each}

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded border-2 border-dashed border-current opacity-50"></div>
				<span>Locked</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-blue-500/30 dark:bg-blue-400/30 border border-blue-500/50"></div>
				<span>In Lessons</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-blue-500 dark:bg-blue-600"></div>
				<span>In Reviews</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-zinc-700 dark:bg-zinc-600"></div>
				<span>Burned</span>
			</div>
		</div>
	{/if}
</div>
