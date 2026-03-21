export interface Migration {
	version: number;
	description: string;
	up: string;
	down: string;
}

export const migrations: Migration[] = [
	{
		version: 1,
		description: "Initial schema",
		up: `
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS decks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				description TEXT,
				source TEXT,
				source_file TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE TABLE IF NOT EXISTS note_types (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				fields TEXT NOT NULL,
				card_templates TEXT NOT NULL,
				css TEXT
			);

			CREATE TABLE IF NOT EXISTS notes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_type_id INTEGER NOT NULL REFERENCES note_types(id),
				deck_id INTEGER NOT NULL REFERENCES decks(id),
				fields TEXT NOT NULL,
				tags TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE TABLE IF NOT EXISTS cards (
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
			);

			CREATE TABLE IF NOT EXISTS review_log (
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
			);

			CREATE TABLE IF NOT EXISTS kanji_levels (
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
			);

			CREATE TABLE IF NOT EXISTS kanji_dependencies (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				kanji_level_id INTEGER NOT NULL REFERENCES kanji_levels(id),
				depends_on_id INTEGER NOT NULL REFERENCES kanji_levels(id),
				UNIQUE(kanji_level_id, depends_on_id)
			);

			CREATE TABLE IF NOT EXISTS media (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				deck_id INTEGER REFERENCES decks(id),
				filename TEXT NOT NULL,
				mime_type TEXT,
				data BLOB,
				file_path TEXT,
				size_bytes INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE TABLE IF NOT EXISTS daily_stats (
				date TEXT PRIMARY KEY,
				reviews_count INTEGER NOT NULL DEFAULT 0,
				new_cards_count INTEGER NOT NULL DEFAULT 0,
				correct_count INTEGER NOT NULL DEFAULT 0,
				incorrect_count INTEGER NOT NULL DEFAULT 0,
				time_spent_ms INTEGER NOT NULL DEFAULT 0,
				kanji_learned INTEGER NOT NULL DEFAULT 0
			);

			CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
			CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
			CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
			CREATE INDEX IF NOT EXISTS idx_notes_deck ON notes(deck_id);
			CREATE INDEX IF NOT EXISTS idx_review_log_card ON review_log(card_id);
			CREATE INDEX IF NOT EXISTS idx_review_log_date ON review_log(reviewed_at);
			CREATE INDEX IF NOT EXISTS idx_kanji_levels_level ON kanji_levels(level);
			CREATE INDEX IF NOT EXISTS idx_kanji_levels_type ON kanji_levels(item_type);
			CREATE INDEX IF NOT EXISTS idx_kanji_levels_srs ON kanji_levels(srs_stage);
			CREATE INDEX IF NOT EXISTS idx_kanji_levels_review ON kanji_levels(next_review);

			INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '1');
		`,
		down: `
			DROP TABLE IF EXISTS daily_stats;
			DROP TABLE IF EXISTS media;
			DROP TABLE IF EXISTS kanji_dependencies;
			DROP TABLE IF EXISTS kanji_levels;
			DROP TABLE IF EXISTS review_log;
			DROP TABLE IF EXISTS cards;
			DROP TABLE IF EXISTS notes;
			DROP TABLE IF EXISTS note_types;
			DROP TABLE IF EXISTS decks;
			DROP TABLE IF EXISTS settings;
		`,
	},
	{
		version: 2,
		description: "Add FTS5 search tables for cards and kanji",
		up: `
			CREATE VIRTUAL TABLE IF NOT EXISTS kanji_fts USING fts5(
				character,
				meanings,
				readings,
				content=kanji_levels,
				content_rowid=id
			);

			INSERT INTO kanji_fts(rowid, character, meanings, readings)
			SELECT id, character, meanings, COALESCE(readings_on, '') || ' ' || COALESCE(readings_kun, '') || ' ' || COALESCE(reading, '')
			FROM kanji_levels;
		`,
		down: `
			DROP TABLE IF EXISTS kanji_fts;
		`,
	},
	{
		version: 3,
		description: "Add kanji review log and lesson tracking columns",
		up: `
			CREATE TABLE IF NOT EXISTS kanji_review_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				kanji_level_id INTEGER NOT NULL REFERENCES kanji_levels(id),
				correct INTEGER NOT NULL,
				srs_stage_before INTEGER NOT NULL,
				srs_stage_after INTEGER NOT NULL,
				duration_ms INTEGER,
				reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE INDEX idx_kanji_review_log_item ON kanji_review_log(kanji_level_id);

			CREATE INDEX idx_kanji_review_log_date ON kanji_review_log(reviewed_at);

			ALTER TABLE kanji_levels ADD COLUMN lesson_completed_at TEXT;

			ALTER TABLE kanji_levels ADD COLUMN user_notes TEXT;

			ALTER TABLE kanji_levels ADD COLUMN user_synonyms TEXT;

			UPDATE kanji_levels SET lesson_completed_at = unlocked_at WHERE srs_stage > 0 AND unlocked_at IS NOT NULL;
		`,
		down: `
			DROP TABLE IF EXISTS kanji_review_log;
		`,
	},
	{
		version: 4,
		description: "Add image_url for radicals and incorrect counts to review log",
		up: `
			ALTER TABLE kanji_levels ADD COLUMN image_url TEXT;

			ALTER TABLE kanji_review_log ADD COLUMN meaning_incorrect INTEGER NOT NULL DEFAULT 0;

			ALTER TABLE kanji_review_log ADD COLUMN reading_incorrect INTEGER NOT NULL DEFAULT 0;
		`,
		down: `
			SELECT 1;
		`,
	},
	{
		version: 5,
		description: "Add WK subject ID and component dependencies for per-item vocab unlock",
		up: `
			ALTER TABLE kanji_levels ADD COLUMN wk_id INTEGER;

			ALTER TABLE kanji_levels ADD COLUMN component_ids TEXT;

			CREATE INDEX IF NOT EXISTS idx_kanji_levels_wk_id ON kanji_levels(wk_id);
		`,
		down: `
			SELECT 1;
		`,
	},
	{
		version: 6,
		description: "Add enriched WK fields: parts of speech, context sentences, audio, similar kanji, radical images",
		up: `
			ALTER TABLE kanji_levels ADD COLUMN parts_of_speech TEXT;

			ALTER TABLE kanji_levels ADD COLUMN context_sentences TEXT;

			ALTER TABLE kanji_levels ADD COLUMN pronunciation_audios TEXT;

			ALTER TABLE kanji_levels ADD COLUMN visually_similar_ids TEXT;

			ALTER TABLE kanji_levels ADD COLUMN character_images TEXT;
		`,
		down: `
			SELECT 1;
		`,
	},
	{
		version: 7,
		description: "Add meaning_hint and reading_hint columns for kanji",
		up: `
			ALTER TABLE kanji_levels ADD COLUMN meaning_hint TEXT;

			ALTER TABLE kanji_levels ADD COLUMN reading_hint TEXT;
		`,
		down: `
			SELECT 1;
		`,
	},
	{
		version: 8,
		description: "Add streak tracking columns for meaning and reading",
		up: `
			ALTER TABLE kanji_levels ADD COLUMN meaning_current_streak INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE kanji_levels ADD COLUMN meaning_max_streak INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE kanji_levels ADD COLUMN reading_current_streak INTEGER NOT NULL DEFAULT 0;
			ALTER TABLE kanji_levels ADD COLUMN reading_max_streak INTEGER NOT NULL DEFAULT 0;
		`,
		down: `
			SELECT 1;
		`,
	},
	{
		version: 9,
		description:
			"Add content classification tables and builtin SRS items for unified Language section",
		up: `
			CREATE TABLE IF NOT EXISTS content_tags (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
				content_type TEXT NOT NULL,
				confidence REAL NOT NULL DEFAULT 1.0,
				source TEXT NOT NULL DEFAULT 'auto',
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				UNIQUE(note_id, content_type)
			);
			CREATE INDEX idx_content_tags_type ON content_tags(content_type);
			CREATE INDEX idx_content_tags_note ON content_tags(note_id);

			CREATE TABLE IF NOT EXISTS content_type_fields (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				note_type_id INTEGER NOT NULL REFERENCES note_types(id) ON DELETE CASCADE,
				content_type TEXT NOT NULL,
				field_name TEXT NOT NULL,
				semantic_role TEXT NOT NULL,
				UNIQUE(note_type_id, content_type, field_name)
			);
			CREATE INDEX idx_ctf_notetype ON content_type_fields(note_type_id);

			CREATE TABLE IF NOT EXISTS builtin_items (
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
			);
			CREATE INDEX idx_builtin_type ON builtin_items(content_type);
			CREATE INDEX idx_builtin_due ON builtin_items(due);
			CREATE INDEX idx_builtin_state ON builtin_items(state);

			CREATE TABLE IF NOT EXISTS builtin_review_log (
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
			);
			CREATE INDEX idx_builtin_review_item ON builtin_review_log(builtin_item_id);
		`,
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
		up: `
			CREATE TABLE IF NOT EXISTS language_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				content_type TEXT NOT NULL,
				item_key TEXT NOT NULL UNIQUE,

				-- Universal fields
				primary_text TEXT NOT NULL,
				reading TEXT,
				meaning TEXT,

				-- Vocabulary
				part_of_speech TEXT,
				pitch_accent TEXT,
				frequency_rank INTEGER,
				audio_file TEXT,

				-- Grammar
				formation TEXT,
				explanation TEXT,

				-- Sentence
				sentence_ja TEXT,
				sentence_en TEXT,
				sentence_reading TEXT,
				sentence_audio TEXT,

				-- Kana
				romaji TEXT,
				stroke_order TEXT,

				-- Conjugation
				conjugation_forms TEXT,
				verb_group TEXT,

				-- Enrichment (from multi-source merge)
				example_sentences TEXT,
				related_items TEXT,
				images TEXT,
				context_notes TEXT,
				source_decks TEXT,

				-- Classification
				jlpt_level TEXT,
				wk_level INTEGER,
				tags TEXT,

				-- SRS (WK-style stages)
				srs_stage INTEGER NOT NULL DEFAULT 0,
				unlocked_at TEXT,
				next_review TEXT,
				correct_count INTEGER NOT NULL DEFAULT 0,
				incorrect_count INTEGER NOT NULL DEFAULT 0,
				lesson_completed_at TEXT,

				-- Prerequisites
				prerequisite_keys TEXT,

				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE TABLE IF NOT EXISTS language_review_log (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				item_id INTEGER NOT NULL REFERENCES language_items(id) ON DELETE CASCADE,
				srs_stage_before INTEGER NOT NULL,
				srs_stage_after INTEGER NOT NULL,
				correct INTEGER NOT NULL,
				duration_ms INTEGER,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			);

			CREATE INDEX idx_language_items_content_type ON language_items(content_type);
			CREATE INDEX idx_language_items_item_key ON language_items(item_key);
			CREATE INDEX idx_language_items_srs_stage ON language_items(srs_stage);
			CREATE INDEX idx_language_items_jlpt ON language_items(jlpt_level);
			CREATE INDEX idx_language_items_next_review ON language_items(next_review);
			CREATE INDEX idx_language_items_type_srs ON language_items(content_type, srs_stage);
			CREATE INDEX idx_language_review_log_item ON language_review_log(item_id);
			CREATE INDEX idx_language_review_log_date ON language_review_log(created_at);

			-- Drop v9 builtin tables
			DROP TABLE IF EXISTS builtin_review_log;
			DROP TABLE IF EXISTS builtin_items;
			DROP TABLE IF EXISTS content_type_fields;
			DROP TABLE IF EXISTS content_tags;

			-- Drop legacy deck/card/note tables
			DROP TABLE IF EXISTS review_log;
			DROP TABLE IF EXISTS cards;
			DROP TABLE IF EXISTS notes;
			DROP TABLE IF EXISTS note_types;
			DROP TABLE IF EXISTS decks;
			DROP TABLE IF EXISTS media;
		`,
		down: `
			DROP TABLE IF EXISTS language_review_log;
			DROP TABLE IF EXISTS language_items;
		`,
	},
	{
		version: 11,
		description: "Add FTS5 full-text search for language_items",
		up: `
			CREATE VIRTUAL TABLE IF NOT EXISTS language_fts USING fts5(
				primary_text,
				reading,
				meaning,
				explanation,
				content=language_items,
				content_rowid=id
			);

			INSERT INTO language_fts(rowid, primary_text, reading, meaning, explanation)
			SELECT id, primary_text, COALESCE(reading, ''), COALESCE(meaning, ''), COALESCE(explanation, '')
			FROM language_items;
		`,
		down: `
			DROP TABLE IF EXISTS language_fts;
		`,
	},
];
