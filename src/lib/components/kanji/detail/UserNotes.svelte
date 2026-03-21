<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { updateUserNotes } from "$lib/db/queries/kanji";

interface Props {
	itemId: number;
	notes: string | null;
}

let { itemId, notes }: Props = $props();

let editing = $state(false);
let draft = $state(notes ?? "");
let saving = $state(false);

async function save() {
	saving = true;
	const result = await updateUserNotes(itemId, draft);
	if (result.ok) {
		notes = draft.trim() || null;
		editing = false;
	}
	saving = false;
}

function cancel() {
	draft = notes ?? "";
	editing = false;
}
</script>

<div class="rounded-lg border bg-card p-4 space-y-2">
	<h3 class="text-sm font-medium text-muted-foreground">Notes</h3>

	{#if editing}
		<textarea
			bind:value={draft}
			rows={3}
			class="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring resize-y"
			placeholder="Add your notes..."
		></textarea>
		<div class="flex gap-2">
			<Button size="sm" onclick={save} disabled={saving}>Save</Button>
			<Button size="sm" variant="outline" onclick={cancel} disabled={saving}>Cancel</Button>
		</div>
	{:else}
		{#if notes}
			<p class="text-sm whitespace-pre-wrap">{notes}</p>
		{/if}
		<button
			type="button"
			class="text-sm text-muted-foreground hover:text-foreground"
			onclick={() => { draft = notes ?? ""; editing = true; }}
		>
			{notes ? "Edit Note" : "+ Add Note"}
		</button>
	{/if}
</div>
