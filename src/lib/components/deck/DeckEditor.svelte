<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { createDeck, deleteDeck, updateDeck } from "$lib/db/queries/decks";

interface Props {
	mode: "create" | "edit";
	deckId?: number;
	initialName?: string;
	initialDescription?: string;
	onsave: () => void;
	oncancel: () => void;
	ondelete?: () => void;
}

let {
	mode,
	deckId,
	initialName = "",
	initialDescription = "",
	onsave,
	oncancel,
	ondelete,
}: Props = $props();

let name = $state(initialName);
let description = $state(initialDescription);
let saving = $state(false);
let error = $state<string | null>(null);

async function save() {
	if (!name.trim()) {
		error = "Deck name is required";
		return;
	}
	saving = true;
	error = null;

	if (mode === "create") {
		const result = await createDeck(name.trim(), description.trim() || undefined);
		if (!result.ok) error = result.error;
	} else if (deckId) {
		const result = await updateDeck(deckId, name.trim(), description.trim() || undefined);
		if (!result.ok) error = result.error;
	}

	saving = false;
	if (!error) onsave();
}

async function handleDelete() {
	if (!deckId) return;
	const confirmed = confirm("Delete this deck and all its cards? This cannot be undone.");
	if (!confirmed) return;

	const result = await deleteDeck(deckId);
	if (result.ok) {
		ondelete?.();
	} else {
		error = result.error;
	}
}
</script>

<div class="space-y-4">
	<h3 class="text-lg font-semibold">{mode === "create" ? "Create Deck" : "Edit Deck"}</h3>

	<div class="space-y-2">
		<label class="text-sm font-medium" for="deck-name">Name</label>
		<input
			id="deck-name"
			type="text"
			class="w-full rounded-md border bg-background px-3 py-2"
			bind:value={name}
			placeholder="My Deck"
		/>
	</div>

	<div class="space-y-2">
		<label class="text-sm font-medium" for="deck-desc">Description</label>
		<textarea
			id="deck-desc"
			class="w-full rounded-md border bg-background px-3 py-2"
			rows={3}
			bind:value={description}
			placeholder="Optional description"
		></textarea>
	</div>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	<div class="flex gap-2">
		<Button onclick={save} disabled={saving}>
			{saving ? "Saving..." : "Save"}
		</Button>
		<Button variant="outline" onclick={oncancel}>Cancel</Button>
		{#if mode === "edit" && deckId}
			<Button variant="destructive" onclick={handleDelete} class="ml-auto">Delete</Button>
		{/if}
	</div>
</div>
