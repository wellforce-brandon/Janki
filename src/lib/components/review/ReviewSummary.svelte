<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { navigate } from "$lib/stores/navigation.svelte";

interface Props {
	reviewed: number;
	correct: number;
	timeMs: number;
}

let { reviewed, correct, timeMs }: Props = $props();

let accuracy = $derived(reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0);
let minutes = $derived(Math.round(timeMs / 60000));
</script>

<div class="mx-auto max-w-md space-y-6 text-center">
	<h2 class="text-2xl font-bold">Session Complete</h2>

	<div class="grid grid-cols-3 gap-4">
		<div class="rounded-lg border bg-card p-4">
			<div class="text-3xl font-bold">{reviewed}</div>
			<div class="text-sm text-muted-foreground">Reviewed</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-3xl font-bold">{accuracy}%</div>
			<div class="text-sm text-muted-foreground">Accuracy</div>
		</div>
		<div class="rounded-lg border bg-card p-4">
			<div class="text-3xl font-bold">{minutes}m</div>
			<div class="text-sm text-muted-foreground">Time</div>
		</div>
	</div>

	<Button onclick={() => navigate("dashboard")} class="mt-4">
		Back to Dashboard
	</Button>
</div>
