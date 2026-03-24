import { ask } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { addToast } from "$lib/stores/toast.svelte";
import { setInstalling, setPendingUpdate } from "$lib/stores/update.svelte";

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
 * Shows a dialog if an update is found, or a toast if already up to date.
 */
export async function checkForUpdates(): Promise<void> {
	try {
		const update = await check();
		if (update) {
			setPendingUpdate(update);
			const yes = await ask(
				`Version ${update.version} is available.\n\n${update.body ?? ""}`.trim() +
					"\n\nInstall now and restart?",
				{ title: "Update Available", kind: "info" },
			);
			if (yes) {
				await installUpdate();
			}
		} else {
			addToast("You're on the latest version", "info", 3000);
		}
	} catch (e) {
		console.error("[Updater] Check failed:", e);
		addToast("Update check failed", "error", 3000);
	}
}

/**
 * Download and install the pending update.
 * Called from either the Settings dialog or the sidebar banner.
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
