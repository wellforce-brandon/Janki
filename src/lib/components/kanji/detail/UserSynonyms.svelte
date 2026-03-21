<script lang="ts">
import Badge from "$lib/components/ui/badge/badge.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { updateUserSynonyms } from "$lib/db/queries/kanji";

interface Props {
	itemId: number;
	synonymsJson: string | null;
}

let { itemId, synonymsJson }: Props = $props();

let synonyms = $state<string[]>(parseSynonyms(synonymsJson));
let newSynonym = $state("");
let saving = $state(false);

function parseSynonyms(json: string | null): string[] {
	if (!json) return [];
	try {
		return JSON.parse(json) as string[];
	} catch {
		return [];
	}
}

async function addSynonym() {
	const trimmed = newSynonym.trim();
	if (!trimmed || synonyms.includes(trimmed)) return;
	saving = true;
	const updated = [...synonyms, trimmed];
	const result = await updateUserSynonyms(itemId, updated);
	if (result.ok) {
		synonyms = updated;
		newSynonym = "";
	}
	saving = false;
}

async function removeSynonym(index: number) {
	saving = true;
	const updated = synonyms.filter((_, i) => i !== index);
	const result = await updateUserSynonyms(itemId, updated);
	if (result.ok) {
		synonyms = updated;
	}
	saving = false;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		addSynonym();
	}
}
</script>

<div class="rounded-lg border bg-card p-4 space-y-2">
	<h3 class="text-sm font-medium text-muted-foreground">User Synonyms</h3>

	{#if synonyms.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each synonyms as synonym, i}
				<Badge variant="outline" class="gap-1">
					{synonym}
					<button
						type="button"
						class="ml-0.5 text-muted-foreground hover:text-destructive"
						onclick={() => removeSynonym(i)}
						disabled={saving}
						aria-label="Remove synonym {synonym}"
					>&times;</button>
				</Badge>
			{/each}
		</div>
	{/if}

	<div class="flex gap-2">
		<input
			type="text"
			bind:value={newSynonym}
			onkeydown={handleKeydown}
			placeholder="Add synonym..."
			class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring"
			disabled={saving}
		/>
		<Button size="sm" variant="outline" onclick={addSynonym} disabled={saving || !newSynonym.trim()}>
			Add
		</Button>
	</div>
</div>
