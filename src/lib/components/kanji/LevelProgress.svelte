<script lang="ts">
import type { LevelProgress } from "$lib/db/queries/kanji";

interface Props {
	progress: LevelProgress;
}

let { progress: p }: Props = $props();
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between text-sm">
		<span>Level {p.level}</span>
		<span class="text-muted-foreground">{p.guru_plus} / {p.total} at Guru+</span>
	</div>
	<div class="h-2 rounded-full bg-muted">
		<div
			class="h-full rounded-full bg-purple-500 transition-all"
			style="width: {p.percentage}%"
		></div>
	</div>
	<div class="flex justify-between text-xs text-muted-foreground">
		<span>{p.unlocked} unlocked</span>
		<span>{p.percentage}%</span>
	</div>
</div>
