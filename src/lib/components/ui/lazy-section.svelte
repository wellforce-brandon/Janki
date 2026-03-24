<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		estimatedHeight?: number;
		rootMargin?: string;
		children: Snippet;
	}

	let { estimatedHeight = 200, rootMargin = "200px", children }: Props = $props();

	let visible = $state(false);
	let container: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!container) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					visible = true;
					observer.disconnect();
				}
			},
			{ rootMargin },
		);

		observer.observe(container);
		return () => observer.disconnect();
	});
</script>

<div bind:this={container} style:min-height={visible ? "auto" : `${estimatedHeight}px`}>
	{#if visible}
		{@render children()}
	{/if}
</div>
