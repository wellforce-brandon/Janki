<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { getSettings } from "$lib/stores/app-settings.svelte";
import { getTts } from "$lib/tts/speech";
import { containsKanji, furiganaToHtml, simpleFurigana } from "$lib/utils/japanese";

interface Sentence {
	ja: string;
	en: string;
	reading: string;
}

// Built-in example sentences organized by JLPT level
// These serve as starter content; Tatoeba integration downloads more on demand
const sampleSentences: Record<string, Sentence[]> = {
	N5: [
		{ ja: "私は学生です。", en: "I am a student.", reading: "わたしはがくせいです。" },
		{ ja: "これは本です。", en: "This is a book.", reading: "これはほんです。" },
		{
			ja: "毎日日本語を勉強します。",
			en: "I study Japanese every day.",
			reading: "まいにちにほんごをべんきょうします。",
		},
		{
			ja: "明日友達と映画を見ます。",
			en: "I will watch a movie with a friend tomorrow.",
			reading: "あしたともだちとえいがをみます。",
		},
		{ ja: "駅はどこですか？", en: "Where is the station?", reading: "えきはどこですか？" },
		{
			ja: "朝ごはんを食べましたか？",
			en: "Did you eat breakfast?",
			reading: "あさごはんをたべましたか？",
		},
		{
			ja: "日本の食べ物は美味しいです。",
			en: "Japanese food is delicious.",
			reading: "にほんのたべものはおいしいです。",
		},
		{
			ja: "先生は優しい人です。",
			en: "The teacher is a kind person.",
			reading: "せんせいはやさしいひとです。",
		},
		{
			ja: "図書館で本を読みます。",
			en: "I read books at the library.",
			reading: "としょかんでほんをよみます。",
		},
		{
			ja: "来週東京に行きます。",
			en: "I am going to Tokyo next week.",
			reading: "らいしゅうとうきょうにいきます。",
		},
	],
	N4: [
		{
			ja: "日本語が話せるようになりたいです。",
			en: "I want to become able to speak Japanese.",
			reading: "にほんごがはなせるようになりたいです。",
		},
		{
			ja: "雨が降りそうですね。",
			en: "It looks like it's going to rain.",
			reading: "あめがふりそうですね。",
		},
		{
			ja: "漢字を覚えるのは大変です。",
			en: "Memorizing kanji is hard.",
			reading: "かんじをおぼえるのはたいへんです。",
		},
		{
			ja: "電車に乗る前に切符を買います。",
			en: "I buy a ticket before getting on the train.",
			reading: "でんしゃにのるまえにきっぷをかいます。",
		},
		{
			ja: "彼女は料理が上手です。",
			en: "She is good at cooking.",
			reading: "かのじょはりょうりがじょうずです。",
		},
		{
			ja: "窓を開けてもいいですか？",
			en: "May I open the window?",
			reading: "まどをあけてもいいですか？",
		},
		{
			ja: "薬を飲まなければなりません。",
			en: "I must take medicine.",
			reading: "くすりをのまなければなりません。",
		},
		{
			ja: "この映画は見たことがあります。",
			en: "I have seen this movie before.",
			reading: "このえいがはみたことがあります。",
		},
	],
};

let selectedLevel = $state("N5");
let showFurigana = $state(true);
let showTranslation = $state(false);
let currentIndex = $state(0);

let sentences = $derived(sampleSentences[selectedLevel] ?? []);
let currentSentence = $derived(sentences[currentIndex]);

let furiganaHtml = $derived.by(() => {
	if (!currentSentence) return "";
	const segments = simpleFurigana(currentSentence.ja, currentSentence.reading);
	return furiganaToHtml(segments);
});

function nextSentence() {
	if (currentIndex < sentences.length - 1) {
		currentIndex++;
	} else {
		currentIndex = 0;
	}
	showTranslation = false;
}

function prevSentence() {
	if (currentIndex > 0) {
		currentIndex--;
	} else {
		currentIndex = sentences.length - 1;
	}
	showTranslation = false;
}

function speakSentence() {
	if (!currentSentence) return;
	const s = getSettings();
	if (!s.ttsEnabled) return;
	getTts().speak(currentSentence.ja);
}

function selectLevel(level: string) {
	selectedLevel = level;
	currentIndex = 0;
	showTranslation = false;
}
</script>

<div class="mx-auto max-w-3xl space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold">Reading Practice</h2>
		<div class="flex gap-2">
			{#each Object.keys(sampleSentences) as level}
				<Button
					variant={selectedLevel === level ? "default" : "outline"}
					size="sm"
					onclick={() => selectLevel(level)}
				>
					{level}
				</Button>
			{/each}
		</div>
	</div>

	<div class="flex items-center gap-4">
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={showFurigana} />
			Show furigana
		</label>
	</div>

	{#if currentSentence}
		<div class="space-y-6 rounded-lg border bg-card p-6">
			<!-- Japanese text with optional furigana -->
			<div class="text-center">
				{#if showFurigana}
					<p class="text-3xl leading-relaxed tracking-wide">
						{@html furiganaHtml}
					</p>
				{:else}
					<p class="text-3xl leading-relaxed tracking-wide">{currentSentence.ja}</p>
				{/if}
			</div>

			<!-- Reading (always hiragana) -->
			<div class="text-center">
				<p class="text-lg text-muted-foreground">{currentSentence.reading}</p>
			</div>

			<!-- Translation toggle -->
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

			<!-- Controls -->
			<div class="flex items-center justify-center gap-3">
				<Button variant="outline" size="sm" onclick={prevSentence}>Previous</Button>
				<Button variant="outline" size="sm" onclick={speakSentence}>Speak</Button>
				<Button size="sm" onclick={nextSentence}>Next</Button>
			</div>

			<p class="text-center text-xs text-muted-foreground">
				{currentIndex + 1} / {sentences.length}
			</p>
		</div>
	{:else}
		<p class="text-muted-foreground">No sentences available for this level.</p>
	{/if}

	<div class="rounded-lg border bg-muted/30 p-4">
		<h3 class="mb-2 text-sm font-medium">About Reading Practice</h3>
		<p class="text-sm text-muted-foreground">
			Practice reading Japanese sentences with furigana support. Toggle furigana on/off to test
			your kanji reading ability. Use TTS to hear native pronunciation.
		</p>
		<p class="mt-2 text-sm text-muted-foreground">
			More sentences (via Tatoeba) and dictionary lookup (via JMdict) will be available in a
			future update.
		</p>
	</div>
</div>
