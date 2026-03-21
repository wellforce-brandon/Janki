<script lang="ts">
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import { getLanguageItems, type LanguageItem } from "$lib/db/queries/language";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let items = $state<LanguageItem[]>([]);
let searchQuery = $state("");
let expandedId = $state<number | null>(null);

const FORM_LABELS: Record<string, string> = {
	te_ta_form: "Te/Ta",
	mizenkei: "Mizenkei (Negative)",
	renyoukei: "Renyoukei (Masu)",
	dictionary: "Dictionary",
	rentaikei: "Rentaikei (Attr.)",
	kateikei: "Kateikei (Conditional)",
};

async function loadConjugation() {
	loading = true;
	const result = await getLanguageItems("conjugation", { limit: 200 });
	if (result.ok) {
		items = result.data;
	} else {
		addToast("Failed to load conjugation data", "error");
	}
	loading = false;
}

function parseForms(item: LanguageItem): Record<string, string> {
	if (!item.conjugation_forms) return {};
	try {
		return JSON.parse(item.conjugation_forms);
	} catch {
		return {};
	}
}

let filteredItems = $derived.by(() => {
	if (!searchQuery.trim()) return items;
	const q = searchQuery.toLowerCase();
	return items.filter(
		(item) =>
			item.primary_text.toLowerCase().includes(q) ||
			(item.meaning?.toLowerCase().includes(q) ?? false),
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
		<SkeletonCards count={4} columns={2} />
	{:else if filteredItems.length === 0}
		<EmptyState
			title="No conjugation data"
			description={searchQuery ? "No verbs match your search." : "No conjugation items have been seeded yet."}
		/>
	{:else}
		<p class="text-sm text-muted-foreground">{filteredItems.length} verb{filteredItems.length === 1 ? "" : "s"}</p>

		<div class="space-y-2">
			{#each filteredItems as item (item.id)}
				{@const forms = parseForms(item)}
				<div class="rounded-lg border bg-card">
					<button
						class="flex w-full items-center justify-between p-4 text-left"
						onclick={() => expandedId = expandedId === item.id ? null : item.id}
						aria-expanded={expandedId === item.id}
					>
						<div class="flex items-center gap-3">
							<span class="text-lg font-bold text-primary">{item.primary_text}</span>
							{#if item.meaning}
								<span class="text-sm text-muted-foreground">{item.meaning}</span>
							{/if}
							{#if item.verb_group}
								<span class="rounded bg-muted px-1.5 py-0.5 text-xs">{item.verb_group}</span>
							{/if}
						</div>
						<span class="text-muted-foreground">{expandedId === item.id ? "−" : "+"}</span>
					</button>

					{#if expandedId === item.id}
						<div class="border-t px-4 pb-4 pt-3">
							<table class="w-full text-sm">
								<tbody>
									{#each Object.entries(forms) as [formKey, formValue]}
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
