<script lang="ts">
import DeckSourceBadge from "$lib/components/language/DeckSourceBadge.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getNotesByContentType, type NoteWithContentInfo } from "$lib/db/queries/language";
import { addToast } from "$lib/stores/toast.svelte";

interface ConjugationItem {
	stem: string;
	meaning: string;
	forms: Record<string, string>;
	deck_name: string;
	note_id: number;
}

let loading = $state(true);
let items = $state<ConjugationItem[]>([]);
let searchQuery = $state("");
let expandedId = $state<number | null>(null);

const FORM_LABELS: Record<string, string> = {
	DictionaryForm: "Dictionary",
	TeTaForm: "Te/Ta",
	Base1: "Base 1 (Negative)",
	Base2: "Base 2 (Masu)",
	Base3: "Base 3 (Dictionary)",
	Base4: "Base 4 (Conditional)",
	Base5: "Base 5 (Volitional)",
	PoliteForm: "Polite",
	NegativeForm: "Negative",
	PastForm: "Past",
	PassiveForm: "Passive",
	CausativeForm: "Causative",
	PotentialForm: "Potential",
	ImperativeForm: "Imperative",
};

async function loadConjugation() {
	loading = true;
	const result = await getNotesByContentType("conjugation", { limit: 200 });
	if (result.ok) {
		items = result.data.map((note) => {
			const fields = JSON.parse(note.fields);
			const stem = fields["Stem"] || fields["Verb"] || fields["Word"] || Object.values(fields)[0] || "";
			const meaning = fields["Meaning"] || fields["English"] || fields["Translation"] || Object.values(fields)[1] || "";

			// Collect all form fields
			const forms: Record<string, string> = {};
			for (const [key, value] of Object.entries(fields)) {
				if (key !== "Stem" && key !== "Verb" && key !== "Word" && key !== "Meaning" && key !== "English" && key !== "Translation" && value) {
					forms[key] = String(value);
				}
			}

			return {
				stem: String(stem),
				meaning: String(meaning),
				forms,
				deck_name: note.deck_name,
				note_id: note.note_id,
			};
		});
	} else {
		addToast("Failed to load conjugation data", "error");
	}
	loading = false;
}

let filteredItems = $derived.by(() => {
	if (!searchQuery.trim()) return items;
	const q = searchQuery.toLowerCase();
	return items.filter(
		(item) =>
			item.stem.toLowerCase().includes(q) ||
			item.meaning.toLowerCase().includes(q),
	);
});

$effect(() => {
	loadConjugation();
});
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Conjugation</h2>

	<input
		type="text"
		placeholder="Search verbs..."
		class="w-full rounded-md border bg-background px-3 py-2 text-sm"
		value={searchQuery}
		oninput={(e) => { searchQuery = (e.target as HTMLInputElement).value; }}
	/>

	{#if loading}
		<LoadingState message="Loading conjugation data..." />
	{:else if filteredItems.length === 0}
		<EmptyState
			title="No conjugation data"
			description={searchQuery ? "No verbs match your search." : "Import a conjugation deck to see verb forms here."}
		/>
	{:else}
		<p class="text-sm text-muted-foreground">{filteredItems.length} verb{filteredItems.length === 1 ? "" : "s"}</p>

		<div class="space-y-2">
			{#each filteredItems as item (item.note_id)}
				<div class="rounded-lg border bg-card">
					<button
						class="flex w-full items-center justify-between p-4 text-left"
						onclick={() => expandedId = expandedId === item.note_id ? null : item.note_id}
						aria-expanded={expandedId === item.note_id}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg font-bold text-primary">{item.stem}</span>
							<span class="text-sm text-muted-foreground">{item.meaning}</span>
							<DeckSourceBadge deckName={item.deck_name} />
						</div>
						<span class="text-muted-foreground">{expandedId === item.note_id ? "−" : "+"}</span>
					</button>

					{#if expandedId === item.note_id}
						<div class="border-t px-4 pb-4 pt-3">
							<table class="w-full text-sm">
								<tbody>
									{#each Object.entries(item.forms) as [formKey, formValue]}
										<tr class="border-b last:border-b-0">
											<td class="py-1.5 pr-4 font-medium text-muted-foreground">
												{FORM_LABELS[formKey] ?? formKey}
											</td>
											<td class="py-1.5 text-lg">{formValue}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
