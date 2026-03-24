<script lang="ts">
import SrsStageIndicator from "$lib/components/kanji/SrsStageIndicator.svelte";
import type { KanjiLevelItem } from "$lib/db/queries/kanji";

interface Props {
	item: KanjiLevelItem;
}

let { item }: Props = $props();

let totalReviews = $derived(item.correct_count + item.incorrect_count);

function parseUtcDate(dateStr: string | null): Date | null {
	if (!dateStr) return null;
	return new Date(dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`);
}

function formatDate(dateStr: string | null): string {
	const d = parseUtcDate(dateStr);
	if (!d) return "--";
	return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatNextReview(dateStr: string | null): string {
	const d = parseUtcDate(dateStr);
	if (!d) return "--";
	if (d.getTime() <= Date.now()) return "Available Now";
	const diff = d.getTime() - Date.now();
	const hours = Math.round(diff / 3600000);
	if (hours < 1) return "Less than 1 hour";
	if (hours < 24) return `About ${hours} hour${hours > 1 ? "s" : ""}`;
	const days = Math.round(hours / 24);
	if (days < 30) return `About ${days} day${days > 1 ? "s" : ""}`;
	return `About ${Math.round(days / 30)} month${Math.round(days / 30) > 1 ? "s" : ""}`;
}

let meaningLabel = $derived(item.item_type === "radical" ? "Name" : "Meaning");
let showReading = $derived(item.item_type !== "radical");
</script>

<div class="rounded-lg border bg-card p-4 space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-muted-foreground">Your Progression</h3>
		<SrsStageIndicator stage={item.srs_stage} />
	</div>

	<!-- Meaning/Name Answered Correct -->
	<div class="space-y-2">
		<h4 class="text-sm font-medium">{meaningLabel} Answered Correct</h4>
		<div class="flex items-center gap-3 text-xs text-muted-foreground">
			<span class="rounded-full bg-muted px-2 py-0.5">Current Streak: <span class="font-medium text-foreground">{item.meaning_current_streak}</span></span>
			<span class="rounded-full bg-muted px-2 py-0.5">Longest Streak: <span class="font-medium text-foreground">{item.meaning_max_streak}</span></span>
		</div>
		<div class="flex items-center gap-2">
			<div class="h-2 flex-1 rounded-full bg-muted overflow-hidden">
				{#if totalReviews > 0}
					<div
						class="h-full rounded-full bg-green-500"
						style="width: {(item.correct_count / totalReviews) * 100}%"
					></div>
				{/if}
			</div>
		</div>
		<div class="flex justify-between text-xs text-muted-foreground">
			<span>{item.correct_count}</span>
			<span>{item.incorrect_count}</span>
		</div>
	</div>

	<!-- Reading Answered Correct (kanji/vocab only) -->
	{#if showReading}
		<div class="space-y-2">
			<h4 class="text-sm font-medium">Reading Answered Correct</h4>
			<div class="flex items-center gap-3 text-xs text-muted-foreground">
				<span class="rounded-full bg-muted px-2 py-0.5">Current Streak: <span class="font-medium text-foreground">{item.reading_current_streak}</span></span>
				<span class="rounded-full bg-muted px-2 py-0.5">Longest Streak: <span class="font-medium text-foreground">{item.reading_max_streak}</span></span>
			</div>
		</div>
	{/if}

	<!-- Next Review + Unlocked Date -->
	<div class="grid grid-cols-2 gap-4 border-t pt-3 text-sm">
		<div>
			<span class="text-muted-foreground">Next Review</span>
			<div class="mt-1 font-medium">{item.lesson_completed_at ? formatNextReview(item.next_review) : "--"}</div>
		</div>
		<div>
			<span class="text-muted-foreground">Unlocked Date</span>
			<div class="mt-1 font-medium">{formatDate(item.unlocked_at)}</div>
		</div>
	</div>
</div>
