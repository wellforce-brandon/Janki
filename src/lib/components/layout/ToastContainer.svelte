<script lang="ts">
import type { ToastType } from "$lib/stores/toast.svelte";
import { dismissToast, getToasts } from "$lib/stores/toast.svelte";

const iconMap: Record<ToastType, string> = {
	success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
	error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
	info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
	warning:
		"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
};

const colorMap: Record<ToastType, string> = {
	success: "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
	error: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
	info: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400",
	warning: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

let toasts = $derived(getToasts());
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
	{#each toasts as toast (toast.id)}
		<div
			class="flex min-w-72 max-w-96 items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm {colorMap[toast.type]}"
		>
			<svg class="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d={iconMap[toast.type]} />
			</svg>
			<p class="flex-1 text-sm">{toast.message}</p>
			<button
				class="shrink-0 opacity-60 hover:opacity-100"
				onclick={() => dismissToast(toast.id)}
				aria-label="Dismiss notification"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
