import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/fira-code/400.css";
import { mount } from "svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { autoBackup } from "$lib/backup/backup";
import { getDb } from "$lib/db/database";
import { seedKanjiData, backfillEnrichedData } from "$lib/db/seed/kanji-data";
import {
	seedLanguageData,
	applyVocabPartOfSpeech,
	applyVocabTopicOrdering,
	applyVocabTopicOrderingV2,
	applyGrammarGroupOrdering,
	applySentenceJlptTagging,
	applyGrammarJlptTagging,
} from "$lib/db/seed/language-data";
import { assignLanguageLevels } from "$lib/db/seed/language-levels";
import { rebuildFtsIndex } from "$lib/db/queries/language";
import { rebuildKanjiFtsIndex } from "$lib/db/queries/kanji";
import { loadSettings, getSettings } from "$lib/stores/app-settings.svelte";
import { checkForUpdates } from "$lib/updater/check-update";
import App from "./App.svelte";

async function init() {
	await getDb();
	try {
		await seedKanjiData();
		await backfillEnrichedData();
		await seedLanguageData();
		await applyVocabPartOfSpeech();
		await applyVocabTopicOrdering();
		await applyVocabTopicOrderingV2();
		await applyGrammarGroupOrdering();
		await applySentenceJlptTagging();
		await applyGrammarJlptTagging();
		await assignLanguageLevels();
		await rebuildFtsIndex();
		await rebuildKanjiFtsIndex();
	} catch (e) {
		console.error("[SEED FAILED]", e);
	}
	await loadSettings();

	// Apply UI zoom from settings
	const zoom = getSettings().uiZoom;
	getCurrentWebviewWindow().setZoom(zoom).catch(console.error);

	// Non-blocking: auto-backup and update check run after app is ready
	autoBackup().catch(console.error);
	checkForUpdates().catch(console.error);
}

init()
	.then(() => {
		mount(App, {
			target: document.getElementById("app") as HTMLElement,
		});
	})
	.catch(console.error);
