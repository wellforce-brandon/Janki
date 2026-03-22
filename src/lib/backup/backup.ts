import { appDataDir, join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { copyFile, exists, mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { closeDb, getDb } from "$lib/db/database";

const BACKUP_DIR = "backups";
const MAX_BACKUPS = 7;

async function getDbPath(): Promise<string> {
	const dataDir = await appDataDir();
	return join(dataDir, "janki.db");
}

async function getBackupDir(): Promise<string> {
	const dataDir = await appDataDir();
	const dir = await join(dataDir, BACKUP_DIR);
	if (!(await exists(dir))) {
		await mkdir(dir, { recursive: true });
	}
	return dir;
}

function formatBackupName(): string {
	const now = new Date();
	const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
	return `janki-backup-${ts}.db`;
}

export async function exportBackup(): Promise<string | null> {
	const dbPath = await getDbPath();
	const dest = await save({
		title: "Export Database Backup",
		defaultPath: formatBackupName(),
		filters: [{ name: "SQLite Database", extensions: ["db"] }],
	});
	if (!dest) return null;

	await copyFile(dbPath, dest);
	return dest;
}

export async function importBackup(): Promise<boolean> {
	const selected = await open({
		title: "Import Database Backup",
		filters: [{ name: "SQLite Database", extensions: ["db"] }],
		multiple: false,
	});
	if (!selected) return false;

	const dbPath = await getDbPath();
	// Back up current DB before replacing
	const backupDir = await getBackupDir();
	const safeName = await join(backupDir, `pre-restore-${formatBackupName()}`);
	await copyFile(dbPath, safeName);

	// Close active DB connection before replacing the file
	await closeDb();

	// Replace current DB with selected backup
	await copyFile(selected, dbPath);

	// Force reconnection so the next query uses the restored DB
	await getDb();
	return true;
}

export async function autoBackup(): Promise<void> {
	try {
		const dbPath = await getDbPath();
		if (!(await exists(dbPath))) return;

		const backupDir = await getBackupDir();
		const dest = await join(backupDir, formatBackupName());
		await copyFile(dbPath, dest);

		await pruneOldBackups(backupDir);
	} catch (e) {
		console.error("[Backup] Auto-backup failed:", e);
	}
}

async function pruneOldBackups(dir: string): Promise<void> {
	try {
		const entries = await readDir(dir);
		const backups = entries
			.filter((e) => e.name?.startsWith("janki-backup-") && e.name.endsWith(".db"))
			.sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""));

		// Remove oldest backups beyond MAX_BACKUPS
		for (const old of backups.slice(MAX_BACKUPS)) {
			if (old.name) {
				const path = await join(dir, old.name);
				await remove(path);
			}
		}
	} catch (e) {
		console.error("[Backup] Prune failed:", e);
	}
}
