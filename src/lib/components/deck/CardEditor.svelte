<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { type CardWithContent, deleteCard } from "$lib/db/queries/cards";
import { updateNote } from "$lib/db/queries/notes";
import { renderCardContent } from "$lib/import/deck-mapper";
import { sanitizeCardHtml } from "$lib/utils/sanitize";

interface Props {
	card: CardWithContent;
	onclose: () => void;
	onsaved: () => void;
}

let { card, onclose, onsaved }: Props = $props();

let fields = $state<Record<string, string>>({});
let tags = $state("");
let saving = $state(false);
let error = $state<string | null>(null);
let previewSide = $state<"front" | "back">("front");

// Initialize from card data
$effect(() => {
	try {
		fields = JSON.parse(card.fields) as Record<string, string>;
	} catch {
		fields = {};
	}
	try {
		const t = card.tags ? JSON.parse(card.tags) : [];
		tags = Array.isArray(t) ? t.join(", ") : "";
	} catch {
		tags = "";
	}
});

let templates = $derived.by(() => {
	try {
		const t = JSON.parse(card.card_templates) as { front: string; back: string }[];
		return t[card.template_index] ?? t[0] ?? { front: "", back: "" };
	} catch {
		return { front: "", back: "" };
	}
});

let previewHtml = $derived(
	sanitizeCardHtml(
		renderCardContent(fields, previewSide === "front" ? templates.front : templates.back),
	),
);

async function save() {
	saving = true;
	error = null;

	const tagArray = tags
		.split(",")
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	const result = await updateNote(card.note_id, fields, tagArray.length > 0 ? tagArray : undefined);
	if (result.ok) {
		onsaved();
	} else {
		error = result.error;
	}
	saving = false;
}

async function handleDelete() {
	if (!confirm("Delete this card? This cannot be undone.")) return;
	const result = await deleteCard(card.id);
	if (result.ok) {
		onsaved();
	} else {
		error = result.error;
	}
}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">Edit Card</h3>
		<Button variant="ghost" onclick={onclose}>Close</Button>
	</div>

	<!-- Fields -->
	{#each Object.entries(fields) as [name, value]}
		<div class="space-y-1">
			<label class="text-sm font-medium">{name}</label>
			<textarea
				class="w-full rounded-md border bg-background px-3 py-2 text-sm"
				rows={3}
				{value}
				oninput={(e) => { fields = { ...fields, [name]: (e.target as HTMLTextAreaElement).value }; }}
			></textarea>
		</div>
	{/each}

	<!-- Tags -->
	<div class="space-y-1">
		<label class="text-sm font-medium">Tags (comma-separated)</label>
		<input
			type="text"
			class="w-full rounded-md border bg-background px-3 py-2 text-sm"
			bind:value={tags}
			placeholder="tag1, tag2, tag3"
		/>
	</div>

	<!-- Preview -->
	<div class="space-y-2">
		<div class="flex gap-2">
			<Button
				variant={previewSide === "front" ? "default" : "outline"}
				onclick={() => (previewSide = "front")}
			>Front</Button>
			<Button
				variant={previewSide === "back" ? "default" : "outline"}
				onclick={() => (previewSide = "back")}
			>Back</Button>
		</div>
		<div class="min-h-[100px] rounded-lg border bg-card p-4">
			{@html previewHtml}
		</div>
	</div>

	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}

	<div class="flex gap-2">
		<Button onclick={save} disabled={saving}>
			{saving ? "Saving..." : "Save"}
		</Button>
		<Button variant="outline" onclick={onclose}>Cancel</Button>
		<Button variant="destructive" onclick={handleDelete} class="ml-auto">Delete</Button>
	</div>
</div>
