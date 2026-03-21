<script lang="ts">
import ContentTypeBadge from "$lib/components/language/ContentTypeBadge.svelte";
import PitchAccentDisplay from "$lib/components/language/PitchAccentDisplay.svelte";
import WkBadge from "$lib/components/language/WkBadge.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import { getLanguageItems, findWkCrossReferences, type LanguageItem, type WkCrossReference } from "$lib/db/queries/language";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let items = $state<LanguageItem[]>([]);
let wkRefs = $state<Map<string, WkCrossReference>>(new Map());

let searchQuery = $state("");
let jlptFilter = $state<string | undefined>(undefined);
let currentPage = $state(0);
const PAGE_SIZE = 50;

let hasMore = $derived(items.length === PAGE_SIZE);

async function loadItems() {
	loading = true;
	const result = await getLanguageItems("vocabulary", {
		limit: PAGE_SIZE,
		offset: currentPage * PAGE_SIZE,
		searchQuery: searchQuery.trim() || undefined,
		jlptFilter,
		sortBy: "frequency_rank",
	});
	if (result.ok) {
		items = result.data;
		await loadWkRefs(result.data);
	} else {
		addToast("Failed to load vocabulary", "error");
	}
	loading = false;
}

function extractKanji(text: string): string[] {
	const kanji: string[] = [];
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code >= 0x4E00 && code <= 0x9FFF) kanji.push(char);
	}
	return kanji;
}

async function loadWkRefs(itemList: LanguageItem[]) {
	const allKanji = new Set<string>();
	for (const item of itemList) {
		for (const k of extractKanji(item.primary_text)) allKanji.add(k);
	}
	if (allKanji.size === 0) return;
	const result = await findWkCrossReferences([...allKanji]);
	if (result.ok) {
		const map = new Map<string, WkCrossReference>();
		for (const ref of result.data) map.set(ref.character, ref);
		wkRefs = map;
	}
}

function getWkRefsForText(text: string): WkCrossReference[] {
	const refs: WkCrossReference[] = [];
	const seen = new Set<string>();
	for (const char of text) {
		if (!seen.has(char) && wkRefs.has(char)) {
			refs.push(wkRefs.get(char)!);
			seen.add(char);
		}
	}
	return refs;
}

function applyFilters() {
	currentPage = 0;
	loadItems();
}

function nextPage() {
	currentPage++;
	loadItems();
}

function prevPage() {
	if (currentPage > 0) {
		currentPage--;
		loadItems();
	}
}

const JLPT_LEVELS = [
	{ label: "All levels", value: undefined },
	{ label: "N5", value: "N5" },
	{ label: "N4", value: "N4" },
	{ label: "N3", value: "N3" },
	{ label: "N2", value: "N2" },
	{ label: "N1", value: "N1" },
];

$effect(() => {
	loadItems();
});
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Vocabulary</h2>

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-3">
		<input
			type="text"
			placeholder="Search vocabulary..."
			class="w-64 rounded-md border bg-background px-3 py-2 text-sm"
			value={searchQuery}
			oninput={(e) => { searchQuery = (e.target as HTMLInputElement).value; }}
			onkeydown={(e) => { if (e.key === "Enter") applyFilters(); }}
		/>

		<select
			class="rounded-md border bg-background px-3 py-2 text-sm"
			onchange={(e) => { const v = (e.target as HTMLSelectElement).value; jlptFilter = v || undefined; applyFilters(); }}
		>
			{#each JLPT_LEVELS as level}
				<option value={level.value ?? ""}>{level.label}</option>
			{/each}
		</select>

		<Button variant="outline" size="sm" onclick={applyFilters}>Search</Button>
	</div>

	{#if loading}
		<SkeletonCards count={6} columns={3} />
	{:else if items.length === 0}
		<EmptyState
			title="No vocabulary found"
			description={searchQuery ? "Try a different search term or filter." : "No vocabulary items have been seeded yet."}
		/>
	{:else}
		<p class="text-sm text-muted-foreground">
			Showing {currentPage * PAGE_SIZE + 1}-{currentPage * PAGE_SIZE + items.length} items
		</p>

		<div class="space-y-2">
			{#each items as item (item.id)}
				<div class="flex items-center gap-4 rounded-lg border bg-card p-4">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-3">
							<span class="text-lg font-bold">{item.primary_text}</span>
							{#if item.reading}
								<span class="text-sm text-muted-foreground">{item.reading}</span>
							{/if}
							{#if item.pitch_accent}
								<PitchAccentDisplay html={item.pitch_accent} />
							{/if}
						</div>
						{#if item.meaning}
							<p class="mt-0.5 text-sm text-muted-foreground">{item.meaning}</p>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#each getWkRefsForText(item.primary_text) as ref (ref.character)}
							<WkBadge srsStage={ref.srs_stage} character={ref.character} kanjiId={ref.id} />
						{/each}
						{#if item.jlpt_level}
							<span class="rounded-full bg-muted px-2 py-0.5 text-xs">{item.jlpt_level}</span>
						{/if}
						{#if item.srs_stage === 0}
							<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">New</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		<div class="flex items-center justify-between">
			<Button variant="outline" size="sm" onclick={prevPage} disabled={currentPage === 0}>
				Previous
			</Button>
			<span class="text-sm text-muted-foreground">Page {currentPage + 1}</span>
			<Button variant="outline" size="sm" onclick={nextPage} disabled={!hasMore}>
				Next
			</Button>
		</div>
	{/if}
</div>
