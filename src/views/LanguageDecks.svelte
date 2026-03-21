<script lang="ts">
import ContentTypeBadge from "$lib/components/language/ContentTypeBadge.svelte";
import DeckCard from "$lib/components/deck/DeckCard.svelte";
import DeckEditor from "$lib/components/deck/DeckEditor.svelte";
import ImportDialog from "$lib/components/deck/ImportDialog.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { type DeckWithCounts, getAllDecks } from "$lib/db/queries/decks";
import { getDeckContentTypes } from "$lib/db/queries/language";
import { classifyDeckContent } from "$lib/import/content-classifier";
import { currentView, navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import DeckBrowse from "./DeckBrowse.svelte";

let decks = $state<DeckWithCounts[]>([]);
let deckTypes = $state<Map<number, { content_type: string; count: number }[]>>(new Map());
let loading = $state(true);
let showCreate = $state(false);
let showImport = $state(false);
let editingDeck = $state<DeckWithCounts | null>(null);
let reclassifying = $state<number | null>(null);

async function loadDecks() {
	loading = true;
	const result = await getAllDecks();
	if (result.ok) {
		decks = result.data;
		// Load content types for each deck
		const typeMap = new Map<number, { content_type: string; count: number }[]>();
		for (const deck of result.data) {
			const typesResult = await getDeckContentTypes(deck.id);
			if (typesResult.ok) {
				typeMap.set(deck.id, typesResult.data);
			}
		}
		deckTypes = typeMap;
	} else {
		addToast("Failed to load decks", "error");
	}
	loading = false;
}

function openDeck(deck: DeckWithCounts) {
	navigate("deck-browse", { deckId: String(deck.id), deckName: deck.name });
}

function handleSaved() {
	showCreate = false;
	const wasEditing = editingDeck !== null;
	editingDeck = null;
	addToast(wasEditing ? "Deck updated" : "Deck created", "success");
	loadDecks();
}

function handleImported() {
	showImport = false;
	addToast("Deck imported successfully", "success");
	loadDecks();
}

function handleDeleted() {
	editingDeck = null;
	addToast("Deck deleted", "success");
	loadDecks();
}

async function handleReclassify(deckId: number) {
	reclassifying = deckId;
	const result = await classifyDeckContent(deckId);
	if (result.ok) {
		addToast("Deck reclassified", "success");
		await loadDecks();
	} else {
		addToast("Failed to reclassify deck", "error");
	}
	reclassifying = null;
}

$effect(() => {
	loadDecks();
});
</script>

{#if currentView() === "deck-browse" && viewParams().deckId}
	<DeckBrowse deckId={Number(viewParams().deckId)} deckName={viewParams().deckName ?? "Deck"} />
{:else if showImport}
	<ImportDialog onimported={handleImported} onclose={() => (showImport = false)} />
{:else if showCreate}
	<DeckEditor mode="create" onsave={handleSaved} oncancel={() => (showCreate = false)} />
{:else if editingDeck}
	<DeckEditor
		mode="edit"
		deckId={editingDeck.id}
		initialName={editingDeck.name}
		initialDescription={editingDeck.description ?? ""}
		onsave={handleSaved}
		oncancel={() => (editingDeck = null)}
		ondelete={handleDeleted}
	/>
{:else}
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h2 class="text-2xl font-bold" tabindex="-1">Manage Decks</h2>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (showImport = true)}>Import Deck</Button>
				<Button onclick={() => (showCreate = true)}>Create Deck</Button>
			</div>
		</div>

		{#if loading}
			<LoadingState message="Loading decks..." />
		{:else if decks.length === 0}
			<EmptyState
				title="No decks yet"
				description="Import an Anki .apkg file or create a new deck to get started."
				actionLabel="Create Deck"
				onaction={() => (showCreate = true)}
				secondaryLabel="Import Deck"
				onsecondary={() => (showImport = true)}
			/>
		{:else}
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each decks as deck (deck.id)}
					<div class="flex flex-col rounded-lg border bg-card">
						<button
							type="button"
							class="flex flex-1 flex-col gap-2 p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
							onclick={() => openDeck(deck)}
						>
							<div class="flex items-center justify-between">
								<h3 class="font-semibold">{deck.name}</h3>
								{#if deck.source === "imported"}
									<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Imported</span>
								{/if}
							</div>
							{#if deck.description}
								<p class="text-sm text-muted-foreground line-clamp-2">{deck.description}</p>
							{/if}
							<div class="flex gap-4 text-sm">
								<span class="text-muted-foreground">{deck.card_count} cards</span>
								{#if deck.due_count > 0}
									<span class="text-orange-500 dark:text-orange-400">{deck.due_count} due</span>
								{/if}
								{#if deck.new_count > 0}
									<span class="text-blue-500 dark:text-blue-400">{deck.new_count} new</span>
								{/if}
							</div>
							<!-- Content type badges -->
							{#if deckTypes.get(deck.id)?.length}
								<div class="flex flex-wrap gap-1 pt-1">
									{#each deckTypes.get(deck.id) ?? [] as ct}
										<ContentTypeBadge type={ct.content_type} />
									{/each}
								</div>
							{/if}
						</button>
						<div class="flex border-t px-4 py-2">
							<button
								type="button"
								class="text-xs text-muted-foreground hover:text-foreground"
								onclick={() => (editingDeck = deck)}
							>
								Edit
							</button>
							<span class="mx-2 text-muted-foreground/30">|</span>
							<button
								type="button"
								class="text-xs text-muted-foreground hover:text-foreground"
								disabled={reclassifying === deck.id}
								onclick={() => handleReclassify(deck.id)}
							>
								{reclassifying === deck.id ? "Reclassifying..." : "Reclassify"}
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
