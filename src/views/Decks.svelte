<script lang="ts">
import DeckCard from "$lib/components/deck/DeckCard.svelte";
import DeckEditor from "$lib/components/deck/DeckEditor.svelte";
import ImportDialog from "$lib/components/deck/ImportDialog.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { type DeckWithCounts, getAllDecks } from "$lib/db/queries/decks";
import { currentView, navigate, viewParams } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import DeckBrowse from "./DeckBrowse.svelte";

let decks = $state<DeckWithCounts[]>([]);
let loading = $state(true);
let showCreate = $state(false);
let showImport = $state(false);
let editingDeck = $state<DeckWithCounts | null>(null);

async function loadDecks() {
	loading = true;
	const result = await getAllDecks();
	if (result.ok) {
		decks = result.data;
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
			<h2 class="text-2xl font-bold">Decks</h2>
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
				{#each decks as deck}
					<DeckCard {deck} onclick={() => openDeck(deck)} />
				{/each}
			</div>
		{/if}
	</div>
{/if}
