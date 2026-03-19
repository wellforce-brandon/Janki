<script lang="ts">
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import Button from "$lib/components/ui/button/button.svelte";
import { parseApkg } from "$lib/import/apkg-parser";
import { type ImportResult, mapAnkiToDeck } from "$lib/import/deck-mapper";
import { extractAndStoreMedia } from "$lib/import/media-extractor";

interface Props {
	onimported: () => void;
	onclose: () => void;
}

let { onimported, onclose }: Props = $props();

let step = $state("");
let progress = $state(0);
let total = $state(0);
let importing = $state(false);
let result = $state<ImportResult | null>(null);
let error = $state<string | null>(null);

async function pickAndImport() {
	error = null;
	result = null;

	const selected = await open({
		filters: [{ name: "Anki Package", extensions: ["apkg"] }],
		multiple: false,
	});

	if (!selected) return;

	importing = true;

	try {
		step = "Reading file";
		const fileBytes = await readFile(selected);

		const pkg = await parseApkg(new Uint8Array(fileBytes), (s, c, t) => {
			step = s;
			progress = c;
			total = t;
		});

		// Check media size
		let totalMediaSize = 0;
		for (const data of pkg.media.values()) {
			totalMediaSize += data.byteLength;
		}
		if (totalMediaSize > 2 * 1024 * 1024 * 1024) {
			throw new Error("Media files exceed 2GB limit");
		}

		const sourceFile =
			typeof selected === "string"
				? (selected.split(/[/\\]/).pop() ?? "unknown.apkg")
				: "unknown.apkg";
		const importResult = await mapAnkiToDeck(pkg, sourceFile, (s, c, t) => {
			step = s;
			progress = c;
			total = t;
		});

		// Extract media
		if (pkg.media.size > 0) {
			await extractAndStoreMedia(pkg, importResult.deckId, (s, c, t) => {
				step = s;
				progress = c;
				total = t;
			});
		}

		result = importResult;
	} catch (e) {
		error = e instanceof Error ? e.message : "Import failed";
	} finally {
		importing = false;
	}
}

function done() {
	if (result) onimported();
	onclose();
}
</script>

<div class="space-y-4">
	<h3 class="text-lg font-semibold">Import Anki Deck</h3>

	{#if result}
		<div class="space-y-2 rounded-lg border bg-card p-4">
			<p class="font-medium text-green-600 dark:text-green-400">Import successful</p>
			<div class="text-sm text-muted-foreground">
				<p>Deck: {result.deckName}</p>
				<p>{result.noteCount} notes, {result.cardCount} cards</p>
				<p>{result.mediaCount} media files</p>
				{#if result.errors.length > 0}
					<p class="mt-2 text-orange-500">{result.errors.length} warnings:</p>
					<ul class="list-inside list-disc">
						{#each result.errors.slice(0, 5) as err}
							<li>{err}</li>
						{/each}
						{#if result.errors.length > 5}
							<li>...and {result.errors.length - 5} more</li>
						{/if}
					</ul>
				{/if}
			</div>
		</div>
		<Button onclick={done}>Done</Button>
	{:else if importing}
		<div class="space-y-2">
			<p class="text-sm text-muted-foreground">{step}</p>
			{#if total > 0}
				<div class="h-2 rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-primary transition-all"
						style="width: {Math.round((progress / total) * 100)}%"
					></div>
				</div>
				<p class="text-xs text-muted-foreground">{progress} / {total}</p>
			{/if}
		</div>
	{:else}
		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}
		<p class="text-sm text-muted-foreground">
			Select an Anki .apkg file to import. Cards will be imported as new (no scheduling history).
		</p>
		<div class="flex gap-2">
			<Button onclick={pickAndImport}>Choose File</Button>
			<Button variant="outline" onclick={onclose}>Cancel</Button>
		</div>
	{/if}
</div>
