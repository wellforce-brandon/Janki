<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { reviewKanjiItem, STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { addToast } from "$lib/stores/toast.svelte";
import { romajiToHiragana } from "$lib/utils/romaji-to-hiragana";

interface Props {
	items: KanjiLevelItem[];
	oncomplete: (summary: ReviewSummary) => void;
}

export interface ReviewSummary {
	reviewed: number;
	correct: number;
	totalTimeMs: number;
	unlockedCount: number;
}

type QuestionType = "meaning" | "reading";

interface ReviewQuestion {
	item: KanjiLevelItem;
	type: QuestionType;
	answered: boolean;
	correct: boolean;
}

let { items, oncomplete }: Props = $props();

// Build question queue: each item gets meaning + reading (if applicable)
function buildQueue(reviewItems: KanjiLevelItem[]): ReviewQuestion[] {
	const questions: ReviewQuestion[] = [];
	// Shuffle items
	const shuffled = [...reviewItems].sort(() => Math.random() - 0.5);
	for (const item of shuffled) {
		questions.push({ item, type: "meaning", answered: false, correct: false });
		// Radicals don't have reading questions
		if (item.item_type !== "radical") {
			questions.push({ item, type: "reading", answered: false, correct: false });
		}
	}
	return questions;
}

let queue = $state(buildQueue(items));
let currentIndex = $state(0);
let inputValue = $state("");
let feedbackState = $state<"none" | "correct" | "incorrect" | "shake">("none");
let correctAnswer = $state("");
let isProcessing = $state(false);
let sessionStartTime = $state(Date.now());
let itemStartTime = $state(Date.now());

// Track per-item results: item id -> { meaningCorrect, readingCorrect, startTime }
type ItemResult = {
	meaningCorrect: boolean | null;
	readingCorrect: boolean | null;
	startTime: number;
};
let itemResults = $state<Map<number, ItemResult>>(new Map());

function getOrCreateItemResult(itemId: number): ItemResult {
	let r = itemResults.get(itemId);
	if (!r) {
		r = { meaningCorrect: null, readingCorrect: null, startTime: Date.now() };
		itemResults.set(itemId, r);
	}
	return r;
}

// Session stats
let totalReviewed = $state(0);
let totalCorrect = $state(0);
let totalUnlocked = $state(0);

let current = $derived(currentIndex < queue.length ? queue[currentIndex] : null);
let remaining = $derived(queue.length - queue.filter((q) => q.answered).length);
let progressPercent = $derived(Math.round(((queue.length - remaining) / queue.length) * 100));

// Prompt label based on item type and question type
let promptLabel = $derived.by(() => {
	if (!current) return "";
	const typeLabel =
		current.item.item_type === "radical"
			? "Radical"
			: current.item.item_type === "kanji"
				? "Kanji"
				: "Vocabulary";
	const questionLabel =
		current.type === "meaning"
			? current.item.item_type === "radical"
				? "Name"
				: "Meaning"
			: "Reading";
	return `${typeLabel} ${questionLabel}`;
});

let isReadingQuestion = $derived(current?.type === "reading");

// Display value: convert romaji to hiragana for reading questions
let displayValue = $derived(isReadingQuestion ? romajiToHiragana(inputValue) : inputValue);

function getAcceptedMeanings(item: KanjiLevelItem): string[] {
	const meanings = JSON.parse(item.meanings) as string[];
	// Add user synonyms if present
	if (item.user_synonyms) {
		try {
			const synonyms = JSON.parse(item.user_synonyms) as string[];
			meanings.push(...synonyms);
		} catch {
			// ignore malformed synonyms
		}
	}
	return meanings.map((m) => m.toLowerCase().trim());
}

function getAcceptedReadings(item: KanjiLevelItem): string[] {
	const readings: string[] = [];
	if (item.readings_on) {
		try {
			const parsed = JSON.parse(item.readings_on) as string[];
			readings.push(...parsed);
		} catch {
			readings.push(item.readings_on);
		}
	}
	if (item.readings_kun) {
		try {
			const parsed = JSON.parse(item.readings_kun) as string[];
			readings.push(...parsed);
		} catch {
			readings.push(item.readings_kun);
		}
	}
	if (item.reading) {
		readings.push(item.reading);
	}
	return readings.map((r) => r.trim());
}

function checkAnswer(): boolean {
	if (!current) return false;

	if (current.type === "meaning") {
		const accepted = getAcceptedMeanings(current.item);
		return accepted.includes(inputValue.toLowerCase().trim());
	}

	// Reading: compare hiragana
	const accepted = getAcceptedReadings(current.item);
	const userAnswer = romajiToHiragana(inputValue).trim();
	return accepted.includes(userAnswer);
}

function getCorrectAnswerDisplay(): string {
	if (!current) return "";
	if (current.type === "meaning") {
		const meanings = JSON.parse(current.item.meanings) as string[];
		return meanings.join(", ");
	}
	const readings = getAcceptedReadings(current.item);
	return readings.join(", ");
}

async function submitAnswer() {
	if (!current || isProcessing || feedbackState === "correct" || feedbackState === "incorrect")
		return;

	const answer = inputValue.trim();
	if (answer.length === 0) return;

	const isCorrect = checkAnswer();

	if (isCorrect) {
		feedbackState = "correct";
		current.answered = true;
		current.correct = true;

		// Track per-item result
		const itemId = current.item.id;
		const result = getOrCreateItemResult(itemId);
		if (current.type === "meaning") result.meaningCorrect = true;
		else result.readingCorrect = true;

		setTimeout(() => advanceToNext(), 600);
	} else {
		feedbackState = "incorrect";
		correctAnswer = getCorrectAnswerDisplay();
		current.answered = true;
		current.correct = false;

		// Track per-item result
		const itemId = current.item.id;
		const result = getOrCreateItemResult(itemId);
		if (current.type === "meaning") result.meaningCorrect = false;
		else result.readingCorrect = false;
	}
}

function advanceToNext() {
	feedbackState = "none";
	inputValue = "";
	correctAnswer = "";
	currentIndex++;

	if (currentIndex >= queue.length) {
		processResults();
	} else {
		itemStartTime = Date.now();
	}
}

function dismissIncorrect() {
	advanceToNext();
}

async function processResults() {
	isProcessing = true;

	// Process each unique item
	const processedItems = new Set<number>();
	let unlocked = 0;

	for (const q of queue) {
		if (processedItems.has(q.item.id)) continue;
		processedItems.add(q.item.id);

		// Determine if item was answered correctly (all questions for this item must be correct)
		const itemQs = queue.filter((iq) => iq.item.id === q.item.id);
		const allCorrect = itemQs.every((iq) => iq.correct);

		const durationMs = Date.now() - (itemResults.get(q.item.id)?.startTime ?? sessionStartTime);

		const result = await reviewKanjiItem(
			q.item.id,
			allCorrect,
			q.item.srs_stage,
			q.item.level,
			durationMs,
		);

		totalReviewed++;
		if (allCorrect) totalCorrect++;
		if (result.unlockedIds.length > 0) {
			unlocked += result.unlockedIds.length;
		}
	}

	totalUnlocked = unlocked;

	if (unlocked > 0) {
		addToast(`${unlocked} new item${unlocked > 1 ? "s" : ""} unlocked!`, "success");
	}

	isProcessing = false;
	oncomplete({
		reviewed: totalReviewed,
		correct: totalCorrect,
		totalTimeMs: Date.now() - sessionStartTime,
		unlockedCount: totalUnlocked,
	});
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

// Item type background colors (WaniKani style)
function getTypeColor(itemType: string): string {
	switch (itemType) {
		case "radical":
			return "bg-blue-500 dark:bg-blue-600";
		case "kanji":
			return "bg-pink-500 dark:bg-pink-600";
		case "vocab":
			return "bg-purple-500 dark:bg-purple-600";
		default:
			return "bg-blue-500 dark:bg-blue-600";
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isProcessing && currentIndex >= queue.length}
	<div class="flex flex-col items-center justify-center gap-3 py-12">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
		<p class="text-sm text-muted-foreground">Processing reviews...</p>
	</div>
{:else if current}
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
			<span>{promptLabel}</span>
			<span class="font-mono">{remaining} remaining</span>
		</div>

		<!-- Character display -->
		<div class="flex flex-col items-center justify-center rounded-t-lg py-10 {getTypeColor(current.item.item_type)}">
			<span class="text-7xl font-bold text-white">{current.item.character}</span>
		</div>

		<!-- Input area with feedback -->
		<div
			class="rounded-b-lg border-x border-b p-4 transition-colors duration-200"
			class:bg-green-500={feedbackState === "correct"}
			class:dark:bg-green-600={feedbackState === "correct"}
			class:bg-red-500={feedbackState === "incorrect"}
			class:dark:bg-red-600={feedbackState === "incorrect"}
			class:bg-card={feedbackState === "none" || feedbackState === "shake"}
		>
			{#if feedbackState === "incorrect"}
				<!-- Incorrect: show correct answer -->
				<div class="space-y-2 text-center text-white">
					<p class="text-sm font-medium">Correct answer:</p>
					<p class="text-xl font-bold">{correctAnswer}</p>
					<p class="text-xs opacity-80">Press <kbd class="rounded border border-white/30 px-1.5 py-0.5">Enter</kbd> to continue</p>
				</div>
			{:else}
				<!-- Input field -->
				<div class="flex flex-col items-center gap-2">
					{#if isReadingQuestion}
						<!-- Reading: show converted hiragana, user types romaji -->
						<input
							type="text"
							class="w-full max-w-md rounded-md border bg-background px-4 py-3 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
							class:text-green-600={feedbackState === "correct"}
							class:dark:text-green-400={feedbackState === "correct"}
							placeholder="Type reading in romaji..."
							bind:value={inputValue}
							disabled={feedbackState === "correct" || isProcessing}
							aria-label="Type reading in romaji"
						/>
						{#if inputValue.length > 0 && displayValue !== inputValue}
							<p class="text-lg font-medium">{displayValue}</p>
						{/if}
					{:else}
						<!-- Meaning: plain text input -->
						<input
							type="text"
							class="w-full max-w-md rounded-md border bg-background px-4 py-3 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
							class:text-green-600={feedbackState === "correct"}
							class:dark:text-green-400={feedbackState === "correct"}
							placeholder="Type the {current.item.item_type === 'radical' ? 'name' : 'meaning'}..."
							bind:value={inputValue}
							disabled={feedbackState === "correct" || isProcessing}
							aria-label="Type the meaning"
						/>
					{/if}
					{#if feedbackState === "correct"}
						<p class="text-sm font-medium text-green-600 dark:text-green-400">Correct!</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Item info peek -->
		<div class="mt-4 flex justify-center gap-2 text-xs text-muted-foreground">
			<span>{STAGE_NAMES[current.item.srs_stage]}</span>
			<span>-</span>
			<span>Level {current.item.level}</span>
		</div>
	</div>
{/if}
