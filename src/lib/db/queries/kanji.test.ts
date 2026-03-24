import { describe, expect, it, vi } from "vitest";

vi.mock("../database", () => ({
	getDb: vi.fn(),
	safeQuery: vi.fn(async (fn: () => Promise<unknown>) => {
		const data = await fn();
		return { ok: true, data };
	}),
	sqlPlaceholders: vi.fn(),
	withTransaction: vi.fn(),
}));

vi.mock("../query-cache", () => ({
	invalidateCache: vi.fn(),
	getCached: vi.fn(),
	setCache: vi.fn(),
	CACHE_KEYS: {},
}));

describe("getDueKanjiReviews", () => {
	it("should reject invalid order values", async () => {
		const { getDueKanjiReviews } = await import("./kanji");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await expect(getDueKanjiReviews("invalid-order" as any)).rejects.toThrow(
			"Invalid review order",
		);
	});
});
