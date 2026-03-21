import { getDb, safeQuery, type QueryResult } from "../db/database";
import {
	getLockedKanaItems,
	getLockedVocabularyItems,
	getLockedGrammarItems,
	getLockedSentenceItems,
	getLockedConjugationItems,
	getItemKeyStages,
	getJlptLevelProgress,
	unlockLanguageItems,
} from "../db/queries/language";

// Regex to detect kanji (CJK Unified Ideographs)
const KANJI_REGEX = /[\u4e00-\u9faf]/g;

/** JLPT levels in progression order */
const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/** Threshold for JLPT level gating: >80% of previous level at Guru+ */
const JLPT_GATE_THRESHOLD = 0.8;

/**
 * Run after each review session (language or kanji) and on app startup.
 * Checks all locked items for met prerequisites and unlocks them.
 * Returns the count of newly unlocked items.
 */
export async function checkAndUnlockItems(): Promise<QueryResult<number>> {
	return safeQuery(async () => {
		let totalUnlocked = 0;

		// 1. Kana: unlock all locked kana immediately
		totalUnlocked += await unlockKana();

		// 2. Vocabulary: unlock when all kanji in primary_text are Guru+ in kanji_levels
		totalUnlocked += await unlockVocabulary();

		// 3. Grammar: N5 first, then sequential within level, JLPT gating for N4+
		totalUnlocked += await unlockGrammar();

		// 4. Sentences: unlock when prerequisite grammar is Guru+
		totalUnlocked += await unlockSentences();

		// 5. Conjugation: unlock when base verb is Apprentice 4+
		totalUnlocked += await unlockConjugations();

		return totalUnlocked;
	});
}

async function unlockKana(): Promise<number> {
	const result = await getLockedKanaItems();
	if (!result.ok || result.data.length === 0) return 0;

	const ids = result.data.map((r) => r.id);
	await unlockLanguageItems(ids);
	return ids.length;
}

async function unlockVocabulary(): Promise<number> {
	const result = await getLockedVocabularyItems();
	if (!result.ok || result.data.length === 0) return 0;

	// Get all kanji that are at Guru+ in kanji_levels
	const guruKanji = await getGuruPlusKanji();

	const toUnlock: number[] = [];
	for (const item of result.data) {
		const kanjiInWord = item.primary_text.match(KANJI_REGEX);
		if (!kanjiInWord || kanjiInWord.length === 0) {
			// Kana-only word -- unlock immediately
			toUnlock.push(item.id);
		} else {
			// All kanji must be Guru+ in kanji_levels
			const allGuru = kanjiInWord.every((k) => guruKanji.has(k));
			if (allGuru) {
				toUnlock.push(item.id);
			}
		}
	}

	if (toUnlock.length > 0) {
		await unlockLanguageItems(toUnlock);
	}
	return toUnlock.length;
}

async function unlockGrammar(): Promise<number> {
	const result = await getLockedGrammarItems();
	if (!result.ok || result.data.length === 0) return 0;

	// Check JLPT gating for each level
	const gateCache = new Map<string, boolean>();

	const toUnlock: number[] = [];
	for (const item of result.data) {
		const level = item.jlpt_level ?? "N5";

		// N5 always unlockable; N4+ requires >80% of previous level at Guru+
		let gateOpen = true;
		if (level !== "N5") {
			if (!gateCache.has(level)) {
				gateCache.set(level, await isJlptGateOpen(level));
			}
			gateOpen = gateCache.get(level)!;
		}

		if (gateOpen) {
			toUnlock.push(item.id);
		}
	}

	if (toUnlock.length > 0) {
		// Unlock in batches -- sequential within level by frequency_rank (already sorted by query)
		await unlockLanguageItems(toUnlock);
	}
	return toUnlock.length;
}

async function unlockSentences(): Promise<number> {
	const result = await getLockedSentenceItems();
	if (!result.ok || result.data.length === 0) return 0;

	// Collect all prerequisite keys
	const itemsWithPrereqs: { id: number; keys: string[] }[] = [];
	const allKeys = new Set<string>();

	for (const item of result.data) {
		if (!item.prerequisite_keys) {
			// No prerequisites -- unlock immediately
			itemsWithPrereqs.push({ id: item.id, keys: [] });
			continue;
		}
		const keys = JSON.parse(item.prerequisite_keys) as string[];
		itemsWithPrereqs.push({ id: item.id, keys });
		for (const k of keys) allKeys.add(k);
	}

	// Batch check prerequisite stages
	const stageMap = await getPrerequisiteStages(Array.from(allKeys));

	const toUnlock: number[] = [];
	for (const item of itemsWithPrereqs) {
		if (item.keys.length === 0) {
			toUnlock.push(item.id);
		} else {
			// All prerequisite grammar must be Guru+ (stage >= 5)
			const allMet = item.keys.every((k) => (stageMap.get(k) ?? 0) >= 5);
			if (allMet) toUnlock.push(item.id);
		}
	}

	if (toUnlock.length > 0) {
		await unlockLanguageItems(toUnlock);
	}
	return toUnlock.length;
}

async function unlockConjugations(): Promise<number> {
	const result = await getLockedConjugationItems();
	if (!result.ok || result.data.length === 0) return 0;

	const itemsWithPrereqs: { id: number; keys: string[] }[] = [];
	const allKeys = new Set<string>();

	for (const item of result.data) {
		if (!item.prerequisite_keys) {
			// No prerequisites -- unlock immediately
			itemsWithPrereqs.push({ id: item.id, keys: [] });
			continue;
		}
		const keys = JSON.parse(item.prerequisite_keys) as string[];
		itemsWithPrereqs.push({ id: item.id, keys });
		for (const k of keys) allKeys.add(k);
	}

	const stageMap = await getPrerequisiteStages(Array.from(allKeys));

	const toUnlock: number[] = [];
	for (const item of itemsWithPrereqs) {
		if (item.keys.length === 0) {
			toUnlock.push(item.id);
		} else {
			// Base verb must be Apprentice 4+ (stage >= 4)
			const allMet = item.keys.every((k) => (stageMap.get(k) ?? 0) >= 4);
			if (allMet) toUnlock.push(item.id);
		}
	}

	if (toUnlock.length > 0) {
		await unlockLanguageItems(toUnlock);
	}
	return toUnlock.length;
}

/** Get set of kanji characters at Guru+ (srs_stage >= 5) in kanji_levels */
async function getGuruPlusKanji(): Promise<Set<string>> {
	const db = await getDb();
	const rows = await db.select<{ character: string }[]>(
		"SELECT character FROM kanji_levels WHERE item_type = 'kanji' AND srs_stage >= 5",
	);
	return new Set(rows.map((r) => r.character));
}

/** Check if the JLPT gate is open for a given level (>80% of previous level at Guru+) */
async function isJlptGateOpen(level: string): Promise<boolean> {
	const idx = JLPT_LEVELS.indexOf(level);
	if (idx <= 0) return true; // N5 or unknown -- always open

	const prevLevel = JLPT_LEVELS[idx - 1];
	const result = await getJlptLevelProgress(prevLevel);
	if (!result.ok) return false;

	const { total, guru_plus } = result.data;
	if (total === 0) return true;
	return guru_plus / total >= JLPT_GATE_THRESHOLD;
}

/** Batch-fetch SRS stages for prerequisite item_keys */
async function getPrerequisiteStages(keys: string[]): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (keys.length === 0) return map;

	const result = await getItemKeyStages(keys);
	if (result.ok) {
		for (const row of result.data) {
			map.set(row.item_key, row.srs_stage);
		}
	}
	return map;
}
