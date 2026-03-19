<script lang="ts">
import type { ReviewSummary } from "$lib/components/kanji/KanjiReviewSession.svelte";
import KanjiReviewSession from "$lib/components/kanji/KanjiReviewSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getBurnedItems,
	getRecentLessonItems,
	getRecentMistakeItems,
	type KanjiLevelItem,
} from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

type StudyMode = "recent-lessons" | "recent-mistakes" | "burned";

const MODES: { id: StudyMode; label: string; description: string }[] = [
	{
		id: "recent-lessons",
		label: "Recent Lessons",
		description: "Re-quiz items from your recent lesson batches. No SRS impact.",
	},
	{
		id: "recent-mistakes",
		label: "Recent Mistakes",
		description: "Practice items you answered incorrectly recently. No SRS impact.",
	},
	{
		id: "burned",
		label: "Burned Items",
		description: "Review permanently learned items to keep them fresh. No SRS impact.",
	},
];

let selectedMode = $state<StudyMode | null>(null);
let loading = $state(false);
let items = $state<KanjiLevelItem[]>([]);
let sessionActive = $state(false);
let summary = $state<ReviewSummary | null>(null);

async function selectMode(mode: StudyMode) {
	selectedMode = mode;
	loading = true;
	summary = null;

	const loaders: Record<StudyMode, () => ReturnType<typeof getRecentLessonItems>> = {
		"recent-lessons": () => getRecentLessonItems(50),
		"recent-mistakes": () => getRecentMistakeItems(50),
		burned: () => getBurnedItems(100),
	};
	const result = await loaders[mode]();

	if (result.ok) {
		items = result.data;
	} else {
		addToast("Failed to load items", "error");
		items = [];
	}
	loading = false;
}

function startSession() {
	if (items.length === 0) return;
	summary = null;
	sessionActive = true;
}

function handleComplete(result: ReviewSummary) {
	summary = result;
	sessionActive = false;
	const accuracy = result.reviewed > 0 ? Math.round((result.correct / result.reviewed) * 100) : 0;
	addToast(`Practice complete! ${accuracy}% accuracy`, "success");
}

function backToModes() {
	selectedMode = null;
	items = [];
	summary = null;
}
</script>

<div class="space-y-6">
	{#if sessionActive}
		<KanjiReviewSession {items} oncomplete={handleComplete} practiceMode={true} />
	{:else if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Extra Study</h2>
		<LoadingState message="Loading items..." />
	{:else if summary}
		<h2 class="text-2xl font-bold" tabindex="-1">Practice Complete</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-primary">
				{summary.reviewed > 0 ? Math.round((summary.correct / summary.reviewed) * 100) : 0}%
			</div>
			<p class="mt-1 text-muted-foreground">Accuracy (no SRS impact)</p>
			<div class="grid grid-cols-2 gap-4 pt-4">
				<div>
					<div class="text-2xl font-bold">{summary.reviewed}</div>
					<div class="text-xs text-muted-foreground">Reviewed</div>
				</div>
				<div>
					<div class="text-2xl font-bold text-green-500">{summary.correct}</div>
					<div class="text-xs text-muted-foreground">Correct</div>
				</div>
			</div>
			<div class="mt-6 flex justify-center gap-2">
				{#if items.length > 0}
					<Button onclick={startSession}>Practice Again</Button>
				{/if}
				<Button variant="outline" onclick={backToModes}>Choose Mode</Button>
			</div>
		</div>
	{:else if selectedMode && items.length === 0}
		<div class="flex items-center gap-2">
			<Button variant="ghost" onclick={backToModes}>&larr; Back</Button>
			<h2 class="text-2xl font-bold" tabindex="-1">Extra Study</h2>
		</div>
		<EmptyState
			title="No items available"
			description="There are no items matching this study mode yet."
			actionLabel="Choose Another Mode"
			onaction={backToModes}
		/>
	{:else if selectedMode}
		<div class="flex items-center gap-2">
			<Button variant="ghost" onclick={backToModes}>&larr; Back</Button>
			<h2 class="text-2xl font-bold" tabindex="-1">
				{MODES.find((m) => m.id === selectedMode)?.label}
			</h2>
		</div>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-primary">{items.length}</div>
			<p class="mt-2 text-muted-foreground">items available for practice</p>
			<p class="mt-1 text-xs text-muted-foreground">No SRS impact -- practice only</p>
			<div class="mt-6">
				<Button onclick={startSession}>Start Practice</Button>
			</div>
		</div>
	{:else}
		<h2 class="text-2xl font-bold" tabindex="-1">Extra Study</h2>
		<p class="text-muted-foreground">Practice without affecting your SRS progress.</p>
		<div class="grid gap-4 sm:grid-cols-3">
			{#each MODES as mode}
				<button
					type="button"
					class="rounded-lg border bg-card p-5 text-left transition-colors hover:bg-accent"
					onclick={() => selectMode(mode.id)}
				>
					<h3 class="font-medium">{mode.label}</h3>
					<p class="mt-1 text-sm text-muted-foreground">{mode.description}</p>
				</button>
			{/each}
		</div>
		<div class="pt-2">
			<Button variant="outline" onclick={() => navigate("kanji-dashboard")}>
				Back to Overview
			</Button>
		</div>
	{/if}
</div>
