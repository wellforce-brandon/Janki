<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";
import { reviewKanjiItem, STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { addToast } from "$lib/stores/toast.svelte";
import { fisherYatesShuffle, getTypeColor } from "$lib/utils/kanji";
import {
	getAcceptedMeanings,
	getAcceptedReadings,
	getCorrectDisplay,
	isKunReadingForKanji,
	normalizeKanjiAnswer,
} from "$lib/utils/kanji-validation";
import { romajiToHiragana } from "$lib/utils/romaji-to-hiragana";

interface Props {
	items: KanjiLevelItem[];
	oncomplete: (summary: ReviewSummary) => void;
	/** When true, skip SRS updates (extra study / practice mode) */
	practiceMode?: boolean;
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

let { items, oncomplete, practiceMode = false }: Props = $props();

// Build question queue: each item gets meaning + reading (if applicable)
function buildQueue(reviewItems: KanjiLevelItem[]): ReviewQuestion[] {
	const questions: ReviewQuestion[] = [];
	// Shuffle items
	const shuffled = fisherYatesShuffle(reviewItems);
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
	meaningIncorrectCount: number;
	readingIncorrectCount: number;
	meaningCorrect: boolean | null;
	readingCorrect: boolean | null;
	startTime: number;
};
let itemResults = $state<Map<number, ItemResult>>(new Map());
let savedItems = $state<Map<number, { allCorrect: boolean; unlockedCount: number }>>(new Map());

function getOrCreateItemResult(itemId: number): ItemResult {
	let r = itemResults.get(itemId);
	if (!r) {
		r = {
			meaningIncorrectCount: 0,
			readingIncorrectCount: 0,
			meaningCorrect: null,
			readingCorrect: null,
			startTime: Date.now(),
		};
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

let shakeMessage = $state("");

function checkAnswer(): "correct" | "incorrect" | "wrong-reading-type" {
	if (!current) return "incorrect";

	if (current.type === "meaning") {
		const accepted = getAcceptedMeanings(current.item);
		return accepted.includes(normalizeKanjiAnswer(inputValue)) ? "correct" : "incorrect";
	}

	// Reading: check for kun'yomi on kanji (shake, not wrong)
	if (isKunReadingForKanji(current.item, inputValue)) {
		return "wrong-reading-type";
	}

	const accepted = getAcceptedReadings(current.item);
	const userAnswer = romajiToHiragana(inputValue).trim();
	return accepted.includes(userAnswer) ? "correct" : "incorrect";
}

async function submitAnswer() {
	if (!current || isProcessing || feedbackState === "correct" || feedbackState === "incorrect")
		return;

	const answer = inputValue.trim();
	if (answer.length === 0) return;

	const answerResult = checkAnswer();

	if (answerResult === "wrong-reading-type") {
		// Kun'yomi entered for kanji -- shake, don't mark wrong
		feedbackState = "shake";
		shakeMessage = "We're looking for the on'yomi reading";
		setTimeout(() => {
			feedbackState = "none";
			shakeMessage = "";
		}, 1500);
		return;
	}

	if (answerResult === "correct") {
		feedbackState = "correct";
		current.answered = true;
		current.correct = true;

		const itemId = current.item.id;
		const result = getOrCreateItemResult(itemId);
		if (current.type === "meaning") result.meaningCorrect = true;
		else result.readingCorrect = true;

		await saveItemIfComplete(current.item, result);
		setTimeout(() => advanceToNext(), 600);
	} else {
		feedbackState = "incorrect";
		correctAnswer = getCorrectDisplay(current.item, current.type);
		current.answered = true;
		current.correct = false;

		const itemId = current.item.id;
		const result = getOrCreateItemResult(itemId);
		if (current.type === "meaning") {
			result.meaningCorrect = false;
			result.meaningIncorrectCount++;
		} else {
			result.readingCorrect = false;
			result.readingIncorrectCount++;
		}

		await saveItemIfComplete(current.item, result);
	}
}

/** Save SRS result as soon as both meaning and reading are answered for an item */
async function saveItemIfComplete(item: KanjiLevelItem, result: ItemResult) {
	if (savedItems.has(item.id) || practiceMode) return;

	const hasReading = item.item_type !== "radical";
	const meaningDone = result.meaningCorrect !== null;
	const readingDone = !hasReading || result.readingCorrect !== null;

	if (!meaningDone || !readingDone) return;

	const incorrectCount = result.meaningIncorrectCount + result.readingIncorrectCount;
	const allCorrect = incorrectCount === 0;
	const durationMs = Date.now() - result.startTime;

	const srsResult = await reviewKanjiItem(
		item.id,
		allCorrect,
		item.srs_stage,
		item.level,
		durationMs,
		incorrectCount,
		result.meaningIncorrectCount,
		result.readingIncorrectCount,
	);

	savedItems.set(item.id, {
		allCorrect,
		unlockedCount: srsResult.unlockedIds.length,
	});

	if (srsResult.unlockedIds.length > 0) {
		totalUnlocked += srsResult.unlockedIds.length;
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

	// Compute summary from already-saved per-item results
	const processedItems = new Set<number>();
	for (const q of queue) {
		if (processedItems.has(q.item.id)) continue;
		processedItems.add(q.item.id);

		const saved = savedItems.get(q.item.id);
		totalReviewed++;
		if (saved?.allCorrect) totalCorrect++;
	}

	if (totalUnlocked > 0) {
		addToast(`${totalUnlocked} new item${totalUnlocked > 1 ? "s" : ""} unlocked!`, "success");
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
							disabled={feedbackState === "correct" || feedbackState === "incorrect" || isProcessing}
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
							disabled={feedbackState === "correct" || feedbackState === "incorrect" || isProcessing}
							aria-label="Type the meaning"
						/>
					{/if}
					{#if feedbackState === "correct"}
						<p class="text-sm font-medium text-green-600 dark:text-green-400">Correct!</p>
					{:else if feedbackState === "shake" && shakeMessage}
						<p class="text-sm font-medium text-amber-500 dark:text-amber-400 animate-shake">{shakeMessage}</p>
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
