<script lang="ts">
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getLanguageLevelItems,
	getLanguageLevelProgress,
	type LanguageLevelItem,
	type LanguageLevelProgress,
} from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { getStageDots } from "$lib/utils/kanji";
import { navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

const MAX_LEVEL = 60;

const TYPE_LABELS: Record<string, string> = {
	kana: "Kana",
	grammar: "Grammar",
	vocabulary: "Vocabulary",
	conjugation: "Conjugation",
	sentence: "Sentences",
};

const TYPE_COLORS: Record<string, string> = {
	kana: "text-teal-500 dark:text-teal-400",
	grammar: "text-amber-500 dark:text-amber-400",
	vocabulary: "text-purple-500 dark:text-purple-400",
	conjugation: "text-rose-500 dark:text-rose-400",
	sentence: "text-blue-500 dark:text-blue-400",
};

let loading = $state(true);
let items = $state<LanguageLevelItem[]>([]);
let progress = $state<LanguageLevelProgress>({ level: 1, total: 0, guru_plus: 0, unlocked: 0, percentage: 0 });

let level = $derived(Number(viewParams().level) || 1);

function getSrsClasses(item: LanguageLevelItem): string {
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

function getMeaningDisplay(item: LanguageLevelItem): string {
	if (!item.meaning) return "";
	return item.meaning.length > 30 ? item.meaning.slice(0, 28) + "..." : item.meaning;
}

function openDetail(item: LanguageLevelItem) {
	navigate("lang-item-detail", {
		id: String(item.id),
		contentType: item.content_type,
		fromLevel: String(level),
	});
}

async function load(lvl: number) {
	loading = true;
	const [itemsResult, progressResult] = await Promise.all([
		getLanguageLevelItems(lvl),
		getLanguageLevelProgress(lvl),
	]);
	if (itemsResult.ok) items = itemsResult.data;
	else addToast("Failed to load level data", "error");
	if (progressResult.ok) progress = progressResult.data;
	loading = false;
}

$effect(() => {
	load(level);
});

// Group items by content_type for display
let sections = $derived((() => {
	const typeOrder = ["kana", "grammar", "vocabulary", "conjugation", "sentence"];
	const grouped = new Map<string, LanguageLevelItem[]>();
	for (const item of items) {
		const list = grouped.get(item.content_type) ?? [];
		list.push(item);
		grouped.set(item.content_type, list);
	}
	return typeOrder
		.filter((t) => grouped.has(t))
		.map((t) => ({
			type: t,
			title: TYPE_LABELS[t] ?? t,
			color: TYPE_COLORS[t] ?? "",
			items: grouped.get(t)!,
		}));
})());
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				class="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
				onclick={() => navigate("lang-levels")}
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
				onclick={() => navigate("lang-level", { level: String(level - 1) })}
				aria-label="Previous level"
			>
				&larr; {level - 1}
			</button>
			<button
				type="button"
				class="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-30"
				disabled={level >= MAX_LEVEL}
				onclick={() => navigate("lang-level", { level: String(level + 1) })}
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
				{progress.guru_plus}/{progress.total} passed
				({progress.percentage}%)
			</span>
		</div>
	{/if}

	{#if loading}
		<LoadingState message="Loading level {level}..." />
	{:else}
		{#each sections as section}
			<section class="space-y-3">
				<h3 class="text-lg font-semibold {section.color}">
					{section.title}
					<span class="text-sm font-normal text-muted-foreground">
						({section.items.length})
					</span>
				</h3>

				<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
					{#each section.items as item (item.id)}
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
									{#each { length: dots.total } as _, i}
										<div
											class="h-1.5 w-1.5 rounded-full {i < dots.filled ? 'bg-white/80' : 'bg-white/25'}"
										></div>
									{/each}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		{/each}

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded border-2 border-dashed border-current opacity-50"></div>
				<span>Locked</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-pink-500/30 border border-pink-500/50"></div>
				<span>In Lessons</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-pink-500"></div>
				<span>In Reviews</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-zinc-700 dark:bg-zinc-600"></div>
				<span>Burned</span>
			</div>
		</div>
	{/if}
</div>
