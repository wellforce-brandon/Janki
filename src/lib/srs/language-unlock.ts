import { getDb, safeQuery, type QueryResult } from "../db/database";
import {
	type ContentType,
	unlockLanguageItems,
	getNextLockedKanaGroup,
	getLockedKanaByGroup,
	getKanaGroupProgress,
	getPreviousKanaGroup,
	getPendingLessonCount,
	getLockedVocabularyBatch,
	getLockedGrammarBatch,
	getLockedSentenceBatch,
	getLockedConjugationBatch,
	getJlptLevelProgressByType,
	getContentTypeMilestone,
	getNextLockedGrammarGroup,
	getLockedGrammarByGroup,
	getGrammarGroupProgress,
	getPreviousGrammarGroup,
} from "../db/queries/language";
import { getSettings } from "../stores/app-settings.svelte";
import { KANJI_REGEX_GLOBAL } from "../utils/japanese";

/** JLPT levels in progression order, null = untagged (last) */
const JLPT_LEVELS: (string | null)[] = ["N5", "N4", "N3", "N2", "N1", null];

/** Threshold for JLPT level gating: >80% of previous level at Guru+ */
const JLPT_GATE_THRESHOLD = 0.8;

/** Sentence unlock prerequisites */
const SENTENCE_VOCAB_THRESHOLD = 50;
const SENTENCE_GRAMMAR_THRESHOLD = 10;

/** Conjugation unlock prerequisites */
const CONJUGATION_VOCAB_THRESHOLD = 10;

/**
 * Run after each review session (language or kanji) and on app startup.
 * Checks all locked items for met prerequisites and unlocks them,
 * respecting per-content-type pending lesson caps.
 * Returns the count of newly unlocked items.
 */
let unlockRunning = false;

export async function checkAndUnlockItems(): Promise<QueryResult<number>> {
	if (unlockRunning) return { ok: true, data: 0 };
	unlockRunning = true;
	try {
	return await safeQuery(async () => {
		let totalUnlocked = 0;

		// 1. Kana: progressive group unlock (already capped by group size)
		totalUnlocked += await unlockKana();

		// 2. Vocabulary: JLPT-ordered, frequency-ranked, kanji-gated, capped
		totalUnlocked += await unlockVocabulary();

		// 3. Grammar: JLPT-ordered, frequency-ranked, capped
		totalUnlocked += await unlockGrammar();

		// 4. Sentences: milestone-gated, frequency-ranked, capped
		totalUnlocked += await unlockSentences();

		// 5. Conjugation: milestone-gated, capped
		totalUnlocked += await unlockConjugations();

		return totalUnlocked;
	});
	} finally {
		unlockRunning = false;
	}
}

// --- Kana (unchanged -- already properly gated) ---

const KANA_GATE_THRESHOLD = 0.8;

async function unlockKana(): Promise<number> {
	const nextGroup = await getNextLockedKanaGroup();
	if (!nextGroup.ok) { console.warn("[unlock] getNextLockedKanaGroup failed:", nextGroup.error); return 0; }
	if (!nextGroup.data) return 0;

	const { lesson_group, lesson_order } = nextGroup.data;

	if (lesson_order === 1) {
		return await unlockKanaGroup(lesson_group);
	}

	const prevGroupResult = await getPreviousKanaGroup(lesson_order);
	if (!prevGroupResult.ok || !prevGroupResult.data) {
		return await unlockKanaGroup(lesson_group);
	}

	const progress = await getKanaGroupProgress(prevGroupResult.data);
	if (!progress.ok) { console.warn("[unlock] getKanaGroupProgress failed:", progress.error); return 0; }

	const { total, at_apprentice4_plus } = progress.data;
	if (total === 0) return await unlockKanaGroup(lesson_group);

	const ratio = at_apprentice4_plus / total;
	if (ratio >= KANA_GATE_THRESHOLD) {
		return await unlockKanaGroup(lesson_group);
	}

	return 0;
}

async function unlockKanaGroup(lessonGroup: string): Promise<number> {
	const result = await getLockedKanaByGroup(lessonGroup);
	if (!result.ok || result.data.length === 0) return 0;

	const ids = result.data.map((r) => r.id);
	await unlockLanguageItems(ids);
	return ids.length;
}

// --- Vocabulary ---

async function unlockVocabulary(): Promise<number> {
	const pendingResult = await getPendingLessonCount("vocabulary");
	if (!pendingResult.ok) { console.warn("[unlock] vocab pending count failed:", pendingResult.error); return 0; }

	const cap = getSettings().vocabLessonCap;
	if (pendingResult.data >= cap) return 0;

	let remaining = cap - pendingResult.data;
	const guruKanji = await getGuruPlusKanji();
	let totalUnlocked = 0;

	for (const level of JLPT_LEVELS) {
		if (remaining <= 0) break;

		// JLPT gate for N4+ (N5 and untagged always open)
		if (level !== null && level !== "N5") {
			const gateOpen = await isJlptGateOpenForType(level, "vocabulary");
			if (!gateOpen) break;
		}

		// Fetch extra to account for kanji-blocked items
		// Fetch extra to account for kanji-blocked items, capped at 50
		const batchResult = await getLockedVocabularyBatch(level, Math.min(remaining * 3, 50));
		if (!batchResult.ok || batchResult.data.length === 0) continue;

		const toUnlock: number[] = [];
		for (const item of batchResult.data) {
			if (toUnlock.length >= remaining) break;

			const kanjiInWord = item.primary_text.match(KANJI_REGEX_GLOBAL);
			if (!kanjiInWord || kanjiInWord.length === 0) {
				toUnlock.push(item.id);
			} else {
				const allGuru = kanjiInWord.every((k) => guruKanji.has(k));
				if (allGuru) toUnlock.push(item.id);
			}
		}

		if (toUnlock.length > 0) {
			await unlockLanguageItems(toUnlock);
			totalUnlocked += toUnlock.length;
			remaining -= toUnlock.length;
		}
	}

	return totalUnlocked;
}

// --- Grammar ---

/** Threshold for grammar group gating: 80% of previous group at Apprentice 4+ */
const GRAMMAR_GATE_THRESHOLD = 0.8;

async function unlockGrammar(): Promise<number> {
	const pendingResult = await getPendingLessonCount("grammar");
	if (!pendingResult.ok) { console.warn("[unlock] grammar pending count failed:", pendingResult.error); return 0; }

	const cap = getSettings().grammarLessonCap;
	if (pendingResult.data >= cap) return 0;

	let remaining = cap - pendingResult.data;
	let totalUnlocked = 0;

	// Phase 1: Structured group progression (Tae Kim sections)
	// While grouped items exist, only unlock through group progression
	const nextGroup = await getNextLockedGrammarGroup();
	if (nextGroup.ok && nextGroup.data) {
		const groupUnlocked = await unlockGrammarByGroup(nextGroup.data, remaining);
		totalUnlocked += groupUnlocked;
		// Don't fall through to ungrouped -- keep focus on current group
		return totalUnlocked;
	}

	// Phase 2: All groups exhausted -- ungrouped items, JLPT-ordered
	for (const level of JLPT_LEVELS) {
		if (remaining <= 0) break;

		if (level !== null && level !== "N5") {
			const gateOpen = await isJlptGateOpenForType(level, "grammar");
			if (!gateOpen) break;
		}

		const batchResult = await getLockedGrammarBatch(level, remaining);
		if (!batchResult.ok || batchResult.data.length === 0) continue;

		const toUnlock = batchResult.data.slice(0, remaining).map((i) => i.id);
		if (toUnlock.length > 0) {
			await unlockLanguageItems(toUnlock);
			totalUnlocked += toUnlock.length;
			remaining -= toUnlock.length;
		}
	}

	return totalUnlocked;
}

async function unlockGrammarByGroup(
	groupInfo: { lesson_group: string; lesson_order: number },
	cap: number,
): Promise<number> {
	const { lesson_group, lesson_order } = groupInfo;

	// First group (copula) unlocks immediately
	if (lesson_order <= 1) {
		return await doUnlockGrammarGroup(lesson_group, cap);
	}

	// Check previous group has 80% at Apprentice 4+
	const prevGroup = await getPreviousGrammarGroup(lesson_order);
	if (!prevGroup.ok || !prevGroup.data) {
		// No previous group found -- unlock anyway
		return await doUnlockGrammarGroup(lesson_group, cap);
	}

	const progress = await getGrammarGroupProgress(prevGroup.data);
	if (!progress.ok) return 0;

	const { total, at_apprentice4_plus } = progress.data;
	if (total === 0 || at_apprentice4_plus / total >= GRAMMAR_GATE_THRESHOLD) {
		return await doUnlockGrammarGroup(lesson_group, cap);
	}

	return 0; // Gate not met -- learner needs to progress current group first
}

async function doUnlockGrammarGroup(lessonGroup: string, cap: number): Promise<number> {
	const result = await getLockedGrammarByGroup(lessonGroup, cap);
	if (!result.ok || result.data.length === 0) return 0;

	const ids = result.data.map((r) => r.id);
	await unlockLanguageItems(ids);
	return ids.length;
}

// --- Sentences ---

async function unlockSentences(): Promise<number> {
	// Check global prerequisites: enough vocab + grammar foundation
	const vocabMilestone = await getContentTypeMilestone("vocabulary", 4);
	const grammarMilestone = await getContentTypeMilestone("grammar", 4);
	if (!vocabMilestone.ok) { console.warn("[unlock] sentence vocab milestone failed:", vocabMilestone.error); return 0; }
	if (!grammarMilestone.ok) { console.warn("[unlock] sentence grammar milestone failed:", grammarMilestone.error); return 0; }
	if (vocabMilestone.data < SENTENCE_VOCAB_THRESHOLD) return 0;
	if (grammarMilestone.data < SENTENCE_GRAMMAR_THRESHOLD) return 0;

	const pendingResult = await getPendingLessonCount("sentence");
	if (!pendingResult.ok) return 0;

	const cap = getSettings().sentenceLessonCap;
	if (pendingResult.data >= cap) return 0;

	let remaining = cap - pendingResult.data;
	let totalUnlocked = 0;

	// Unlock sentences in JLPT order (N5 first, then N4, etc.)
	for (const level of JLPT_LEVELS) {
		if (remaining <= 0) break;

		if (level !== null && level !== "N5") {
			const gateOpen = await isJlptGateOpenForType(level, "sentence");
			if (!gateOpen) break;
		}

		const batchResult = await getLockedSentenceBatch(level, remaining);
		if (!batchResult.ok || batchResult.data.length === 0) continue;

		const toUnlock = batchResult.data.slice(0, remaining).map((i) => i.id);
		if (toUnlock.length > 0) {
			await unlockLanguageItems(toUnlock);
			totalUnlocked += toUnlock.length;
			remaining -= toUnlock.length;
		}
	}

	return totalUnlocked;
}

// --- Conjugation ---

async function unlockConjugations(): Promise<number> {
	// Check prerequisite: enough vocab learned
	const vocabMilestone = await getContentTypeMilestone("vocabulary", 4);
	if (!vocabMilestone.ok) { console.warn("[unlock] conjugation vocab milestone failed:", vocabMilestone.error); return 0; }
	if (vocabMilestone.data < CONJUGATION_VOCAB_THRESHOLD) return 0;

	const pendingResult = await getPendingLessonCount("conjugation");
	if (!pendingResult.ok) return 0;

	const cap = getSettings().conjugationLessonCap;
	if (pendingResult.data >= cap) return 0;

	const needed = cap - pendingResult.data;
	const batchResult = await getLockedConjugationBatch(needed);
	if (!batchResult.ok || batchResult.data.length === 0) return 0;

	const toUnlock = batchResult.data.map((i) => i.id);
	await unlockLanguageItems(toUnlock);
	return toUnlock.length;
}

// --- Shared helpers ---

/** Get set of kanji characters at Guru+ (srs_stage >= 5) in kanji_levels */
async function getGuruPlusKanji(): Promise<Set<string>> {
	const result = await safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ character: string }[]>(
			"SELECT character FROM kanji_levels WHERE item_type = 'kanji' AND srs_stage >= 5",
		);
		return new Set(rows.map((r) => r.character));
	});
	return result.ok ? result.data : new Set();
}

/** Check if the JLPT gate is open for a given level and content type */
async function isJlptGateOpenForType(level: string, contentType: ContentType): Promise<boolean> {
	const idx = JLPT_LEVELS.indexOf(level);
	if (idx <= 0) return true; // N5, untagged, or unknown -- always open

	const prevLevel = JLPT_LEVELS[idx - 1];
	if (prevLevel === null) return true;

	const result = await getJlptLevelProgressByType(prevLevel, contentType);
	if (!result.ok) return false;

	const { total, guru_plus } = result.data;
	if (total === 0) return true;
	return guru_plus / total >= JLPT_GATE_THRESHOLD;
}
