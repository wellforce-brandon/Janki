import { getDb, type QueryResult, safeQuery } from "../db/database";
import type { AnkiPackage, ProgressCallback } from "./apkg-parser";

const BLOB_SIZE_THRESHOLD = 1024 * 1024; // 1MB

function getMimeType(filename: string): string | null {
	const ext = filename.split(".").pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		png: "image/png",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		mp3: "audio/mpeg",
		ogg: "audio/ogg",
		wav: "audio/wav",
		mp4: "video/mp4",
	};
	return ext ? (mimeTypes[ext] ?? null) : null;
}

export async function extractAndStoreMedia(
	pkg: AnkiPackage,
	deckId: number,
	onProgress?: ProgressCallback,
): Promise<QueryResult<{ stored: number; skipped: number }>> {
	return safeQuery(async () => {
		const db = await getDb();
		let stored = 0;
		let skipped = 0;
		const entries = Array.from(pkg.media.entries());

		for (let i = 0; i < entries.length; i++) {
			const [filename, data] = entries[i];
			onProgress?.("Storing media", i + 1, entries.length);

			const mimeType = getMimeType(filename);
			const sizeBytes = data.byteLength;

			// Reject files over 2GB (safety limit)
			if (sizeBytes > 2 * 1024 * 1024 * 1024) {
				skipped++;
				continue;
			}

			if (sizeBytes < BLOB_SIZE_THRESHOLD) {
				// Store as BLOB
				await db.execute(
					"INSERT INTO media (deck_id, filename, mime_type, data, size_bytes) VALUES (?, ?, ?, ?, ?)",
					[deckId, filename, mimeType, Array.from(data), sizeBytes],
				);
			} else {
				// For large files, store a reference (filesystem storage handled by Tauri)
				// In the future, use @tauri-apps/plugin-fs to write to $APPDATA/janki/media/
				await db.execute(
					"INSERT INTO media (deck_id, filename, mime_type, file_path, size_bytes) VALUES (?, ?, ?, ?, ?)",
					[deckId, filename, mimeType, `media/${deckId}/${filename}`, sizeBytes],
				);
			}
			stored++;
		}

		return { stored, skipped };
	});
}

export async function getMediaBlob(
	deckId: number,
	filename: string,
): Promise<QueryResult<{ data: number[]; mime_type: string } | null>> {
	return safeQuery(async () => {
		const db = await getDb();
		const rows = await db.select<{ data: number[]; mime_type: string }[]>(
			"SELECT data, mime_type FROM media WHERE deck_id = ? AND filename = ? AND data IS NOT NULL",
			[deckId, filename],
		);
		return rows[0] ?? null;
	});
}
