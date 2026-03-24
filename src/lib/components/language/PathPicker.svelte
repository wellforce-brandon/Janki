<script lang="ts">
import { BookOpen, Globe, GraduationCap, Trophy } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { LEARNING_PATHS, PATH_IDS, type PathId } from "$lib/data/learning-paths";
import { clearLanguageLevelsSeed, setLanguagePath } from "$lib/db/queries/language";
import { assignLanguageLevels } from "$lib/db/seed/language-levels";
import { addToast } from "$lib/stores/toast.svelte";

interface PathStats {
	totalLevels: number;
	totalItems: number;
	itemCounts: Record<string, number>;
}

interface Props {
	onselected: () => void;
}

let { onselected }: Props = $props();

let stats = $state<Record<string, PathStats>>({});
let loadingStats = $state(true);
let selected = $state<PathId | null>(null);
let applying = $state(false);

const PATH_ICONS: Record<PathId, typeof BookOpen> = {
	n5: BookOpen,
	conversational: Globe,
	n1: GraduationCap,
	completionist: Trophy,
};

const PATH_COLORS: Record<PathId, string> = {
	n5: "border-emerald-500 bg-emerald-500/10",
	conversational: "border-blue-500 bg-blue-500/10",
	n1: "border-purple-500 bg-purple-500/10",
	completionist: "border-amber-500 bg-amber-500/10",
};

const PATH_ICON_COLORS: Record<PathId, string> = {
	n5: "text-emerald-500",
	conversational: "text-blue-500",
	n1: "text-purple-500",
	completionist: "text-amber-500",
};

const SELECTED_RING: Record<PathId, string> = {
	n5: "ring-2 ring-emerald-500",
	conversational: "ring-2 ring-blue-500",
	n1: "ring-2 ring-purple-500",
	completionist: "ring-2 ring-amber-500",
};

$effect(() => {
	loadAllStats();
});

async function loadAllStats() {
	loadingStats = true;
	const results: Record<string, PathStats> = {};
	try {
		const fetches = PATH_IDS.map(async (id) => {
			const res = await fetch(`/data/language/paths/${id}.json`);
			if (res.ok) {
				const data = await res.json();
				results[id] = {
					totalLevels: data.totalLevels,
					totalItems: data.totalItems,
					itemCounts: data.itemCounts,
				};
			}
		});
		await Promise.all(fetches);
		stats = results;
	} catch (e) {
		console.error("[PathPicker] Failed to load path stats:", e);
	} finally {
		loadingStats = false;
	}
}

async function confirmSelection() {
	if (!selected || applying) return;
	applying = true;
	try {
		const r1 = await setLanguagePath(selected);
		if (!r1.ok) {
			addToast(`Failed to save path: ${r1.error}`, "error");
			return;
		}
		const r2 = await clearLanguageLevelsSeed();
		if (!r2.ok) {
			addToast(`Failed to clear seed flag: ${r2.error}`, "error");
			return;
		}
		await assignLanguageLevels();
		addToast(`Learning path set to ${LEARNING_PATHS[selected].label}`, "success");
		onselected();
	} catch (e) {
		addToast(`Path setup failed: ${e instanceof Error ? e.message : String(e)}`, "error");
	} finally {
		applying = false;
	}
}

function formatCount(n: number): string {
	return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
	<div class="mx-auto max-w-3xl px-4">
		<div class="mb-8 text-center">
			<h1 class="text-3xl font-bold">Choose Your Learning Path</h1>
			<p class="mt-2 text-muted-foreground">
				This determines which items you'll study and how they're paced. You can change this later in Settings.
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			{#each PATH_IDS as id}
				{@const path = LEARNING_PATHS[id]}
				{@const pathStats = stats[id]}
				{@const Icon = PATH_ICONS[id]}
				{@const isSelected = selected === id}
				<button
					type="button"
					class="rounded-lg border-2 p-5 text-left transition-all hover:shadow-md {isSelected
						? `${PATH_COLORS[id]} ${SELECTED_RING[id]}`
						: 'border-border bg-card hover:border-muted-foreground/40'}"
					onclick={() => (selected = id)}
					disabled={applying}
				>
					<div class="flex items-start gap-3">
						<div class="mt-0.5 shrink-0 {PATH_ICON_COLORS[id]}">
							<Icon class="h-6 w-6" />
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="text-lg font-semibold">{path.label}</h3>
							<p class="mt-1 text-sm text-muted-foreground">
								{path.description}
							</p>
							{#if pathStats && !loadingStats}
								<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
									<span>{pathStats.totalLevels} levels</span>
									<span>{formatCount(pathStats.totalItems)} items</span>
								</div>
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#if pathStats.itemCounts.kana}
										<span class="rounded bg-teal-500/20 px-1.5 py-0.5 text-xs text-teal-600 dark:text-teal-400">
											{pathStats.itemCounts.kana} kana
										</span>
									{/if}
									{#if pathStats.itemCounts.vocabulary}
										<span class="rounded bg-purple-500/20 px-1.5 py-0.5 text-xs text-purple-600 dark:text-purple-400">
											{formatCount(pathStats.itemCounts.vocabulary)} vocab
										</span>
									{/if}
									{#if pathStats.itemCounts.grammar}
										<span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
											{pathStats.itemCounts.grammar} grammar
										</span>
									{/if}
									{#if pathStats.itemCounts.sentence}
										<span class="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400">
											{formatCount(pathStats.itemCounts.sentence)} sentences
										</span>
									{/if}
								</div>
							{:else if loadingStats}
								<div class="mt-3 h-4 w-24 animate-pulse rounded bg-muted"></div>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		</div>

		<div class="mt-6 flex justify-center">
			<Button
				class="min-w-[200px]"
				disabled={!selected || applying}
				onclick={confirmSelection}
			>
				{#if applying}
					Setting up...
				{:else if selected}
					Start with {LEARNING_PATHS[selected].label}
				{:else}
					Select a path to continue
				{/if}
			</Button>
		</div>
	</div>
</div>
