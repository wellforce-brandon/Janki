<script lang="ts">
import { getDb } from "$lib/db/database";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { speakJapanese } from "$lib/tts/speech";

let query = $state("");
let kanjiResults = $state<KanjiLevelItem[]>([]);
let searching = $state(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function parseMeanings(json: string): string {
	try {
		return (JSON.parse(json) as string[]).join(", ");
	} catch {
		return json;
	}
}

async function search(q: string) {
	if (q.trim().length === 0) {
		kanjiResults = [];
		return;
	}

	searching = true;
	const db = await getDb();

	try {
		// Search kanji via FTS5
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
		// FTS might not be ready or query might be invalid, fall back to LIKE
		const likeQuery = `%${q.trim()}%`;
		kanjiResults = await db.select<KanjiLevelItem[]>(
			`SELECT * FROM kanji_levels
			WHERE character LIKE ? OR meanings LIKE ? OR readings_on LIKE ? OR readings_kun LIKE ?
			ORDER BY level, item_type
			LIMIT 50`,
			[likeQuery, likeQuery, likeQuery, likeQuery],
		);
	}

	searching = false;
}

function handleInput() {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => search(query), 300);
}

function openKanji(item: KanjiLevelItem) {
	navigate("kanji-detail", { id: String(item.id), character: item.character });
}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<h2 class="text-2xl font-bold">Search</h2>

	<input
		type="text"
		class="w-full rounded-lg border bg-background px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
		placeholder="Search kanji, meanings, readings..."
		bind:value={query}
		oninput={handleInput}
	/>

	{#if searching}
		<p class="text-sm text-muted-foreground">Searching...</p>
	{/if}

	{#if kanjiResults.length > 0}
		<div class="space-y-2">
			<h3 class="text-sm font-medium text-muted-foreground">
				Kanji ({kanjiResults.length} results)
			</h3>
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
								<div class="text-sm">{parseMeanings(item.meanings)}</div>
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
		</div>
	{:else if query.trim().length > 0 && !searching}
		<p class="text-center text-muted-foreground">No results found.</p>
	{/if}
</div>
