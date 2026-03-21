<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import type { LanguageItem } from "$lib/db/queries/language";
import { reviewLanguageItem, type LanguageReviewResult } from "$lib/srs/language-srs";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { addToast } from "$lib/stores/toast.svelte";
import { romajiToHiragana } from "$lib/utils/romaji-to-hiragana";

interface Props {
	items: LanguageItem[];
	oncomplete: (summary: ReviewSummary) => void;
}

export interface ReviewSummary {
	reviewed: number;
	correct: number;
	totalTimeMs: number;
}

let { items, oncomplete }: Props = $props();

// Shuffle items
function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

let queue = $state(shuffle(items));
let currentIndex = $state(0);
let inputValue = $state("");
let feedbackState = $state<"none" | "correct" | "incorrect">("none");
let correctAnswer = $state("");
let isProcessing = $state(false);
let sessionStartTime = $state(Date.now());
let itemStartTime = $state(Date.now());

// SRS stage change display
let stageTransition = $state<{ from: string; to: string; direction: "up" | "down" } | null>(null);

// Item info peek after answering
let showInfoPeek = $state(false);

let totalReviewed = $state(0);
let totalCorrect = $state(0);

let current = $derived(currentIndex < queue.length ? queue[currentIndex] : null);
let remaining = $derived(queue.length - currentIndex);
let progressPercent = $derived(Math.round((currentIndex / queue.length) * 100));

// Vocabulary reading uses romaji-to-hiragana conversion
let isReadingInput = $derived(
	current?.content_type === "vocabulary" && false, // vocabulary is meaning-only for now
);
let displayValue = $derived(isReadingInput ? romajiToHiragana(inputValue) : inputValue);

/** Get display label for the content type */
function getTypeLabel(type: string): string {
	const labels: Record<string, string> = {
		kana: "Kana",
		vocabulary: "Vocabulary",
		grammar: "Grammar",
		sentence: "Sentence",
		conjugation: "Conjugation",
	};
	return labels[type] ?? type;
}

/** Get the background color for the item type */
function getTypeColor(type: string): string {
	const colors: Record<string, string> = {
		kana: "bg-teal-500",
		vocabulary: "bg-purple-500",
		grammar: "bg-amber-500",
		sentence: "bg-blue-500",
		conjugation: "bg-rose-500",
	};
	return colors[type] ?? "bg-gray-500";
}

/** Normalize an answer for comparison */
function normalizeAnswer(answer: string): string {
	return answer
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[.,!?;:'"()\[\]{}]/g, "");
}

/** Fuzzy match: checks if strings share enough words for longer answers */
function fuzzyMatch(userAnswer: string, expected: string): boolean {
	// Exact match first
	if (userAnswer === expected) return true;
	// Contains match
	if (userAnswer.includes(expected) || expected.includes(userAnswer)) return true;
	// For longer meanings (3+ words), accept if 60%+ of words match
	const userWords = userAnswer.split(" ").filter(Boolean);
	const expectedWords = expected.split(" ").filter(Boolean);
	if (expectedWords.length >= 3) {
		const matching = userWords.filter((w) => expectedWords.includes(w));
		return matching.length >= Math.ceil(expectedWords.length * 0.6);
	}
	return false;
}

/** Check if user's answer is correct */
function checkAnswer(): boolean {
	if (!current) return false;

	const userAnswer = normalizeAnswer(inputValue);
	if (userAnswer.length === 0) return false;

	// For kana, accept romaji or meaning
	if (current.content_type === "kana") {
		const accepted: string[] = [];
		if (current.reading) accepted.push(normalizeAnswer(current.reading));
		if (current.meaning) accepted.push(normalizeAnswer(current.meaning));
		if (current.romaji) accepted.push(normalizeAnswer(current.romaji));
		return accepted.some((a) => a === userAnswer);
	}

	// For grammar, check meaning/explanation with fuzzy matching
	if (current.content_type === "grammar") {
		const accepted: string[] = [];
		if (current.meaning) {
			for (const m of current.meaning.split(/[;,]/)) {
				accepted.push(normalizeAnswer(m));
			}
		}
		return accepted.some((a) => fuzzyMatch(userAnswer, a));
	}

	// For sentences, check English translation with fuzzy matching
	if (current.content_type === "sentence") {
		const expected = normalizeAnswer(current.sentence_en ?? current.meaning ?? "");
		return fuzzyMatch(userAnswer, expected);
	}

	// For conjugation, check the meaning or reading
	if (current.content_type === "conjugation") {
		const accepted: string[] = [];
		if (current.meaning) accepted.push(normalizeAnswer(current.meaning));
		if (current.reading) accepted.push(normalizeAnswer(current.reading));
		return accepted.some((a) => a === userAnswer);
	}

	// Default: vocabulary -- check meaning with fuzzy matching for longer meanings
	const accepted: string[] = [];
	if (current.meaning) {
		for (const m of current.meaning.split(/[;,]/)) {
			accepted.push(normalizeAnswer(m));
		}
	}
	return accepted.some((a) => fuzzyMatch(userAnswer, a));
}

/** Get the correct answer text for display */
function getCorrectAnswerDisplay(item: LanguageItem): string {
	if (item.content_type === "kana") {
		return item.romaji ?? item.reading ?? item.meaning ?? "";
	}
	if (item.content_type === "sentence") {
		return item.sentence_en ?? item.meaning ?? "";
	}
	return item.meaning ?? "";
}

/** Get the placeholder text */
function getPlaceholder(item: LanguageItem): string {
	if (item.content_type === "kana") return "Type the romaji...";
	if (item.content_type === "sentence") return "Type the translation...";
	if (item.content_type === "conjugation") return "Type the meaning...";
	return "Type the meaning...";
}

async function submitAnswer() {
	if (!current || isProcessing || feedbackState !== "none") return;

	const answer = inputValue.trim();
	if (answer.length === 0) return;

	const isCorrect = checkAnswer();
	const durationMs = Date.now() - itemStartTime;
	const oldStage = current.srs_stage;

	if (isCorrect) {
		feedbackState = "correct";
		totalReviewed++;
		totalCorrect++;

		const result = await reviewLanguageItem(current.id, true, durationMs);
		showStageTransition(oldStage, result);
		showInfoPeek = true;

		setTimeout(() => advanceToNext(), 1200);
	} else {
		feedbackState = "incorrect";
		correctAnswer = getCorrectAnswerDisplay(current);
		totalReviewed++;

		const result = await reviewLanguageItem(current.id, false, durationMs);
		showStageTransition(oldStage, result);
		showInfoPeek = true;
	}
}

function showStageTransition(oldStage: number, result: LanguageReviewResult) {
	const fromName = STAGE_NAMES[oldStage] ?? `Stage ${oldStage}`;
	const toName = STAGE_NAMES[result.newStage] ?? `Stage ${result.newStage}`;
	stageTransition = {
		from: fromName,
		to: toName,
		direction: result.newStage > oldStage ? "up" : "down",
	};
}

function advanceToNext() {
	feedbackState = "none";
	inputValue = "";
	correctAnswer = "";
	stageTransition = null;
	showInfoPeek = false;
	currentIndex++;
	itemStartTime = Date.now();

	if (currentIndex >= queue.length) {
		oncomplete({
			reviewed: totalReviewed,
			correct: totalCorrect,
			totalTimeMs: Date.now() - sessionStartTime,
		});
	}
}

function dismissIncorrect() {
	advanceToNext();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Enter") {
		e.preventDefault();
		if (feedbackState === "incorrect") {
			dismissIncorrect();
		} else if (feedbackState === "none") {
			submitAnswer();
		}
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if current}
	<div class="mx-auto max-w-2xl space-y-0">
		<!-- Progress bar -->
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-primary transition-all duration-300"
				style="width: {progressPercent}%"
			></div>
		</div>

		<!-- Counter -->
		<div class="flex items-center justify-between py-2 text-sm text-muted-foreground">
			<span>{getTypeLabel(current.content_type)} Meaning</span>
			<span class="font-mono">{remaining} remaining</span>
		</div>

		<!-- Item display -->
		<div class="flex flex-col items-center justify-center rounded-t-lg py-10 {getTypeColor(current.content_type)}">
			{#if current.content_type === "sentence"}
				<span class="max-w-lg px-4 text-center text-2xl font-bold text-white">{current.sentence_ja ?? current.primary_text}</span>
			{:else if current.content_type === "grammar"}
				<span class="text-4xl font-bold text-white">{current.primary_text}</span>
				{#if current.formation}
					<span class="mt-2 text-sm text-white/70">{current.formation}</span>
				{/if}
			{:else}
				<span class="text-7xl font-bold text-white">{current.primary_text}</span>
			{/if}
			{#if current.reading && current.content_type !== "kana"}
				<span class="mt-2 text-lg text-white/80">{current.reading}</span>
			{/if}
		</div>

		<!-- Input area -->
		<div
			class="rounded-b-lg border-x border-b p-4 transition-colors duration-200"
			class:bg-green-500={feedbackState === "correct"}
			class:dark:bg-green-600={feedbackState === "correct"}
			class:bg-red-500={feedbackState === "incorrect"}
			class:dark:bg-red-600={feedbackState === "incorrect"}
			class:bg-card={feedbackState === "none"}
		>
			{#if feedbackState === "incorrect"}
				<div class="space-y-2 text-center text-white">
					<p class="text-sm font-medium">Correct answer:</p>
					<p class="text-xl font-bold">{correctAnswer}</p>
					<p class="text-xs opacity-80">Press <kbd class="rounded border border-white/30 px-1.5 py-0.5">Enter</kbd> to continue</p>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-2">
					<input
						type="text"
						class="w-full max-w-md rounded-md border bg-background px-4 py-3 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
						class:text-green-600={feedbackState === "correct"}
						class:dark:text-green-400={feedbackState === "correct"}
						placeholder={getPlaceholder(current)}
						bind:value={inputValue}
						disabled={feedbackState === "correct" || isProcessing}
						aria-label="Type your answer"
					/>
					{#if feedbackState === "correct"}
						<p class="text-sm font-medium text-green-600 dark:text-green-400">Correct!</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- SRS stage transition animation -->
		{#if stageTransition}
			<div class="mt-3 flex items-center justify-center gap-2 text-sm font-medium transition-all duration-300">
				<span class="text-muted-foreground">{stageTransition.from}</span>
				<span class={stageTransition.direction === "up" ? "text-green-500" : "text-red-500"}>
					{stageTransition.direction === "up" ? "\u2192" : "\u2193"}
				</span>
				<span class={stageTransition.direction === "up" ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
					{stageTransition.to}
				</span>
			</div>
		{/if}

		<!-- Item info peek (shown after answering) -->
		{#if showInfoPeek && current}
			<div class="mt-3 rounded-lg border bg-card p-4 text-sm">
				<div class="flex flex-wrap gap-x-6 gap-y-2">
					{#if current.reading}
						<div>
							<span class="text-muted-foreground">Reading: </span>
							<span class="font-medium">{current.reading}</span>
						</div>
					{/if}
					{#if current.meaning}
						<div>
							<span class="text-muted-foreground">Meaning: </span>
							<span class="font-medium">{current.meaning}</span>
						</div>
					{/if}
					{#if current.sentence_ja && current.content_type !== "sentence"}
						<div>
							<span class="text-muted-foreground">Example: </span>
							<span>{current.sentence_ja}</span>
						</div>
					{/if}
					{#if current.sentence_en}
						<div>
							<span class="text-muted-foreground">Translation: </span>
							<span>{current.sentence_en}</span>
						</div>
					{/if}
					{#if current.formation}
						<div>
							<span class="text-muted-foreground">Formation: </span>
							<span>{current.formation}</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Item info (when no peek) -->
		{#if !showInfoPeek}
			<div class="mt-4 flex justify-center gap-2 text-xs text-muted-foreground">
				<span>{STAGE_NAMES[current.srs_stage]}</span>
				{#if current.jlpt_level}
					<span>-</span>
					<span>{current.jlpt_level}</span>
				{/if}
			</div>
		{/if}
	</div>
{/if}
