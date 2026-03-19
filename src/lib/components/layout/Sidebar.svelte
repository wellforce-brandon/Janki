<script lang="ts">
import type { View } from "$lib/stores/navigation.svelte";
import { currentView, navigate } from "$lib/stores/navigation.svelte";

interface NavItem {
	id: View;
	label: string;
	shortcut?: string;
	/** Additional views that should highlight this item */
	subViews?: View[];
}

interface NavSection {
	label?: string;
	items: NavItem[];
}

const sections: NavSection[] = [
	{
		items: [{ id: "dashboard", label: "Dashboard", shortcut: "Ctrl+1" }],
	},
	{
		label: "Decks",
		items: [
			{ id: "decks", label: "All Decks", shortcut: "Ctrl+2", subViews: ["deck-browse"] },
			{ id: "deck-review", label: "Review", shortcut: "Ctrl+3" },
		],
	},
	{
		label: "Kanji",
		items: [
			{ id: "kanji-dashboard", label: "Overview", shortcut: "Ctrl+4" },
			{ id: "kanji-map", label: "Kanji Map", subViews: ["kanji-detail"] },
			{ id: "kanji-lessons", label: "Lessons" },
			{ id: "kanji-review", label: "Reviews" },
		],
	},
	{
		label: "Language",
		items: [
			{ id: "grammar", label: "Grammar", shortcut: "Ctrl+5" },
			{ id: "reading", label: "Reading", shortcut: "Ctrl+6" },
		],
	},
	{
		items: [
			{ id: "stats", label: "Stats", shortcut: "Ctrl+7" },
			{ id: "search", label: "Search", shortcut: "Ctrl+F" },
			{ id: "settings", label: "Settings" },
		],
	},
];

function isActive(item: NavItem): boolean {
	const view = currentView();
	if (view === item.id) return true;
	return item.subViews?.includes(view) ?? false;
}
</script>

<nav class="flex h-full w-60 flex-col border-r border-border bg-card p-4">
	<div class="mb-6 px-2 text-xl font-bold tracking-tight">
		<span class="text-primary">J</span>anki
	</div>
	<div class="flex flex-1 flex-col gap-4">
		{#each sections as section}
			<div>
				{#if section.label}
					<div class="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
						{section.label}
					</div>
				{/if}
				<ul class="flex flex-col gap-0.5">
					{#each section.items as item}
						<li>
							<button
								onclick={() => navigate(item.id)}
								class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors
									{isActive(item)
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
							>
								<span>{item.label}</span>
								{#if item.shortcut}
									<span class="text-xs opacity-50">{item.shortcut}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</nav>
