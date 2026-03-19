import { ask } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";

export async function checkForUpdates(): Promise<void> {
	try {
		const update = await check();
		if (update) {
			const yes = await ask(
				`Version ${update.version} is available.\n\n${update.body ?? ""}`.trim() +
					"\n\nInstall now and restart?",
				{ title: "Update Available", kind: "info" },
			);
			if (yes) {
				await update.downloadAndInstall();
			}
		}
	} catch (e) {
		console.error("[Updater] Check failed:", e);
	}
}
