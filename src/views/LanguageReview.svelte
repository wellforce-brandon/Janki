<script lang="ts">
import EmptyState from "$lib/components/ui/empty-state.svelte";
import { navigate } from "$lib/stores/navigation.svelte";
</script>

<div class="mx-auto max-w-3xl space-y-6">
	<h2 class="text-2xl font-bold" tabindex="-1">Language Review</h2>

	<EmptyState
		title="Coming soon"
		description="The unified language review system is being built in the next phase. For now, use the deck-based review to study your imported cards."
		actionLabel="Back to Overview"
		onaction={() => navigate("lang-overview")}
	/>
</div>
