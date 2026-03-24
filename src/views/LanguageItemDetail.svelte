<script lang="ts">
import { ChevronLeft, ChevronRight, Volume2 } from "@lucide/svelte";
import SrsStageIndicator from "$lib/components/kanji/SrsStageIndicator.svelte";
import ContentTypeBadge from "$lib/components/language/ContentTypeBadge.svelte";
import PitchAccentDisplay from "$lib/components/language/PitchAccentDisplay.svelte";
import WkBadge from "$lib/components/language/WkBadge.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	findWkCrossReferences,
	getAdjacentLanguageItem,
	getLanguageItemById,
	type LanguageItem,
	type WkCrossReference,
} from "$lib/db/queries/language";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { sanitizeForSpeech } from "$lib/tts/sanitize-tts";
import { getTts, isTtsSpeaking, stopSpeaking } from "$lib/tts/speech.svelte";
import { safeParseJson } from "$lib/utils/common";
import { sanitizeCardHtml } from "$lib/utils/sanitize";

interface Props {
	itemId: number;
	contentType?: string;
	jlptLevel?: string;
	fromLevel?: string;
}

let { itemId, contentType, jlptLevel, fromLevel }: Props = $props();

let item = $state<LanguageItem | null>(null);
let loading = $state(true);
let prevItem = $state<LanguageItem | null>(null);
let nextItem = $state<LanguageItem | null>(null);
let wkRefs = $state<WkCrossReference[]>([]);

function getParentView(): string {
	if (fromLevel) return "lang-level";
	switch (item?.content_type ?? contentType) {
		case "vocabulary":
			return "lang-vocabulary";
		case "grammar":
			return "lang-grammar";
		case "sentence":
			return "lang-sentences";
		case "conjugation":
			return "lang-conjugation";
		default:
			return "lang-overview";
	}
}

function getParentParams(): Record<string, string> {
	if (fromLevel) return { level: fromLevel };
	return {};
}

function navigateToItem(target: LanguageItem) {
	navigate("lang-item-detail", {
		id: String(target.id),
		contentType: target.content_type,
		jlptLevel: target.jlpt_level ?? "None",
	});
}

let fetchId = 0;

async function loadItem(id: number) {
	const myId = ++fetchId;
	loading = true;
	item = null;
	prevItem = null;
	nextItem = null;
	wkRefs = [];

	try {
		const result = await getLanguageItemById(id);
		if (myId !== fetchId) {
			console.warn("[detail] fetchId mismatch after getItem", myId, fetchId);
			return;
		}
		if (result.ok) {
			item = result.data;
			if (item) {
				// Load adjacent items for keyboard nav (non-blocking)
				getAdjacentLanguageItem(item.content_type, item.jlpt_level, item.id)
					.then((adjResult) => {
						if (myId !== fetchId) return;
						if (adjResult.ok) {
							prevItem = adjResult.data.prev;
							nextItem = adjResult.data.next;
						}
					})
					.catch(console.error);

				// Load WK cross-references (non-blocking)
				const kanji = new Set<string>();
				for (const char of item.primary_text) {
					const code = char.codePointAt(0) ?? 0;
					if (code >= 0x4e00 && code <= 0x9fff) kanji.add(char);
				}
				if (kanji.size > 0) {
					findWkCrossReferences([...kanji])
						.then((wkResult) => {
							if (myId !== fetchId) return;
							if (wkResult.ok) wkRefs = wkResult.data;
						})
						.catch(console.error);
				}
			}
		} else {
			item = null;
		}
	} catch (e) {
		console.error("[LanguageItemDetail] Failed to load item:", e);
		item = null;
	}
	loading = false;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
	if (e.key === "ArrowLeft" && prevItem) navigateToItem(prevItem);
	else if (e.key === "ArrowRight" && nextItem) navigateToItem(nextItem);
}

async function speak(text: string) {
	if (isTtsSpeaking()) {
		stopSpeaking();
		return;
	}
	const tts = getTts();
	if (!tts.isAvailable()) {
		addToast("Text-to-speech is not available on this device", "warning");
		return;
	}
	try {
		await tts.speak(sanitizeForSpeech(text));
	} catch {
		addToast("TTS playback failed", "error");
	}
}

function parseExamples(json: string | null): { ja: string; en: string; reading?: string }[] {
	return safeParseJson<{ ja: string; en: string; reading?: string }[]>(json, []);
}

function parseConjugationForms(json: string | null): Record<string, string> {
	return safeParseJson<Record<string, string>>(json, {});
}

function parseRelatedItems(json: string | null): string[] {
	return safeParseJson<string[]>(json, []);
}

$effect(() => {
	loadItem(itemId);
});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="mx-auto max-w-2xl space-y-6">
	<!-- Navigation bar -->
	<div class="flex items-center gap-2">
		<Button variant="ghost" onclick={() => navigate(getParentView(), getParentParams())}>
			&larr; {fromLevel ? `Level ${fromLevel}` : "Back"}
		</Button>
		<div class="ml-auto flex gap-1">
			{#if prevItem}
				<button
					type="button"
					class="rounded-md border px-2 py-1 text-sm hover:bg-muted"
					onclick={() => navigateToItem(prevItem!)}
					aria-label="Previous: {prevItem.primary_text}"
				>
					<ChevronLeft class="inline h-4 w-4" /> {prevItem.primary_text}
				</button>
			{/if}
			{#if nextItem}
				<button
					type="button"
					class="rounded-md border px-2 py-1 text-sm hover:bg-muted"
					onclick={() => navigateToItem(nextItem!)}
					aria-label="Next: {nextItem.primary_text}"
				>
					{nextItem.primary_text} <ChevronRight class="inline h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading item details..." />
	{:else if !item}
		<EmptyState
			title="Item not found"
			description="This item doesn't exist or may have been removed."
			actionLabel="Back"
			onaction={() => navigate(getParentView(), getParentParams())}
		/>
	{:else}
		<!-- Header -->
		<div class="rounded-lg border bg-card p-6">
			<div class="flex items-start justify-between">
				<div>
					<div class="flex items-center gap-3">
						<span class="text-3xl font-bold">{item.primary_text}</span>
						<button
							type="button"
							class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
							onclick={() => speak(item!.primary_text)}
							aria-label="Speak"
						>
							<Volume2 class="h-5 w-5" />
						</button>
					</div>
					{#if item.reading}
						<p class="mt-1 text-lg text-muted-foreground">{item.reading}</p>
					{/if}
					{#if item.meaning}
						<p class="mt-2 text-base">{item.meaning}</p>
					{/if}
				</div>
				<div class="flex flex-col items-end gap-2">
					<ContentTypeBadge type={item.content_type} primaryText={item.primary_text} />
					{#if item.jlpt_level}
						<span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
							{item.jlpt_level}
						</span>
					{/if}
					{#if item.language_level}
						<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
							Lv {item.language_level}
						</span>
					{/if}
				</div>
			</div>

			<!-- Metadata row -->
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<SrsStageIndicator stage={item.srs_stage} nextReview={item.next_review} />
				{#if item.part_of_speech}
					<span class="text-sm text-muted-foreground">{item.part_of_speech}</span>
				{/if}
				{#if item.frequency_rank}
					<span class="text-xs text-muted-foreground">Freq #{item.frequency_rank}</span>
				{/if}
				{#if item.pitch_accent}
					<PitchAccentDisplay html={item.pitch_accent} />
				{/if}
			</div>

			<!-- WK cross-references -->
			{#if wkRefs.length > 0}
				<div class="mt-3 flex items-center gap-2">
					<span class="text-xs text-muted-foreground">WaniKani:</span>
					{#each wkRefs as ref (ref.character)}
						<WkBadge srsStage={ref.srs_stage} character={ref.character} kanjiId={ref.id} />
					{/each}
				</div>
			{/if}
		</div>

		<!-- Explanation (grammar) -->
		{#if item.explanation}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Explanation</h3>
				<p class="text-sm whitespace-pre-wrap">{item.explanation}</p>
			</div>
		{/if}

		<!-- Formation (grammar) -->
		{#if item.formation}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Formation</h3>
				<p class="text-sm">{item.formation}</p>
			</div>
		{/if}

		<!-- Conjugation forms -->
		{#if item.conjugation_forms}
			{@const forms = parseConjugationForms(item.conjugation_forms)}
			{#if Object.keys(forms).length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Conjugation Forms</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each Object.entries(forms) as [formName, formValue]}
							<div class="rounded-md bg-muted/50 p-2">
								<span class="text-xs text-muted-foreground">{formName}</span>
								<p class="font-medium">{formValue}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- Verb group -->
		{#if item.verb_group}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Verb Group</h3>
				<p class="text-sm">{item.verb_group}</p>
			</div>
		{/if}

		<!-- Example sentence (single) -->
		{#if item.sentence_ja}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Example Sentence</h3>
				<div class="flex items-start gap-2">
					<div class="min-w-0 flex-1">
						<p class="text-base font-medium">{item.sentence_ja}</p>
						{#if item.sentence_reading}
							<p class="text-sm text-muted-foreground">{item.sentence_reading}</p>
						{/if}
						{#if item.sentence_en}
							<p class="mt-1 text-sm text-muted-foreground">{item.sentence_en}</p>
						{/if}
					</div>
					<button
						type="button"
						class="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						onclick={() => speak(item!.sentence_ja!)}
						aria-label="Speak sentence"
					>
						<Volume2 class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}

		<!-- Example sentences (array) -->
		{#if item.example_sentences}
			{@const examples = parseExamples(item.example_sentences)}
			{#if examples.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Examples</h3>
					<div class="space-y-3">
						{#each examples as ex}
							<div class="flex items-start gap-2 rounded-md bg-muted/50 p-3">
								<div class="min-w-0 flex-1">
									<p class="text-base font-medium">{ex.ja}</p>
									{#if ex.reading}
										<p class="text-sm text-muted-foreground">{ex.reading}</p>
									{/if}
									<p class="text-sm text-muted-foreground">{ex.en}</p>
								</div>
								<button
									type="button"
									class="mt-0.5 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
									onclick={() => speak(ex.ja)}
									aria-label="Speak example"
								>
									<Volume2 class="h-4 w-4" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- Context notes -->
		{#if item.context_notes}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Notes</h3>
				<p class="text-sm whitespace-pre-wrap">{item.context_notes}</p>
			</div>
		{/if}

		<!-- Related items -->
		{#if item.related_items}
			{@const related = parseRelatedItems(item.related_items)}
			{#if related.length > 0}
				<div class="rounded-lg border bg-card p-4">
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">Related Items</h3>
					<div class="flex flex-wrap gap-2">
						{#each related as key}
							<span class="rounded-md bg-muted px-2 py-1 text-sm">{key}</span>
						{/each}
					</div>
				</div>
			{/if}
		{/if}

		<!-- Review stats -->
		{#if item.srs_stage > 0}
			<div class="rounded-lg border bg-card p-4">
				<h3 class="mb-2 text-sm font-medium text-muted-foreground">Review Stats</h3>
				<div class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
					<div>
						<span class="text-muted-foreground">Correct</span>
						<p class="font-medium">{item.correct_count}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Incorrect</span>
						<p class="font-medium">{item.incorrect_count}</p>
					</div>
					{#if item.unlocked_at}
						<div>
							<span class="text-muted-foreground">Unlocked</span>
							<p class="font-medium">{new Date(item.unlocked_at + "Z").toLocaleDateString()}</p>
						</div>
					{/if}
					{#if item.lesson_completed_at}
						<div>
							<span class="text-muted-foreground">Lesson</span>
							<p class="font-medium">{new Date(item.lesson_completed_at + "Z").toLocaleDateString()}</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Source + tags -->
		<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
			{#if item.source_decks}
				{@const decks = safeParseJson(item.source_decks, [])}
				{#each decks as deck}
					<span class="rounded bg-muted px-2 py-0.5">Source: {deck}</span>
				{/each}
			{/if}
			{#if item.tags}
				{@const tags = safeParseJson(item.tags, [])}
				{#each tags as tag}
					<span class="rounded bg-muted px-2 py-0.5">{tag}</span>
				{/each}
			{/if}
		</div>
	{/if}
</div>
