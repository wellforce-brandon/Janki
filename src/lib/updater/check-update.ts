import { check } from "@tauri-apps/plugin-updater";
import { addToast } from "$lib/stores/toast.svelte";
import { setInstalling, setPendingUpdate, showUpdateDialog } from "$lib/stores/update.svelte";

/**
 * Silent background check on app startup.
 * Stores the result in the update store for the sidebar banner.
 */
export async function checkForUpdatesSilent(): Promise<void> {
	try {
		const update = await check();
		if (update) {
			setPendingUpdate(update);
		}
	} catch (e) {
		console.error("[Updater] Silent check failed:", e);
	}
}

/**
 * Manual check from Settings page.
 * Opens the custom update dialog if an update is found.
 */
export async function checkForUpdates(): Promise<void> {
	try {
		const update = await check();
		if (update) {
			setPendingUpdate(update);
			showUpdateDialog();
		} else {
			addToast("You're on the latest version", "info", 3000);
		}
	} catch (e) {
		console.error("[Updater] Check failed:", e);
		const msg = e instanceof Error ? e.message : String(e);
		if (msg.includes("404") || msg.includes("network") || msg.includes("fetch")) {
			addToast("No update info available yet -- try again later", "info", 3000);
		} else {
			addToast("Update check failed", "error", 3000);
		}
	}
}

/**
 * Download and install the pending update.
 * Called from the update dialog or the sidebar banner.
 */
export async function installUpdate(): Promise<void> {
	const { getPendingUpdate } = await import("$lib/stores/update.svelte");
	const update = getPendingUpdate();
	if (!update) return;

	setInstalling(true);
	try {
		await update.downloadAndInstall();
	} catch (e) {
		console.error("[Updater] Install failed:", e);
		addToast("Update install failed", "error", 3000);
		setInstalling(false);
	}
}
