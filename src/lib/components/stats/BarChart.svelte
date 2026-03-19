<script lang="ts">
interface Props {
	data: { label: string; value: number }[];
	height?: number;
	color?: string;
	yLabel?: string;
}

let { data, height = 200, color = "var(--color-primary, #8b5cf6)", yLabel = "" }: Props = $props();

let maxValue = $derived(Math.max(1, ...data.map((d) => d.value)));
let barWidth = $derived(data.length > 0 ? Math.max(8, Math.min(30, 600 / data.length - 2)) : 20);
let svgWidth = $derived(data.length * (barWidth + 2) + 40);
</script>

<div class="overflow-x-auto">
	<svg width={svgWidth} {height} class="text-muted-foreground">
		{#if yLabel}
			<text x="0" y="12" class="fill-current text-[10px]">{yLabel}</text>
		{/if}
		{#each data as d, i}
			{@const barHeight = (d.value / maxValue) * (height - 30)}
			<rect
				x={i * (barWidth + 2) + 30}
				y={height - 20 - barHeight}
				width={barWidth}
				height={barHeight}
				fill={color}
				rx="2"
				opacity="0.85"
			>
				<title>{d.label}: {d.value}</title>
			</rect>
			{#if data.length <= 15 || i % Math.ceil(data.length / 10) === 0}
				<text
					x={i * (barWidth + 2) + 30 + barWidth / 2}
					y={height - 4}
					text-anchor="middle"
					class="fill-current text-[8px]"
				>{d.label.slice(-5)}</text>
			{/if}
		{/each}
	</svg>
</div>
