<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import EmptyState from "$lib/components/ui/empty-state.svelte";
import SkeletonCards from "$lib/components/ui/skeleton-cards.svelte";
import {
	getAvailableLessons,
	type LanguageItem,
} from "$lib/db/queries/language";
import { getKanaGroupLabel } from "$lib/data/kana-groups";
import { getTypeLabel, getTypeColor } from "$lib/utils/content-type";
import { navigate } from "$lib/stores/navigation.svelte";
import { addToast } from "$lib/stores/toast.svelte";

let loading = $state(true);
let allItems = $state<LanguageItem[]>([]);
let selected = $state<Set<number>>(new Set());
let interleave = $state(true);

const TYPE_ORDER = ["kana", "vocabulary", "grammar", "conjugation", "sentence"];

interface DisplayGroup {
	key: string;
	label: string;
	type: string;
	colorClass: string;
	items: LanguageItem[];
}

let displayGroups = $derived.by((): DisplayGroup[] => {
	const groups: DisplayGroup[] = [];

	for (const type of TYPE_ORDER) {
		const items = allItems.filter((i) => i.content_type === type);
		if (items.length === 0) continue;

		if (type === "kana") {
			// Sub-group kana by lesson_group, ordered by lesson_order
			const lessonGroupMap = new Map<string, LanguageItem[]>();
			for (const item of items) {
				const groupKey = item.lesson_group ?? "unknown";
				const arr = lessonGroupMap.get(groupKey) ?? [];
				arr.push(item);
				lessonGroupMap.set(groupKey, arr);
			}
			// Sort by lesson_order of first item in each group
			const sortedEntries = [...lessonGroupMap.entries()].sort((a, b) => {
				const orderA = a[1][0]?.lesson_order ?? 999;
				const orderB = b[1][0]?.lesson_order ?? 999;
				return orderA - orderB;
			});
			for (const [groupKey, groupItems] of sortedEntries) {
				groups.push({
					key: `kana-${groupKey}`,
					label: getKanaGroupLabel(groupKey),
					type: "kana",
					colorClass: "bg-teal-500",
					items: groupItems,
				});
			}
		} else {
			groups.push({
				key: type,
				label: getTypeLabel(type),
				type,
				colorClass: getTypeColor(type),
				items,
			});
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

function selectGroup(group: DisplayGroup) {
	const next = new Set(selected);
	const allSelected = group.items.every((i) => next.has(i.id));
	if (allSelected) {
		for (const i of group.items) next.delete(i.id);
	} else {
		for (const i of group.items) next.add(i.id);
	}
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

// getTypeLabel and getTypeColor imported from $lib/utils/content-type

function getDisplayText(item: LanguageItem): string {
	return item.primary_text;
}

function getSubText(item: LanguageItem): string {
	if (item.content_type === "kana") {
		return item.romaji ?? "";
	}
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

		<!-- Display groups (kana sub-grouped by lesson_group, others as before) -->
		{#each displayGroups as group (group.key)}
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<h3 class="font-semibold">{group.label}</h3>
					<span class="text-xs text-muted-foreground">({group.items.length})</span>
					<Button size="sm" variant="ghost" onclick={() => selectGroup(group)}>
						{group.items.every((i) => selected.has(i.id)) ? "Deselect All" : "Select All"}
					</Button>
				</div>

				<div class="flex flex-wrap gap-1.5">
					{#each group.items as item (item.id)}
						<button
							type="button"
							class="flex flex-col items-center rounded-md border px-2.5 py-1.5 text-sm transition-colors
								{selected.has(item.id)
									? group.colorClass + ' text-white border-transparent'
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
