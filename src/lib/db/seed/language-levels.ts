import type { PathId } from "$lib/data/learning-paths";
import { DEFAULT_PATH } from "$lib/data/learning-paths";
import { getDb, safeQuery } from "../database";

/**
 * Assigns language_items to language_level based on the user's selected learning path.
 * Runs once on startup, idempotent via settings key.
 *
 * Level assignments are pre-built by `scripts/build-language-levels.mjs` and stored
 * as JSON files in `public/data/language/paths/{path-id}.json`. This function reads
 * the selected path's JSON and applies item_key -> level mappings to the DB.
 *
 * The build script handles all the sorting, filtering, and distribution logic.
 * This seed script just applies the result and computes sentence prerequisites.
 */

const SETTINGS_KEY = "language_levels_v5_paths";

interface DbHandle {
	execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
	select<T>(sql: string, params?: unknown[]): Promise<T>;
}

interface PathData {
	pathId: string;
	totalLevels: number;
	totalItems: number;
	assignments: Record<string, number>;
}

export async function assignLanguageLevels(): Promise<void> {
	const check = await safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = ?", [
			SETTINGS_KEY,
		]);
		return rows.length > 0 && rows[0].value === "true";
	});
	if (check.ok && check.data) return; // Already assigned

	const pathId = await getSelectedPath();
	console.log(`[language-levels] Assigning levels from path "${pathId}"...`);

	const result = await safeQuery(async () => {
		const db = await getDb();

		// Clear any previous assignments and reset SRS state for clean reassignment
		await db.execute(
			"UPDATE language_items SET language_level = NULL WHERE language_level IS NOT NULL",
		);
		await db.execute(
			`UPDATE language_items SET srs_stage = 0, unlocked_at = NULL, next_review = NULL,
			 lesson_completed_at = NULL, correct_count = 0, incorrect_count = 0
			 WHERE srs_stage > 0`,
		);
		await db.execute("DELETE FROM language_review_log");

		// Fetch pre-built path assignments
		const pathData = await fetchPathData(pathId);

		// Group assignments by level for batch SQL updates
		const byLevel = new Map<number, string[]>();
		for (const [itemKey, level] of Object.entries(pathData.assignments)) {
			if (!byLevel.has(level)) byLevel.set(level, []);
			byLevel.get(level)?.push(itemKey);
		}

		// Apply assignments in batches (500 items per SQL statement, SQLite variable limit)
		let totalAssigned = 0;
		for (const [level, itemKeys] of byLevel) {
			for (let i = 0; i < itemKeys.length; i += 500) {
				const chunk = itemKeys.slice(i, i + 500);
				const placeholders = chunk.map(() => "?").join(",");
				const res = await db.execute(
					`UPDATE language_items SET language_level = ? WHERE item_key IN (${placeholders})`,
					[level, ...chunk],
				);
				totalAssigned += res.rowsAffected;
			}
		}

		console.log(
			`[language-levels] Applied ${totalAssigned} level assignments across ${pathData.totalLevels} levels.`,
		);

		// Compute sentence prerequisites (kanji-based)
		await computeSentencePrerequisites(db);

		// Auto-unlock level 1 kana only
		await bootstrapLevel1(db);

		// Mark as done
		await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, 'true')", [
			SETTINGS_KEY,
		]);
	});

	if (!result.ok) {
		console.error("[language-levels] Failed to assign levels:", result.error);
	} else {
		console.log("[language-levels] Level assignment complete.");
	}
}

/**
 * Read the user's selected learning path from settings.
 * Defaults to "n5" if no path has been selected (Phase 3 adds path picker UI).
 */
async function getSelectedPath(): Promise<PathId> {
	const result = await safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ value: string }[]>(
			"SELECT value FROM settings WHERE key = 'language_path'",
		);
		return rows.length > 0 ? rows[0].value : null;
	});

	const valid = new Set<string>(["n5", "conversational", "n1", "completionist"]);
	if (result.ok && result.data && valid.has(result.data)) {
		return result.data as PathId;
	}
	return DEFAULT_PATH;
}

/**
 * Fetch the pre-built path JSON from static assets.
 */
async function fetchPathData(pathId: PathId): Promise<PathData> {
	const res = await fetch(`/data/language/paths/${pathId}.json`);
	if (!res.ok) {
		throw new Error(`Failed to fetch path data for "${pathId}": ${res.status} ${res.statusText}`);
	}
	return res.json();
}

// ── Sentence prerequisites ──────────────────────────────────────────────────

const KANJI_MIN = 0x4e00;
const KANJI_MAX = 0x9fff;

function extractKanji(text: string): string[] {
	const kanji = new Set<string>();
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (code >= KANJI_MIN && code <= KANJI_MAX) {
			kanji.add(char);
		}
	}
	return [...kanji];
}

/**
 * Pre-compute prerequisite_keys for sentences based on kanji in their text.
 * Each kanji character becomes a "kanji:<char>" prerequisite key.
 * Sentences without kanji get empty prerequisites (unlock with level).
 */
async function computeSentencePrerequisites(db: DbHandle): Promise<void> {
	const sentences = await db.select<
		{ id: number; primary_text: string; sentence_ja: string | null }[]
	>(
		`SELECT id, primary_text, sentence_ja FROM language_items
		 WHERE content_type = 'sentence' AND language_level IS NOT NULL`,
	);

	const updates: { id: number; keys: string }[] = [];

	for (const sentence of sentences) {
		const text = sentence.sentence_ja ?? sentence.primary_text;
		const kanjiChars = extractKanji(text);

		if (kanjiChars.length === 0) {
			updates.push({ id: sentence.id, keys: "[]" });
		} else {
			const prereqKeys = kanjiChars.map((k) => `kanji:${k}`);
			updates.push({ id: sentence.id, keys: JSON.stringify(prereqKeys) });
		}
	}

	for (let i = 0; i < updates.length; i += 200) {
		const chunk = updates.slice(i, i + 200);
		for (const { id, keys } of chunk) {
			await db.execute("UPDATE language_items SET prerequisite_keys = ? WHERE id = ?", [keys, id]);
		}
	}

	console.log(`[language-levels] Computed prerequisites for ${sentences.length} sentences.`);
}

// ── Bootstrap ───────────────────────────────────────────────────────────────

/**
 * If no language items are unlocked yet, auto-unlock level 1 KANA only.
 * Vocab stays locked until kana lessons are completed.
 */
async function bootstrapLevel1(db: DbHandle): Promise<void> {
	const unlocked = await db.select<{ cnt: number }[]>(
		"SELECT COUNT(*) as cnt FROM language_items WHERE srs_stage > 0",
	);
	if (unlocked[0].cnt > 0) return; // User has already progressed

	await db.execute(
		`UPDATE language_items
		 SET srs_stage = 1, unlocked_at = datetime('now')
		 WHERE language_level = 1 AND srs_stage = 0 AND content_type = 'kana'`,
	);
	console.log("[language-levels] Auto-unlocked level 1 kana.");
}
