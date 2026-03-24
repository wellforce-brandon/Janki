<script lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { exportBackup, importBackup } from "$lib/backup/backup";
import Button from "$lib/components/ui/button/button.svelte";
import {
	LEARNING_PATHS,
	type PathId,
} from "$lib/data/learning-paths";
import {
	getSettings,
	type KanjiReviewOrder,
	resetAllSettings,
	saveSetting,
} from "$lib/stores/app-settings.svelte";
import { addToast } from "$lib/stores/toast.svelte";
import { getTts } from "$lib/tts/speech";
import {
	clearLanguageLevelsSeed,
	getLanguagePath,
	rebuildFtsIndex,
	resetAllLanguageProgress,
	setLanguagePath,
} from "$lib/db/queries/language";
import { assignLanguageLevels } from "$lib/db/seed/language-levels";
import { resetAllKanjiProgress } from "$lib/db/queries/kanji";
import { checkForUpdates } from "$lib/updater/check-update";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import PathPicker from "$lib/components/language/PathPicker.svelte";

let s = $derived(getSettings());
let appVersion = $state("...");
let showResetConfirm = $state(false);
let pendingZoom = $state<number | null>(null);
let showResetLearningConfirm = $state<"language" | "kanji" | "all" | null>(null);
let resettingLearning = $state(false);
let currentPathId = $state<string | null>(null);
let showPathChangeConfirm = $state(false);
let showPathPicker = $state(false);
let changingPath = $state(false);

$effect(() => {
	getVersion().then((v) => {
		appVersion = v;
	});
	getLanguagePath().then((r) => {
		if (r.ok) currentPathId = r.data;
	});
});

let currentPathLabel = $derived(
	currentPathId && currentPathId in LEARNING_PATHS
		? LEARNING_PATHS[currentPathId as PathId].label
		: "Not selected",
);

async function handleChangePath() {
	changingPath = true;
	showPathChangeConfirm = false;
	showPathPicker = true;
	changingPath = false;
}

function setTheme(theme: "dark" | "light" | "system") {
	saveSetting("theme", theme);
	addToast(`Theme set to ${theme}`, "success");
}

async function handleExport() {
	try {
		const dest = await exportBackup();
		if (dest) {
			addToast("Backup exported successfully", "success");
		} else {
			addToast("Export cancelled", "info");
		}
	} catch (e) {
		addToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`, "error");
	}
}

async function handleImport() {
	try {
		const ok = await importBackup();
		if (ok) {
			addToast("Backup restored. Restart app to apply.", "success");
		} else {
			addToast("Import cancelled", "info");
		}
	} catch (e) {
		addToast(`Restore failed: ${e instanceof Error ? e.message : String(e)}`, "error");
	}
}

let rebuildingFts = $state(false);

async function handleRebuildFts() {
	rebuildingFts = true;
	try {
		const result = await rebuildFtsIndex();
		if (result.ok) {
			addToast("Search index rebuilt successfully", "success");
		} else {
			addToast(`Rebuild failed: ${result.error}`, "error");
		}
	} catch (e) {
		addToast(`Rebuild failed: ${e instanceof Error ? e.message : String(e)}`, "error");
	} finally {
		rebuildingFts = false;
	}
}

async function handleResetLearning() {
	const target = showResetLearningConfirm;
	if (!target) return;
	resettingLearning = true;
	try {
		if (target === "language" || target === "all") {
			const r = await resetAllLanguageProgress();
			if (!r.ok) { addToast(`Failed to reset language data: ${r.error}`, "error"); return; }
		}
		if (target === "kanji" || target === "all") {
			const r = await resetAllKanjiProgress();
			if (!r.ok) { addToast(`Failed to reset kanji data: ${r.error}`, "error"); return; }
		}
		const label = target === "all" ? "All learning" : target === "language" ? "Language" : "Kanji";
		addToast(`${label} progress has been reset`, "success");
	} catch (e) {
		addToast(`Reset failed: ${e instanceof Error ? e.message : String(e)}`, "error");
	} finally {
		resettingLearning = false;
		showResetLearningConfirm = null;
	}
}

async function handleResetDefaults() {
	showResetConfirm = false;
	await resetAllSettings();
	addToast("All settings restored to defaults", "success");
}
</script>

{#if showPathPicker}
	<PathPicker
		onselected={() => {
			showPathPicker = false;
			getLanguagePath().then((r) => {
				if (r.ok) currentPathId = r.data;
			});
		}}
	/>
{/if}

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
		<div class="space-y-1">
			<label class="text-sm text-muted-foreground" for="ui-zoom">UI Zoom: {((pendingZoom ?? s.uiZoom) * 100).toFixed(0)}%</label>
			<div class="flex items-center gap-3">
				<input
					id="ui-zoom"
					type="range"
					min="0.8"
					max="2.0"
					step="0.1"
					class="flex-1"
					value={pendingZoom ?? s.uiZoom}
					oninput={(e) => {
						pendingZoom = Number((e.target as HTMLInputElement).value);
					}}
				/>
				<Button
					disabled={pendingZoom === null || pendingZoom === s.uiZoom}
					onclick={() => {
						const val = pendingZoom!;
						saveSetting("uiZoom", val);
						getCurrentWebviewWindow().setZoom(val).catch(console.error);
						pendingZoom = null;
						addToast(`Zoom set to ${(val * 100).toFixed(0)}%`, "success");
					}}
				>
					Apply
				</Button>
			</div>
		</div>
	</section>

	<!-- Language Daily Limits -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Language Daily Limits</h3>
		<p class="text-sm text-muted-foreground">
			Maximum lessons and reviews per day for the language section. Set to 0 for unlimited.
		</p>
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="lang-daily-lessons">Max daily lessons</label>
				<input
					id="lang-daily-lessons"
					type="number"
					min="0"
					max="100"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.languageMaxDailyLessons}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("languageMaxDailyLessons", val);
						addToast("Language daily lesson limit saved", "success");
					}}
				/>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="lang-daily-reviews">Max daily reviews</label>
				<input
					id="lang-daily-reviews"
					type="number"
					min="0"
					max="1000"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.languageMaxDailyReviews}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("languageMaxDailyReviews", val);
						addToast("Language daily review limit saved", "success");
					}}
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
				onchange={(e) => {
					const val = (e.target as HTMLInputElement).checked;
					saveSetting("ttsEnabled", val);
					addToast(val ? "TTS enabled" : "TTS disabled", "success");
				}}
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
					onchange={(e) => {
						const val = (e.target as HTMLInputElement).checked;
						saveSetting("kanjiAutoSpeak", val);
						addToast(val ? "Auto-speak enabled" : "Auto-speak disabled", "success");
					}}
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
				onchange={(e) => {
					const val = (e.target as HTMLInputElement).checked;
					saveSetting("showReviewTimer", val);
					addToast(val ? "Review timer shown" : "Review timer hidden", "success");
				}}
			/>
			<span class="text-sm">Show timer during review</span>
		</label>
	</section>

	<!-- Learning Path -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Learning Path</h3>
		<p class="text-sm text-muted-foreground">
			Your learning path determines which items you study and how they're paced across levels.
		</p>
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium">{currentPathLabel}</span>
			{#if showPathChangeConfirm}
				<div class="flex items-center gap-2">
					<span class="text-xs text-destructive">All language progress will be reset.</span>
					<Button variant="destructive" size="sm" onclick={handleChangePath}>
						Change
					</Button>
					<Button variant="outline" size="sm" onclick={() => (showPathChangeConfirm = false)}>
						Cancel
					</Button>
				</div>
			{:else}
				<Button variant="outline" size="sm" onclick={() => (showPathChangeConfirm = true)}>
					Change Path
				</Button>
			{/if}
		</div>
	</section>

	<!-- Language Lesson Caps -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Language Lessons</h3>
		<p class="text-sm text-muted-foreground">
			Maximum number of pending (unlocked but unlearned) lessons per content type. Lower values keep sessions focused.
		</p>
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="vocab-cap">Vocabulary cap</label>
				<input
					id="vocab-cap"
					type="number"
					min="1"
					max="50"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.vocabLessonCap}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("vocabLessonCap", val);
						addToast("Vocabulary lesson cap saved", "success");
					}}
				/>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="grammar-cap">Grammar cap</label>
				<input
					id="grammar-cap"
					type="number"
					min="1"
					max="50"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.grammarLessonCap}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("grammarLessonCap", val);
						addToast("Grammar lesson cap saved", "success");
					}}
				/>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="sentence-cap">Sentence cap</label>
				<input
					id="sentence-cap"
					type="number"
					min="1"
					max="50"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.sentenceLessonCap}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("sentenceLessonCap", val);
						addToast("Sentence lesson cap saved", "success");
					}}
				/>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="conj-cap">Conjugation cap</label>
				<input
					id="conj-cap"
					type="number"
					min="1"
					max="50"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.conjugationLessonCap}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("conjugationLessonCap", val);
						addToast("Conjugation lesson cap saved", "success");
					}}
				/>
			</div>
		</div>
	</section>

	<!-- Kanji -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Kanji</h3>
		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="kanji-batch">Lesson batch size</label>
				<select
					id="kanji-batch"
					class="w-full rounded-md border bg-background px-3 py-2 text-sm"
					value={String(s.kanjiBatchSize)}
					onchange={(e) => {
						const val = Number((e.target as HTMLSelectElement).value);
						saveSetting("kanjiBatchSize", val);
						addToast("Batch size updated", "success");
					}}
				>
					{#each [3, 5, 7, 10] as size}
						<option value={String(size)}>{size} items</option>
					{/each}
				</select>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="kanji-daily">Max daily lessons</label>
				<input
					id="kanji-daily"
					type="number"
					min="0"
					max="100"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.kanjiMaxDailyLessons}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("kanjiMaxDailyLessons", val);
						addToast("Kanji daily lesson limit saved", "success");
					}}
				/>
			</div>
			<div class="space-y-1">
				<label class="text-sm text-muted-foreground" for="kanji-daily-reviews">Max daily reviews</label>
				<input
					id="kanji-daily-reviews"
					type="number"
					min="0"
					max="1000"
					class="w-full rounded-md border bg-background px-3 py-2"
					value={s.kanjiMaxDailyReviews}
					onchange={(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						saveSetting("kanjiMaxDailyReviews", val);
						addToast("Kanji daily review limit saved", "success");
					}}
				/>
			</div>
		</div>
		<div class="space-y-1">
			<label class="text-sm text-muted-foreground" for="kanji-order">Review ordering</label>
			<select
				id="kanji-order"
				class="w-full rounded-md border bg-background px-3 py-2 text-sm"
				value={s.kanjiReviewOrder}
				onchange={(e) => {
					saveSetting("kanjiReviewOrder", (e.target as HTMLSelectElement).value as KanjiReviewOrder);
					addToast("Review order updated", "success");
				}}
			>
				<option value="due-first">Due First</option>
				<option value="apprentice-first">Apprentice First</option>
				<option value="lower-srs">Lower SRS Stages First</option>
				<option value="lower-level">Lower Levels First</option>
			</select>
		</div>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={s.kanjiShowSrsIndicator}
				onchange={(e) => {
					const val = (e.target as HTMLInputElement).checked;
					saveSetting("kanjiShowSrsIndicator", val);
					addToast(val ? "SRS indicator shown" : "SRS indicator hidden", "success");
				}}
			/>
			<span class="text-sm">Show SRS stage change after each review</span>
		</label>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				checked={s.kanjiAutoplayAudio}
				onchange={(e) => {
					const val = (e.target as HTMLInputElement).checked;
					saveSetting("kanjiAutoplayAudio", val);
					addToast(val ? "Audio autoplay enabled" : "Audio autoplay disabled", "success");
				}}
			/>
			<span class="text-sm">Autoplay audio in lessons and reviews</span>
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
	</section>

	<!-- Search Index -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Search Index</h3>
		<p class="text-sm text-muted-foreground">
			Rebuild the full-text search index if search results seem incomplete or out of sync.
		</p>
		<Button variant="outline" onclick={handleRebuildFts} disabled={rebuildingFts}>
			{rebuildingFts ? "Rebuilding..." : "Rebuild Search Index"}
		</Button>
	</section>

	<!-- Updates -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Updates</h3>
		<p class="text-sm text-muted-foreground">
			Janki checks for updates automatically on launch.
		</p>
		<Button variant="outline" onclick={() => checkForUpdates()}>Check for Updates</Button>
	</section>

	<!-- Reset Defaults -->
	<section class="space-y-3 rounded-lg border bg-card p-4">
		<h3 class="font-medium">Reset</h3>
		<p class="text-sm text-muted-foreground">
			Restore all settings to their default values. This does not affect your decks or review history.
		</p>
		{#if showResetConfirm}
			<div class="flex items-center gap-3">
				<span class="text-sm text-destructive">Are you sure?</span>
				<Button variant="destructive" onclick={handleResetDefaults}>Yes, reset all settings</Button>
				<Button variant="outline" onclick={() => (showResetConfirm = false)}>Cancel</Button>
			</div>
		{:else}
			<Button variant="outline" onclick={() => (showResetConfirm = true)}>Reset to Defaults</Button>
		{/if}
	</section>

	<!-- Reset Learning Data -->
	<section class="space-y-3 rounded-lg border border-destructive/30 bg-card p-4">
		<h3 class="font-medium text-destructive">Reset Learning Data</h3>
		<p class="text-sm text-muted-foreground">
			Reset all SRS progress, review history, and unlock state. Your vocabulary, kanji, and content data will be kept -- only your learning progress is erased.
		</p>
		{#if showResetLearningConfirm}
			<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
				<p class="text-sm font-medium text-destructive">
					Are you sure you want to reset your {showResetLearningConfirm === "all" ? "language and kanji" : showResetLearningConfirm} progress? This will delete all review history and reset every item to locked. This cannot be undone.
				</p>
				<div class="flex items-center gap-3">
					<Button variant="destructive" onclick={handleResetLearning} disabled={resettingLearning}>
						{resettingLearning ? "Resetting..." : "Yes, reset everything"}
					</Button>
					<Button variant="outline" onclick={() => (showResetLearningConfirm = null)}>Cancel</Button>
				</div>
			</div>
		{:else}
			<div class="flex flex-wrap gap-2">
				<Button variant="destructive" onclick={() => (showResetLearningConfirm = "language")}>
					Reset Language Progress
				</Button>
				<Button variant="destructive" onclick={() => (showResetLearningConfirm = "kanji")}>
					Reset Kanji Progress
				</Button>
				<Button variant="destructive" onclick={() => (showResetLearningConfirm = "all")}>
					Reset All Progress
				</Button>
			</div>
		{/if}
	</section>

	<!-- About -->
	<section class="space-y-2 rounded-lg border bg-card p-4">
		<h3 class="font-medium">About</h3>
		<p class="text-sm text-muted-foreground">Janki v{appVersion}</p>
		<p class="text-sm text-muted-foreground">
			Kanji data: davidluzgouveia/kanji-data (MIT).
			SRS engine: ts-fsrs (MIT).
		</p>
	</section>
</div>
