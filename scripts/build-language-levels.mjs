#!/usr/bin/env node
/**
 * Build-time script that generates level assignments for each learning path.
 *
 * Input:  public/data/language/{vocabulary,grammar,sentence,kana,conjugation}.json
 * Output: public/data/language/paths/{path-id}.json
 *
 * Each output file maps item_key -> level number for every item in that path.
 * The seed script (language-levels.ts) consumes these at app startup.
 *
 * Usage: node scripts/build-language-levels.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Path definitions (mirrors src/lib/data/learning-paths.ts) ───────────────

const PATHS = {
	n5: {
		id: "n5",
		label: "JLPT N5",
		jlptScope: ["N5"],
		maxCoreLevels: 60,
		frequencyCutoff: undefined,
		includeUntagged: false,
		pacing: {
			kanaLevels: 8,
			vocabDensity: [20, 30],
			grammarIntroLevel: 9,
			conjugationIntroLevel: 9,
			sentenceIntroLevel: 12,
		},
	},
	conversational: {
		id: "conversational",
		label: "Conversational",
		jlptScope: ["N5", "N4", "N3"],
		maxCoreLevels: 60,
		frequencyCutoff: 10000,
		includeUntagged: false,
		pacing: {
			kanaLevels: 5,
			vocabDensity: [30, 40],
			grammarIntroLevel: 6,
			conjugationIntroLevel: 6,
			sentenceIntroLevel: 8,
		},
	},
	n1: {
		id: "n1",
		label: "JLPT N1",
		jlptScope: ["N5", "N4", "N3", "N2", "N1"],
		maxCoreLevels: 100,
		frequencyCutoff: undefined,
		includeUntagged: false,
		pacing: {
			kanaLevels: 3,
			vocabDensity: [30, 40],
			grammarIntroLevel: 4,
			conjugationIntroLevel: 4,
			sentenceIntroLevel: 5,
		},
	},
	completionist: {
		id: "completionist",
		label: "Completionist",
		jlptScope: ["N5", "N4", "N3", "N2", "N1"],
		maxCoreLevels: 100,
		frequencyCutoff: undefined,
		includeUntagged: true,
		pacing: {
			kanaLevels: 3,
			vocabDensity: [40, 50],
			grammarIntroLevel: 4,
			conjugationIntroLevel: 4,
			sentenceIntroLevel: 5,
		},
	},
};

// ── Grammar group ordering (pedagogical sequence) ───────────────────────────
// Lower index = taught earlier. Groups not listed get index 99.

const GRAMMAR_GROUP_ORDER = [
	"Copula & State of Being",
	"Tae Kim: Expressing State-of-Being",
	"Tae Kim: Introduction to Particles",
	"Basic Particles",
	"Tae Kim: Adjectives",
	"Adjectives",
	"Tae Kim: Verb Basics",
	"Verb Conjugation",
	"Tae Kim: Negative Verbs",
	"Negation Patterns",
	"Tae Kim: Past Tense",
	"Time & Aspect",
	"Tae Kim: Particles used with verbs",
	"Tae Kim: Transative and Intransitive Verbs",
	"Te-form Patterns",
	"Tae Kim: Noun-related Particles",
	"Noun Modification & Clauses",
	"Tae Kim: Using Adverbs and Gobi",
	"Adverbs & Manner",
	"Tae Kim: Descriptive Subordinate Clauses and Sentence Order",
	"Conditional Forms",
	"Desire & Volition",
	"Reason & Cause",
	"Obligation & Prohibition",
	"Conjunctions & Contrast",
	"Comparison & Degree",
	"Focus & Emphasis Particles",
	"Questions & Uncertainty",
	"Demonstratives & Reference",
	"Potential & Ability",
	"Appearance & Hearsay",
	"Quotation & Hearsay",
	"Giving & Receiving",
	"Causative & Passive Forms",
	"Honorific & Polite Speech",
	"Sentence-ending Particles",
	"Trigger & Basis",
	"Result & Consequence",
	"Certainty & Judgment",
	"Effort & Attempt",
	"Compound Verbs",
	"Listing & Enumeration",
	"Scope & Exception",
	"Extent & Coverage Expressions",
	"Formal & Written Style",
	"Set Phrases & Expressions",
	"General Grammar",
];

const grammarGroupIndex = new Map(GRAMMAR_GROUP_ORDER.map((g, i) => [g, i]));

// ── Inferred JLPT for grammar items without explicit tags ───────────────────
// Many grammar items (especially from Tae Kim) lack JLPT tags.
// This map assigns approximate JLPT levels based on their lesson_group.

const GRAMMAR_INFERRED_JLPT = {
	// N5-equivalent
	"Copula & State of Being": "N5",
	"Tae Kim: Expressing State-of-Being": "N5",
	"Tae Kim: Introduction to Particles": "N5",
	"Basic Particles": "N5",
	"Tae Kim: Adjectives": "N5",
	Adjectives: "N5",
	"Tae Kim: Verb Basics": "N5",
	"Verb Conjugation": "N5",
	"Tae Kim: Negative Verbs": "N5",
	"Tae Kim: Past Tense": "N5",
	"Tae Kim: Particles used with verbs": "N5",
	"Tae Kim: Transative and Intransitive Verbs": "N5",
	"Te-form Patterns": "N5",
	"Tae Kim: Noun-related Particles": "N5",
	"Tae Kim: Using Adverbs and Gobi": "N5",
	"Tae Kim: Descriptive Subordinate Clauses and Sentence Order": "N5",
	// N4-equivalent
	"Noun Modification & Clauses": "N4",
	"Adverbs & Manner": "N4",
	"Conditional Forms": "N4",
	"Desire & Volition": "N4",
	"Reason & Cause": "N4",
	"Negation Patterns": "N4",
	"Time & Aspect": "N4",
	"Obligation & Prohibition": "N4",
	"Conjunctions & Contrast": "N4",
	"Questions & Uncertainty": "N4",
	// N3-equivalent
	"Comparison & Degree": "N3",
	"Focus & Emphasis Particles": "N3",
	"Demonstratives & Reference": "N3",
	"Potential & Ability": "N3",
	"Appearance & Hearsay": "N3",
	"Giving & Receiving": "N3",
	"Causative & Passive Forms": "N3",
	"Honorific & Polite Speech": "N3",
	"Sentence-ending Particles": "N3",
	"General Grammar": "N3",
	"Set Phrases & Expressions": "N3",
	// N2-equivalent
	"Trigger & Basis": "N2",
	"Result & Consequence": "N2",
	"Certainty & Judgment": "N2",
	"Effort & Attempt": "N2",
	"Compound Verbs": "N2",
	"Listing & Enumeration": "N2",
	"Scope & Exception": "N2",
	"Extent & Coverage Expressions": "N2",
	"Formal & Written Style": "N2",
	"Quotation & Hearsay": "N2",
};

// ── Kana group ordering ─────────────────────────────────────────────────────
// Replicates the ordering from src/lib/data/kana-groups.ts for the build script.

const SEION_ROWS = {
	vowels: new Set(["a", "i", "u", "e", "o"]),
	k: new Set(["ka", "ki", "ku", "ke", "ko"]),
	s: new Set(["sa", "shi", "su", "se", "so"]),
	t: new Set(["ta", "chi", "tsu", "te", "to"]),
	n: new Set(["na", "ni", "nu", "ne", "no"]),
	h: new Set(["ha", "hi", "fu", "he", "ho"]),
	m: new Set(["ma", "mi", "mu", "me", "mo"]),
	y: new Set(["ya", "yu", "yo"]),
	r: new Set(["ra", "ri", "ru", "re", "ro"]),
	w: new Set(["wa", "wo", "n"]),
};

const ROW_BASE_ORDER = {
	vowels: 0,
	k: 1,
	s: 2,
	t: 3,
	n: 4,
	h: 5,
	m: 6,
	y: 7,
	r: 8,
	w: 9,
};

const DAKUTEN_ROMAJI = new Set([
	"ga",
	"gi",
	"gu",
	"ge",
	"go",
	"za",
	"ji",
	"zu",
	"ze",
	"zo",
	"da",
	"dzi",
	"dzu",
	"de",
	"do",
	"ba",
	"bi",
	"bu",
	"be",
	"bo",
]);

const HANDAKUTEN_ROMAJI = new Set(["pa", "pi", "pu", "pe", "po"]);

const YOON_ROMAJI = new Set([
	"kya",
	"kyu",
	"kyo",
	"sha",
	"shu",
	"sho",
	"cha",
	"chu",
	"cho",
	"nya",
	"nyu",
	"nyo",
	"hya",
	"hyu",
	"hyo",
	"mya",
	"myu",
	"myo",
	"rya",
	"ryu",
	"ryo",
	"gya",
	"gyu",
	"gyo",
	"ja",
	"ju",
	"jo",
	"bya",
	"byu",
	"byo",
	"pya",
	"pyu",
	"pyo",
]);

function isHiraganaChar(code) {
	return code >= 0x3040 && code <= 0x309f;
}

function isKatakanaChar(code) {
	return code >= 0x30a0 && code <= 0x30ff;
}

/**
 * Returns a numeric sort order for a kana item (0-24 range).
 * Hiragana basic = 0-9, Katakana basic = 10-19, Dakuten = 20,
 * Handakuten = 21, Yoon = 22, Extended = 24.
 */
function getKanaOrder(romaji, primaryText) {
	if (!romaji) return 24;

	const code = primaryText.codePointAt(0) ?? 0;
	const isKata = isKatakanaChar(code);

	for (const [rowKey, romajiSet] of Object.entries(SEION_ROWS)) {
		if (romajiSet.has(romaji)) {
			return (isKata ? 10 : 0) + (ROW_BASE_ORDER[rowKey] ?? 0);
		}
	}

	if (DAKUTEN_ROMAJI.has(romaji)) return 20;
	if (HANDAKUTEN_ROMAJI.has(romaji)) return 21;
	if (YOON_ROMAJI.has(romaji)) return 22;
	return 24;
}

// ── Kana-only vocab detection ───────────────────────────────────────────────

const SMALL_KANA_RE = /^[ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]$/;
const PUNCT_RE = /^[\s・ー〜～。、！？!?,.\-()（）「」『』]$/;

function isKanaOnlyWord(text) {
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		if (isHiraganaChar(code)) continue;
		if (isKatakanaChar(code)) continue;
		if (SMALL_KANA_RE.test(char)) continue;
		if (PUNCT_RE.test(char)) continue;
		return false;
	}
	return text.length > 0;
}

function canReadWord(text, kanaSet) {
	for (const char of text) {
		if (kanaSet.has(char)) continue;
		if (SMALL_KANA_RE.test(char)) continue;
		if (PUNCT_RE.test(char)) continue;
		return false;
	}
	return true;
}

/** Extract the first line from potentially multi-line primary_text */
function getFirstLine(text) {
	const nl = text.indexOf("\n");
	return nl === -1 ? text : text.slice(0, nl).trim();
}

// ── JLPT sort ordering ─────────────────────────────────────────────────────

const JLPT_SORT = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

function jlptSortKey(jlpt) {
	return JLPT_SORT[jlpt] ?? 5;
}

// ── Distribution helper ─────────────────────────────────────────────────────

/**
 * Evenly distributes sorted items across a level range.
 * Returns a Map of item_key -> level.
 */
function distribute(items, startLevel, endLevel) {
	const result = new Map();
	if (items.length === 0) return result;

	const levelCount = endLevel - startLevel + 1;
	const perLevel = Math.ceil(items.length / levelCount);

	for (let i = 0; i < items.length; i++) {
		const level = startLevel + Math.min(Math.floor(i / perLevel), levelCount - 1);
		result.set(items[i].item_key, level);
	}
	return result;
}

// ── Main build algorithm ────────────────────────────────────────────────────

function buildPath(pathDef, allData) {
	const assignments = new Map();
	const { pacing, maxCoreLevels } = pathDef;
	const scope = new Set(pathDef.jlptScope);

	// ── 1. Filter eligible items ──

	const vocab = allData.vocab.filter((v) => {
		const jlpt = v.jlpt_level;
		if (jlpt && scope.has(jlpt)) {
			if (pathDef.frequencyCutoff && v.frequency_rank > pathDef.frequencyCutoff) return false;
			return true;
		}
		if (!jlpt && pathDef.includeUntagged) return true;
		return false;
	});

	const grammar = allData.grammar.filter((g) => {
		const jlpt = g.jlpt_level || GRAMMAR_INFERRED_JLPT[g.lesson_group];
		if (jlpt && scope.has(jlpt)) return true;
		if (!jlpt && pathDef.includeUntagged) return true;
		return false;
	});

	// Conjugation: all N5, included if N5 is in scope (always true)
	const conjugation = allData.conjugation.filter((c) => {
		const jlpt = c.jlpt_level;
		if (jlpt && scope.has(jlpt)) return true;
		if (!jlpt && pathDef.includeUntagged) return true;
		return false;
	});

	const sentences = allData.sentences.filter((s) => {
		const jlpt = s.jlpt_level;
		if (jlpt && scope.has(jlpt)) return true;
		if (!jlpt && pathDef.includeUntagged) return true;
		return false;
	});

	// Kana: always all
	const kana = [...allData.kana];

	// ── 2. Assign kana to levels 1..kanaLevels ──
	// Group-aware distribution: keeps kana groups (hiragana rows, katakana rows,
	// dakuten, yoon, etc.) intact rather than splitting them at arbitrary boundaries.
	// Large groups (like extended kana, ~157 items) are split across multiple levels.

	kana.sort(
		(a, b) => getKanaOrder(a.romaji, a.primary_text) - getKanaOrder(b.romaji, b.primary_text),
	);

	// Build ordered groups (each group = items with same kana order value)
	const kanaGroups = [];
	let prevKanaOrder = -1;
	for (const item of kana) {
		const order = getKanaOrder(item.romaji, item.primary_text);
		if (order !== prevKanaOrder) {
			kanaGroups.push([]);
			prevKanaOrder = order;
		}
		kanaGroups[kanaGroups.length - 1].push(item);
	}

	const kanaByLevel = new Map();
	let kanaLevel = 1;
	let kanaLevelItems = [];
	let totalKanaAssigned = 0;

	for (let g = 0; g < kanaGroups.length; g++) {
		const group = kanaGroups[g];
		const remaining = kana.length - totalKanaAssigned;
		const remainingLevels = pacing.kanaLevels - kanaLevel + 1;
		const target = remaining / remainingLevels;

		// Should we finalize current level before adding this group?
		if (kanaLevelItems.length > 0 && kanaLevel < pacing.kanaLevels) {
			const withGroup = kanaLevelItems.length + group.length;
			if (withGroup > target * 1.3) {
				const devWith = Math.abs(withGroup - target);
				const devWithout = Math.abs(kanaLevelItems.length - target);
				if (devWithout < devWith) {
					// Finalize current level
					for (const item of kanaLevelItems) {
						assignments.set(item.item_key, kanaLevel);
						if (!kanaByLevel.has(kanaLevel)) kanaByLevel.set(kanaLevel, []);
						kanaByLevel.get(kanaLevel).push(item);
					}
					totalKanaAssigned += kanaLevelItems.length;
					kanaLevel++;
					kanaLevelItems = [];
				}
			}
		}

		// Check if this group is large enough to need splitting
		const newRemaining = kana.length - totalKanaAssigned;
		const newRemainingLevels = pacing.kanaLevels - kanaLevel + 1;
		const newTarget = newRemaining / newRemainingLevels;

		if (group.length > newTarget * 1.5 && newRemainingLevels > 1) {
			// Finalize current partial level first
			if (kanaLevelItems.length > 0) {
				for (const item of kanaLevelItems) {
					assignments.set(item.item_key, kanaLevel);
					if (!kanaByLevel.has(kanaLevel)) kanaByLevel.set(kanaLevel, []);
					kanaByLevel.get(kanaLevel).push(item);
				}
				totalKanaAssigned += kanaLevelItems.length;
				kanaLevel++;
				kanaLevelItems = [];
			}

			// Reserve levels for remaining groups after this one
			const itemsAfter = kanaGroups.slice(g + 1).reduce((s, gr) => s + gr.length, 0);
			const levelsForAfter = itemsAfter > 0 ? Math.max(1, Math.ceil(itemsAfter / newTarget)) : 0;
			const levelsForGroup = Math.max(1, pacing.kanaLevels - kanaLevel + 1 - levelsForAfter);
			const splitSize = Math.ceil(group.length / levelsForGroup);

			for (const item of group) {
				kanaLevelItems.push(item);
				if (kanaLevelItems.length >= splitSize && kanaLevel < pacing.kanaLevels) {
					for (const li of kanaLevelItems) {
						assignments.set(li.item_key, kanaLevel);
						if (!kanaByLevel.has(kanaLevel)) kanaByLevel.set(kanaLevel, []);
						kanaByLevel.get(kanaLevel).push(li);
					}
					totalKanaAssigned += kanaLevelItems.length;
					kanaLevel++;
					kanaLevelItems = [];
				}
			}
		} else {
			kanaLevelItems.push(...group);

			// Advance if at or above target
			const curTarget = (kana.length - totalKanaAssigned) / (pacing.kanaLevels - kanaLevel + 1);
			if (
				kanaLevelItems.length >= curTarget &&
				kanaLevel < pacing.kanaLevels &&
				g < kanaGroups.length - 1
			) {
				for (const item of kanaLevelItems) {
					assignments.set(item.item_key, kanaLevel);
					if (!kanaByLevel.has(kanaLevel)) kanaByLevel.set(kanaLevel, []);
					kanaByLevel.get(kanaLevel).push(item);
				}
				totalKanaAssigned += kanaLevelItems.length;
				kanaLevel++;
				kanaLevelItems = [];
			}
		}
	}

	// Assign any remaining items to the last kana level
	for (const item of kanaLevelItems) {
		assignments.set(item.item_key, kanaLevel);
		if (!kanaByLevel.has(kanaLevel)) kanaByLevel.set(kanaLevel, []);
		kanaByLevel.get(kanaLevel).push(item);
	}

	// ── 3. Build cumulative kana character sets ──

	const cumulativeKana = new Map();
	const allKnown = new Set();

	for (let l = 1; l <= pacing.kanaLevels; l++) {
		const items = kanaByLevel.get(l) || [];
		for (const item of items) {
			// Add each individual character from the kana item
			for (const char of item.primary_text) {
				allKnown.add(char);
			}
		}
		cumulativeKana.set(l, new Set(allKnown));
	}

	// ── 4. Assign kana-only vocab to kana levels ──

	// Sort vocab by frequency for deterministic ordering
	vocab.sort((a, b) => (a.frequency_rank || 99999) - (b.frequency_rank || 99999));

	const kanaOnlyItems = [];
	const regularVocab = [];
	const kanaVocabCap = pacing.vocabDensity[0]; // cap per kana level

	for (const v of vocab) {
		const text = getFirstLine(v.primary_text);
		if (text.length > 0 && isKanaOnlyWord(text)) {
			kanaOnlyItems.push(v);
		} else {
			regularVocab.push(v);
		}
	}

	const perLevelCount = new Map();

	for (const item of kanaOnlyItems) {
		const text = getFirstLine(item.primary_text);
		let assigned = false;

		for (let l = 1; l <= pacing.kanaLevels; l++) {
			const kanaSet = cumulativeKana.get(l);
			if (kanaSet && canReadWord(text, kanaSet)) {
				const count = perLevelCount.get(l) || 0;
				if (count < kanaVocabCap) {
					assignments.set(item.item_key, l);
					perLevelCount.set(l, count + 1);
					assigned = true;
				}
				break;
			}
		}

		if (!assigned) {
			regularVocab.push(item);
		}
	}

	// ── 5. Assign remaining vocab ──

	regularVocab.sort((a, b) => {
		const ja = jlptSortKey(a.jlpt_level);
		const jb = jlptSortKey(b.jlpt_level);
		if (ja !== jb) return ja - jb;
		return (a.frequency_rank || 99999) - (b.frequency_rank || 99999);
	});

	const vocabStartLevel = pacing.kanaLevels + 1;
	for (const [key, level] of distribute(regularVocab, vocabStartLevel, maxCoreLevels)) {
		assignments.set(key, level);
	}

	// ── 6. Assign grammar ──

	grammar.sort((a, b) => {
		const ga = grammarGroupIndex.get(a.lesson_group) ?? 99;
		const gb = grammarGroupIndex.get(b.lesson_group) ?? 99;
		if (ga !== gb) return ga - gb;
		return (a.frequency_rank || 99999) - (b.frequency_rank || 99999);
	});

	for (const [key, level] of distribute(grammar, pacing.grammarIntroLevel, maxCoreLevels)) {
		assignments.set(key, level);
	}

	// ── 7. Assign conjugation ──

	conjugation.sort((a, b) => a.primary_text.localeCompare(b.primary_text, "ja"));

	for (const [key, level] of distribute(conjugation, pacing.conjugationIntroLevel, maxCoreLevels)) {
		assignments.set(key, level);
	}

	// ── 8. Assign sentences ──

	sentences.sort((a, b) => {
		const ja = jlptSortKey(a.jlpt_level);
		const jb = jlptSortKey(b.jlpt_level);
		if (ja !== jb) return ja - jb;
		// Stable sort by original index (frequency_rank for sentences is unreliable)
		return (a._index || 0) - (b._index || 0);
	});

	for (const [key, level] of distribute(sentences, pacing.sentenceIntroLevel, maxCoreLevels)) {
		assignments.set(key, level);
	}

	return assignments;
}

// ── Stats helper ────────────────────────────────────────────────────────────

function computeStats(assignments, allData, maxCoreLevels) {
	const contentTypes = {};
	const levelStats = [];

	// Build item_key -> content_type lookup
	const keyToType = new Map();
	for (const item of allData.kana) keyToType.set(item.item_key, "kana");
	for (const item of allData.vocab) keyToType.set(item.item_key, "vocabulary");
	for (const item of allData.grammar) keyToType.set(item.item_key, "grammar");
	for (const item of allData.conjugation) keyToType.set(item.item_key, "conjugation");
	for (const item of allData.sentences) keyToType.set(item.item_key, "sentence");

	// Count by content type
	for (const [itemKey] of assignments) {
		const type = keyToType.get(itemKey) || "unknown";
		contentTypes[type] = (contentTypes[type] || 0) + 1;
	}

	// Count per level
	const byLevel = new Map();
	for (const [itemKey, level] of assignments) {
		if (!byLevel.has(level)) byLevel.set(level, {});
		const stats = byLevel.get(level);
		const type = keyToType.get(itemKey) || "unknown";
		stats[type] = (stats[type] || 0) + 1;
	}

	for (let l = 1; l <= maxCoreLevels; l++) {
		const stats = byLevel.get(l) || {};
		levelStats.push({
			level: l,
			kana: stats.kana || 0,
			vocabulary: stats.vocabulary || 0,
			grammar: stats.grammar || 0,
			conjugation: stats.conjugation || 0,
			sentence: stats.sentence || 0,
			total:
				(stats.kana || 0) +
				(stats.vocabulary || 0) +
				(stats.grammar || 0) +
				(stats.conjugation || 0) +
				(stats.sentence || 0),
		});
	}

	return { contentTypes, levelStats };
}

// ── Entry point ─────────────────────────────────────────────────────────────

const DATA_DIR = "public/data/language";
const OUTPUT_DIR = join(DATA_DIR, "paths");

if (!existsSync(OUTPUT_DIR)) {
	mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log("Loading data files...");

const allData = {
	kana: JSON.parse(readFileSync(join(DATA_DIR, "kana.json"), "utf8")),
	vocab: JSON.parse(readFileSync(join(DATA_DIR, "vocabulary.json"), "utf8")),
	grammar: JSON.parse(readFileSync(join(DATA_DIR, "grammar.json"), "utf8")),
	conjugation: JSON.parse(readFileSync(join(DATA_DIR, "conjugation.json"), "utf8")),
	sentences: JSON.parse(readFileSync(join(DATA_DIR, "sentence.json"), "utf8")).map((s, i) => ({
		...s,
		_index: i,
	})),
};

console.log(
	`Loaded: ${allData.kana.length} kana, ${allData.vocab.length} vocab, ` +
		`${allData.grammar.length} grammar, ${allData.conjugation.length} conjugation, ` +
		`${allData.sentences.length} sentences`,
);

for (const [pathId, pathDef] of Object.entries(PATHS)) {
	console.log(`\nBuilding path: ${pathDef.label} (${pathId})...`);

	const assignments = buildPath(pathDef, allData);
	const { contentTypes, levelStats } = computeStats(assignments, allData, pathDef.maxCoreLevels);

	// Convert Map to plain object for JSON
	const assignmentsObj = {};
	for (const [key, level] of assignments) {
		assignmentsObj[key] = level;
	}

	const output = {
		pathId,
		totalLevels: pathDef.maxCoreLevels,
		totalItems: assignments.size,
		itemCounts: contentTypes,
		levelStats,
		assignments: assignmentsObj,
	};

	const outPath = join(OUTPUT_DIR, `${pathId}.json`);
	writeFileSync(outPath, JSON.stringify(output));
	console.log(`  -> ${outPath} (${assignments.size} items across ${pathDef.maxCoreLevels} levels)`);

	// Print summary
	console.log("  Content types:", contentTypes);

	// Print level range with most and least items
	const totals = levelStats.map((s) => s.total);
	const minTotal = Math.min(...totals.filter((t) => t > 0));
	const maxTotal = Math.max(...totals);
	const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
	console.log(`  Items per level: min=${minTotal}, max=${maxTotal}, avg=${avgTotal}`);
}

console.log("\nDone.");
