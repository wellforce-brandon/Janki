<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import { navigate } from "$lib/stores/navigation.svelte";
</script>

<div class="space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Kanji Overview</h2>
	<div class="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
		<p class="text-muted-foreground">Kanji dashboard coming soon.</p>
		<p class="mt-2 text-sm text-muted-foreground">Lessons, reviews, level progress, and SRS breakdown will appear here.</p>
		<div class="mt-6 flex justify-center gap-3">
			<Button variant="outline" onclick={() => navigate("kanji-map")}>Kanji Map</Button>
		</div>
	</div>
</div>
