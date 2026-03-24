import { describe, expect, it, vi, beforeEach } from "vitest";
import { calculateNextReview } from "./language-srs";
import { toSqliteDateTime } from "../utils/common";

// Mock DB modules
vi.mock("../db/queries/language", () => ({
	getLanguageItemById: vi.fn(),
	updateLanguageItemSrs: vi.fn().mockResolvedValue({ ok: true }),
	logLanguageReview: vi.fn().mockResolvedValue({ ok: true }),
	deleteLatestLanguageReview: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("./language-unlock", () => ({
	checkAndUnlockWithinLevel: vi.fn().mockResolvedValue(0),
}));

vi.mock("../db/queries/stats", () => ({
	updateDailyStats: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../db/query-cache", () => ({
	invalidateCache: vi.fn(),
}));

// Import after mocks
const { getLanguageItemById } = await import("../db/queries/language");
const { reviewLanguageItem } = await import("./language-srs");

function makeItem(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		srs_stage: 3,
		correct_count: 5,
		incorrect_count: 2,
		lesson_completed_at: "2026-01-01 00:00:00",
		language_level: 1,
		...overrides,
	} as unknown as import("../db/queries/language").LanguageItem;
}

describe("Language SRS", () => {
	describe("toSqliteDateTime", () => {
		it("should format date as YYYY-MM-DD HH:MM:SS", () => {
			const d = new Date("2026-03-15T14:30:45.123Z");
			expect(toSqliteDateTime(d)).toBe("2026-03-15 14:30:45");
		});

		it("should strip milliseconds and timezone", () => {
			const d = new Date("2026-01-01T00:00:00.000Z");
			expect(toSqliteDateTime(d)).toBe("2026-01-01 00:00:00");
		});
	});

	describe("calculateNextReview", () => {
		it("should return null for stage 0 (Locked)", () => {
			expect(calculateNextReview(0)).toBeNull();
		});

		it("should return null for stage 9 (Burned)", () => {
			expect(calculateNextReview(9)).toBeNull();
		});

		it("should return a future datetime string for stages 1-8", () => {
			for (let stage = 1; stage <= 8; stage++) {
				const result = calculateNextReview(stage);
				expect(result).not.toBeNull();
				expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
			}
		});

		it("should produce longer intervals for higher stages", () => {
			const results: Date[] = [];
			for (let stage = 1; stage <= 8; stage++) {
				const result = calculateNextReview(stage);
				results.push(new Date(result!.replace(" ", "T") + "Z"));
			}
			for (let i = 1; i < results.length; i++) {
				expect(results[i].getTime()).toBeGreaterThanOrEqual(results[i - 1].getTime());
			}
		});
	});

	describe("calculateDrop (via reviewLanguageItem)", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("should advance stage by 1 on correct answer", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 3 }),
			});
			const result = await reviewLanguageItem(1, true, 1000);
			expect(result.newStage).toBe(4);
		});

		it("should cap at stage 9 (Burned)", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 8 }),
			});
			const result = await reviewLanguageItem(1, true, 1000);
			expect(result.newStage).toBe(9);
		});

		it("should drop stage on incorrect with penalty factor 1 (below Guru)", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 4 }),
			});
			// incorrectCount=1: drop = ceil(1/2)*1 = 1, new = 4-1 = 3
			const result = await reviewLanguageItem(1, false, 1000, 1);
			expect(result.newStage).toBe(3);
		});

		it("should apply penalty factor 2 for Guru+ stages (5+)", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 6 }),
			});
			// incorrectCount=1: drop = ceil(1/2)*2 = 2, new = 6-2 = 4
			const result = await reviewLanguageItem(1, false, 1000, 1);
			expect(result.newStage).toBe(4);
		});

		it("should never drop below stage 1", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 1 }),
			});
			const result = await reviewLanguageItem(1, false, 1000, 5);
			expect(result.newStage).toBe(1);
		});

		it("should increase drop with higher incorrectCount", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 7 }),
			});
			// incorrectCount=3: drop = ceil(3/2)*2 = 4, new = 7-4 = 3
			const result = await reviewLanguageItem(1, false, 1000, 3);
			expect(result.newStage).toBe(3);
		});

		it("should return null nextReview for Burned stage", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: true,
				data: makeItem({ srs_stage: 8 }),
			});
			const result = await reviewLanguageItem(1, true, 1000);
			expect(result.newStage).toBe(9);
			expect(result.nextReview).toBeNull();
		});

		it("should throw if item not found", async () => {
			vi.mocked(getLanguageItemById).mockResolvedValue({
				ok: false,
				error: "not found",
			});
			await expect(reviewLanguageItem(999, true)).rejects.toThrow("Language item 999 not found");
		});
	});
});
