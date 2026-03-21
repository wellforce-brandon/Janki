<script lang="ts">
import { Shuffle } from "@lucide/svelte";
import DeckSourceBadge from "$lib/components/language/DeckSourceBadge.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import { Progress } from "$lib/components/ui/progress";
import { getLanguageItems, type LanguageItem } from "$lib/db/queries/language";
import { getSettings } from "$lib/stores/app-settings.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { getTts } from "$lib/tts/speech";
import { containsKanji, furiganaToHtml, simpleFurigana } from "$lib/utils/japanese";

interface SentenceItem {
	ja: string;
	en: string;
	reading: string;
	source: "builtin" | "imported";
	deck_name?: string;
}

// Builtin sample sentences carried over from Reading.svelte
const builtinSentences: Record<string, SentenceItem[]> = {
	N5: [
		{ ja: "私は学生です。", en: "I am a student.", reading: "わたしはがくせいです。", source: "builtin" },
		{ ja: "これは本です。", en: "This is a book.", reading: "これはほんです。", source: "builtin" },
		{ ja: "毎日日本語を勉強します。", en: "I study Japanese every day.", reading: "まいにちにほんごをべんきょうします。", source: "builtin" },
		{ ja: "明日友達と映画を見ます。", en: "I will watch a movie with a friend tomorrow.", reading: "あしたともだちとえいがをみます。", source: "builtin" },
		{ ja: "駅はどこですか？", en: "Where is the station?", reading: "えきはどこですか？", source: "builtin" },
		{ ja: "朝ごはんを食べましたか？", en: "Did you eat breakfast?", reading: "あさごはんをたべましたか？", source: "builtin" },
		{ ja: "日本の食べ物は美味しいです。", en: "Japanese food is delicious.", reading: "にほんのたべものはおいしいです。", source: "builtin" },
		{ ja: "先生は優しい人です。", en: "The teacher is a kind person.", reading: "せんせいはやさしいひとです。", source: "builtin" },
		{ ja: "図書館で本を読みます。", en: "I read books at the library.", reading: "としょかんでほんをよみます。", source: "builtin" },
		{ ja: "来週東京に行きます。", en: "I am going to Tokyo next week.", reading: "らいしゅうとうきょうにいきます。", source: "builtin" },
	],
	N4: [
		{ ja: "日本語が話せるようになりたいです。", en: "I want to become able to speak Japanese.", reading: "にほんごがはなせるようになりたいです。", source: "builtin" },
		{ ja: "雨が降りそうですね。", en: "It looks like it's going to rain.", reading: "あめがふりそうですね。", source: "builtin" },
		{ ja: "漢字を覚えるのは大変です。", en: "Memorizing kanji is hard.", reading: "かんじをおぼえるのはたいへんです。", source: "builtin" },
		{ ja: "電車に乗る前に切符を買います。", en: "I buy a ticket before getting on the train.", reading: "でんしゃにのるまえにきっぷをかいます。", source: "builtin" },
		{ ja: "彼女は料理が上手です。", en: "She is good at cooking.", reading: "かのじょはりょうりがじょうずです。", source: "builtin" },
		{ ja: "窓を開けてもいいですか？", en: "May I open the window?", reading: "まどをあけてもいいですか？", source: "builtin" },
		{ ja: "薬を飲まなければなりません。", en: "I must take medicine.", reading: "くすりをのまなければなりません。", source: "builtin" },
		{ ja: "この映画は見たことがあります。", en: "I have seen this movie before.", reading: "このえいがはみたことがあります。", source: "builtin" },
	],
};

type ViewMode = "reading" | "browse";

let mode = $state<ViewMode>("reading");
let loading = $state(true);
let selectedLevel = $state("N5");
let showFurigana = $state(true);
let showTranslation = $state(false);
let currentIndex = $state(0);
let shuffled = $state(false);
let shuffleOrder = $state<number[]>([]);
let importedSentences = $state<SentenceItem[]>([]);

async function loadImported() {
	loading = true;
	const result = await getLanguageItems("sentence", { limit: 200 });
	if (result.ok) {
		importedSentences = result.data.map((item) => ({
			ja: item.primary_text,
			en: item.meaning ?? "",
			reading: item.reading ?? "",
			source: "imported" as const,
			deck_name: item.source_decks ? (JSON.parse(item.source_decks) as string[])[0] : undefined,
		}));
	}
	loading = false;
}

let baseSentences = $derived.by(() => {
	const builtin = builtinSentences[selectedLevel] ?? [];
	if (mode === "browse") {
		return [...builtin, ...importedSentences];
	}
	return builtin;
});

let sentences = $derived.by(() => {
	if (!shuffled || shuffleOrder.length !== baseSentences.length) return baseSentences;
	return shuffleOrder.map((i) => baseSentences[i]);
});

let currentSentence = $derived(sentences[currentIndex]);
let progressPercent = $derived(
	sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0,
);

let furiganaHtml = $derived.by(() => {
	if (!currentSentence) return "";
	const segments = simpleFurigana(currentSentence.ja, currentSentence.reading);
	return furiganaToHtml(segments);
});

function nextSentence() {
	if (currentIndex < sentences.length - 1) currentIndex++;
	else currentIndex = 0;
	showTranslation = false;
}

function prevSentence() {
	if (currentIndex > 0) currentIndex--;
	else currentIndex = sentences.length - 1;
	showTranslation = false;
}

async function speakSentence() {
	if (!currentSentence) return;
	const s = getSettings();
	if (!s.ttsEnabled) return;
	const tts = getTts();
	if (!tts.isAvailable()) {
		addToast("Text-to-speech is not available on this device", "warning");
		return;
	}
	try {
		await tts.speak(currentSentence.ja);
	} catch {
		addToast("TTS playback failed", "error");
	}
}

function selectLevel(level: string) {
	selectedLevel = level;
	currentIndex = 0;
	showTranslation = false;
	shuffled = false;
	shuffleOrder = [];
}

function toggleShuffle() {
	if (shuffled) {
		shuffled = false;
		shuffleOrder = [];
		currentIndex = 0;
	} else {
		const order = baseSentences.map((_, i) => i);
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		shuffleOrder = order;
		shuffled = true;
		currentIndex = 0;
	}
	showTranslation = false;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
	if (mode !== "reading") return;
	switch (e.key) {
		case "ArrowLeft": prevSentence(); break;
		case "ArrowRight": nextSentence(); break;
		case "t": case "T": showTranslation = !showTranslation; break;
		case "f": case "F": showFurigana = !showFurigana; break;
		case "s": case "S": speakSentence(); break;
		default: return;
	}
	e.preventDefault();
}

$effect(() => {
	loadImported();
});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="mx-auto max-w-3xl space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold" tabindex="-1">Sentences</h2>
		<div class="flex gap-2">
			<Button
				variant={mode === "reading" ? "default" : "outline"}
				size="sm"
				onclick={() => { mode = "reading"; currentIndex = 0; }}
			>
				Reading Mode
			</Button>
			<Button
				variant={mode === "browse" ? "default" : "outline"}
				size="sm"
				onclick={() => { mode = "browse"; currentIndex = 0; }}
			>
				Browse
			</Button>
		</div>
	</div>

	{#if mode === "reading"}
		<!-- Reading mode (carried over from Reading.svelte) -->
		<div class="flex items-center gap-4">
			<div class="flex gap-2">
				{#each Object.keys(builtinSentences) as level}
					<Button
						variant={selectedLevel === level ? "default" : "outline"}
						size="sm"
						onclick={() => selectLevel(level)}
					>
						{level}
					</Button>
				{/each}
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={showFurigana} />
				Furigana
			</label>
			<Button
				variant={shuffled ? "default" : "outline"}
				size="sm"
				onclick={toggleShuffle}
				aria-label="Toggle shuffle"
			>
				<Shuffle class="mr-1.5 h-4 w-4" />
				Shuffle
			</Button>
		</div>

		{#if sentences.length === 0}
			<EmptyState title="No sentences available" description="No sentences for this level yet." />
		{:else if currentSentence}
			<div class="space-y-6 rounded-lg border bg-card p-6" aria-live="polite">
				<div class="text-center">
					{#if showFurigana && currentSentence.reading}
						<p class="text-3xl leading-relaxed tracking-wide">{@html furiganaHtml}</p>
					{:else}
						<p class="text-3xl leading-relaxed tracking-wide">{currentSentence.ja}</p>
					{/if}
				</div>

				{#if currentSentence.reading}
					<div class="text-center">
						<p class="text-lg text-muted-foreground">{currentSentence.reading}</p>
					</div>
				{/if}

				<div class="text-center">
					{#if showTranslation}
						<p class="text-base text-muted-foreground">{currentSentence.en}</p>
					{:else}
						<button
							class="text-sm text-primary hover:underline"
							onclick={() => { showTranslation = true; }}
						>
							Show translation
						</button>
					{/if}
				</div>

				{#if currentSentence.source === "imported" && currentSentence.deck_name}
					<div class="text-center">
						<DeckSourceBadge deckName={currentSentence.deck_name} />
					</div>
				{/if}

				<div class="flex items-center justify-center gap-3">
					<Button variant="outline" size="sm" onclick={prevSentence}>Previous</Button>
					<Button variant="outline" size="sm" onclick={speakSentence}>Speak</Button>
					<Button size="sm" onclick={nextSentence}>Next</Button>
				</div>

				<div class="space-y-1">
					<Progress value={progressPercent} max={100} class="h-2" />
					<p class="text-center text-xs text-muted-foreground">
						{currentIndex + 1} / {sentences.length}
					</p>
				</div>
			</div>
		{/if}

		<div class="rounded-lg border bg-muted/30 p-4">
			<h3 class="mb-2 text-sm font-medium">Keyboard Shortcuts</h3>
			<div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
				<span><kbd class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">←</kbd> Previous</span>
				<span><kbd class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">→</kbd> Next</span>
				<span><kbd class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">T</kbd> Translation</span>
				<span><kbd class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">F</kbd> Furigana</span>
				<span><kbd class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">S</kbd> Speak</span>
			</div>
		</div>
	{:else}
		<!-- Browse mode -->
		{#if loading}
			<SkeletonCards count={4} columns={2} />
		{:else if baseSentences.length === 0}
			<EmptyState
				title="No sentences found"
				description="Import a sentence deck or switch to reading mode for builtin sentences."
			/>
		{:else}
			<p class="text-sm text-muted-foreground">{baseSentences.length} sentences</p>
			<div class="space-y-2">
				{#each baseSentences as sentence, i}
					<div class="rounded-lg border bg-card p-4">
						<p class="text-lg font-medium">{sentence.ja}</p>
						{#if sentence.reading}
							<p class="mt-1 text-sm text-muted-foreground">{sentence.reading}</p>
						{/if}
						<p class="mt-1 text-sm text-muted-foreground">{sentence.en}</p>
						{#if sentence.source === "imported" && sentence.deck_name}
							<div class="mt-2">
								<DeckSourceBadge deckName={sentence.deck_name} />
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
