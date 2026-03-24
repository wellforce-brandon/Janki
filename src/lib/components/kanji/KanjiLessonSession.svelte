<script lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import {
	getItemsContainingComponent,
	type KanjiLevelItem,
	markLessonCompleted,
	updateUserNotes,
	updateUserSynonyms,
} from "$lib/db/queries/kanji";
import { addToast } from "$lib/stores/toast.svelte";
import { fisherYatesShuffle, getTypeColor } from "$lib/utils/kanji";
import {
	getAcceptedMeanings,
	getAcceptedReadings,
	getCorrectDisplay,
	isKunReadingForKanji,
	normalizeKanjiAnswer,
	parseJsonArray,
} from "$lib/utils/kanji-validation";
import { romajiToHiragana } from "$lib/utils/romaji-to-hiragana";
import { sanitizeMnemonicHtml } from "$lib/utils/sanitize";

interface Props {
	items: KanjiLevelItem[];
	oncomplete: (count: number) => void;
}

export type LessonPhase = "teaching" | "quiz";

let { items, oncomplete }: Props = $props();

let phase = $state<LessonPhase>("teaching");
let currentIndex = $state(0);
let activeTab = $state<"meaning" | "examples" | "reading">("meaning");

// Teaching phase state
let current = $derived(phase === "teaching" ? (items[currentIndex] ?? null) : null);
let foundInKanji = $state<KanjiLevelItem[]>([]);
let loadingFoundInKanji = $state(false);

$effect(() => {
	const item = current;
	let cancelled = false;
	if (item?.item_type === "radical" && item.wk_id) {
		loadingFoundInKanji = true;
		foundInKanji = [];
		getItemsContainingComponent(item.wk_id, "kanji").then((result) => {
			if (cancelled) return;
			if (result.ok) foundInKanji = result.data;
			loadingFoundInKanji = false;
		});
	} else {
		foundInKanji = [];
	}
	return () => {
		cancelled = true;
	};
});

let editingNotes = $state(false);
let notesInput = $state("");
let synonymInput = $state("");

// Quiz phase state
type QuestionType = "meaning" | "reading";

interface QuizQuestion {
	item: KanjiLevelItem;
	type: QuestionType;
	answered: boolean;
	correct: boolean;
}

let quizQueue = $state<QuizQuestion[]>([]);
let quizIndex = $state(0);
let inputValue = $state("");
let feedbackState = $state<"none" | "correct" | "incorrect" | "shake">("none");
let correctAnswer = $state("");
let isCompleting = $state(false);
let quizInputEl = $state<HTMLInputElement | null>(null);
let activeTimers: ReturnType<typeof setTimeout>[] = [];

function safeTimeout(fn: () => void, ms: number) {
	const id = setTimeout(fn, ms);
	activeTimers.push(id);
	return id;
}

// Clear all timers on component destroy
$effect(() => () => activeTimers.forEach(clearTimeout));

$effect(() => {
	// Auto-focus the quiz input whenever the question changes
	void quizIndex;
	void feedbackState;
	if (phase === "quiz" && feedbackState === "none") {
		// Use tick to wait for DOM update
		safeTimeout(() => quizInputEl?.focus(), 0);
	}
});

let currentQuiz = $derived(quizIndex < quizQueue.length ? quizQueue[quizIndex] : null);
let quizRemaining = $derived(quizQueue.length - quizQueue.filter((q) => q.answered).length);
let quizProgress = $derived(
	quizQueue.length > 0
		? Math.round(((quizQueue.length - quizRemaining) / quizQueue.length) * 100)
		: 0,
);

// --- Teaching phase ---

function goToItem(index: number) {
	if (index >= 0 && index < items.length) {
		currentIndex = index;
		activeTab = "meaning";
		editingNotes = false;
	}
}

function startQuiz() {
	phase = "quiz";
	buildQuizQueue();
}

function buildQuizQueue() {
	const questions: QuizQuestion[] = [];
	const shuffled = fisherYatesShuffle(items);
	for (const item of shuffled) {
		questions.push({ item, type: "meaning", answered: false, correct: false });
		if (item.item_type !== "radical") {
			questions.push({ item, type: "reading", answered: false, correct: false });
		}
	}
	quizQueue = questions;
	quizIndex = 0;
	inputValue = "";
	feedbackState = "none";
}

function getMeanings(item: KanjiLevelItem): string[] {
	return parseJsonArray(item.meanings);
}

function getReadingsDisplay(item: KanjiLevelItem): { on: string[]; kun: string[] } {
	return {
		on: parseJsonArray(item.readings_on),
		kun: parseJsonArray(item.readings_kun),
	};
}

function getUserSynonyms(item: KanjiLevelItem): string[] {
	return parseJsonArray(item.user_synonyms);
}

async function saveNotes() {
	if (!current) return;
	const result = await updateUserNotes(current.id, notesInput);
	if (result.ok) {
		current.user_notes = notesInput;
		editingNotes = false;
	} else {
		addToast("Failed to save notes", "error");
	}
}

async function addSynonym() {
	if (!current || !synonymInput.trim()) return;
	const existing = getUserSynonyms(current);
	existing.push(synonymInput.trim());
	const result = await updateUserSynonyms(current.id, existing);
	if (result.ok) {
		current.user_synonyms = JSON.stringify(existing);
		synonymInput = "";
	} else {
		addToast("Failed to add synonym", "error");
	}
}

// --- Quiz phase ---

let shakeMessage = $state("");

function checkQuizAnswer(): "correct" | "incorrect" | "wrong-reading-type" {
	if (!currentQuiz) return "incorrect";
	if (currentQuiz.type === "meaning") {
		const accepted = getAcceptedMeanings(currentQuiz.item);
		return accepted.includes(normalizeKanjiAnswer(inputValue)) ? "correct" : "incorrect";
	}
	if (isKunReadingForKanji(currentQuiz.item, inputValue)) {
		return "wrong-reading-type";
	}
	const accepted = getAcceptedReadings(currentQuiz.item);
	const userAnswer = romajiToHiragana(inputValue).trim();
	return accepted.includes(userAnswer) ? "correct" : "incorrect";
}

let isReadingQ = $derived(currentQuiz?.type === "reading");
let displayValue = $derived(isReadingQ ? romajiToHiragana(inputValue) : inputValue);

let quizPromptLabel = $derived.by(() => {
	if (!currentQuiz) return "";
	const typeLabel =
		currentQuiz.item.item_type === "radical"
			? "Radical"
			: currentQuiz.item.item_type === "kanji"
				? "Kanji"
				: "Vocabulary";
	const questionLabel =
		currentQuiz.type === "meaning"
			? currentQuiz.item.item_type === "radical"
				? "Name"
				: "Meaning"
			: "Reading";
	return `${typeLabel} ${questionLabel}`;
});

function submitQuizAnswer() {
	if (!currentQuiz || feedbackState === "correct" || feedbackState === "incorrect") return;
	if (inputValue.trim().length === 0) return;

	const answerResult = checkQuizAnswer();

	if (answerResult === "wrong-reading-type") {
		feedbackState = "shake";
		shakeMessage = "We're looking for the on'yomi reading";
		safeTimeout(() => {
			feedbackState = "none";
			shakeMessage = "";
		}, 1500);
		return;
	}

	if (answerResult === "correct") {
		feedbackState = "correct";
		currentQuiz.answered = true;
		currentQuiz.correct = true;
		safeTimeout(() => advanceQuiz(), 600);
	} else {
		feedbackState = "incorrect";
		correctAnswer = getCorrectDisplay(currentQuiz.item, currentQuiz.type);
		currentQuiz.correct = false;
		// Incorrect: shuffle back into queue
		const failedQ = { ...currentQuiz, answered: false, correct: false };
		// Remove current from position, re-add near end
		quizQueue = [...quizQueue.slice(0, quizIndex), ...quizQueue.slice(quizIndex + 1), failedQ];
		// quizIndex stays the same (next question slides into position)
	}
}

function advanceQuiz() {
	feedbackState = "none";
	inputValue = "";
	correctAnswer = "";
	quizIndex++;
	if (quizIndex >= quizQueue.length) {
		completeLesson();
	}
}

function dismissIncorrect() {
	feedbackState = "none";
	inputValue = "";
	correctAnswer = "";
	// quizIndex already points to the next question (we spliced the failed one out)
	if (quizIndex >= quizQueue.length) {
		completeLesson();
	}
}

async function completeLesson() {
	isCompleting = true;
	const ids = items.map((i) => i.id);
	const level = items[0]?.level ?? 1;
	const result = await markLessonCompleted(ids, level);
	if (result.ok) {
		addToast(`${items.length} item${items.length > 1 ? "s" : ""} learned!`, "success");
	} else {
		addToast("Failed to save lesson progress", "error");
	}
	isCompleting = false;
	oncomplete(items.length);
}

function handleKeydown(e: KeyboardEvent) {
	if (phase === "quiz") {
		if (e.key === "Enter") {
			e.preventDefault();
			if (feedbackState === "incorrect") {
				dismissIncorrect();
			} else if (feedbackState === "none") {
				submitQuizAnswer();
			}
		}
	} else if (phase === "teaching") {
		if (e.key === "ArrowLeft") goToItem(currentIndex - 1);
		else if (e.key === "ArrowRight") goToItem(currentIndex + 1);
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if phase === "teaching" && current}
	<div class="mx-auto max-w-2xl space-y-0">
		<!-- Character header -->
		<div class="flex flex-col items-center justify-center rounded-t-lg py-8 {getTypeColor(current.item_type)}">
			<span class="text-7xl font-bold text-white">{current.character}</span>
			<span class="mt-2 text-lg font-medium text-white/90">{getMeanings(current).join(", ")}</span>
		</div>

		<!-- Tab navigation -->
		<div class="flex border-x border-b bg-card">
			<button
				type="button"
				class="flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
				class:border-primary={activeTab === "meaning"}
				class:text-primary={activeTab === "meaning"}
				class:border-transparent={activeTab !== "meaning"}
				class:text-muted-foreground={activeTab !== "meaning"}
				onclick={() => (activeTab = "meaning")}
			>
				{current.item_type === "radical" ? "Name" : "Meaning"}
			</button>
			{#if current.item_type === "radical"}
				<button
					type="button"
					class="flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
					class:border-primary={activeTab === "examples"}
					class:text-primary={activeTab === "examples"}
					class:border-transparent={activeTab !== "examples"}
					class:text-muted-foreground={activeTab !== "examples"}
					onclick={() => (activeTab = "examples")}
				>
					Found In Kanji
				</button>
			{/if}
			{#if current.item_type !== "radical"}
				<button
					type="button"
					class="flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
					class:border-primary={activeTab === "reading"}
					class:text-primary={activeTab === "reading"}
					class:border-transparent={activeTab !== "reading"}
					class:text-muted-foreground={activeTab !== "reading"}
					onclick={() => (activeTab = "reading")}
				>
					Reading
				</button>
			{/if}
		</div>

		<!-- Tab content -->
		<div class="min-h-[200px] rounded-b-lg border-x border-b bg-card p-6">
			{#if activeTab === "meaning"}
				<div class="space-y-4">
					{#if current.mnemonic_meaning}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Mnemonic</h4>
							<p class="mt-1 text-sm leading-relaxed">{@html sanitizeMnemonicHtml(current.mnemonic_meaning)}</p>
						</div>
					{/if}

					<div>
						<h4 class="text-sm font-medium text-muted-foreground">Meanings</h4>
						<p class="mt-1 font-medium">{getMeanings(current).join(", ")}</p>
					</div>

					<!-- User notes -->
					<div>
						<h4 class="text-sm font-medium text-muted-foreground">Your Notes</h4>
						{#if editingNotes}
							<div class="mt-1 flex gap-2">
								<input
									type="text"
									class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
									bind:value={notesInput}
									placeholder="Add a note..."
								/>
								<Button size="sm" onclick={saveNotes}>Save</Button>
								<Button size="sm" variant="outline" onclick={() => (editingNotes = false)}>Cancel</Button>
							</div>
						{:else}
							<button
								type="button"
								class="mt-1 text-sm text-muted-foreground hover:text-foreground"
								onclick={() => { notesInput = current?.user_notes ?? ""; editingNotes = true; }}
							>
								{current.user_notes || "Click to add notes..."}
							</button>
						{/if}
					</div>

					<!-- User synonyms -->
					<div>
						<h4 class="text-sm font-medium text-muted-foreground">User Synonyms</h4>
						<div class="mt-1 flex flex-wrap gap-1.5">
							{#each getUserSynonyms(current) as syn}
								<span class="rounded-full bg-muted px-2.5 py-0.5 text-xs">{syn}</span>
							{/each}
						</div>
						<div class="mt-2 flex gap-2">
							<input
								type="text"
								class="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
								bind:value={synonymInput}
								placeholder="Add synonym..."
								onkeydown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSynonym(); } }}
							/>
							<Button size="sm" variant="outline" onclick={addSynonym}>Add</Button>
						</div>
					</div>
				</div>
			{:else if activeTab === "examples"}
				<div class="space-y-3">
					<h4 class="text-sm font-medium text-muted-foreground">Kanji Using This Radical</h4>
					{#if loadingFoundInKanji}
						<p class="text-sm text-muted-foreground">Loading...</p>
					{:else if foundInKanji.length > 0}
						<div class="flex flex-wrap gap-3">
							{#each foundInKanji as kanji}
								<div class="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-pink-500 bg-pink-500 px-3 py-2 text-white">
									<span class="text-2xl font-bold">{kanji.character}</span>
									<span class="text-xs">{getMeanings(kanji)[0]}</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-muted-foreground">No example kanji data available yet.</p>
					{/if}
				</div>
			{:else if activeTab === "reading"}
				{@const readings = getReadingsDisplay(current)}
				<div class="space-y-4">
					{#if current.mnemonic_reading}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Reading Mnemonic</h4>
							<p class="mt-1 text-sm leading-relaxed">{@html sanitizeMnemonicHtml(current.mnemonic_reading)}</p>
						</div>
					{/if}
					{#if readings.on.length > 0}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">On'yomi</h4>
							<p class="mt-1 text-lg">{readings.on.join(", ")}</p>
						</div>
					{/if}
					{#if readings.kun.length > 0}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Kun'yomi</h4>
							<p class="mt-1 text-lg">{readings.kun.join(", ")}</p>
						</div>
					{/if}
					{#if readings.on.length === 0 && readings.kun.length === 0}
						<p class="text-sm text-muted-foreground">No readings available.</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Batch thumbnails + navigation -->
		<div class="mt-4 flex items-center justify-between">
			<button
				type="button"
				class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
				disabled={currentIndex === 0}
				onclick={() => goToItem(currentIndex - 1)}
				aria-label="Previous item"
			>
				<ChevronLeft class="h-5 w-5" />
			</button>

			<div class="flex gap-1.5">
				{#each items as item, i}
					<button
						type="button"
						class="h-9 w-9 rounded-md border-2 text-xs font-bold text-white transition-all {getTypeColor(item.item_type)}"
						class:ring-2={i === currentIndex}
						class:ring-primary={i === currentIndex}
						class:opacity-50={i !== currentIndex}
						onclick={() => goToItem(i)}
						aria-label="Item {i + 1}: {item.character}"
					>
						{item.character}
					</button>
				{/each}
			</div>

			<button
				type="button"
				class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
				disabled={currentIndex === items.length - 1}
				onclick={() => goToItem(currentIndex + 1)}
				aria-label="Next item"
			>
				<ChevronRight class="h-5 w-5" />
			</button>
		</div>

		<!-- Quiz button -->
		<div class="mt-4 flex justify-center">
			<Button onclick={startQuiz}>Quiz &rarr;</Button>
		</div>
	</div>

{:else if phase === "quiz" && isCompleting}
	<div class="flex flex-col items-center justify-center gap-3 py-12">
		<div class="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
		<p class="text-sm text-muted-foreground">Saving lesson progress...</p>
	</div>

{:else if phase === "quiz" && currentQuiz}
	<div class="mx-auto max-w-2xl space-y-0">
		<!-- Progress bar -->
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-primary transition-all duration-300"
				style="width: {quizProgress}%"
			></div>
		</div>

		<div class="flex items-center justify-between py-2 text-sm text-muted-foreground">
			<span>{quizPromptLabel}</span>
			<span class="font-mono">{quizRemaining} remaining</span>
		</div>

		<!-- Character display -->
		<div class="flex flex-col items-center justify-center rounded-t-lg py-10 {getTypeColor(currentQuiz.item.item_type)}">
			<span class="text-7xl font-bold text-white">{currentQuiz.item.character}</span>
		</div>

		<!-- Input area with feedback -->
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
					{#if isReadingQ}
						<input
							type="text"
							class="w-full max-w-md rounded-md border bg-background px-4 py-3 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
							class:text-green-600={feedbackState === "correct"}
							class:dark:text-green-400={feedbackState === "correct"}
							placeholder="Type reading in romaji..."
							bind:value={inputValue}
							bind:this={quizInputEl}
							disabled={feedbackState === "correct"}
							aria-label="Type reading in romaji"
						/>
						{#if inputValue.length > 0 && displayValue !== inputValue}
							<p class="text-lg font-medium">{displayValue}</p>
						{/if}
					{:else}
						<input
							type="text"
							class="w-full max-w-md rounded-md border bg-background px-4 py-3 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary"
							class:text-green-600={feedbackState === "correct"}
							class:dark:text-green-400={feedbackState === "correct"}
							placeholder="Type the {currentQuiz.item.item_type === 'radical' ? 'name' : 'meaning'}..."
							bind:value={inputValue}
							bind:this={quizInputEl}
							disabled={feedbackState === "correct"}
							aria-label="Type the meaning"
						/>
					{/if}
					{#if feedbackState === "correct"}
						<p class="text-sm font-medium text-green-600 dark:text-green-400">Correct!</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
