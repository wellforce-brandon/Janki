<script lang="ts">
import { currentView, navigate } from "$lib/stores/navigation.svelte";

const navItems = [
	{ id: "dashboard" as const, label: "Dashboard", shortcut: "Ctrl+1" },
	{ id: "review" as const, label: "Review", shortcut: "Ctrl+2" },
	{ id: "kanji" as const, label: "Kanji", shortcut: "Ctrl+3" },
	{ id: "decks" as const, label: "Decks", shortcut: "Ctrl+4" },
	{ id: "stats" as const, label: "Stats", shortcut: "Ctrl+5" },
	{ id: "search" as const, label: "Search", shortcut: "Ctrl+F" },
	{ id: "settings" as const, label: "Settings", shortcut: "" },
];
</script>

<nav class="flex h-full w-60 flex-col border-r border-border bg-card p-4">
	<div class="mb-6 px-2 text-xl font-bold tracking-tight">
		<span class="text-primary">J</span>anki
	</div>
	<ul class="flex flex-col gap-1">
		{#each navItems as item}
			<li>
				<button
					onclick={() => navigate(item.id)}
					class="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors
						{currentView() === item.id
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
</nav>
