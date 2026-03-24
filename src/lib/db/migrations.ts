export interface Migration {
	version: number;
	description: string;
	up: string | string[];
	down: string;
}

export const migrations: Migration[] = [
	{
		version: 1,
		description: "Initial schema",
		up: [
			`CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS decks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				description TEXT,
				source TEXT,
				source_file TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			`CREATE TABLE IF NOT EXISTS note_types (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				fields TEXT NOT NULL,
				card_templates TEXT NOT NULL,
				css TEXT
			)`,
			`CREATE TABLE IF NOT EXISTS notes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_type_id INTEGER NOT NULL REFERENCES note_types(id),
				deck_id INTEGER NOT NULL REFERENCES decks(id),
				fields TEXT NOT NULL,
				tags TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			`CREATE TABLE IF NOT EXISTS cards (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_id INTEGER NOT NULL REFERENCES notes(id),
				deck_id INTEGER NOT NULL REFERENCES decks(id),
				template_index INTEGER NOT NULL DEFAULT 0,
				stability REAL NOT NULL DEFAULT 0,
				difficulty REAL NOT NULL DEFAULT 0,
				due TEXT NOT NULL DEFAULT (datetime('now')),
				last_review TEXT,
				reps INTEGER NOT NULL DEFAULT 0,
				lapses INTEGER NOT NULL DEFAULT 0,
				state INTEGER NOT NULL DEFAULT 0,
				scheduled_days INTEGER NOT NULL DEFAULT 0,
				elapsed_days INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			`CREATE TABLE IF NOT EXISTS review_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				card_id INTEGER NOT NULL REFERENCES cards(id),
				rating INTEGER NOT NULL,
				state INTEGER NOT NULL,
				scheduled_days INTEGER NOT NULL,
				elapsed_days INTEGER NOT NULL,
				stability REAL NOT NULL,
				difficulty REAL NOT NULL,
				duration_ms INTEGER,
				reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			`CREATE TABLE IF NOT EXISTS kanji_levels (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				level INTEGER NOT NULL,
				item_type TEXT NOT NULL,
				character TEXT NOT NULL,
				meanings TEXT NOT NULL,
				readings_on TEXT,
				readings_kun TEXT,
				reading TEXT,
				radicals TEXT,
				mnemonic_meaning TEXT,
				mnemonic_reading TEXT,
				srs_stage INTEGER NOT NULL DEFAULT 0,
				unlocked_at TEXT,
				next_review TEXT,
				correct_count INTEGER NOT NULL DEFAULT 0,
				incorrect_count INTEGER NOT NULL DEFAULT 0
			)`,
			`CREATE TABLE IF NOT EXISTS kanji_dependencies (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				kanji_level_id INTEGER NOT NULL REFERENCES kanji_levels(id),
				depends_on_id INTEGER NOT NULL REFERENCES kanji_levels(id),
				UNIQUE(kanji_level_id, depends_on_id)
			)`,
			`CREATE TABLE IF NOT EXISTS media (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				deck_id INTEGER REFERENCES decks(id),
				filename TEXT NOT NULL,
				mime_type TEXT,
				data BLOB,
				file_path TEXT,
				size_bytes INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			`CREATE TABLE IF NOT EXISTS daily_stats (
				date TEXT PRIMARY KEY,
				reviews_count INTEGER NOT NULL DEFAULT 0,
				new_cards_count INTEGER NOT NULL DEFAULT 0,
				correct_count INTEGER NOT NULL DEFAULT 0,
				incorrect_count INTEGER NOT NULL DEFAULT 0,
				time_spent_ms INTEGER NOT NULL DEFAULT 0,
				kanji_learned INTEGER NOT NULL DEFAULT 0
			)`,
			"CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due)",
			"CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id)",
			"CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state)",
			"CREATE INDEX IF NOT EXISTS idx_notes_deck ON notes(deck_id)",
			"CREATE INDEX IF NOT EXISTS idx_review_log_card ON review_log(card_id)",
			"CREATE INDEX IF NOT EXISTS idx_review_log_date ON review_log(reviewed_at)",
			"CREATE INDEX IF NOT EXISTS idx_kanji_levels_level ON kanji_levels(level)",
			"CREATE INDEX IF NOT EXISTS idx_kanji_levels_type ON kanji_levels(item_type)",
			"CREATE INDEX IF NOT EXISTS idx_kanji_levels_srs ON kanji_levels(srs_stage)",
			"CREATE INDEX IF NOT EXISTS idx_kanji_levels_review ON kanji_levels(next_review)",
			"INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '1')",
		],
		down: `
			DROP TABLE IF EXISTS daily_stats;
			DROP TABLE IF EXISTS media;
			DROP TABLE IF EXISTS review_log;
			DROP TABLE IF EXISTS cards;
			DROP TABLE IF EXISTS notes;
			DROP TABLE IF EXISTS kanji_dependencies;
			DROP TABLE IF EXISTS kanji_levels;
			DROP TABLE IF EXISTS note_types;
			DROP TABLE IF EXISTS decks;
			DROP TABLE IF EXISTS settings;
		`,
	},
	{
		version: 2,
		description: "Add FTS5 search tables for cards and kanji",
		up: [
			`CREATE VIRTUAL TABLE IF NOT EXISTS kanji_fts USING fts5(
				character,
				meanings,
				readings,
				content=kanji_levels,
				content_rowid=id
			)`,
			`INSERT INTO kanji_fts(rowid, character, meanings, readings)
			SELECT id, character, meanings, COALESCE(readings_on, '') || ' ' || COALESCE(readings_kun, '') || ' ' || COALESCE(reading, '')
			FROM kanji_levels`,
		],
		down: `
			DROP TABLE IF EXISTS kanji_fts;
		`,
	},
	{
		version: 3,
		description: "Add kanji review log and lesson tracking columns",
		up: [
			`CREATE TABLE IF NOT EXISTS kanji_review_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				kanji_level_id INTEGER NOT NULL REFERENCES kanji_levels(id),
				correct INTEGER NOT NULL,
				srs_stage_before INTEGER NOT NULL,
				srs_stage_after INTEGER NOT NULL,
				duration_ms INTEGER,
				reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			"CREATE INDEX IF NOT EXISTS idx_kanji_review_log_item ON kanji_review_log(kanji_level_id)",
			"CREATE INDEX IF NOT EXISTS idx_kanji_review_log_date ON kanji_review_log(reviewed_at)",
			"ALTER TABLE kanji_levels ADD COLUMN lesson_completed_at TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN user_notes TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN user_synonyms TEXT",
			"UPDATE kanji_levels SET lesson_completed_at = unlocked_at WHERE srs_stage > 0 AND unlocked_at IS NOT NULL",
		],
		down: `
			DROP TABLE IF EXISTS kanji_review_log;
		`,
	},
	{
		version: 4,
		description: "Add image_url for radicals and incorrect counts to review log",
		up: [
			"ALTER TABLE kanji_levels ADD COLUMN image_url TEXT",
			"ALTER TABLE kanji_review_log ADD COLUMN meaning_incorrect INTEGER NOT NULL DEFAULT 0",
			"ALTER TABLE kanji_review_log ADD COLUMN reading_incorrect INTEGER NOT NULL DEFAULT 0",
		],
		down: `
			SELECT 1;
		`,
	},
	{
		version: 5,
		description: "Add WK subject ID and component dependencies for per-item vocab unlock",
		up: [
			"ALTER TABLE kanji_levels ADD COLUMN wk_id INTEGER",
			"ALTER TABLE kanji_levels ADD COLUMN component_ids TEXT",
			"CREATE INDEX IF NOT EXISTS idx_kanji_levels_wk_id ON kanji_levels(wk_id)",
		],
		down: `
			SELECT 1;
		`,
	},
	{
		version: 6,
		description:
			"Add enriched WK fields: parts of speech, context sentences, audio, similar kanji, radical images",
		up: [
			"ALTER TABLE kanji_levels ADD COLUMN parts_of_speech TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN context_sentences TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN pronunciation_audios TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN visually_similar_ids TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN character_images TEXT",
		],
		down: `
			SELECT 1;
		`,
	},
	{
		version: 7,
		description: "Add meaning_hint and reading_hint columns for kanji",
		up: [
			"ALTER TABLE kanji_levels ADD COLUMN meaning_hint TEXT",
			"ALTER TABLE kanji_levels ADD COLUMN reading_hint TEXT",
		],
		down: `
			SELECT 1;
		`,
	},
	{
		version: 8,
		description: "Add streak tracking columns for meaning and reading",
		up: [
			"ALTER TABLE kanji_levels ADD COLUMN meaning_current_streak INTEGER NOT NULL DEFAULT 0",
			"ALTER TABLE kanji_levels ADD COLUMN meaning_max_streak INTEGER NOT NULL DEFAULT 0",
			"ALTER TABLE kanji_levels ADD COLUMN reading_current_streak INTEGER NOT NULL DEFAULT 0",
			"ALTER TABLE kanji_levels ADD COLUMN reading_max_streak INTEGER NOT NULL DEFAULT 0",
		],
		down: `
			SELECT 1;
		`,
	},
	{
		version: 9,
		description:
			"Add content classification tables and builtin SRS items for unified Language section",
		up: [
			`CREATE TABLE IF NOT EXISTS content_tags (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
				content_type TEXT NOT NULL,
				confidence REAL NOT NULL DEFAULT 1.0,
				source TEXT NOT NULL DEFAULT 'auto',
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				UNIQUE(note_id, content_type)
			)`,
			"CREATE INDEX idx_content_tags_type ON content_tags(content_type)",
			"CREATE INDEX idx_content_tags_note ON content_tags(note_id)",
			`CREATE TABLE IF NOT EXISTS content_type_fields (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_type_id INTEGER NOT NULL REFERENCES note_types(id) ON DELETE CASCADE,
				content_type TEXT NOT NULL,
				field_name TEXT NOT NULL,
				semantic_role TEXT NOT NULL,
				UNIQUE(note_type_id, content_type, field_name)
			)`,
			"CREATE INDEX idx_ctf_notetype ON content_type_fields(note_type_id)",
			`CREATE TABLE IF NOT EXISTS builtin_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				content_type TEXT NOT NULL,
				item_key TEXT NOT NULL UNIQUE,
				data TEXT NOT NULL,
				jlpt_level TEXT,
				stability REAL NOT NULL DEFAULT 0,
				difficulty REAL NOT NULL DEFAULT 0,
				due TEXT NOT NULL DEFAULT (datetime('now')),
				last_review TEXT,
				reps INTEGER NOT NULL DEFAULT 0,
				lapses INTEGER NOT NULL DEFAULT 0,
				state INTEGER NOT NULL DEFAULT 0,
				scheduled_days INTEGER NOT NULL DEFAULT 0,
				elapsed_days INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			"CREATE INDEX idx_builtin_type ON builtin_items(content_type)",
			"CREATE INDEX idx_builtin_due ON builtin_items(due)",
			"CREATE INDEX idx_builtin_state ON builtin_items(state)",
			`CREATE TABLE IF NOT EXISTS builtin_review_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				builtin_item_id INTEGER NOT NULL REFERENCES builtin_items(id) ON DELETE CASCADE,
				rating INTEGER NOT NULL,
				state INTEGER NOT NULL,
				scheduled_days INTEGER NOT NULL,
				elapsed_days INTEGER NOT NULL,
				stability REAL NOT NULL,
				difficulty REAL NOT NULL,
				duration_ms INTEGER,
				reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			"CREATE INDEX idx_builtin_review_item ON builtin_review_log(builtin_item_id)",
		],
		down: `
			DROP TABLE IF EXISTS builtin_review_log;
			DROP TABLE IF EXISTS builtin_items;
			DROP TABLE IF EXISTS content_type_fields;
			DROP TABLE IF EXISTS content_tags;
		`,
	},
	{
		version: 10,
		description:
			"Replace legacy deck/card/note tables and v9 builtin tables with unified language_items schema",
		up: [
			`CREATE TABLE IF NOT EXISTS language_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				content_type TEXT NOT NULL,
				item_key TEXT NOT NULL UNIQUE,
				primary_text TEXT NOT NULL,
				reading TEXT,
				meaning TEXT,
				part_of_speech TEXT,
				pitch_accent TEXT,
				frequency_rank INTEGER,
				audio_file TEXT,
				formation TEXT,
				explanation TEXT,
				sentence_ja TEXT,
				sentence_en TEXT,
				sentence_reading TEXT,
				sentence_audio TEXT,
				romaji TEXT,
				stroke_order TEXT,
				conjugation_forms TEXT,
				verb_group TEXT,
				example_sentences TEXT,
				related_items TEXT,
				images TEXT,
				context_notes TEXT,
				source_decks TEXT,
				jlpt_level TEXT,
				wk_level INTEGER,
				tags TEXT,
				srs_stage INTEGER NOT NULL DEFAULT 0,
				unlocked_at TEXT,
				next_review TEXT,
				correct_count INTEGER NOT NULL DEFAULT 0,
				incorrect_count INTEGER NOT NULL DEFAULT 0,
				lesson_completed_at TEXT,
				prerequisite_keys TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			`CREATE TABLE IF NOT EXISTS language_review_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				item_id INTEGER NOT NULL REFERENCES language_items(id) ON DELETE CASCADE,
				srs_stage_before INTEGER NOT NULL,
				srs_stage_after INTEGER NOT NULL,
				correct INTEGER NOT NULL,
				duration_ms INTEGER,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			)`,
			"CREATE INDEX idx_language_items_content_type ON language_items(content_type)",
			"CREATE INDEX idx_language_items_item_key ON language_items(item_key)",
			"CREATE INDEX idx_language_items_srs_stage ON language_items(srs_stage)",
			"CREATE INDEX idx_language_items_jlpt ON language_items(jlpt_level)",
			"CREATE INDEX idx_language_items_next_review ON language_items(next_review)",
			"CREATE INDEX idx_language_items_type_srs ON language_items(content_type, srs_stage)",
			"CREATE INDEX idx_language_review_log_item ON language_review_log(item_id)",
			"CREATE INDEX idx_language_review_log_date ON language_review_log(created_at)",
			// Legacy tables replaced by language_items schema above.
			// These tables only held Anki-imported data, not user-generated content.
			// Safe to drop as migration 10 creates the replacement schema.
			"DROP TABLE IF EXISTS builtin_review_log",
			"DROP TABLE IF EXISTS builtin_items",
			"DROP TABLE IF EXISTS content_type_fields",
			"DROP TABLE IF EXISTS content_tags",
			"DROP TABLE IF EXISTS review_log",
			"DROP TABLE IF EXISTS cards",
			"DROP TABLE IF EXISTS notes",
			"DROP TABLE IF EXISTS note_types",
			"DROP TABLE IF EXISTS decks",
			"DROP TABLE IF EXISTS media",
		],
		down: `
			DROP TABLE IF EXISTS language_review_log;
			DROP TABLE IF EXISTS language_items;
		`,
	},
	{
		version: 11,
		description: "Add FTS5 full-text search for language_items",
		up: [
			`CREATE VIRTUAL TABLE IF NOT EXISTS language_fts USING fts5(
				primary_text,
				reading,
				meaning,
				explanation,
				content=language_items,
				content_rowid=id
			)`,
			`INSERT INTO language_fts(rowid, primary_text, reading, meaning, explanation)
			SELECT id, primary_text, COALESCE(reading, ''), COALESCE(meaning, ''), COALESCE(explanation, '')
			FROM language_items`,
		],
		down: `
			DROP TABLE IF EXISTS language_fts;
		`,
	},
	{
		version: 12,
		description: "Add lesson_group and lesson_order columns for structured kana progression",
		up: [
			"ALTER TABLE language_items ADD COLUMN lesson_group TEXT",
			"ALTER TABLE language_items ADD COLUMN lesson_order INTEGER",
			"CREATE INDEX idx_language_items_lesson_group ON language_items(lesson_group)",
			"CREATE INDEX idx_language_items_lesson_order ON language_items(lesson_order)",
			// Backfill hiragana seion rows (unicode 12352-12447 = 0x3040-0x309F)
			"UPDATE language_items SET lesson_group = 'hiragana-vowels', lesson_order = 1 WHERE content_type = 'kana' AND romaji IN ('a','i','u','e','o') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-k', lesson_order = 2 WHERE content_type = 'kana' AND romaji IN ('ka','ki','ku','ke','ko') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-s', lesson_order = 3 WHERE content_type = 'kana' AND romaji IN ('sa','shi','su','se','so') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-t', lesson_order = 4 WHERE content_type = 'kana' AND romaji IN ('ta','chi','tsu','te','to') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-n', lesson_order = 5 WHERE content_type = 'kana' AND romaji IN ('na','ni','nu','ne','no') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-h', lesson_order = 6 WHERE content_type = 'kana' AND romaji IN ('ha','hi','fu','he','ho') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-m', lesson_order = 7 WHERE content_type = 'kana' AND romaji IN ('ma','mi','mu','me','mo') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-y', lesson_order = 8 WHERE content_type = 'kana' AND romaji IN ('ya','yu','yo') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-r', lesson_order = 9 WHERE content_type = 'kana' AND romaji IN ('ra','ri','ru','re','ro') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			"UPDATE language_items SET lesson_group = 'hiragana-w', lesson_order = 10 WHERE content_type = 'kana' AND romaji IN ('wa','wo','n') AND unicode(primary_text) BETWEEN 12352 AND 12447",
			// Backfill katakana seion rows (unicode 12448-12543 = 0x30A0-0x30FF)
			"UPDATE language_items SET lesson_group = 'katakana-vowels', lesson_order = 11 WHERE content_type = 'kana' AND romaji IN ('a','i','u','e','o') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-k', lesson_order = 12 WHERE content_type = 'kana' AND romaji IN ('ka','ki','ku','ke','ko') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-s', lesson_order = 13 WHERE content_type = 'kana' AND romaji IN ('sa','shi','su','se','so') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-t', lesson_order = 14 WHERE content_type = 'kana' AND romaji IN ('ta','chi','tsu','te','to') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-n', lesson_order = 15 WHERE content_type = 'kana' AND romaji IN ('na','ni','nu','ne','no') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-h', lesson_order = 16 WHERE content_type = 'kana' AND romaji IN ('ha','hi','fu','he','ho') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-m', lesson_order = 17 WHERE content_type = 'kana' AND romaji IN ('ma','mi','mu','me','mo') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-y', lesson_order = 18 WHERE content_type = 'kana' AND romaji IN ('ya','yu','yo') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-r', lesson_order = 19 WHERE content_type = 'kana' AND romaji IN ('ra','ri','ru','re','ro') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			"UPDATE language_items SET lesson_group = 'katakana-w', lesson_order = 20 WHERE content_type = 'kana' AND romaji IN ('wa','wo','n') AND unicode(primary_text) BETWEEN 12448 AND 12543",
			// Backfill dakuten (both scripts)
			"UPDATE language_items SET lesson_group = 'dakuten', lesson_order = 21 WHERE content_type = 'kana' AND romaji IN ('ga','gi','gu','ge','go','za','ji','zu','ze','zo','da','dzi','dzu','de','do','ba','bi','bu','be','bo') AND lesson_group IS NULL",
			// Backfill handakuten (both scripts)
			"UPDATE language_items SET lesson_group = 'handakuten', lesson_order = 22 WHERE content_type = 'kana' AND romaji IN ('pa','pi','pu','pe','po') AND lesson_group IS NULL",
			// Backfill yoon (both scripts)
			"UPDATE language_items SET lesson_group = 'yoon', lesson_order = 23 WHERE content_type = 'kana' AND romaji IN ('kya','kyu','kyo','sha','shu','sho','cha','chu','cho','nya','nyu','nyo','hya','hyu','hyo','mya','myu','myo','rya','ryu','ryo','gya','gyu','gyo','ja','ju','jo','bya','byu','byo','pya','pyu','pyo') AND lesson_group IS NULL",
			// Backfill extended (everything remaining)
			"UPDATE language_items SET lesson_group = 'extended', lesson_order = 24 WHERE content_type = 'kana' AND lesson_group IS NULL",
		],
		down: `
			DROP INDEX IF EXISTS idx_language_items_lesson_order;
			DROP INDEX IF EXISTS idx_language_items_lesson_group;
			UPDATE language_items SET lesson_group = NULL, lesson_order = NULL;
		`,
	},
	{
		version: 13,
		description: "Fix corrupted sentence frequency_rank values and add composite unlock index",
		up: [
			// Fix corrupted frequency_rank values (timestamps mistakenly stored as rank)
			"UPDATE language_items SET frequency_rank = NULL WHERE content_type = 'sentence' AND frequency_rank > 100000",
			// Composite index for batch unlock queries (content_type + srs_stage + jlpt_level + frequency_rank)
			"CREATE INDEX IF NOT EXISTS idx_language_items_unlock_batch ON language_items(content_type, srs_stage, jlpt_level, frequency_rank)",
		],
		down: `
			DROP INDEX IF EXISTS idx_language_items_unlock_batch;
		`,
	},
	{
		version: 14,
		description: "Reset language items to locked state for clean progressive unlock",
		up: [
			// Reset all language items to locked (pre-cap mass unlock left them all at srs_stage=1)
			"UPDATE language_items SET srs_stage = 0, unlocked_at = NULL, next_review = NULL, lesson_completed_at = NULL, correct_count = 0, incorrect_count = 0",
			// Clear language review log since no valid reviews exist
			"DELETE FROM language_review_log",
		],
		down: `SELECT 1`,
	},
	{
		version: 15,
		description: "Pedagogical ordering: grammar groups, conjugation order, sentence JLPT tags",
		up: [
			// --- Grammar: assign lesson_group and lesson_order based on Tae Kim sections ---
			// context_notes pattern: "NNN Section - Topic: Subtopic"
			// Extract leading 3-digit number and map to dependency-chain groups

			// Group 1: Copula / State-of-being (lessons 001-008)
			`UPDATE language_items SET lesson_group = 'grammar-copula', lesson_order = 1
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 1 AND 8`,

			// Group 2: Basic particles (lessons 009-017)
			`UPDATE language_items SET lesson_group = 'grammar-particles', lesson_order = 2
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 9 AND 17`,

			// Group 3: Adjectives (lessons 018-038)
			`UPDATE language_items SET lesson_group = 'grammar-adjectives', lesson_order = 3
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 18 AND 38`,

			// Group 4: Verb basics (lessons 039-045)
			`UPDATE language_items SET lesson_group = 'grammar-verb-basics', lesson_order = 4
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 39 AND 45`,

			// Group 5: Negative verbs (lessons 046-051)
			`UPDATE language_items SET lesson_group = 'grammar-negative-verbs', lesson_order = 5
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 46 AND 51`,

			// Group 6: Past tense (lessons 052-063)
			`UPDATE language_items SET lesson_group = 'grammar-past-tense', lesson_order = 6
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 52 AND 63`,

			// Group 7: Particles used with verbs (lessons 064-094)
			`UPDATE language_items SET lesson_group = 'grammar-verb-particles', lesson_order = 7
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 64 AND 94`,

			// Group 8: Transitive/Intransitive verbs (lessons 095-101)
			`UPDATE language_items SET lesson_group = 'grammar-transitivity', lesson_order = 8
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 95 AND 101`,

			// Group 9: Subordinate clauses (lessons 102-109)
			`UPDATE language_items SET lesson_group = 'grammar-clauses', lesson_order = 9
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 102 AND 109`,

			// Group 10: Noun-related particles (lessons 110-137)
			`UPDATE language_items SET lesson_group = 'grammar-noun-particles', lesson_order = 10
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 110 AND 137`,

			// Group 11: Adverbs and sentence-ending particles (lessons 138-149)
			`UPDATE language_items SET lesson_group = 'grammar-adverbs-gobi', lesson_order = 11
			WHERE content_type = 'grammar' AND context_notes IS NOT NULL
			AND CAST(SUBSTR(LTRIM(context_notes), 1, 3) AS INTEGER) BETWEEN 138 AND 149`,

			// Grammar items without Tae Kim context_notes: assign to frequency-ordered group
			// These items have frequency_rank from other sources but no section info
			`UPDATE language_items SET lesson_group = 'grammar-supplemental', lesson_order = 12
			WHERE content_type = 'grammar' AND lesson_group IS NULL AND frequency_rank IS NOT NULL`,

			// --- Conjugation: assign lesson_order (items with full forms first) ---
			// Items with conjugation_forms have complete paradigm data (better teaching material)
			`UPDATE language_items SET lesson_order = 1
			WHERE content_type = 'conjugation' AND conjugation_forms IS NOT NULL`,

			// Items with only verb_group (classification without full forms)
			`UPDATE language_items SET lesson_order = 2
			WHERE content_type = 'conjugation' AND conjugation_forms IS NULL`,

			// --- Sentences: assign JLPT level from Core 2k/6k frequency ranges ---
			`UPDATE language_items SET jlpt_level = 'N5'
			WHERE content_type = 'sentence' AND jlpt_level IS NULL
			AND frequency_rank IS NOT NULL AND frequency_rank <= 800`,

			`UPDATE language_items SET jlpt_level = 'N4'
			WHERE content_type = 'sentence' AND jlpt_level IS NULL
			AND frequency_rank IS NOT NULL AND frequency_rank BETWEEN 801 AND 1500`,

			`UPDATE language_items SET jlpt_level = 'N3'
			WHERE content_type = 'sentence' AND jlpt_level IS NULL
			AND frequency_rank IS NOT NULL AND frequency_rank BETWEEN 1501 AND 4000`,

			`UPDATE language_items SET jlpt_level = 'N2'
			WHERE content_type = 'sentence' AND jlpt_level IS NULL
			AND frequency_rank IS NOT NULL AND frequency_rank BETWEEN 4001 AND 6000`,

			`UPDATE language_items SET jlpt_level = 'N1'
			WHERE content_type = 'sentence' AND jlpt_level IS NULL
			AND frequency_rank IS NOT NULL AND frequency_rank > 6000`,

			// --- N5 Vocabulary: topic-based ordering for coherent learning sets ---
			// Items in the same topic are learned together instead of scattered across WK levels.
			// Within each topic, items still sort by frequency_rank (WK level) + kanji gating.

			// Topic 1: Pronouns and demonstratives (foundational references)
			`UPDATE language_items SET lesson_group = 'vocab-pronouns', lesson_order = 1
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(part_of_speech) LIKE '%pronoun%'`,

			// Topic 2: Numbers (numerals as a cohesive set)
			`UPDATE language_items SET lesson_group = 'vocab-numbers', lesson_order = 2
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(part_of_speech) LIKE '%numeral%'`,

			// Topic 3: Days of the week
			`UPDATE language_items SET lesson_group = 'vocab-days', lesson_order = 3
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND TRIM(meaning) IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')`,

			// Topic 4: Months of the year
			`UPDATE language_items SET lesson_group = 'vocab-months', lesson_order = 4
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND TRIM(meaning) IN ('January','February','March','April','May','June','July','August','September','October','November','December')`,

			// Topic 5: Hours (o'clock)
			`UPDATE language_items SET lesson_group = 'vocab-hours', lesson_order = 5
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(meaning) LIKE '%o''clock%'`,

			// Topic 6: Minutes
			`UPDATE language_items SET lesson_group = 'vocab-minutes', lesson_order = 6
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(meaning) LIKE '%minute%'`,

			// Topic 7: Day numbers (First Day, Day Two, etc.)
			`UPDATE language_items SET lesson_group = 'vocab-day-numbers', lesson_order = 7
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND (meaning LIKE '%First Day%' OR meaning LIKE '%Day One%'
				OR meaning LIKE '%Second Day%' OR meaning LIKE '%Day Two%'
				OR meaning LIKE '%Third Day%' OR meaning LIKE '%Day Three%'
				OR meaning LIKE '%Fourth Day%' OR meaning LIKE '%Day Four%'
				OR meaning LIKE '%Fifth Day%' OR meaning LIKE '%Day Five%'
				OR meaning LIKE '%Sixth Day%' OR meaning LIKE '%Day Six%'
				OR meaning LIKE '%Seventh Day%' OR meaning LIKE '%Day Seven%'
				OR meaning LIKE '%Eighth Day%' OR meaning LIKE '%Day Eight%'
				OR meaning LIKE '%Ninth Day%' OR meaning LIKE '%Day Nine%'
				OR meaning LIKE '%Tenth Day%' OR meaning LIKE '%Day Ten%'
				OR meaning LIKE '%day 1%' OR meaning LIKE '%day 11%')`,

			// Topic 8: Hundreds (100-900)
			`UPDATE language_items SET lesson_group = 'vocab-hundreds', lesson_order = 8
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND meaning LIKE '%Hundred%'`,

			// Topic 9: Thousands (1000, 2000, etc.)
			`UPDATE language_items SET lesson_group = 'vocab-thousands', lesson_order = 9
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND (meaning LIKE '%Thousand%' OR meaning LIKE '%thousand%')`,

			// Topic 10: Year students (1st year through 6th year)
			`UPDATE language_items SET lesson_group = 'vocab-year-students', lesson_order = 10
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(meaning) LIKE '%year student%'`,

			// Topic 11: Age counters (X years old)
			`UPDATE language_items SET lesson_group = 'vocab-age', lesson_order = 11
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(meaning) LIKE '%year%old%'`,

			// Topic 12: People counters (X Persons)
			`UPDATE language_items SET lesson_group = 'vocab-people-counters', lesson_order = 12
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND (meaning LIKE '%Persons%' OR (meaning LIKE '%People%' AND meaning LIKE '%Person%'))`,

			// Topic 13: Seasons
			`UPDATE language_items SET lesson_group = 'vocab-seasons', lesson_order = 13
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(TRIM(meaning)) IN ('spring','summer','fall','winter','autumn')`,

			// Topic 14: Family terms (using Japanese text for precision)
			`UPDATE language_items SET lesson_group = 'vocab-family', lesson_order = 14
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND (item_key IN ('vocab:家族','vocab:兄弟','vocab:両親')
				OR item_key LIKE 'vocab:お父%' OR item_key LIKE 'vocab:お母%'
				OR item_key LIKE 'vocab:お兄%' OR item_key LIKE 'vocab:お姉%'
				OR item_key LIKE 'vocab:おじい%' OR item_key LIKE 'vocab:おばあ%'
				OR item_key LIKE 'vocab:赤ちゃん%'
				OR LOWER(TRIM(meaning)) IN ('family','older brother','older sister',
					'younger brother','younger sister','child, kid',
					'grandfather','grandmother','daughter','husband','wife','baby','baby (colloquial)')
				OR meaning LIKE '(speaker''s) father%' OR meaning LIKE '(speaker''s) mother%')`,

			// Topic 15: Countries and places (proper nouns)
			`UPDATE language_items SET lesson_group = 'vocab-places', lesson_order = 15
			WHERE content_type = 'vocabulary' AND jlpt_level = 'N5' AND lesson_group IS NULL
			AND LOWER(part_of_speech) LIKE '%proper noun%'`,
		],
		down: `
			UPDATE language_items SET lesson_group = NULL, lesson_order = NULL
			WHERE content_type IN ('grammar', 'conjugation', 'vocabulary');
			UPDATE language_items SET jlpt_level = NULL
			WHERE content_type = 'sentence' AND jlpt_level IN ('N5','N4','N3','N2','N1');
		`,
	},
	{
		version: 16,
		description: "Add language_level column for WaniKani-style level progression",
		up: [
			"ALTER TABLE language_items ADD COLUMN language_level INTEGER",
			"CREATE INDEX idx_language_items_language_level ON language_items(language_level)",
			"CREATE INDEX idx_language_items_level_type ON language_items(language_level, content_type)",
		],
		down: `
			DROP INDEX IF EXISTS idx_language_items_level_type;
			DROP INDEX IF EXISTS idx_language_items_language_level;
		`,
	},
];
