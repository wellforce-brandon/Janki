<script lang="ts">
interface Props {
	message?: string;
}

let { message = "Loading..." }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12">
	<div class="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
	<p class="text-sm text-muted-foreground">{message}</p>
</div>
