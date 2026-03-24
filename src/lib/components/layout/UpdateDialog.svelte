<script lang="ts">
import { ArrowDownToLine, Download, Loader2, Sparkles, X } from "@lucide/svelte";
import Button from "$lib/components/ui/button/button.svelte";
import { getPendingUpdate, isInstalling } from "$lib/stores/update.svelte";
import { installUpdate } from "$lib/updater/check-update";

interface Props {
	open: boolean;
	onclose: () => void;
}

let { open = $bindable(), onclose }: Props = $props();

let update = $derived(getPendingUpdate());
let installing = $derived(isInstalling());

async function handleInstall() {
	await installUpdate();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape" && !installing) {
		onclose();
	}
}
</script>

{#if open && update}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-labelledby="update-title"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
			onclick={() => !installing && onclose()}
			onkeydown={handleKeydown}
		></div>

		<!-- Dialog -->
		<div class="relative z-10 w-full max-w-md mx-4 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300">
			<div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20 dark:shadow-black/40">
				<!-- Header with gradient accent -->
				<div class="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent px-6 pt-6 pb-4 dark:from-emerald-500/15 dark:via-teal-500/10">
					<!-- Decorative circles -->
					<div class="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl dark:bg-emerald-500/15"></div>
					<div class="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-teal-500/10 blur-xl dark:bg-teal-500/15"></div>

					<!-- Close button -->
					{#if !installing}
						<button
							type="button"
							class="absolute top-3 right-3 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
							onclick={onclose}
							aria-label="Close"
						>
							<X class="h-4 w-4" />
						</button>
					{/if}

					<div class="relative flex items-start gap-4">
						<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
							<Sparkles class="h-6 w-6" />
						</div>
						<div class="min-w-0">
							<h2 id="update-title" class="text-lg font-semibold tracking-tight">
								Update Available
							</h2>
							<div class="mt-1 flex items-center gap-2">
								<span class="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
									v{update.version}
								</span>
								<span class="text-xs text-muted-foreground">ready to install</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Body -->
				<div class="px-6 py-4">
					<p class="text-sm text-muted-foreground leading-relaxed">
						A new version of Janki is available with bug fixes and improvements.
						The update will download and install automatically, then the app will restart.
					</p>

					{#if update.body}
						<div class="mt-3 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
							{update.body}
						</div>
					{/if}
				</div>

				<!-- Footer -->
				<div class="flex items-center justify-end gap-2 border-t border-border/50 bg-muted/30 px-6 py-4">
					{#if !installing}
						<Button variant="outline" onclick={onclose}>
							Later
						</Button>
						<Button
							class="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
							onclick={handleInstall}
						>
							<Download class="h-4 w-4" />
							Install & Restart
						</Button>
					{:else}
						<div class="flex w-full items-center justify-center gap-3 py-1">
							<Loader2 class="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
							<span class="text-sm font-medium text-muted-foreground">
								Downloading and installing...
							</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
