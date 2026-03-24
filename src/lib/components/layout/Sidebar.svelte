<script lang="ts">
import type { View } from "$lib/stores/navigation.svelte";
import { currentView, navigate } from "$lib/stores/navigation.svelte";
import { getContentTypeCounts, type ContentTypeCount } from "$lib/db/queries/language";

interface TierFlyout {
	kind: "levels" | "items";
	/** Background color class for tier headers (items flyout only) */
	color?: string;
}

interface NavItem {
	id: View;
	label: string;
	shortcut?: string;
	subViews?: View[];
	flyout?: TierFlyout;
	hidden?: boolean;
}

interface NavSection {
	label?: string;
	items: NavItem[];
}

const TIERS = [
	{ kanji: "快", en: "Pleasant", label: "1-10", start: 1, end: 10, index: 0 },
	{ kanji: "苦", en: "Painful", label: "11-20", start: 11, end: 20, index: 1 },
	{ kanji: "死", en: "Death", label: "21-30", start: 21, end: 30, index: 2 },
	{ kanji: "地獄", en: "Hell", label: "31-40", start: 31, end: 40, index: 3 },
	{ kanji: "天国", en: "Paradise", label: "41-50", start: 41, end: 50, index: 4 },
	{ kanji: "現実", en: "Reality", label: "51-60", start: 51, end: 60, index: 5 },
];

let hasConjugation = $state(false);

async function checkConjugation() {
	const result = await getContentTypeCounts();
	if (result.ok) {
		hasConjugation = result.data.some((c: ContentTypeCount) => c.type === "conjugation" && c.total > 0);
	}
}

$effect(() => {
	checkConjugation();
});

let sections = $derived<NavSection[]>([
	{
		items: [{ id: "dashboard", label: "Dashboard", shortcut: "Ctrl+1" }],
	},
	{
		label: "Language",
		items: [
			{ id: "lang-overview", label: "Overview", shortcut: "Ctrl+2" },
			{ id: "lang-lessons", label: "Lessons", subViews: ["lang-lesson-picker"] },
			{ id: "lang-review", label: "Reviews", shortcut: "Ctrl+3" },
			{
				id: "lang-levels",
				label: "Levels",
				subViews: ["lang-level"],
				flyout: { kind: "levels" },
			},
			{ id: "lang-kana", label: "Kana" },
			{
				id: "lang-vocabulary",
				label: "Vocabulary",
				shortcut: "Ctrl+7",
				flyout: { kind: "items" as const, color: "bg-purple-500 dark:bg-purple-600" },
			},
			{
				id: "lang-grammar",
				label: "Grammar",
				shortcut: "Ctrl+5",
				flyout: { kind: "items" as const, color: "bg-amber-500 dark:bg-amber-600" },
			},
			{
				id: "lang-sentences",
				label: "Sentences",
				shortcut: "Ctrl+6",
				flyout: { kind: "items" as const, color: "bg-blue-500 dark:bg-blue-600" },
			},
			{ id: "lang-conjugation", label: "Conjugation", hidden: !hasConjugation, flyout: { kind: "items" as const, color: "bg-rose-500 dark:bg-rose-600" } },
		],
	},
	{
		label: "Kanji",
		items: [
			{ id: "kanji-dashboard", label: "Overview", shortcut: "Ctrl+4" },
			{ id: "kanji-lessons", label: "Lessons", subViews: ["kanji-lesson-picker"] },
			{ id: "kanji-review", label: "Reviews", subViews: ["kanji-extra-study"] },
			{
				id: "kanji-levels",
				label: "Levels",
				subViews: ["kanji-level"],
				flyout: { kind: "levels" },
			},
			{
				id: "kanji-radicals",
				label: "Radicals",
				subViews: ["kanji-detail"],
				flyout: { kind: "items", color: "bg-blue-500 dark:bg-blue-600" },
			},
			{
				id: "kanji-kanji",
				label: "Kanji",
				flyout: { kind: "items", color: "bg-pink-500 dark:bg-pink-600" },
			},
			{
				id: "kanji-vocabulary",
				label: "Vocabulary",
				flyout: { kind: "items", color: "bg-purple-500 dark:bg-purple-600" },
			},
		],
	},
	{
		items: [
			{ id: "stats", label: "Stats", shortcut: "Ctrl+8" },
			{ id: "search", label: "Search", shortcut: "Ctrl+F" },
			{ id: "settings", label: "Settings" },
		],
	},
]);

let openFlyout = $state<string | null>(null);
let hoverTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
let expandedTier = $state<number | null>(null);

function isActive(item: NavItem): boolean {
	const view = currentView();
	if (view === item.id) return true;
	return item.subViews?.includes(view) ?? false;
}

function showFlyout(id: string) {
	if (hoverTimeout) clearTimeout(hoverTimeout);
	expandedTier = null;
	openFlyout = id;
	activeLevelsFlyoutId = id;
}

function scheduleFlyoutClose() {
	if (hoverTimeout) clearTimeout(hoverTimeout);
	hoverTimeout = setTimeout(() => {
		openFlyout = null;
		expandedTier = null;
	}, 200);
}

function keepFlyoutOpen() {
	if (hoverTimeout) clearTimeout(hoverTimeout);
}

let activeLevelsFlyoutId = $state<string | null>(null);

function handleLevelClick(level: number) {
	const target = activeLevelsFlyoutId === "lang-levels" ? "lang-level" : "kanji-level";
	openFlyout = null;
	expandedTier = null;
	activeLevelsFlyoutId = null;
	navigate(target, { level: String(level) });
}

function handleTierClick(item: NavItem, tierIndex: number) {
	openFlyout = null;
	expandedTier = null;
	activeLevelsFlyoutId = null;
	navigate(item.id, { tier: String(tierIndex) });
}
</script>

<nav class="flex h-full w-[17rem] flex-col border-r border-border bg-sidebar p-4">
	<div class="mb-6 px-2 text-xl font-bold tracking-tight text-sidebar-foreground">
		<span class="text-primary">J</span>anki
	</div>
	<div class="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto scrollbar-hide">
		{#each sections as section, sectionIndex}
			<div>
				{#if section.label}
					<div class="mb-2 rounded-md bg-black/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50 dark:bg-white/5">
						{section.label}
					</div>
				{:else if sectionIndex === sections.length - 1}
					<div class="mb-2 border-t border-border/50"></div>
				{/if}
				<ul class="flex flex-col gap-0.5">
					{#each section.items as item}
						{#if !item.hidden}
							<li
								class="relative"
								onmouseenter={() => item.flyout ? showFlyout(item.id) : null}
								onmouseleave={scheduleFlyoutClose}
							>
								<button
									onclick={() => navigate(item.id)}
									class="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors
										{isActive(item)
											? 'bg-sidebar-active text-sidebar-active-foreground border-l-[3px] border-primary rounded-r-md'
											: 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground border-l-[3px] border-transparent rounded-r-md'}"
								>
									<span>{item.label}</span>
									{#if item.flyout}
										<span class="text-xs opacity-30">&rsaquo;</span>
									{:else if item.shortcut}
										<span class="text-xs opacity-30">{item.shortcut}</span>
									{/if}
								</button>

								<!-- Tier flyout -->
								{#if item.flyout && openFlyout === item.id}
									<div
										class="absolute left-full top-0 z-50 ml-1 w-56 rounded-lg border bg-card p-2 shadow-lg"
										onmouseenter={keepFlyoutOpen}
										onmouseleave={scheduleFlyoutClose}
										role="menu"
										tabindex="-1"
									>
										{#if item.flyout.kind === "levels"}
											<!-- Levels flyout: tiers with expandable level buttons -->
											{#each TIERS as tier}
												<div>
													<button
														type="button"
														class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
														onclick={() => expandedTier = expandedTier === tier.index ? null : tier.index}
														role="menuitem"
													>
														<span class="text-base font-bold">{tier.kanji}</span>
														<span class="flex-1 text-left">{tier.en}</span>
														<span class="text-xs text-muted-foreground">{tier.label}</span>
														<span class="text-xs text-muted-foreground transition-transform {expandedTier === tier.index ? 'rotate-90' : ''}">
															&rsaquo;
														</span>
													</button>
													{#if expandedTier === tier.index}
														<div class="grid grid-cols-5 gap-1 px-2 pb-2">
															{#each { length: tier.end - tier.start + 1 } as _, i}
																{@const level = tier.start + i}
																<button
																	type="button"
																	class="rounded px-1.5 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground text-muted-foreground"
																	onclick={() => handleLevelClick(level)}
																	role="menuitem"
																>
																	{String(level).padStart(2, "0")}
																</button>
															{/each}
														</div>
													{/if}
												</div>
											{/each}
										{:else}
											<!-- Items flyout: tiers with colored backgrounds -->
											{#each TIERS as tier}
												<button
													type="button"
													class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white transition-all hover:brightness-110 {item.flyout.color}"
													onclick={() => handleTierClick(item, tier.index)}
													role="menuitem"
												>
													<span class="font-bold">{tier.kanji}</span>
													<span class="flex-1 text-left">{tier.en}</span>
													<span class="text-xs opacity-80">{tier.label}</span>
												</button>
											{/each}
										{/if}
									</div>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</nav>
