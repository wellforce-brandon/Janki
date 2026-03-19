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
];
