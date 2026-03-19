<script lang="ts">
import KanjiLessonSession from "$lib/components/kanji/KanjiLessonSession.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import LoadingState from "$lib/components/ui/loading-state.svelte";
import { getAllAvailableLessons, type KanjiLevelItem } from "$lib/db/queries/kanji";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { getTypeColor } from "$lib/utils/kanji";

let loading = $state(true);
let allItems = $state<KanjiLevelItem[]>([]);
let selected = $state<Set<number>>(new Set());
let sessionActive = $state(false);
let completedCount = $state(0);
let interleave = $state(true);

interface LevelGroup {
	level: number;
	items: KanjiLevelItem[];
	types: Map<string, KanjiLevelItem[]>;
}

let levelGroups = $derived.by((): LevelGroup[] => {
	const map = new Map<number, KanjiLevelItem[]>();
	for (const item of allItems) {
		const arr = map.get(item.level) ?? [];
		arr.push(item);
		map.set(item.level, arr);
	}
	const groups: LevelGroup[] = [];
	for (const [level, items] of map) {
		const types = new Map<string, KanjiLevelItem[]>();
		for (const item of items) {
			const arr = types.get(item.item_type) ?? [];
			arr.push(item);
			types.set(item.item_type, arr);
		}
		groups.push({ level, items, types });
	}
	return groups;
});

let selectedItems = $derived(allItems.filter((i) => selected.has(i.id)));

async function loadItems() {
	loading = true;
	const result = await getAllAvailableLessons();
	if (result.ok) {
		allItems = result.data;
	} else {
		addToast("Failed to load available lessons", "error");
	}
	loading = false;
}

function toggleItem(id: number) {
	const next = new Set(selected);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	selected = next;
}

function selectAllLevel(level: number) {
	const next = new Set(selected);
	const items = allItems.filter((i) => i.level === level);
	const allSelected = items.every((i) => next.has(i.id));
	if (allSelected) {
		for (const i of items) next.delete(i.id);
	} else {
		for (const i of items) next.add(i.id);
	}
	selected = next;
}

function selectAllType(itemType: string) {
	const next = new Set(selected);
	const items = allItems.filter((i) => i.item_type === itemType);
	const allSelected = items.every((i) => next.has(i.id));
	if (allSelected) {
		for (const i of items) next.delete(i.id);
	} else {
		for (const i of items) next.add(i.id);
	}
	selected = next;
}

function autoBatch(size = 5) {
	const next = new Set<number>();
	const batch = allItems.slice(0, size);
	for (const item of batch) next.add(item.id);
	selected = next;
}

function startSession() {
	if (selectedItems.length === 0) return;
	completedCount = 0;
	sessionActive = true;
}

function handleComplete(count: number) {
	completedCount = count;
	sessionActive = false;
	addToast(`${count} item${count > 1 ? "s" : ""} learned!`, "success");
	loadItems();
}

function getSessionItems(): KanjiLevelItem[] {
	const items = [...selectedItems];
	if (interleave) {
		// Interleave types: take one of each type in round-robin
		const byType = new Map<string, KanjiLevelItem[]>();
		for (const item of items) {
			const arr = byType.get(item.item_type) ?? [];
			arr.push(item);
			byType.set(item.item_type, arr);
		}
		const result: KanjiLevelItem[] = [];
		const typeOrder = ["radical", "kanji", "vocab"];
		let added = true;
		while (added) {
			added = false;
			for (const type of typeOrder) {
				const arr = byType.get(type);
				if (arr && arr.length > 0) {
					const item = arr.shift();
					if (item) result.push(item);
					added = true;
				}
			}
		}
		return result;
	}
	return items;
}

function getTypeLabel(type: string): string {
	switch (type) {
		case "radical":
			return "Radicals";
		case "kanji":
			return "Kanji";
		case "vocab":
			return "Vocabulary";
		default:
			return type;
	}
}

function parseMeaning(json: string): string {
	try {
		return (JSON.parse(json) as string[])[0] ?? json;
	} catch {
		return json;
	}
}

$effect(() => {
	loadItems();
});
</script>

<div class="space-y-6">
	{#if sessionActive}
		<KanjiLessonSession items={getSessionItems()} oncomplete={handleComplete} />
	{:else if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Lesson Picker</h2>
		<LoadingState message="Loading available lessons..." />
	{:else if completedCount > 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Lessons Complete</h2>
		<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
			<div class="text-5xl font-bold text-green-500">{completedCount}</div>
			<p class="mt-2 text-muted-foreground">
				item{completedCount > 1 ? "s" : ""} learned!
			</p>
			<div class="mt-6 flex justify-center gap-2">
				{#if allItems.length > 0}
					<Button onclick={() => { completedCount = 0; }}>Pick More</Button>
				{/if}
				<Button variant="outline" onclick={() => navigate("kanji-dashboard")}>
					Back to Overview
				</Button>
			</div>
		</div>
	{:else if allItems.length === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Lesson Picker</h2>
		<EmptyState
			title="No lessons available"
			description="All unlocked items have been learned. Complete reviews to unlock more."
			actionLabel="Back to Lessons"
			onaction={() => navigate("kanji-lessons")}
		/>
	{:else}
		<div class="flex items-center justify-between">
			<h2 class="text-2xl font-bold" tabindex="-1">Lesson Picker</h2>
			<span class="text-sm text-muted-foreground">{allItems.length} available</span>
		</div>

		<!-- Controls -->
		<div class="flex flex-wrap items-center gap-3">
			<Button size="sm" variant="outline" onclick={() => autoBatch(5)}>
				Auto-select 5
			</Button>
			<Button size="sm" variant="outline" onclick={() => autoBatch(10)}>
				Auto-select 10
			</Button>
			{#each ["radical", "kanji", "vocab"] as type}
				{@const count = allItems.filter((i) => i.item_type === type).length}
				{#if count > 0}
					<Button size="sm" variant="outline" onclick={() => selectAllType(type)}>
						All {getTypeLabel(type)} ({count})
					</Button>
				{/if}
			{/each}
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={interleave} />
				Interleave types
			</label>
		</div>

		<!-- Selection summary + start -->
		{#if selected.size > 0}
			<div class="flex items-center gap-3 rounded-lg border bg-card p-3">
				<span class="font-medium">{selected.size} selected</span>
				<Button size="sm" onclick={startSession}>
					Start Lessons ({selected.size})
				</Button>
				<Button size="sm" variant="ghost" onclick={() => { selected = new Set(); }}>
					Clear
				</Button>
			</div>
		{/if}

		<!-- Level groups -->
		{#each levelGroups as group}
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<h3 class="font-semibold">Level {group.level}</h3>
					<Button size="sm" variant="ghost" onclick={() => selectAllLevel(group.level)}>
						{group.items.every((i) => selected.has(i.id)) ? "Deselect All" : "Select All"}
					</Button>
				</div>

				{#each ["radical", "kanji", "vocab"] as type}
					{@const typeItems = group.types.get(type)}
					{#if typeItems && typeItems.length > 0}
						<div class="space-y-1.5">
							<span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								{getTypeLabel(type)}
							</span>
							<div class="flex flex-wrap gap-1.5">
								{#each typeItems as item}
									<button
										type="button"
										class="flex flex-col items-center rounded-md border px-2.5 py-1.5 text-sm transition-colors
											{selected.has(item.id)
												? getTypeColor(item.item_type) + ' text-white border-transparent'
												: 'bg-card hover:bg-accent'}"
										onclick={() => toggleItem(item.id)}
										aria-label="{item.character} - {parseMeaning(item.meanings)}{selected.has(item.id) ? ' (selected)' : ''}"
										aria-pressed={selected.has(item.id)}
									>
										<span class="font-bold">{item.character}</span>
										<span class="text-[10px] opacity-80">{parseMeaning(item.meanings)}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	{/if}
</div>
