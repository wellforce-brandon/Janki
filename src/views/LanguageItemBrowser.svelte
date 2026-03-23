<script lang="ts">
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getLanguageItemsByTypeAndTier,
	type ContentType,
	type LanguageItemsByLevel,
	type LanguageItem,
} from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { getStageDots } from "$lib/utils/kanji";
import { navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

interface Props {
	contentType: ContentType;
	title: string;
}

let { contentType, title }: Props = $props();

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
let levelData = $state<LanguageItemsByLevel[]>([]);

let tier = $derived(TIERS[currentTier]);
let initialTier = $derived(Number(viewParams().tier) || 0);

async function loadTier(tierIndex: number) {
	loading = true;
	currentTier = tierIndex;
	const t = TIERS[tierIndex];
	const result = await getLanguageItemsByTypeAndTier(contentType, t.start, t.end);
	if (result.ok) {
		levelData = result.data;
	} else {
		addToast(`Failed to load ${title.toLowerCase()}`, "error");
	}
	loading = false;
}

function jumpToLevel(level: number) {
	requestAnimationFrame(() => {
		const el = document.getElementById(`lang-level-section-${level}`);
		if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
	});
}

function getLevelPct(level: LanguageItemsByLevel): number {
	return level.total > 0 ? Math.round((level.unlocked / level.total) * 100) : 0;
}

function getSrsClasses(item: LanguageItem): string {
	if (item.srs_stage === 0)
		return "border-2 border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground/50";
	if (item.srs_stage === 9)
		return "bg-zinc-700 dark:bg-zinc-600 text-zinc-300 border border-transparent";
	if (!item.lesson_completed_at)
		return "bg-pink-500/30 dark:bg-pink-400/30 text-pink-600 dark:text-pink-400 border border-pink-500/50";
	if (item.srs_stage <= 4)
		return "bg-pink-500 dark:bg-pink-600 text-white border border-transparent";
	if (item.srs_stage <= 6)
		return "bg-purple-500 dark:bg-purple-600 text-white border border-transparent";
	if (item.srs_stage === 7)
		return "bg-blue-500 dark:bg-blue-600 text-white border border-transparent";
	if (item.srs_stage === 8)
		return "bg-sky-500 dark:bg-sky-600 text-white border border-transparent";
	return "bg-muted text-muted-foreground border border-transparent";
}

function getMeaningDisplay(item: LanguageItem): string {
	if (!item.meaning) return "";
	return item.meaning.length > 30 ? item.meaning.slice(0, 28) + "..." : item.meaning;
}

function openDetail(item: LanguageItem) {
	navigate("lang-item-detail", {
		id: String(item.id),
		contentType: item.content_type,
		fromLevel: String(item.language_level ?? ""),
	});
}

$effect(() => {
	loadTier(initialTier);
});
</script>

<div class="space-y-5">
	<!-- Header with title + legend -->
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
				<div class="h-4 w-4 rounded bg-pink-500/30 border border-pink-500/50"></div>
				<span class="text-muted-foreground">In Lessons</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-pink-500"></div>
				<span class="text-muted-foreground">In Reviews</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-zinc-700 dark:bg-zinc-600"></div>
				<span class="text-muted-foreground">Burned</span>
			</div>
		</div>
	</div>

	<!-- Tier pagination tabs -->
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
				<section id="lang-level-section-{level.level}" class="space-y-3">
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

					<!-- Sub-group tags (if any) -->
					{#if level.subGroups.length > 1}
						<div class="flex flex-wrap gap-1">
							{#each level.subGroups as group}
								<span class="rounded-full border border-muted-foreground/20 px-2.5 py-0.5 text-xs text-muted-foreground">
									{group.label}
								</span>
							{/each}
						</div>
					{/if}

					<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
						{#each level.items as item (item.id)}
							<button
								type="button"
								class="flex flex-col items-center rounded-lg p-2 transition-all hover:brightness-110 {getSrsClasses(item)}"
								onclick={() => openDetail(item)}
								title={STAGE_NAMES[item.srs_stage] ?? "Unknown"}
								aria-label="{item.primary_text} - {getMeaningDisplay(item)} ({STAGE_NAMES[item.srs_stage] ?? 'Unknown'})"
							>
								<span class="text-base font-bold leading-tight">
									{item.primary_text}
								</span>
								{#if item.reading}
									<span class="mt-0.5 truncate text-[10px] leading-tight opacity-80 max-w-full">
										{item.reading}
									</span>
								{/if}
								<span class="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-70">
									{getMeaningDisplay(item)}
								</span>
								{#if item.srs_stage >= 1 && item.srs_stage <= 4}
									{@const dots = getStageDots(item.srs_stage)}
									<div class="mt-1 flex gap-0.5">
										{#each { length: dots.total } as _, di}
											<div
												class="h-1.5 w-1.5 rounded-full {di < dots.filled ? 'bg-white/80' : 'bg-white/25'}"
											></div>
										{/each}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
