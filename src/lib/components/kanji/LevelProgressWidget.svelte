<script lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/svelte";
import {
	getAllLevelProgress,
	getItemsByLevel,
	getLevelProgressByType,
	getUserLevel,
	type KanjiLevelItem,
	type LevelItemsByType,
	type LevelProgress,
	type LevelProgressByType,
} from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { getStageDots, getTileClasses } from "$lib/utils/kanji";

interface Props {
	userLevel: number;
}

let { userLevel }: Props = $props();

type ViewMode = "summary" | "type-detail" | "level-picker";

// eslint-disable-next-line svelte/valid-compile -- intentional: capture initial value for local browsing
let selectedLevel = $state(userLevel);
let progress = $state<LevelProgressByType | null>(null);
let allItems = $state<LevelItemsByType>({ radicals: [], kanji: [], vocab: [] });
let loading = $state(false);
let fetchId = 0;

let viewMode = $state<ViewMode>("summary");
let expandedType = $state<"radical" | "kanji" | "vocab">("radical");

// Level picker state
let levelPickerData = $state<LevelProgress[]>([]);
let levelPickerUserLevel = $state(1);
let levelPickerLoading = $state(false);

const TYPE_CONFIG = [
	{
		key: "radical" as const,
		label: "Radicals",
		icon: "bg-blue-500 dark:bg-blue-600",
		border: "border-blue-200 dark:border-blue-800",
	},
	{
		key: "kanji" as const,
		label: "Kanji",
		icon: "bg-pink-500 dark:bg-pink-600",
		border: "border-pink-200 dark:border-pink-800",
	},
	{
		key: "vocab" as const,
		label: "Vocabulary",
		icon: "bg-purple-500 dark:bg-purple-600",
		border: "border-purple-200 dark:border-purple-800",
	},
] as const;

const typeCards = $derived(
	progress
		? TYPE_CONFIG.map((cfg) => {
				const data =
					cfg.key === "radical"
						? progress?.radicals
						: cfg.key === "kanji"
							? progress?.kanji
							: progress?.vocab;
				return { ...cfg, guru: data?.guru_plus ?? 0, total: data?.total ?? 0 };
			})
		: [],
);

const isLevelLocked = $derived(
	progress
		? progress.radicals.unlocked === 0 &&
				progress.kanji.unlocked === 0 &&
				progress.vocab.unlocked === 0
		: false,
);

const kanjiNeeded = $derived(
	progress ? Math.max(0, Math.ceil(progress.kanji.total * 0.9) - progress.kanji.guru_plus) : 0,
);

const expandedItems = $derived<KanjiLevelItem[]>(
	expandedType === "radical"
		? allItems.radicals
		: expandedType === "kanji"
			? allItems.kanji
			: allItems.vocab,
);

const expandedGuruCount = $derived(expandedItems.filter((i) => i.srs_stage >= 5).length);

function getBlockColor(stage: number): string {
	if (stage === 0) return "bg-muted";
	if (stage <= 4) return "bg-pink-400 dark:bg-pink-500";
	if (stage <= 6) return "bg-green-500 dark:bg-green-400";
	if (stage === 7) return "bg-blue-400 dark:bg-blue-300";
	if (stage === 8) return "bg-yellow-400 dark:bg-yellow-300";
	return "bg-zinc-600 dark:bg-zinc-500";
}

function getMeaning(item: KanjiLevelItem): string {
	try {
		return (JSON.parse(item.meanings) as string[])[0] ?? "";
	} catch {
		return item.meanings;
	}
}

function getReading(item: KanjiLevelItem): string {
	if (item.item_type === "radical") return "";
	if (item.reading) return item.reading;
	if (item.readings_on) {
		try {
			const parsed = JSON.parse(item.readings_on) as string[];
			return parsed.filter((r) => !r.startsWith("!"))[0] ?? "";
		} catch {
			return item.readings_on;
		}
	}
	return "";
}

function handleTypeClick(key: "radical" | "kanji" | "vocab") {
	expandedType = key;
	viewMode = "type-detail";
}

async function openLevelPicker() {
	viewMode = "level-picker";
	if (levelPickerData.length > 0) return; // already loaded
	levelPickerLoading = true;
	const [progressR, levelR] = await Promise.all([getAllLevelProgress(), getUserLevel()]);
	if (progressR.ok) levelPickerData = progressR.data;
	if (levelR.ok) levelPickerUserLevel = levelR.data;
	levelPickerLoading = false;
}

function pickLevel(level: number) {
	selectedLevel = level;
	viewMode = "summary";
}

function getPickerLevelClasses(level: number): string {
	const progress = levelPickerData.find((p) => p.level === level);
	if (level === levelPickerUserLevel) return "bg-primary text-primary-foreground font-bold";
	if (progress && progress.percentage >= 90)
		return "bg-green-500 dark:bg-green-600 text-white font-semibold";
	if (progress && progress.unlocked > 0) return "bg-accent text-accent-foreground font-medium";
	return "bg-muted text-muted-foreground";
}

function getPickerProgress(level: number): number {
	const p = levelPickerData.find((lp) => lp.level === level);
	return p?.percentage ?? 0;
}

async function loadLevel(level: number) {
	const id = ++fetchId;
	loading = true;
	const [progressR, itemsR] = await Promise.all([
		getLevelProgressByType(level),
		getItemsByLevel(level),
	]);
	if (id !== fetchId) return;
	if (progressR.ok) progress = progressR.data;
	if (itemsR.ok) allItems = itemsR.data;
	loading = false;
}

$effect(() => {
	loadLevel(selectedLevel);
});
</script>

<div class="rounded-lg border bg-card p-5">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<h3 class="font-medium">Level Progress</h3>
		<div class="flex items-center gap-1">
			{#if selectedLevel > 1}
				<button type="button" class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" onclick={() => { selectedLevel--; viewMode = "summary"; }} aria-label="Previous level">
					<ChevronLeft class="h-4 w-4" />
				</button>
			{/if}
			<button type="button" class="rounded px-2 py-0.5 text-sm font-medium hover:bg-accent transition-colors" onclick={openLevelPicker} aria-label="View all levels">
				Level {selectedLevel}
			</button>
			{#if selectedLevel < 60}
				<button type="button" class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" onclick={() => { selectedLevel++; viewMode = "summary"; }} aria-label="Next level">
					<ChevronRight class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if loading && !progress}
		<div class="py-6 text-center text-sm text-muted-foreground">Loading...</div>

	{:else if viewMode === "level-picker"}
		<!-- Level picker grid -->
		{#if levelPickerLoading}
			<div class="py-6 text-center text-sm text-muted-foreground">Loading levels...</div>
		{:else}
			<div class="max-h-72 overflow-y-auto">
				<div class="grid grid-cols-9 gap-1.5">
					{#each { length: 60 } as _, i}
						{@const lvl = i + 1}
						{@const pct = getPickerProgress(lvl)}
						<button
							type="button"
							class="group relative flex flex-col items-center justify-center rounded-md p-2 transition-all hover:brightness-110 {getPickerLevelClasses(lvl)} {lvl === selectedLevel ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}"
							onclick={() => pickLevel(lvl)}
							aria-label="Level {lvl}{pct > 0 ? `, ${pct}% complete` : ''}"
						>
							<span class="text-xs">{String(lvl).padStart(2, "0")}</span>
							{#if pct > 0}
								<div class="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-black/20">
									<div class="h-full rounded-full bg-white/70" style="width: {pct}%"></div>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}

	{:else if progress && viewMode === "summary"}
		<!-- Summary view -->
		<p class="mb-3 text-sm text-muted-foreground">
			Number of items <span class="font-semibold text-foreground">Guru</span>'d in this level.
		</p>
		<div class="grid grid-cols-3 gap-3">
			{#each typeCards as card}
				<button type="button" class="rounded-lg border {card.border} p-3 text-center transition-colors hover:bg-muted" onclick={() => handleTypeClick(card.key)}>
					<div class="mx-auto mb-1.5 flex items-center justify-center gap-1.5">
						<span class="inline-block h-4 w-4 rounded {card.icon}"></span>
						<span class="text-xs font-medium">{card.label}</span>
					</div>
					<div class="text-lg font-bold">{card.guru}/{card.total}</div>
					<div class="mt-1 text-xs text-muted-foreground">See All &rsaquo;</div>
				</button>
			{/each}
		</div>
		<!-- Level-up status -->
		<div class="mt-4">
			{#if isLevelLocked}
				<div class="rounded-md bg-accent/50 p-3">
					<p class="text-sm text-muted-foreground">You haven't unlocked this level yet. Do your Kanji Lessons and Reviews to level up!</p>
				</div>
			{:else if kanjiNeeded > 0}
				<p class="mb-2 text-sm text-muted-foreground">
					Guru <span class="font-semibold text-foreground">{kanjiNeeded}</span> more kanji to level up.
				</p>
				<div class="flex flex-wrap gap-1">
					{#each allItems.kanji as item}
						<div class="h-3.5 w-3.5 rounded-sm {getBlockColor(item.srs_stage)}" title={item.character}></div>
					{/each}
				</div>
			{:else if progress.kanji.total > 0}
				<p class="text-sm font-medium text-green-500 dark:text-green-400">Level complete!</p>
			{/if}
		</div>

	{:else if progress && viewMode === "type-detail"}
		<!-- Expanded type view -->
		<div class="flex items-center justify-between mb-3">
			<button type="button" class="text-sm text-muted-foreground hover:text-foreground transition-colors" onclick={() => viewMode = "summary"}>
				&larr; Back
			</button>
			<span class="text-sm font-medium text-muted-foreground">
				{expandedGuruCount}/{expandedItems.length} items <span class="font-semibold text-foreground">Guru</span>'d
			</span>
		</div>
		<div class="max-h-72 overflow-y-auto">
			<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
				{#each expandedItems as item}
					{@const dots = getStageDots(item.srs_stage)}
					<button type="button" class="flex flex-col items-center rounded-lg p-2 transition-all hover:brightness-110 {getTileClasses(item)}" onclick={() => navigate("kanji-detail", { id: String(item.id), character: item.character })} aria-label="{item.character} - {getMeaning(item)}">
						{#if item.image_url}
							<img src={item.image_url} alt={getMeaning(item)} class="h-6 w-6 invert dark:invert-0 opacity-90" />
						{:else}
							<span class="text-lg font-bold leading-tight">{item.character}</span>
						{/if}
						{#if item.item_type !== "radical" && getReading(item)}
							<span class="mt-0.5 truncate text-[10px] leading-tight opacity-80">{getReading(item)}</span>
						{/if}
						<span class="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-70">{getMeaning(item)}</span>
						{#if item.srs_stage > 0 && item.srs_stage < 9}
							<div class="mt-1 flex gap-0.5">
								{#each { length: dots.total } as _, i}
									<div class="h-0.5 w-2 rounded-full {i < dots.filled ? 'bg-green-400' : 'bg-current opacity-30'}"></div>
								{/each}
							</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
