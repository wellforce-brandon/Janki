<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import n5Data from "../../data/grammar/n5.json";

interface GrammarPoint {
	id: string;
	pattern: string;
	meaning: string;
	formation: string;
	explanation: string;
	examples: { ja: string; en: string; reading: string }[];
	related_grammar: string[];
	related_kanji: string[];
	tags: string[];
}

const levels = [{ id: "N5", label: "N5", data: n5Data.points as GrammarPoint[] }];

let selectedLevel = $state("N5");
let searchQuery = $state("");
let expandedId = $state<string | null>(null);

let currentPoints = $derived(levels.find((l) => l.id === selectedLevel)?.data ?? []);

let filteredPoints = $derived(
	searchQuery.trim()
		? currentPoints.filter((p) => {
				const q = searchQuery.toLowerCase();
				return (
					p.pattern.toLowerCase().includes(q) ||
					p.meaning.toLowerCase().includes(q) ||
					p.tags.some((t) => t.includes(q)) ||
					p.examples.some((ex) => ex.ja.includes(searchQuery) || ex.en.toLowerCase().includes(q))
				);
			})
		: currentPoints,
);

function toggleExpand(id: string) {
	expandedId = expandedId === id ? null : id;
}

function navigateToRelated(grammarId: string) {
	const point = currentPoints.find((p) => p.id === grammarId);
	if (point) {
		expandedId = grammarId;
		const el = document.getElementById(grammarId);
		el?.scrollIntoView({ behavior: "smooth", block: "start" });
	}
}
</script>

<div class="mx-auto max-w-3xl space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Grammar Reference</h2>
		<div class="flex gap-2">
			{#each levels as level}
				<Button
					variant={selectedLevel === level.id ? "default" : "outline"}
					size="sm"
					onclick={() => { selectedLevel = level.id; expandedId = null; }}
				>
					{level.label}
				</Button>
			{/each}
		</div>
	</div>

	<input
		type="text"
		placeholder="Search grammar points..."
		class="w-full rounded-md border bg-background px-3 py-2 text-sm"
		value={searchQuery}
		oninput={(e) => { searchQuery = (e.target as HTMLInputElement).value; }}
	/>

	<p class="text-sm text-muted-foreground">
		{filteredPoints.length} grammar point{filteredPoints.length === 1 ? "" : "s"}
	</p>

	<div class="space-y-2">
		{#each filteredPoints as point (point.id)}
			<div id={point.id} class="rounded-lg border bg-card">
				<button
					class="flex w-full items-start justify-between p-4 text-left"
					onclick={() => toggleExpand(point.id)}
				>
					<div class="space-y-1">
						<div class="flex items-center gap-3">
							<span class="text-lg font-bold text-primary">{point.pattern}</span>
							<span class="text-sm text-muted-foreground">{point.meaning}</span>
						</div>
						<p class="text-xs text-muted-foreground">{point.formation}</p>
					</div>
					<span class="mt-1 text-muted-foreground">
						{expandedId === point.id ? "−" : "+"}
					</span>
				</button>

				{#if expandedId === point.id}
					<div class="space-y-4 border-t px-4 pb-4 pt-3">
						<p class="text-sm">{point.explanation}</p>

						<div class="space-y-2">
							<h4 class="text-xs font-medium uppercase text-muted-foreground">Examples</h4>
							{#each point.examples as ex}
								<div class="rounded-md bg-muted/50 p-3">
									<p class="text-base font-medium">{ex.ja}</p>
									<p class="text-sm text-muted-foreground">{ex.reading}</p>
									<p class="text-sm text-muted-foreground">{ex.en}</p>
								</div>
							{/each}
						</div>

						{#if point.related_grammar.length > 0}
							<div class="space-y-1">
								<h4 class="text-xs font-medium uppercase text-muted-foreground">Related Grammar</h4>
								<div class="flex flex-wrap gap-1">
									{#each point.related_grammar as relId}
										{@const rel = currentPoints.find((p) => p.id === relId)}
										{#if rel}
											<button
												class="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
												onclick={() => navigateToRelated(relId)}
											>
												{rel.pattern}
											</button>
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						{#if point.tags.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each point.tags as tag}
									<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
										{tag}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
