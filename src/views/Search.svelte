<script lang="ts">
import EmptyState from "$lib/components/ui/empty-state.svelte";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
import { getDb } from "$lib/db/database";
import {
	type BuiltinSearchResult,
	type CardSearchWithType,
	searchBuiltinItems,
	searchCardsWithContentType,
} from "$lib/db/queries/language";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { speakJapanese } from "$lib/tts/speech";
import { parseMeanings } from "$lib/utils/kanji";
import { highlightMatch } from "$lib/utils/search";
import n5Data from "../../data/grammar/n5.json";

interface GrammarPoint {
	id: string;
	pattern: string;
	meaning: string;
	formation: string;
	examples: { ja: string; en: string; reading: string }[];
}

const grammarPoints = n5Data.points as GrammarPoint[];

const CONTENT_TYPES = [
	{ value: "", label: "All Types" },
	{ value: "vocabulary", label: "Vocabulary" },
	{ value: "grammar", label: "Grammar" },
	{ value: "sentence", label: "Sentences" },
	{ value: "kana", label: "Kana" },
	{ value: "kanji", label: "Kanji" },
	{ value: "radical", label: "Radicals" },
	{ value: "conjugation", label: "Conjugation" },
] as const;

let query = $state("");
let activeTab = $state("kanji");
let contentTypeFilter = $state("");
let kanjiResults = $state<KanjiLevelItem[]>([]);
let cardResults = $state<CardSearchWithType[]>([]);
let builtinResults = $state<BuiltinSearchResult[]>([]);
let searching = $state(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchInput: HTMLInputElement | undefined = $state();

let grammarResults = $derived.by(() => {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return grammarPoints
		.filter(
			(p) =>
				p.pattern.toLowerCase().includes(q) ||
				p.meaning.toLowerCase().includes(q) ||
				p.formation.toLowerCase().includes(q) ||
				p.examples.some((ex) => ex.ja.includes(query.trim()) || ex.en.toLowerCase().includes(q)),
		)
		.slice(0, 50);
});

function parseCardFields(fields: string): string {
	try {
		const parsed = JSON.parse(fields) as string[][];
		return parsed
			.map(([, val]) => val)
			.filter(Boolean)
			.join(" | ");
	} catch {
		return fields;
	}
}

function parseBuiltinData(data: string): string {
	try {
		const parsed = JSON.parse(data) as Record<string, string>;
		return Object.values(parsed).filter(Boolean).join(" | ");
	} catch {
		return data;
	}
}

const stateLabel = (s: number) =>
	s === 0 ? "New" : s === 1 ? "Learning" : s === 2 ? "Review" : "Relearning";

async function search(q: string) {
	if (q.trim().length === 0) {
		kanjiResults = [];
		cardResults = [];
		builtinResults = [];
		return;
	}

	searching = true;

	// Kanji search
	const db = await getDb();
	try {
		const ftsQuery = `${q.trim().replace(/['"]/g, "")}*`;
		kanjiResults = await db.select<KanjiLevelItem[]>(
			`SELECT kl.* FROM kanji_levels kl
			JOIN kanji_fts ON kanji_fts.rowid = kl.id
			WHERE kanji_fts MATCH ?
			ORDER BY rank
			LIMIT 50`,
			[ftsQuery],
		);
	} catch {
		const likeQuery = `%${q.trim()}%`;
		kanjiResults = await db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE character LIKE ? OR meanings LIKE ? OR readings_on LIKE ? OR readings_kun LIKE ?
			ORDER BY level, item_type
			LIMIT 50`,
			[likeQuery, likeQuery, likeQuery, likeQuery],
		);
	}

	// Card search with content type filter
	const cardResult = await searchCardsWithContentType(
		q.trim(),
		contentTypeFilter || undefined,
	);
	cardResults = cardResult.ok ? cardResult.data : [];

	// Builtin items search
	const builtinResult = await searchBuiltinItems(q.trim());
	builtinResults = builtinResult.ok ? builtinResult.data : [];

	// Filter builtins by content type if set
	if (contentTypeFilter) {
		builtinResults = builtinResults.filter((b) => b.content_type === contentTypeFilter);
	}

	searching = false;
}

function handleInput() {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => search(query), 300);
}

function handleContentTypeChange() {
	if (query.trim().length > 0) {
		search(query);
	}
}

function openKanji(item: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(item.id), character: item.character });
}

$effect(() => {
	searchInput?.focus();
});
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<h2 class="text-2xl font-bold">Search</h2>

	<div class="flex gap-3">
		<input
			bind:this={searchInput}
			type="text"
			class="flex-1 rounded-lg border bg-background px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
			placeholder="Search kanji, cards, grammar..."
			bind:value={query}
			oninput={handleInput}
		/>
		<select
			class="rounded-lg border bg-background px-3 py-2 text-sm"
			bind:value={contentTypeFilter}
			onchange={handleContentTypeChange}
		>
			{#each CONTENT_TYPES as ct}
				<option value={ct.value}>{ct.label}</option>
			{/each}
		</select>
	</div>

	{#if searching}
		<p class="text-sm text-muted-foreground">Searching...</p>
	{/if}

	{#if query.trim().length === 0}
		<EmptyState
			title="Start searching"
			description="Type a kanji, word, meaning, or grammar pattern to search across all content."
		/>
	{:else}
		<Tabs bind:value={activeTab}>
			<TabsList class="w-full">
				<TabsTrigger value="kanji" class="flex-1">
					Kanji ({kanjiResults.length})
				</TabsTrigger>
				<TabsTrigger value="cards" class="flex-1">
					Cards ({cardResults.length})
				</TabsTrigger>
				<TabsTrigger value="builtin" class="flex-1">
					Builtin ({builtinResults.length})
				</TabsTrigger>
				<TabsTrigger value="grammar" class="flex-1">
					Grammar ({grammarResults.length})
				</TabsTrigger>
			</TabsList>

			<TabsContent value="kanji">
				{#if kanjiResults.length > 0}
					<div class="space-y-1">
						{#each kanjiResults as item}
							<div class="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent">
								<button
									type="button"
									class="flex flex-1 items-center gap-3 text-left"
									onclick={() => openKanji(item)}
								>
									<span class="text-2xl font-bold">{item.character}</span>
									<div class="flex-1">
										<div class="text-sm">{@html highlightMatch(parseMeanings(item.meanings).join(", "), query)}</div>
										<div class="text-xs text-muted-foreground capitalize">
											{item.item_type} &middot; Level {item.level}
										</div>
									</div>
								</button>
								<button
									type="button"
									class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
									onclick={() => speakJapanese(item.character)}
									aria-label="Pronounce"
								>
									&#9654;
								</button>
							</div>
						{/each}
					</div>
				{:else if !searching}
					<EmptyState title="No kanji found" description="Try a different search term." />
				{/if}
			</TabsContent>

			<TabsContent value="cards">
				{#if cardResults.length > 0}
					<div class="space-y-1">
						{#each cardResults as card}
							<div class="rounded-lg border bg-card p-3 hover:bg-accent">
								<div class="text-sm">{@html highlightMatch(parseCardFields(card.fields), query)}</div>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<span>{card.deck_name}</span>
									<span>&middot;</span>
									<span>{stateLabel(card.state)}</span>
									{#if card.content_type}
										<span>&middot;</span>
										<span class="rounded bg-muted px-1.5 py-0.5 capitalize">{card.content_type}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else if !searching}
					<EmptyState
						title="No cards found"
						description="No imported cards match your search. Try importing a deck first."
					/>
				{/if}
			</TabsContent>

			<TabsContent value="builtin">
				{#if builtinResults.length > 0}
					<div class="space-y-1">
						{#each builtinResults as item}
							<div class="rounded-lg border bg-card p-3 hover:bg-accent">
								<div class="text-sm">{@html highlightMatch(parseBuiltinData(item.data), query)}</div>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<span class="rounded bg-muted px-1.5 py-0.5 capitalize">{item.content_type}</span>
									<span>&middot;</span>
									<span>{stateLabel(item.state)}</span>
								</div>
							</div>
						{/each}
					</div>
				{:else if !searching}
					<EmptyState
						title="No builtin items found"
						description="No grammar points or sentences match your search."
					/>
				{/if}
			</TabsContent>

			<TabsContent value="grammar">
				{#if grammarResults.length > 0}
					<div class="space-y-1">
						{#each grammarResults as point}
							<div class="rounded-lg border bg-card p-3 hover:bg-accent">
								<div class="flex items-center gap-3">
									<span class="text-lg font-bold text-primary">{point.pattern}</span>
									<span class="text-sm">{@html highlightMatch(point.meaning, query)}</span>
								</div>
								<p class="text-xs text-muted-foreground">{point.formation}</p>
							</div>
						{/each}
					</div>
				{:else if !searching}
					<EmptyState
						title="No grammar points found"
						description="Try searching by pattern, meaning, or keyword."
					/>
				{/if}
			</TabsContent>
		</Tabs>
	{/if}
</div>
