<script lang="ts">
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getItemsByTypeAndTier,
	type ItemsByLevel,
	type KanjiLevelItem,
} from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

interface ColorConfig {
	locked: string;
	lesson: string;
	review: string;
	legendLesson: string;
	legendReview: string;
}

interface Props {
	itemType: "radical" | "kanji" | "vocab";
	title: string;
	colors: ColorConfig;
}

let { itemType, title, colors }: Props = $props();

const TIERS = [
	{ label: "1-10", start: 1, end: 10 },
	{ label: "11-20", start: 11, end: 20 },
	{ label: "21-30", start: 21, end: 30 },
	{ label: "31-40", start: 31, end: 40 },
	{ label: "41-50", start: 41, end: 50 },
	{ label: "51-60", start: 51, end: 60 },
];

let currentTier = $state(0);
let loading = $state(true);
let levelData = $state<ItemsByLevel[]>([]);

let tier = $derived(TIERS[currentTier]);

async function loadTier(tierIndex: number) {
	loading = true;
	currentTier = tierIndex;
	const t = TIERS[tierIndex];
	const result = await getItemsByTypeAndTier(itemType, t.start, t.end);
	if (result.ok) {
		levelData = result.data;
	} else {
		addToast(`Failed to load ${title.toLowerCase()}`, "error");
	}
	loading = false;
}

function jumpToLevel(level: number) {
	requestAnimationFrame(() => {
		const el = document.getElementById(`level-section-${level}`);
		if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
	});
}

function openDetail(item: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(item.id), character: item.character });
}

function getTileStatus(item: KanjiLevelItem): "locked" | "lesson" | "review" | "burned" {
	if (item.srs_stage === 0) return "locked";
	if (item.srs_stage === 9) return "burned";
	if (!item.lesson_completed_at) return "lesson";
	return "review";
}

function getTileClasses(item: KanjiLevelItem): string {
	const status = getTileStatus(item);
	switch (status) {
		case "locked":
			return colors.locked;
		case "lesson":
			return colors.lesson;
		case "review":
			return colors.review;
		case "burned":
			return "bg-zinc-700 dark:bg-zinc-600 text-zinc-300 border border-transparent";
	}
}

function getReadingDisplay(item: KanjiLevelItem): string {
	if (itemType === "radical") return "";
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

function getLevelPct(level: ItemsByLevel): number {
	return level.total > 0 ? Math.round((level.unlocked / level.total) * 100) : 0;
}

function getMeaningDisplay(item: KanjiLevelItem): string {
	try {
		const arr = JSON.parse(item.meanings) as string[];
		return arr[0] ?? "";
	} catch {
		return item.meanings;
	}
}

$effect(() => {
	loadTier(0);
});
</script>

<div class="space-y-5">
	<!-- Header with title + tier pagination -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-2xl font-bold" tabindex="-1">
			{title}
			<span class="text-base font-normal text-muted-foreground">
				Levels {tier.start}-{tier.end}
			</span>
		</h2>

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-3 text-xs">
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded border-2 border-dashed border-current opacity-50"></div>
				<span class="text-muted-foreground">Locked</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded {colors.legendLesson}"></div>
				<span class="text-muted-foreground">In Lessons</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded {colors.legendReview}"></div>
				<span class="text-muted-foreground">In Reviews</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-zinc-700 dark:bg-zinc-600"></div>
				<span class="text-muted-foreground">Burned</span>
			</div>
		</div>
	</div>

	<!-- Tier pagination -->
	<div class="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
		{#each TIERS as t, i}
			<button
				type="button"
				class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {currentTier === i ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
				onclick={() => loadTier(i)}
				aria-label="Show levels {t.start} to {t.end}"
			>
				{t.label}
			</button>
		{/each}
	</div>

	<!-- Level sub-tabs -->
	{#if !loading && levelData.length > 0}
		<div class="flex flex-wrap gap-1">
			{#each { length: tier.end - tier.start + 1 } as _, i}
				{@const lvl = tier.start + i}
				{@const hasItems = levelData.some((d) => d.level === lvl)}
				<button
					type="button"
					class="rounded px-2 py-1 text-xs font-medium transition-colors {hasItems ? 'hover:bg-accent text-foreground' : 'text-muted-foreground/40 cursor-default'}"
					onclick={() => hasItems && jumpToLevel(lvl)}
					disabled={!hasItems}
					aria-label="Jump to level {lvl}"
				>
					{lvl}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Content -->
	{#if loading}
		<LoadingState message="Loading {title.toLowerCase()}..." />
	{:else if levelData.length === 0}
		<div class="rounded-lg border bg-card p-8 text-center">
			<p class="text-muted-foreground">No {title.toLowerCase()} found for levels {tier.start}-{tier.end}.</p>
		</div>
	{:else}
		<div class="space-y-8">
			{#each levelData as level}
				<section id="level-section-{level.level}" class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-semibold">
							Level {level.level}
							<span class="text-sm font-normal text-muted-foreground">
								({level.unlocked}/{level.total} unlocked)
							</span>
						</h3>
						<div class="flex items-center gap-2">
							<div class="h-2 w-24 overflow-hidden rounded-full bg-muted">
								<div
									class="h-full rounded-full bg-green-500 transition-all"
									style="width: {getLevelPct(level)}%"
								></div>
							</div>
							<span class="text-xs text-muted-foreground">{getLevelPct(level)}%</span>
						</div>
					</div>

					<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
						{#each level.items as item}
							<button
								type="button"
								class="flex flex-col items-center rounded-lg p-2 transition-all hover:brightness-110 {getTileClasses(item)}"
								onclick={() => openDetail(item)}
								aria-label="{item.character} - {getMeaningDisplay(item)}{getTileStatus(item) === 'locked' ? ' (locked)' : ''}"
							>
								{#if item.image_url}
									<img src={item.image_url} alt={getMeaningDisplay(item)} class="h-6 w-6 invert dark:invert-0 opacity-90" />
								{:else}
									<span class="text-lg font-bold leading-tight">{item.character}</span>
								{/if}
								{#if itemType !== "radical"}
									{#if getReadingDisplay(item)}
										<span class="mt-0.5 truncate text-[10px] leading-tight opacity-80">{getReadingDisplay(item)}</span>
									{/if}
								{/if}
								<span class="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-70">
									{getMeaningDisplay(item)}
								</span>
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
