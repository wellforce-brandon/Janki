<script lang="ts">
import { exportBackup, importBackup } from "$lib/backup/backup";
import Button from "$lib/components/ui/button/button.svelte";
import { getSettings, saveSetting } from "$lib/stores/app-settings.svelte";
import { getTts } from "$lib/tts/speech";
import { checkForUpdates } from "$lib/updater/check-update";

let s = $derived(getSettings());
let backupStatus = $state("");
let restoreStatus = $state("");

function setTheme(theme: "dark" | "light" | "system") {
	saveSetting("theme", theme);
}

async function handleExport() {
	backupStatus = "Exporting...";
	try {
		const dest = await exportBackup();
		backupStatus = dest ? `Saved to ${dest}` : "Cancelled";
	} catch (e) {
		backupStatus = `Error: ${e instanceof Error ? e.message : String(e)}`;
	}
}

async function handleImport() {
	restoreStatus = "Importing...";
	try {
		const ok = await importBackup();
		if (ok) {
			restoreStatus = "Restored. Restart app to apply.";
		} else {
			restoreStatus = "Cancelled";
		}
	} catch (e) {
		restoreStatus = `Error: ${e instanceof Error ? e.message : String(e)}`;
	}
}
</script>

<div class="mx-auto max-w-2xl space-y-8">
	<h2 class="text-2xl font-bold">Settings</h2>

	<!-- Theme -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Appearance</h3>
		<div class="flex gap-2">
			{#each ["dark", "light", "system"] as theme}
				<Button
					variant={s.theme === theme ? "default" : "outline"}
					onclick={() => setTheme(theme as "dark" | "light" | "system")}
					class="capitalize"
				>
					{theme}
				</Button>
			{/each}
		</div>
	</section>

	<!-- Review Limits -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Review Limits</h3>
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="new-limit">Daily new cards</label>
				<input
					id="new-limit"
					type="number"
					min="0"
					max="100"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.dailyNewLimit}
					onchange={(e) => saveSetting("dailyNewLimit", Number((e.target as HTMLInputElement).value))}
				/>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="review-limit">Daily review limit</label>
				<input
					id="review-limit"
					type="number"
					min="0"
					max="1000"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.dailyReviewLimit}
					onchange={(e) => saveSetting("dailyReviewLimit", Number((e.target as HTMLInputElement).value))}
				/>
			</div>
		</div>
	</section>

	<!-- TTS -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Text-to-Speech</h3>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={s.ttsEnabled}
				onchange={(e) => saveSetting("ttsEnabled", (e.target as HTMLInputElement).checked)}
			/>
			<span class="text-sm">Enable TTS</span>
		</label>
		{#if s.ttsEnabled}
			<div class="grid grid-cols-2 gap-4">
				<div class="space-y-1">
					<label class="text-sm text-muted-foreground" for="tts-rate">Speed: {s.ttsRate.toFixed(1)}</label>
					<input
						id="tts-rate"
						type="range"
						min="0.5"
						max="2.0"
						step="0.1"
						class="w-full"
						value={s.ttsRate}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							saveSetting("ttsRate", val);
							getTts().setRate(val);
						}}
					/>
				</div>
				<div class="space-y-1">
					<label class="text-sm text-muted-foreground" for="tts-pitch">Pitch: {s.ttsPitch.toFixed(1)}</label>
					<input
						id="tts-pitch"
						type="range"
						min="0.5"
						max="2.0"
						step="0.1"
						class="w-full"
						value={s.ttsPitch}
						oninput={(e) => {
							const val = Number((e.target as HTMLInputElement).value);
							saveSetting("ttsPitch", val);
							getTts().setPitch(val);
						}}
					/>
				</div>
			</div>
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					checked={s.kanjiAutoSpeak}
					onchange={(e) => saveSetting("kanjiAutoSpeak", (e.target as HTMLInputElement).checked)}
				/>
				<span class="text-sm">Auto-play kanji pronunciation on reveal</span>
			</label>
		{/if}
	</section>

	<!-- Review Options -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Review</h3>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={s.showReviewTimer}
				onchange={(e) => saveSetting("showReviewTimer", (e.target as HTMLInputElement).checked)}
			/>
			<span class="text-sm">Show timer during review</span>
		</label>
	</section>

	<!-- Backup & Restore -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Backup & Restore</h3>
		<p class="text-sm text-muted-foreground">
			Automatic backups run on each launch (last 7 kept). You can also manually export or restore.
		</p>
		<div class="flex gap-2">
			<Button variant="outline" onclick={handleExport}>Export Backup</Button>
			<Button variant="outline" onclick={handleImport}>Restore from Backup</Button>
		</div>
		{#if backupStatus}
			<p class="text-sm text-muted-foreground">{backupStatus}</p>
		{/if}
		{#if restoreStatus}
			<p class="text-sm text-muted-foreground">{restoreStatus}</p>
		{/if}
	</section>

	<!-- Updates -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Updates</h3>
		<p class="text-sm text-muted-foreground">
			Janki checks for updates automatically on launch.
		</p>
		<Button variant="outline" onclick={() => checkForUpdates()}>Check for Updates</Button>
	</section>

	<!-- About -->
	<section class="space-y-2 rounded-lg border bg-card p-4">
		<h3 class="font-medium">About</h3>
		<p class="text-sm text-muted-foreground">Janki v0.5.0</p>
		<p class="text-sm text-muted-foreground">
			Kanji data: davidluzgouveia/kanji-data (MIT).
			SRS engine: ts-fsrs (MIT).
		</p>
	</section>
</div>
