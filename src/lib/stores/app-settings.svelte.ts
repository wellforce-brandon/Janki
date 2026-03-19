import { getDb } from "$lib/db/database";

export interface AppSettings {
	theme: "dark" | "light" | "system";
	dailyNewLimit: number;
	dailyReviewLimit: number;
	ttsEnabled: boolean;
	ttsRate: number;
	ttsPitch: number;
	kanjiAutoSpeak: boolean;
	showReviewTimer: boolean;
}

const DEFAULTS: AppSettings = {
	theme: "dark",
	dailyNewLimit: 20,
	dailyReviewLimit: 200,
	ttsEnabled: true,
	ttsRate: 1.0,
	ttsPitch: 1.0,
	kanjiAutoSpeak: false,
	showReviewTimer: true,
};

let settings = $state<AppSettings>({ ...DEFAULTS });
let loaded = $state(false);

export function getSettings(): AppSettings {
	return settings;
}

export function isLoaded(): boolean {
	return loaded;
}

export async function loadSettings(): Promise<void> {
	try {
		const db = await getDb();
		const rows = await db.select<{ key: string; value: string }[]>(
			"SELECT key, value FROM settings WHERE key LIKE 'app_%'",
		);

		for (const row of rows) {
			const key = row.key.replace("app_", "") as keyof AppSettings;
			if (key in DEFAULTS) {
				const val = row.value;
				if (typeof DEFAULTS[key] === "number") {
					(settings as Record<string, unknown>)[key] = Number(val);
				} else if (typeof DEFAULTS[key] === "boolean") {
					(settings as Record<string, unknown>)[key] = val === "true";
				} else {
					(settings as Record<string, unknown>)[key] = val;
				}
			}
		}
	} catch {
		// Use defaults if DB not ready
	}
	loaded = true;

	// Apply theme on load
	applyTheme(settings.theme);
}

export async function saveSetting<K extends keyof AppSettings>(
	key: K,
	value: AppSettings[K],
): Promise<void> {
	settings = { ...settings, [key]: value };

	try {
		const db = await getDb();
		await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
			`app_${key}`,
			String(value),
		]);
	} catch {
		// Silently fail
	}

	if (key === "theme") applyTheme(value as string);
}

function applyTheme(theme: string): void {
	if (
		theme === "dark" ||
		(theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
	) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}
}
