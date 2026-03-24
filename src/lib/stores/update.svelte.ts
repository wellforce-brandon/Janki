import type { Update } from "@tauri-apps/plugin-updater";

let pendingUpdate = $state<Update | null>(null);
let installing = $state(false);
let dialogOpen = $state(false);

export function getPendingUpdate(): Update | null {
	return pendingUpdate;
}

export function setPendingUpdate(update: Update | null): void {
	pendingUpdate = update;
}

export function isInstalling(): boolean {
	return installing;
}

export function setInstalling(value: boolean): void {
	installing = value;
}

export function isUpdateDialogOpen(): boolean {
	return dialogOpen;
}

export function showUpdateDialog(): void {
	dialogOpen = true;
}

export function hideUpdateDialog(): void {
	dialogOpen = false;
}
