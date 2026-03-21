<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	getAvailableLessons,
	type LanguageItem,
} from "$lib/db/queries/language";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let allItems = $state<LanguageItem[]>([]);
let selected = $state<Set<number>>(new Set());
let interleave = $state(true);

const TYPE_ORDER = ["kana", "vocabulary", "grammar", "conjugation", "sentence"];

interface TypeGroup {
	type: string;
	items: LanguageItem[];
}

let typeGroups = $derived.by((): TypeGroup[] => {
	const map = new Map<string, LanguageItem[]>();
	for (const item of allItems) {
		const arr = map.get(item.content_type) ?? [];
		arr.push(item);
		map.set(item.content_type, arr);
	}
	const groups: TypeGroup[] = [];
	for (const type of TYPE_ORDER) {
		const items = map.get(type);
		if (items && items.length > 0) {
			groups.push({ type, items });
		}
	}
	return groups;
});

let selectedItems = $derived(allItems.filter((i) => selected.has(i.id)));

async function loadItems() {
	loading = true;
	const result = await getAvailableLessons(undefined, 200);
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

function selectAllType(type: string) {
	const next = new Set(selected);
	const items = allItems.filter((i) => i.content_type === type);
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
	const ids = selectedItems.map((i) => i.id).join(",");
	navigate("lang-lessons", { ids, source: "picker" });
}

function getSessionItems(): LanguageItem[] {
	const items = [...selectedItems];
	if (interleave) {
		const byType = new Map<string, LanguageItem[]>();
		for (const item of items) {
			const arr = byType.get(item.content_type) ?? [];
			arr.push(item);
			byType.set(item.content_type, arr);
		}
		const result: LanguageItem[] = [];
		let added = true;
		while (added) {
			added = false;
			for (const type of TYPE_ORDER) {
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
	const labels: Record<string, string> = {
		kana: "Kana",
		vocabulary: "Vocabulary",
		grammar: "Grammar",
		sentence: "Sentences",
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

function getDisplayText(item: LanguageItem): string {
	return item.primary_text;
}

function getSubText(item: LanguageItem): string {
	return item.meaning ?? item.reading ?? "";
}

$effect(() => {
	loadItems();
});
</script>

<div class="space-y-6">
	{#if loading}
		<h2 class="text-2xl font-bold" tabindex="-1">Lesson Picker</h2>
		<SkeletonCards count={6} columns={3} />
	{:else if allItems.length === 0}
		<h2 class="text-2xl font-bold" tabindex="-1">Lesson Picker</h2>
		<EmptyState
			title="No lessons available"
			description="All unlocked items have been learned. Complete reviews to unlock more."
			actionLabel="Back to Overview"
			onaction={() => navigate("lang-overview")}
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
			{#each TYPE_ORDER as type}
				{@const count = allItems.filter((i) => i.content_type === type).length}
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

		<!-- Type groups -->
		{#each typeGroups as group}
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<h3 class="font-semibold">{getTypeLabel(group.type)}</h3>
					<Button size="sm" variant="ghost" onclick={() => selectAllType(group.type)}>
						{group.items.every((i) => selected.has(i.id)) ? "Deselect All" : "Select All"}
					</Button>
				</div>

				<div class="flex flex-wrap gap-1.5">
					{#each group.items as item}
						<button
							type="button"
							class="flex flex-col items-center rounded-md border px-2.5 py-1.5 text-sm transition-colors
								{selected.has(item.id)
									? getTypeColor(item.content_type) + ' text-white border-transparent'
									: 'bg-card hover:bg-accent'}"
							onclick={() => toggleItem(item.id)}
							aria-label="{getDisplayText(item)} - {getSubText(item)}{selected.has(item.id) ? ' (selected)' : ''}"
							aria-pressed={selected.has(item.id)}
						>
							<span class="font-bold">{getDisplayText(item)}</span>
							<span class="max-w-[80px] truncate text-[10px] opacity-80">{getSubText(item)}</span>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
