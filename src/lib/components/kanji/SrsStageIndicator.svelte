<script lang="ts">
import { getStageColor, STAGE_NAMES } from "$lib/srs/wanikani-srs";
import { cn } from "$lib/utils/cn";

interface Props {
	stage: number;
	nextReview?: string | null;
}

let { stage, nextReview = null }: Props = $props();

function formatNextReview(review: string | null): string {
	if (!review) return "";
	const d = new Date(review);
	const now = new Date();
	const diff = d.getTime() - now.getTime();
	if (diff <= 0) return "Now";
	const hours = Math.round(diff / 3600000);
	if (hours < 24) return `${hours}h`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d`;
	return `${Math.round(days / 30)}mo`;
}
</script>

<span class={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", getStageColor(stage))}>
	{STAGE_NAMES[stage] ?? "Unknown"}
	{#if nextReview && stage > 0 && stage < 9}
		<span class="opacity-70">{formatNextReview(nextReview)}</span>
	{/if}
</span>
