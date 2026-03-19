import { mount } from "svelte";
import { getDb } from "$lib/db/database";
import { seedKanjiData } from "$lib/db/seed/kanji-data";
import App from "./App.svelte";

async function init() {
	// Initialize database and run migrations
	await getDb();

	// Seed kanji data on first launch
	await seedKanjiData();
}

init().catch(console.error);

const app = mount(App, {
	target: document.getElementById("app") as HTMLElement,
});

export default app;
