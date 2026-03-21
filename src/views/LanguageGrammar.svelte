<script lang="ts">
import { Volume2 } from "@lucide/svelte";
import DeckSourceBadge from "$lib/components/language/DeckSourceBadge.svelte";
import WkBadge from "$lib/components/language/WkBadge.svelte";
import { Badge } from "$lib/components/ui/badge";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getLanguageItems, findWkCrossReferences, type LanguageItem, type WkCrossReference } from "$lib/db/queries/language";
import { addToast } from "$lib/stores/toast.svelte";
import { getTts } from "$lib/tts/speech";
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
	source: "builtin" | "imported";
	deck_name?: string;
}

const levels = ["N5", "N4", "N3", "N2", "N1"];

let loading = $state(true);
let selectedLevel = $state("N5");
let searchQuery = $state("");
let expandedId = $state<string | null>(null);
let grammarPoints = $state<GrammarPoint[]>([]);
let wkRefs = $state<Map<string, WkCrossReference>>(new Map());

function parseExamples(item: LanguageItem): { ja: string; en: string; reading: string }[] {
	if (!item.example_sentences) return [];
	try {
		return (JSON.parse(item.example_sentences) as { ja: string; en: string; reading?: string }[]).map((ex) => ({
			ja: ex.ja ?? "",
			en: ex.en ?? "",
			reading: ex.reading ?? "",
		}));
	} catch {
		return [];
	}
}

async function loadGrammar() {
	loading = true;

	// Start with static builtin data
	const staticPoints: GrammarPoint[] = n5Data.points.map((p: any) => ({
		...p,
		source: "builtin" as const,
	}));

	// Load grammar items from language_items
	const result = await getLanguageItems("grammar", { limit: 500 });
	const dbPoints: GrammarPoint[] = [];
	if (result.ok) {
		for (const item of result.data) {
			const sourceDecks = item.source_decks ? JSON.parse(item.source_decks) as string[] : [];
			dbPoints.push({
				id: `lang-${item.id}`,
				pattern: item.primary_text,
				meaning: item.meaning ?? "",
				formation: item.formation ?? "",
				explanation: item.explanation ?? "",
				examples: parseExamples(item),
				related_grammar: [],
				related_kanji: [],
				tags: item.jlpt_level ? [item.jlpt_level.toLowerCase()] : [],
				source: "imported",
				deck_name: sourceDecks[0],
			});
		}
	}

	grammarPoints = [...staticPoints, ...dbPoints];

	// Batch-lookup WK cross-references for kanji in grammar patterns
	const allKanji = new Set<string>();
	for (const p of grammarPoints) {
		for (const char of p.pattern) {
			const code = char.codePointAt(0) ?? 0;
			if (code >= 0x4E00 && code <= 0x9FFF) allKanji.add(char);
		}
	}
	if (allKanji.size > 0) {
		const wkResult = await findWkCrossReferences([...allKanji]);
		if (wkResult.ok) {
			const map = new Map<string, WkCrossReference>();
			for (const ref of wkResult.data) map.set(ref.character, ref);
			wkRefs = map;
		}
	}

	loading = false;
}

let filteredPoints = $derived.by(() => {
	let points = grammarPoints;

	// Filter by JLPT level for builtin points
	if (selectedLevel) {
		points = points.filter(
			(p) => p.source === "imported" || p.tags.includes(selectedLevel.toLowerCase()) || selectedLevel === "N5",
		);
	}

	if (searchQuery.trim()) {
		const q = searchQuery.toLowerCase();
		points = points.filter(
			(p) =>
				p.pattern.toLowerCase().includes(q) ||
				p.meaning.toLowerCase().includes(q) ||
				p.tags.some((t) => t.includes(q)),
		);
	}

	return points;
});

function getWkRefsForText(text: string): WkCrossReference[] {
	const refs: WkCrossReference[] = [];
	const seen = new Set<string>();
	for (const char of text) {
		if (!seen.has(char) && wkRefs.has(char)) {
			refs.push(wkRefs.get(char)!);
			seen.add(char);
		}
	}
	return refs;
}

function toggleExpand(id: string) {
	expandedId = expandedId === id ? null : id;
}

async function speakExample(text: string) {
	const tts = getTts();
	if (!tts.isAvailable()) {
		addToast("Text-to-speech is not available on this device", "warning");
		return;
	}
	try {
		await tts.speak(text);
	} catch {
		addToast("TTS playback failed", "error");
	}
}

$effect(() => {
	loadGrammar();
});
</script>

<div class="mx-auto max-w-3xl space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Grammar</h2>
		<div class="flex gap-2">
			{#each levels as level}
				<Button
					variant={selectedLevel === level ? "default" : "outline"}
					size="sm"
					onclick={() => { selectedLevel = level; expandedId = null; }}
				>
					{level}
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

	{#if loading}
		<LoadingState message="Loading grammar..." />
	{:else}
		<p class="text-sm text-muted-foreground">
			{filteredPoints.length} grammar point{filteredPoints.length === 1 ? "" : "s"}
		</p>

		{#if filteredPoints.length === 0}
			<EmptyState
				title="No matching grammar points"
				description="Try a different search term or check another level."
			/>
		{:else}
			<div class="space-y-2">
				{#each filteredPoints as point (point.id)}
					<div id={point.id} class="rounded-lg border bg-card">
						<button
							class="flex w-full items-start justify-between p-4 text-left"
							onclick={() => toggleExpand(point.id)}
							aria-expanded={expandedId === point.id}
						>
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<span class="text-lg font-bold text-primary">{point.pattern}</span>
									<span class="text-sm text-muted-foreground">{point.meaning}</span>
									{#each getWkRefsForText(point.pattern) as ref (ref.character)}
										<WkBadge srsStage={ref.srs_stage} character={ref.character} kanjiId={ref.id} />
									{/each}
									{#if point.source === "imported" && point.deck_name}
										<DeckSourceBadge deckName={point.deck_name} />
									{/if}
								</div>
								{#if point.formation}
									<p class="text-xs text-muted-foreground">{point.formation}</p>
								{/if}
							</div>
							<span class="mt-1 text-muted-foreground">
								{expandedId === point.id ? "−" : "+"}
							</span>
						</button>

						{#if expandedId === point.id}
							<div class="space-y-4 border-t px-4 pb-4 pt-3">
								{#if point.explanation}
									<p class="text-sm">{point.explanation}</p>
								{/if}

								{#if point.examples.length > 0}
									<div class="space-y-2">
										<h4 class="text-xs font-medium uppercase text-muted-foreground">Examples</h4>
										{#each point.examples as ex}
											<div class="flex items-start gap-2 rounded-md bg-muted/50 p-3">
												<div class="min-w-0 flex-1">
													<p class="text-base font-medium">{ex.ja}</p>
													<p class="text-sm text-muted-foreground">{ex.reading}</p>
													<p class="text-sm text-muted-foreground">{ex.en}</p>
												</div>
												<button
													type="button"
													class="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
													onclick={() => speakExample(ex.ja)}
													aria-label="Speak example"
												>
													<Volume2 class="h-4 w-4" />
												</button>
											</div>
										{/each}
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
		{/if}
	{/if}
</div>
