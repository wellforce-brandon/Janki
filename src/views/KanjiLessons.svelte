<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { navigate } from "$lib/stores/navigation.svelte";
</script>

<div class="space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Kanji Lessons</h2>
	<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
		<p class="text-muted-foreground">Kanji lessons coming soon.</p>
		<p class="mt-2 text-sm text-muted-foreground">Learn new radicals, kanji, and vocabulary in batches of 5.</p>
		<div class="mt-6">
			<Button variant="outline" onclick={() => navigate("kanji-dashboard")}>Back to Overview</Button>
		</div>
	</div>
</div>
