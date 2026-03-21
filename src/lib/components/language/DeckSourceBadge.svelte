<script lang="ts">
interface Props {
	deckName: string;
}

let { deckName }: Props = $props();
</script>

<span
	class="inline-block max-w-[12rem] truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
	title={deckName}
>
	{deckName}
</span>
