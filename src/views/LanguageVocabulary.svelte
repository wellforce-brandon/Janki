<script lang="ts">
import ContentTypeBadge from "$lib/components/language/ContentTypeBadge.svelte";
import DeckSourceBadge from "$lib/components/language/DeckSourceBadge.svelte";
import PitchAccentDisplay from "$lib/components/language/PitchAccentDisplay.svelte";
import WkBadge from "$lib/components/language/WkBadge.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getNotesByContentType, getSemanticFields, findWkCrossReferences, type NoteWithContentInfo, type SemanticFieldMapping, type WkCrossReference } from "$lib/db/queries/language";
import { getAllDecks, type DeckWithCounts } from "$lib/db/queries/decks";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let notes = $state<NoteWithContentInfo[]>([]);
let decks = $state<DeckWithCounts[]>([]);
let fieldMappings = $state<Map<number, SemanticFieldMapping[]>>(new Map());
let wkRefs = $state<Map<string, WkCrossReference>>(new Map());

// Filters
let searchQuery = $state("");
let deckFilter = $state<number | undefined>(undefined);
let stateFilter = $state<number | undefined>(undefined);
let currentPage = $state(0);
const PAGE_SIZE = 50;

let hasMore = $derived(notes.length === PAGE_SIZE);

async function loadNotes() {
	loading = true;
	const result = await getNotesByContentType("vocabulary", {
		limit: PAGE_SIZE,
		offset: currentPage * PAGE_SIZE,
		searchQuery: searchQuery.trim() || undefined,
		deckFilter,
		stateFilter,
		sortBy: "created_at",
	});
	if (result.ok) {
		notes = result.data;
		// Load semantic field mappings for unique note types
		const noteTypeIds = [...new Set(result.data.map((n) => n.note_type_id))];
		for (const ntId of noteTypeIds) {
			if (!fieldMappings.has(ntId)) {
				const fm = await getSemanticFields(ntId, "vocabulary");
				if (fm.ok) {
					fieldMappings = new Map([...fieldMappings, [ntId, fm.data]]);
				}
			}
		}
		// Batch-lookup WK cross-references for kanji in displayed words
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

async function loadWkRefs(noteList: NoteWithContentInfo[]) {
	const allKanji = new Set<string>();
	for (const note of noteList) {
		const fields = JSON.parse(note.fields);
		for (const val of Object.values(fields)) {
			for (const k of extractKanji(String(val))) allKanji.add(k);
		}
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

async function loadDecks() {
	const result = await getAllDecks();
	if (result.ok) decks = result.data;
}

function getFieldByRole(note: NoteWithContentInfo, role: string): string {
	const mappings = fieldMappings.get(note.note_type_id);
	if (!mappings) return "";
	const fields = JSON.parse(note.fields);
	const mapping = mappings.find((m) => m.semantic_role === role);
	if (!mapping) return "";
	return fields[mapping.field_name] ?? "";
}

function applyFilters() {
	currentPage = 0;
	loadNotes();
}

function nextPage() {
	currentPage++;
	loadNotes();
}

function prevPage() {
	if (currentPage > 0) {
		currentPage--;
		loadNotes();
	}
}

const SRS_STATES = [
	{ label: "All states", value: undefined },
	{ label: "New", value: 0 },
	{ label: "Learning", value: 1 },
	{ label: "Review", value: 2 },
	{ label: "Relearning", value: 3 },
];

$effect(() => {
	loadDecks();
	loadNotes();
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
			onchange={(e) => { deckFilter = (e.target as HTMLSelectElement).value ? Number((e.target as HTMLSelectElement).value) : undefined; applyFilters(); }}
		>
			<option value="">All decks</option>
			{#each decks as deck}
				<option value={deck.id}>{deck.name}</option>
			{/each}
		</select>

		<select
			class="rounded-md border bg-background px-3 py-2 text-sm"
			onchange={(e) => { const v = (e.target as HTMLSelectElement).value; stateFilter = v === "" ? undefined : Number(v); applyFilters(); }}
		>
			{#each SRS_STATES as s}
				<option value={s.value ?? ""}>{s.label}</option>
			{/each}
		</select>

		<Button variant="outline" size="sm" onclick={applyFilters}>Search</Button>
	</div>

	{#if loading}
		<LoadingState message="Loading vocabulary..." />
	{:else if notes.length === 0}
		<EmptyState
			title="No vocabulary found"
			description={searchQuery ? "Try a different search term or filter." : "Import a vocabulary deck to see items here."}
		/>
	{:else}
		<p class="text-sm text-muted-foreground">
			Showing {currentPage * PAGE_SIZE + 1}-{currentPage * PAGE_SIZE + notes.length} items
		</p>

		<div class="space-y-2">
			{#each notes as note (note.note_id)}
				{@const word = getFieldByRole(note, "primary_text")}
				{@const reading = getFieldByRole(note, "reading")}
				{@const meaning = getFieldByRole(note, "meaning")}
				{@const pitchAccent = getFieldByRole(note, "pitch_accent")}
				<div class="flex items-center gap-4 rounded-lg border bg-card p-4">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-3">
							<span class="text-lg font-bold">{word || "—"}</span>
							{#if reading}
								<span class="text-sm text-muted-foreground">{reading}</span>
							{/if}
							{#if pitchAccent}
								<PitchAccentDisplay html={pitchAccent} />
							{/if}
						</div>
						{#if meaning}
							<p class="mt-0.5 text-sm text-muted-foreground">{meaning}</p>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#each getWkRefsForText(word) as ref (ref.character)}
							<WkBadge srsStage={ref.srs_stage} character={ref.character} kanjiId={ref.id} />
						{/each}
						<DeckSourceBadge deckName={note.deck_name} />
						{#if note.state === 0}
							<span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">New</span>
						{:else if note.due}
							{@const isDue = new Date(note.due) <= new Date()}
							{#if isDue}
								<span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900 dark:text-orange-300">Due</span>
							{/if}
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
