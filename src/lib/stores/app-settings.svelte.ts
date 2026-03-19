import { getDb } from "$lib/db/database";

export type KanjiReviewOrder = "shuffled" | "apprentice-first" | "lower-srs" | "lower-level";

export interface AppSettings {
	theme: "dark" | "light" | "system";
	dailyNewLimit: number;
	dailyReviewLimit: number;
	ttsEnabled: boolean;
	ttsRate: number;
	ttsPitch: number;
	kanjiAutoSpeak: boolean;
	showReviewTimer: boolean;
	kanjiBatchSize: number;
	kanjiMaxDailyLessons: number;
	kanjiReviewOrder: KanjiReviewOrder;
	kanjiShowSrsIndicator: boolean;
	kanjiAutoplayAudio: boolean;
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
	kanjiBatchSize: 5,
	kanjiMaxDailyLessons: 15,
	kanjiReviewOrder: "shuffled",
	kanjiShowSrsIndicator: true,
	kanjiAutoplayAudio: false,
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
	} catch (e) {
		console.error("[Settings] Failed to load settings:", e);
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
	} catch (e) {
		console.error("[Settings] Failed to save setting:", key, e);
	}

	if (key === "theme") applyTheme(value as string);
}

export function getDefaults(): AppSettings {
	return { ...DEFAULTS };
}

export async function resetAllSettings(): Promise<void> {
	settings = { ...DEFAULTS };
	try {
		const db = await getDb();
		await db.execute("DELETE FROM settings WHERE key LIKE 'app_%'");
	} catch (e) {
		console.error("[Settings] Failed to reset settings:", e);
	}
	applyTheme(DEFAULTS.theme);
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
