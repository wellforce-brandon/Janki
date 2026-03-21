import { mount } from "svelte";
import { autoBackup } from "$lib/backup/backup";
import { getDb } from "$lib/db/database";
import { seedKanjiData, backfillEnrichedData } from "$lib/db/seed/kanji-data";
import { seedLanguageData } from "$lib/db/seed/language-data";
import { loadSettings } from "$lib/stores/app-settings.svelte";
import { checkForUpdates } from "$lib/updater/check-update";
import App from "./App.svelte";

async function init() {
	await getDb();
	try {
		await seedKanjiData();
		await backfillEnrichedData();
		await seedLanguageData();
	} catch (e) {
		console.error("[SEED FAILED]", e);
	}
	await loadSettings();

	// Non-blocking: auto-backup and update check run after app is ready
	autoBackup().catch(console.error);
	checkForUpdates().catch(console.error);
}

init().catch(console.error);

const app = mount(App, {
	target: document.getElementById("app") as HTMLElement,
});

export default app;
