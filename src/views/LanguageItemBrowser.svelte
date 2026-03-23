<script lang="ts">
import LoadingState from "$lib/components/ui/loading-state.svelte";
import {
	getLanguageItemsByJlptAndRange,
	getLanguageItemCountsByJlpt,
	type ContentType,
	type JlptGroupCount,
	type JlptSubGroup,
	type LanguageItem,
} from "$lib/db/queries/language";
import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { getStageDots } from "$lib/utils/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

interface Props {
	contentType: ContentType;
	title: string;
}

let { contentType, title }: Props = $props();

const JLPT_ORDER = ["N5", "N4", "N3", "N2", "N1", "None"];
const JLPT_LABELS: Record<string, string> = {
	N5: "N5 -- Beginner",
	N4: "N4 -- Elementary",
	N3: "N3 -- Intermediate",
	N2: "N2 -- Upper Intermediate",
	N1: "N1 -- Advanced",
	None: "Untagged",
};

let loading = $state(true);
let tierCounts = $state<JlptGroupCount[]>([]);
let expandedTier = $state<string | null>(null);
let tierData = $state<JlptSubGroup[]>([]);
let tierLoading = $state(false);

async function load() {
	loading = true;
	const result = await getLanguageItemCountsByJlpt(contentType);
	if (result.ok) {
		tierCounts = result.data;
		// Auto-expand first tier with items
		if (tierCounts.length > 0) {
			await expandTier(tierCounts[0].jlpt_level);
		}
	} else {
		addToast(`Failed to load ${title.toLowerCase()} counts`, "error");
	}
	loading = false;
}

async function expandTier(jlptLevel: string) {
	if (expandedTier === jlptLevel) {
		expandedTier = null;
		tierData = [];
		return;
	}
	expandedTier = jlptLevel;
	tierLoading = true;
	const result = await getLanguageItemsByJlptAndRange(contentType, jlptLevel);
	if (result.ok) {
		tierData = result.data;
	} else {
		addToast(`Failed to load ${jlptLevel} items`, "error");
		tierData = [];
	}
	tierLoading = false;
}

function getTierCount(jlptLevel: string): JlptGroupCount | undefined {
	return tierCounts.find((t) => t.jlpt_level === jlptLevel);
}

function getTierPct(tier: JlptGroupCount): number {
	return tier.total > 0 ? Math.round((tier.unlocked / tier.total) * 100) : 0;
}

function getGuruPct(tier: JlptGroupCount): number {
	return tier.total > 0 ? Math.round((tier.guru_plus / tier.total) * 100) : 0;
}

function getGroupPct(group: JlptSubGroup): number {
	return group.total > 0 ? Math.round((group.unlocked / group.total) * 100) : 0;
}

function getSrsClasses(item: LanguageItem): string {
	if (item.srs_stage === 0)
		return "border-2 border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground/50";
	if (item.srs_stage === 9)
		return "bg-zinc-700 dark:bg-zinc-600 text-zinc-300 border border-transparent";
	if (!item.lesson_completed_at)
		return "bg-pink-500/30 dark:bg-pink-400/30 text-pink-600 dark:text-pink-400 border border-pink-500/50";
	if (item.srs_stage <= 4)
		return "bg-pink-500 dark:bg-pink-600 text-white border border-transparent";
	if (item.srs_stage <= 6)
		return "bg-purple-500 dark:bg-purple-600 text-white border border-transparent";
	if (item.srs_stage === 7)
		return "bg-blue-500 dark:bg-blue-600 text-white border border-transparent";
	if (item.srs_stage === 8)
		return "bg-sky-500 dark:bg-sky-600 text-white border border-transparent";
	return "bg-muted text-muted-foreground border border-transparent";
}

function getSrsTooltip(item: LanguageItem): string {
	return STAGE_NAMES[item.srs_stage] ?? "Unknown";
}

function getMeaningDisplay(item: LanguageItem): string {
	if (!item.meaning) return "";
	// Truncate long meanings
	return item.meaning.length > 30 ? item.meaning.slice(0, 28) + "..." : item.meaning;
}

function openDetail(item: LanguageItem) {
	navigate("lang-item-detail", {
		id: String(item.id),
		contentType: item.content_type,
		jlptLevel: item.jlpt_level ?? "None",
	});
}

function jumpToGroup(groupIndex: number) {
	requestAnimationFrame(() => {
		const el = document.getElementById(`subgroup-${groupIndex}`);
		if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
	});
}

$effect(() => {
	load();
});
</script>

<div class="space-y-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-2xl font-bold" tabindex="-1">{title}</h2>

		<!-- Legend -->
		<div class="flex flex-wrap items-center gap-3 text-xs">
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded border-2 border-dashed border-current opacity-30"></div>
				<span class="text-muted-foreground">Locked</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-pink-500/30 border border-pink-500/50"></div>
				<span class="text-muted-foreground">In Lessons</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-pink-500"></div>
				<span class="text-muted-foreground">Apprentice</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-purple-500"></div>
				<span class="text-muted-foreground">Guru</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-blue-500"></div>
				<span class="text-muted-foreground">Master</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-sky-500"></div>
				<span class="text-muted-foreground">Enlightened</span>
			</div>
			<div class="flex items-center gap-1.5">
				<div class="h-4 w-4 rounded bg-zinc-700 dark:bg-zinc-600"></div>
				<span class="text-muted-foreground">Burned</span>
			</div>
		</div>
	</div>

	{#if loading}
		<LoadingState message="Loading {title.toLowerCase()}..." />
	{:else if tierCounts.length === 0}
		<div class="rounded-lg border bg-card p-8 text-center">
			<p class="text-muted-foreground">No {title.toLowerCase()} items found.</p>
		</div>
	{:else}
		<!-- JLPT tier accordions -->
		<div class="space-y-3">
			{#each JLPT_ORDER as jlpt}
				{@const tier = getTierCount(jlpt)}
				{#if tier}
					<div class="rounded-lg border bg-card">
						<!-- Tier header -->
						<button
							type="button"
							class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent/50"
							onclick={() => expandTier(jlpt)}
							aria-expanded={expandedTier === jlpt}
						>
							<div class="flex items-center gap-3">
								<span class="text-lg font-semibold">{JLPT_LABELS[jlpt] ?? jlpt}</span>
								<span class="text-sm text-muted-foreground">
									{tier.total.toLocaleString()} items
								</span>
							</div>
							<div class="flex items-center gap-3">
								<div class="flex flex-col gap-1">
									<div class="flex items-center gap-2">
										<span class="w-12 text-right text-[10px] text-muted-foreground">Unlock</span>
										<div class="h-2 w-24 overflow-hidden rounded-full bg-muted">
											<div
												class="h-full rounded-full bg-green-500 transition-all"
												style="width: {getTierPct(tier)}%"
											></div>
										</div>
										<span class="text-xs text-muted-foreground">{getTierPct(tier)}%</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-12 text-right text-[10px] text-muted-foreground">Guru+</span>
										<div class="h-2 w-24 overflow-hidden rounded-full bg-muted">
											<div
												class="h-full rounded-full bg-purple-500 transition-all"
												style="width: {getGuruPct(tier)}%"
											></div>
										</div>
										<span class="text-xs text-muted-foreground">{getGuruPct(tier)}%</span>
									</div>
								</div>
								<span class="text-muted-foreground">
									{expandedTier === jlpt ? "−" : "+"}
								</span>
							</div>
						</button>

						<!-- Expanded tier content -->
						{#if expandedTier === jlpt}
							<div class="border-t px-4 pb-4 pt-3">
								{#if tierLoading}
									<LoadingState message="Loading items..." />
								{:else if tierData.length === 0}
									<p class="text-sm text-muted-foreground">No items in this tier.</p>
								{:else}
									<!-- Sub-group quick-jump tabs -->
									{#if tierData.length > 1}
										<div class="mb-4 flex flex-wrap gap-1">
											{#each tierData as group}
												{@const start = group.groupIndex * 50 + 1}
												{@const end = start + group.total - 1}
												<button
													type="button"
													class="rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-accent text-foreground"
													onclick={() => jumpToGroup(group.groupIndex)}
													aria-label="Jump to items {start}-{end}"
												>
													{start}-{end}
												</button>
											{/each}
										</div>
									{/if}

									<!-- Sub-groups -->
									<div class="space-y-6">
										{#each tierData as group}
											{@const start = group.groupIndex * 50 + 1}
											{@const end = start + group.total - 1}
											<section id="subgroup-{group.groupIndex}" class="space-y-3">
												<div class="flex items-center justify-between">
													<h3 class="text-sm font-semibold text-muted-foreground">
														Items {start}-{end}
													</h3>
													<div class="flex items-center gap-2">
														<div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
															<div
																class="h-full rounded-full bg-green-500 transition-all"
																style="width: {getGroupPct(group)}%"
															></div>
														</div>
														<span class="text-xs text-muted-foreground">
															{group.unlocked}/{group.total}
														</span>
													</div>
												</div>

												<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
													{#each group.items as item (item.id)}
														<button
															type="button"
															class="flex flex-col items-center rounded-lg p-2 transition-all hover:brightness-110 {getSrsClasses(item)}"
															onclick={() => openDetail(item)}
															title={getSrsTooltip(item)}
															aria-label="{item.primary_text} - {getMeaningDisplay(item)} ({getSrsTooltip(item)})"
														>
															<span class="text-base font-bold leading-tight">
																{item.primary_text}
															</span>
															{#if item.reading}
																<span class="mt-0.5 truncate text-[10px] leading-tight opacity-80 max-w-full">
																	{item.reading}
																</span>
															{/if}
															<span class="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-70">
																{getMeaningDisplay(item)}
															</span>
															{#if item.srs_stage >= 1 && item.srs_stage <= 4}
																{@const dots = getStageDots(item.srs_stage)}
																<div class="mt-1 flex gap-0.5">
																	{#each { length: dots.total } as _, i}
																		<div
																			class="h-1.5 w-1.5 rounded-full {i < dots.filled ? 'bg-white/80' : 'bg-white/25'}"
																		></div>
																	{/each}
																</div>
															{/if}
														</button>
													{/each}
												</div>
											</section>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
