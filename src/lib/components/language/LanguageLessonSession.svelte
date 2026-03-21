<script lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import type { LanguageItem } from "$lib/db/queries/language";
import { completeLessonBatch } from "$lib/srs/language-lessons";
import { addToast } from "$lib/stores/toast.svelte";

interface Props {
	items: LanguageItem[];
	oncomplete: (count: number) => void;
}

export type LessonPhase = "teaching" | "quiz";

let { items, oncomplete }: Props = $props();

let phase = $state<LessonPhase>("teaching");
let currentIndex = $state(0);
let activeTab = $state<"info" | "examples" | "reading">("info");

// Teaching phase state
let current = $derived(phase === "teaching" ? (items[currentIndex] ?? null) : null);

// Quiz phase state
interface QuizQuestion {
	item: LanguageItem;
	answered: boolean;
	correct: boolean;
}

let quizQueue = $state<QuizQuestion[]>([]);
let quizIndex = $state(0);
let inputValue = $state("");
let feedbackState = $state<"none" | "correct" | "incorrect">("none");
let correctAnswer = $state("");
let isCompleting = $state(false);
let quizInputEl = $state<HTMLInputElement | null>(null);

$effect(() => {
	void quizIndex;
	void feedbackState;
	if (phase === "quiz" && feedbackState === "none") {
		setTimeout(() => quizInputEl?.focus(), 0);
	}
});

let currentQuiz = $derived(quizIndex < quizQueue.length ? quizQueue[quizIndex] : null);
let quizRemaining = $derived(quizQueue.length - quizQueue.filter((q) => q.answered).length);
let quizProgress = $derived(
	quizQueue.length > 0
		? Math.round(((quizQueue.length - quizRemaining) / quizQueue.length) * 100)
		: 0,
);

// --- Helpers ---

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

function getExpectedAnswer(item: LanguageItem): string {
	if (item.content_type === "kana") return item.romaji ?? item.reading ?? item.meaning ?? "";
	if (item.content_type === "sentence") return item.sentence_en ?? item.meaning ?? "";
	return item.meaning ?? "";
}

function getPlaceholder(item: LanguageItem): string {
	if (item.content_type === "kana") return "Type the romaji...";
	if (item.content_type === "sentence") return "Type the translation...";
	return "Type the meaning...";
}

function normalizeAnswer(answer: string): string {
	return answer
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ")
		.replace(/[.,!?;:'"()\[\]{}]/g, "");
}

function checkAnswer(item: LanguageItem, input: string): boolean {
	const userAnswer = normalizeAnswer(input);
	if (userAnswer.length === 0) return false;

	if (item.content_type === "kana") {
		const accepted: string[] = [];
		if (item.reading) accepted.push(normalizeAnswer(item.reading));
		if (item.meaning) accepted.push(normalizeAnswer(item.meaning));
		if (item.romaji) accepted.push(normalizeAnswer(item.romaji));
		return accepted.some((a) => a === userAnswer);
	}

	if (item.content_type === "grammar") {
		const accepted: string[] = [];
		if (item.meaning) {
			for (const m of item.meaning.split(/[;,]/)) {
				accepted.push(normalizeAnswer(m));
			}
		}
		return accepted.some((a) => a === userAnswer || userAnswer.includes(a) || a.includes(userAnswer));
	}

	if (item.content_type === "sentence") {
		const expected = normalizeAnswer(item.sentence_en ?? item.meaning ?? "");
		return expected === userAnswer || userAnswer.includes(expected) || expected.includes(userAnswer);
	}

	// vocabulary, conjugation
	const accepted: string[] = [];
	if (item.meaning) {
		for (const m of item.meaning.split(/[;,]/)) {
			accepted.push(normalizeAnswer(m));
		}
	}
	if (item.content_type === "conjugation" && item.reading) {
		accepted.push(normalizeAnswer(item.reading));
	}
	return accepted.some((a) => a === userAnswer);
}

function parseExampleSentences(json: string | null): { ja: string; en: string }[] {
	if (!json) return [];
	try {
		return JSON.parse(json) as { ja: string; en: string }[];
	} catch {
		return [];
	}
}

// --- Teaching phase ---

function goToItem(index: number) {
	if (index >= 0 && index < items.length) {
		currentIndex = index;
		activeTab = "info";
	}
}

function startQuiz() {
	phase = "quiz";
	buildQuizQueue();
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function buildQuizQueue() {
	const questions: QuizQuestion[] = [];
	const shuffled = shuffle(items);
	for (const item of shuffled) {
		questions.push({ item, answered: false, correct: false });
	}
	quizQueue = questions;
	quizIndex = 0;
	inputValue = "";
	feedbackState = "none";
}

// --- Quiz phase ---

function submitQuizAnswer() {
	if (!currentQuiz || feedbackState === "correct" || feedbackState === "incorrect") return;
	if (inputValue.trim().length === 0) return;

	const isCorrect = checkAnswer(currentQuiz.item, inputValue);

	if (isCorrect) {
		feedbackState = "correct";
		currentQuiz.answered = true;
		currentQuiz.correct = true;
		setTimeout(() => advanceQuiz(), 600);
	} else {
		feedbackState = "incorrect";
		correctAnswer = getExpectedAnswer(currentQuiz.item);
		currentQuiz.correct = false;
		// Shuffle failed question back into queue
		const failedQ = { ...currentQuiz, answered: false, correct: false };
		quizQueue = [...quizQueue.slice(0, quizIndex), ...quizQueue.slice(quizIndex + 1), failedQ];
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
	if (quizIndex >= quizQueue.length) {
		completeLesson();
	}
}

async function completeLesson() {
	isCompleting = true;
	const ids = items.map((i) => i.id);
	const result = await completeLessonBatch(ids);
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
		<!-- Item header -->
		<div class="flex flex-col items-center justify-center rounded-t-lg py-8 {getTypeColor(current.content_type)}">
			{#if current.content_type === "sentence"}
				<span class="max-w-lg px-4 text-center text-2xl font-bold text-white">{current.sentence_ja ?? current.primary_text}</span>
			{:else}
				<span class="text-5xl font-bold text-white">{current.primary_text}</span>
			{/if}
			{#if current.reading && current.content_type !== "kana"}
				<span class="mt-2 text-lg text-white/80">{current.reading}</span>
			{/if}
			<span class="mt-1 text-sm font-medium text-white/90">{current.meaning ?? ""}</span>
		</div>

		<!-- Tab navigation -->
		<div class="flex border-x border-b bg-card">
			<button
				type="button"
				class="flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
				class:border-primary={activeTab === "info"}
				class:text-primary={activeTab === "info"}
				class:border-transparent={activeTab !== "info"}
				class:text-muted-foreground={activeTab !== "info"}
				onclick={() => (activeTab = "info")}
			>
				Info
			</button>
			{#if current.example_sentences || current.sentence_en}
				<button
					type="button"
					class="flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
					class:border-primary={activeTab === "examples"}
					class:text-primary={activeTab === "examples"}
					class:border-transparent={activeTab !== "examples"}
					class:text-muted-foreground={activeTab !== "examples"}
					onclick={() => (activeTab = "examples")}
				>
					Examples
				</button>
			{/if}
			{#if current.reading || current.romaji}
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
			{#if activeTab === "info"}
				<div class="space-y-4">
					<div>
						<h4 class="text-sm font-medium text-muted-foreground">Type</h4>
						<p class="mt-1 font-medium capitalize">{getTypeLabel(current.content_type)}</p>
					</div>

					{#if current.meaning}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Meaning</h4>
							<p class="mt-1 font-medium">{current.meaning}</p>
						</div>
					{/if}

					{#if current.formation}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Formation</h4>
							<p class="mt-1 text-sm">{current.formation}</p>
						</div>
					{/if}

					{#if current.explanation}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Explanation</h4>
							<p class="mt-1 text-sm leading-relaxed">{current.explanation}</p>
						</div>
					{/if}

					{#if current.part_of_speech}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Part of Speech</h4>
							<p class="mt-1 text-sm">{current.part_of_speech}</p>
						</div>
					{/if}

					{#if current.jlpt_level}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">JLPT Level</h4>
							<p class="mt-1 text-sm">{current.jlpt_level}</p>
						</div>
					{/if}

					{#if current.conjugation_forms}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Conjugation Forms</h4>
							<p class="mt-1 text-sm">{current.conjugation_forms}</p>
						</div>
					{/if}
				</div>
			{:else if activeTab === "examples"}
				<div class="space-y-4">
					{#if current.content_type === "sentence" && current.sentence_en}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Translation</h4>
							<p class="mt-1">{current.sentence_en}</p>
						</div>
						{#if current.sentence_reading}
							<div>
								<h4 class="text-sm font-medium text-muted-foreground">Reading</h4>
								<p class="mt-1 text-sm">{current.sentence_reading}</p>
							</div>
						{/if}
					{/if}

					{#each [parseExampleSentences(current.example_sentences)] as examples}
						{#if examples.length > 0}
							<h4 class="text-sm font-medium text-muted-foreground">Example Sentences</h4>
							{#each examples as ex}
								<div class="rounded-lg border bg-muted/50 p-3">
									<p class="font-medium">{ex.ja}</p>
									<p class="mt-1 text-sm text-muted-foreground">{ex.en}</p>
								</div>
							{/each}
						{:else if !current.sentence_en}
							<p class="text-sm text-muted-foreground">No examples available.</p>
						{/if}
					{/each}
				</div>
			{:else if activeTab === "reading"}
				<div class="space-y-4">
					{#if current.reading}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Reading</h4>
							<p class="mt-1 text-lg">{current.reading}</p>
						</div>
					{/if}
					{#if current.romaji}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Romaji</h4>
							<p class="mt-1 text-lg">{current.romaji}</p>
						</div>
					{/if}
					{#if current.pitch_accent}
						<div>
							<h4 class="text-sm font-medium text-muted-foreground">Pitch Accent</h4>
							<p class="mt-1 text-sm">{current.pitch_accent}</p>
						</div>
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
						class="h-9 min-w-[36px] rounded-md border-2 px-1 text-xs font-bold text-white transition-all {getTypeColor(item.content_type)}"
						class:ring-2={i === currentIndex}
						class:ring-primary={i === currentIndex}
						class:opacity-50={i !== currentIndex}
						onclick={() => goToItem(i)}
						aria-label="Item {i + 1}: {item.primary_text}"
					>
						{item.primary_text.length > 3 ? item.primary_text.slice(0, 3) + "..." : item.primary_text}
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
			<span>{getTypeLabel(currentQuiz.item.content_type)} Meaning</span>
			<span class="font-mono">{quizRemaining} remaining</span>
		</div>

		<!-- Item display -->
		<div class="flex flex-col items-center justify-center rounded-t-lg py-10 {getTypeColor(currentQuiz.item.content_type)}">
			{#if currentQuiz.item.content_type === "sentence"}
				<span class="max-w-lg px-4 text-center text-2xl font-bold text-white">{currentQuiz.item.sentence_ja ?? currentQuiz.item.primary_text}</span>
			{:else}
				<span class="text-5xl font-bold text-white">{currentQuiz.item.primary_text}</span>
			{/if}
			{#if currentQuiz.item.reading && currentQuiz.item.content_type !== "kana"}
				<span class="mt-2 text-lg text-white/80">{currentQuiz.item.reading}</span>
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
						placeholder={getPlaceholder(currentQuiz.item)}
						bind:value={inputValue}
						bind:this={quizInputEl}
						disabled={feedbackState === "correct"}
						aria-label="Type your answer"
					/>
					{#if feedbackState === "correct"}
						<p class="text-sm font-medium text-green-600 dark:text-green-400">Correct!</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
