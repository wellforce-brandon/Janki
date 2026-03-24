<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	DAKUTEN_ROWS,
	GOJUON_ROWS,
	HANDAKUTEN_ROWS,
	isHiragana,
	isKatakana,
	VOWELS,
	YOON_COLS,
	YOON_ROWS,
} from "$lib/data/kana-groups";
import { getLanguageItems, type LanguageItem } from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

type KanaType = "all" | "hiragana" | "katakana";

let loading = $state(true);
let items = $state<LanguageItem[]>([]);
let kanaType = $state<KanaType>("all");

async function loadKana() {
	loading = true;
	const result = await getLanguageItems("kana", { limit: 500 });
	if (result.ok) {
		items = result.data;
	} else {
		addToast("Failed to load kana", "error");
	}
	loading = false;
}

// All romaji values that appear in the charts
const CHARTED_ROMAJI = new Set<string>();
for (const row of [...GOJUON_ROWS, ...DAKUTEN_ROWS, ...HANDAKUTEN_ROWS]) {
	for (const r of row.romaji) {
		if (r) CHARTED_ROMAJI.add(r);
	}
}
for (const row of YOON_ROWS) {
	for (const r of row.romaji) {
		CHARTED_ROMAJI.add(r);
	}
}

type RomajiMap = Map<string, LanguageItem>;

function buildRomajiMap(filteredItems: LanguageItem[]): RomajiMap {
	const map = new Map<string, LanguageItem>();
	for (const item of filteredItems) {
		if (item.romaji) {
			// For duplicates (e.g. ji appears in both z and d rows), keep first
			if (!map.has(item.romaji)) {
				map.set(item.romaji, item);
			}
		}
	}
	return map;
}

function getUnchartedItems(filteredItems: LanguageItem[]): LanguageItem[] {
	return filteredItems.filter((item) => !item.romaji || !CHARTED_ROMAJI.has(item.romaji));
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

function openDetail(item: LanguageItem) {
	navigate("lang-item-detail", {
		id: String(item.id),
		contentType: item.content_type,
		jlptLevel: item.jlpt_level ?? "None",
	});
}

let hiraganaItems = $derived(items.filter((k) => isHiragana(k.primary_text)));
let katakanaItems = $derived(items.filter((k) => isKatakana(k.primary_text)));

// Build maps per script
let hiraganaMap = $derived(buildRomajiMap(hiraganaItems));
let katakanaMap = $derived(buildRomajiMap(katakanaItems));
let hiraganaExtra = $derived(getUnchartedItems(hiraganaItems));
let katakanaExtra = $derived(getUnchartedItems(katakanaItems));

$effect(() => {
	loadKana();
});
</script>

{#snippet kanaCell(item: LanguageItem | undefined)}
	{#if item}
		<button
			type="button"
			class="flex flex-col items-center justify-center rounded-lg p-2 transition-all hover:brightness-110 cursor-pointer {getSrsClasses(item)}"
			onclick={() => openDetail(item)}
			title={STAGE_NAMES[item.srs_stage] ?? "Unknown"}
			aria-label="{item.primary_text} ({item.romaji ?? ''}) - {STAGE_NAMES[item.srs_stage] ?? 'Unknown'}"
		>
			<span class="text-xl font-bold sm:text-2xl">{item.primary_text}</span>
			{#if item.romaji}
				<span class="mt-0.5 text-[10px] opacity-80 sm:text-xs">{item.romaji}</span>
			{/if}
		</button>
	{:else}
		<div></div>
	{/if}
{/snippet}

{#snippet chartSection(title: string, rows: { label: string; romaji: (string | null)[] }[], columns: string[], map: RomajiMap)}
	<div class="space-y-1">
		<h3 class="text-sm font-semibold text-muted-foreground">{title}</h3>
		<!-- Column headers -->
		<div class="grid gap-1.5" style="grid-template-columns: 2rem repeat({columns.length}, minmax(0, 1fr))">
			<div></div>
			{#each columns as col}
				<div class="text-center text-xs font-medium text-muted-foreground">{col}</div>
			{/each}
		</div>
		<!-- Rows -->
		{#each rows as row}
			<div class="grid gap-1.5" style="grid-template-columns: 2rem repeat({columns.length}, minmax(0, 1fr))">
				<div class="flex items-center justify-center text-xs font-medium text-muted-foreground">{row.label}</div>
				{#each row.romaji as romaji}
					{@render kanaCell(romaji ? map.get(romaji) : undefined)}
				{/each}
			</div>
		{/each}
	</div>
{/snippet}

{#snippet extraSection(title: string, extraItems: LanguageItem[])}
	{#if extraItems.length > 0}
		<div class="space-y-1">
			<h3 class="text-sm font-semibold text-muted-foreground">{title}</h3>
			<div class="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
				{#each extraItems as item (item.id)}
					{@render kanaCell(item)}
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet fullChart(label: string, map: RomajiMap, extraItems: LanguageItem[])}
	<div class="space-y-6">
		<h2 class="text-lg font-bold">{label}</h2>
		{@render chartSection("Gojūon", GOJUON_ROWS, VOWELS, map)}
		{@render chartSection("Dakuten", DAKUTEN_ROWS, VOWELS, map)}
		{@render chartSection("Handakuten", HANDAKUTEN_ROWS, VOWELS, map)}
		{@render chartSection("Yōon (Combinations)", YOON_ROWS, YOON_COLS, map)}
		{@render extraSection("Extended Kana", extraItems)}
	</div>
{/snippet}

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-2xl font-bold" tabindex="-1">Kana</h2>
		<div class="flex items-center gap-3">
			<div class="flex gap-2">
				<Button variant={kanaType === "all" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "all")}>All</Button>
				<Button variant={kanaType === "hiragana" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "hiragana")}>Hiragana</Button>
				<Button variant={kanaType === "katakana" ? "default" : "outline"} size="sm" onclick={() => (kanaType = "katakana")}>Katakana</Button>
			</div>
		</div>
	</div>

	<!-- SRS Legend -->
	<div class="flex flex-wrap items-center gap-3 text-xs">
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded border-2 border-dashed border-current opacity-30"></div>
			<span class="text-muted-foreground">Locked</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded bg-pink-500/30 border border-pink-500/50"></div>
			<span class="text-muted-foreground">In Lessons</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded bg-pink-500"></div>
			<span class="text-muted-foreground">Apprentice</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded bg-purple-500"></div>
			<span class="text-muted-foreground">Guru</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded bg-blue-500"></div>
			<span class="text-muted-foreground">Master</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded bg-sky-500"></div>
			<span class="text-muted-foreground">Enlightened</span>
		</div>
		<div class="flex items-center gap-1.5">
			<div class="h-4 w-4 rounded bg-zinc-700 dark:bg-zinc-600"></div>
			<span class="text-muted-foreground">Burned</span>
		</div>
	</div>

	{#if loading}
		<SkeletonCards count={6} columns={3} />
	{:else if kanaType === "hiragana"}
		{@render fullChart("Hiragana", hiraganaMap, hiraganaExtra)}
	{:else if kanaType === "katakana"}
		{@render fullChart("Katakana", katakanaMap, katakanaExtra)}
	{:else}
		{@render fullChart("Hiragana", hiraganaMap, hiraganaExtra)}
		<hr class="border-border" />
		{@render fullChart("Katakana", katakanaMap, katakanaExtra)}
	{/if}
</div>
