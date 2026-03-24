import { getDb } from "$lib/db/database";

export type KanjiReviewOrder = "due-first" | "apprentice-first" | "lower-srs" | "lower-level";

export interface AppSettings {
	theme: "dark" | "light" | "system";
	ttsEnabled: boolean;
	ttsRate: number;
	ttsPitch: number;
	kanjiAutoSpeak: boolean;
	showReviewTimer: boolean;
	kanjiBatchSize: number;
	kanjiMaxDailyLessons: number;
	kanjiMaxDailyReviews: number;
	kanjiReviewOrder: KanjiReviewOrder;
	kanjiShowSrsIndicator: boolean;
	kanjiAutoplayAudio: boolean;
	languageMaxDailyLessons: number;
	languageMaxDailyReviews: number;
	vocabLessonCap: number;
	grammarLessonCap: number;
	sentenceLessonCap: number;
	conjugationLessonCap: number;
	uiZoom: number;
}

const DEFAULTS: AppSettings = {
	theme: "dark",
	ttsEnabled: true,
	ttsRate: 1.0,
	ttsPitch: 1.0,
	kanjiAutoSpeak: false,
	showReviewTimer: true,
	kanjiBatchSize: 5,
	kanjiMaxDailyLessons: 15,
	kanjiMaxDailyReviews: 200,
	kanjiReviewOrder: "due-first",
	kanjiShowSrsIndicator: true,
	kanjiAutoplayAudio: false,
	languageMaxDailyLessons: 20,
	languageMaxDailyReviews: 200,
	vocabLessonCap: 10,
	grammarLessonCap: 5,
	sentenceLessonCap: 5,
	conjugationLessonCap: 5,
	uiZoom: 1.5,
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

		const parsed: Record<string, unknown> = {};
		for (const row of rows) {
			const possibleKey = row.key.replace("app_", "");
			if (possibleKey in DEFAULTS) {
				const key = possibleKey as keyof AppSettings;
				const val = row.value;
				if (typeof DEFAULTS[key] === "number") {
					const num = Number(val);
					parsed[key] = Number.isFinite(num) ? num : DEFAULTS[key];
				} else if (typeof DEFAULTS[key] === "boolean") {
					parsed[key] = val === "true";
				} else {
					parsed[key] = val;
				}
			}
		}
		settings = { ...settings, ...parsed } as AppSettings;
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

let systemThemeHandler: ((e: MediaQueryListEvent) => void) | null = null;

function applyTheme(theme: string): void {
	// Clean up previous system theme listener
	if (systemThemeHandler) {
		window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", systemThemeHandler);
		systemThemeHandler = null;
	}

	const prefersDark =
		theme === "dark" ||
		(theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

	if (prefersDark) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}

	// Listen for OS theme changes when set to "system"
	if (theme === "system") {
		systemThemeHandler = (e: MediaQueryListEvent) => {
			if (e.matches) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		};
		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", systemThemeHandler);
	}
}
