<script lang="ts">
interface Props {
	data: { label: string; value: number }[];
	height?: number;
	color?: string;
	yLabel?: string;
	maxY?: number;
}

let {
	data,
	height = 200,
	color = "var(--color-primary, #8b5cf6)",
	yLabel = "",
	maxY,
}: Props = $props();

let maxValue = $derived(maxY ?? Math.max(1, ...data.map((d) => d.value)));
let chartWidth = $derived(Math.max(300, data.length * 20 + 40));
let points = $derived(
	data
		.map((d, i) => {
			const x = i * ((chartWidth - 50) / Math.max(1, data.length - 1)) + 30;
			const y = height - 25 - (d.value / maxValue) * (height - 35);
			return `${x},${y}`;
		})
		.join(" "),
);
</script>

<div class="overflow-x-auto">
	<svg width={chartWidth} {height} class="text-muted-foreground">
		{#if yLabel}
			<text x="0" y="12" class="fill-current text-[10px]">{yLabel}</text>
		{/if}
		{#if data.length > 1}
			<polyline
				{points}
				fill="none"
				stroke={color}
				stroke-width="2"
				stroke-linejoin="round"
			/>
		{/if}
		{#each data as d, i}
			{@const x = i * ((chartWidth - 50) / Math.max(1, data.length - 1)) + 30}
			{@const y = height - 25 - (d.value / maxValue) * (height - 35)}
			<circle cx={x} cy={y} r="3" fill={color}>
				<title>{d.label}: {d.value}</title>
			</circle>
			{#if data.length <= 15 || i % Math.ceil(data.length / 10) === 0}
				<text
					{x}
					y={height - 4}
					text-anchor="middle"
					class="fill-current text-[8px]"
				>{d.label.slice(-5)}</text>
			{/if}
		{/each}
	</svg>
</div>
