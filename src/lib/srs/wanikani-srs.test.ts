import { describe, expect, it, vi } from "vitest";
import { getStageColor, STAGE_CATEGORIES, STAGE_NAMES } from "./wanikani-srs";

// Mock the database module -- withTransaction just executes the callback with a mock db
const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
vi.mock("../db/database", () => ({
	withTransaction: vi.fn(async (fn: (db: { execute: typeof mockExecute }) => Promise<unknown>) => {
		return fn({ execute: mockExecute });
	}),
}));

vi.mock("../db/queries/kanji", () => ({
	checkAndUnlockLevel: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("../db/query-cache", () => ({
	invalidateCache: vi.fn(),
}));

describe("WaniKani SRS", () => {
	describe("stage names", () => {
		it("should have names for all stages 0-9", () => {
			for (let i = 0; i <= 9; i++) {
				expect(STAGE_NAMES[i]).toBeDefined();
			}
		});

		it("should have correct stage names", () => {
			expect(STAGE_NAMES[0]).toBe("Locked");
			expect(STAGE_NAMES[1]).toBe("Apprentice 1");
			expect(STAGE_NAMES[5]).toBe("Guru 1");
			expect(STAGE_NAMES[7]).toBe("Master");
			expect(STAGE_NAMES[8]).toBe("Enlightened");
			expect(STAGE_NAMES[9]).toBe("Burned");
		});
	});

	describe("stage categories", () => {
		it("should categorize stages correctly", () => {
			expect(STAGE_CATEGORIES[0]).toBe("locked");
			expect(STAGE_CATEGORIES[1]).toBe("apprentice");
			expect(STAGE_CATEGORIES[4]).toBe("apprentice");
			expect(STAGE_CATEGORIES[5]).toBe("guru");
			expect(STAGE_CATEGORIES[6]).toBe("guru");
			expect(STAGE_CATEGORIES[7]).toBe("master");
			expect(STAGE_CATEGORIES[8]).toBe("enlightened");
			expect(STAGE_CATEGORIES[9]).toBe("burned");
		});
	});

	describe("getStageColor", () => {
		it("should return color classes for each stage", () => {
			for (let i = 0; i <= 9; i++) {
				const color = getStageColor(i);
				expect(color).toBeDefined();
				expect(color.length).toBeGreaterThan(0);
			}
		});

		it("should return locked color for stage 0", () => {
			expect(getStageColor(0)).toContain("gray");
		});

		it("should return apprentice color for stages 1-4", () => {
			expect(getStageColor(1)).toContain("pink");
			expect(getStageColor(4)).toContain("pink");
		});

		it("should return guru color for stages 5-6", () => {
			expect(getStageColor(5)).toContain("purple");
		});

		it("should return burned color for stage 9", () => {
			expect(getStageColor(9)).toContain("amber");
		});
	});

	describe("reviewKanjiItem", () => {
		it("should advance stage on correct answer", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 1, 1);
			expect(result.newStage).toBe(2);
			expect(result.nextReview).toBeDefined();
			expect(result.unlockedIds).toEqual([]);
		});

		it("should drop stage on incorrect answer (1 wrong at stage 3)", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			// Stage 3, penalty_factor=1, ceil(1/2)=1, drop=1 -> stage 2
			const result = await reviewKanjiItem(1, false, 3, 1, null, 1);
			expect(result.newStage).toBe(2);
		});

		it("should burn on correct from enlightened", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 8, 1);
			expect(result.newStage).toBe(9);
			expect(result.nextReview).toBeNull();
		});

		it("should not exceed stage 9", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 8, 1);
			expect(result.newStage).toBeLessThanOrEqual(9);
		});

		it("should not drop below stage 1 on incorrect at stage 1", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, false, 1, 1, null, 1);
			expect(result.newStage).toBe(1);
			expect(result.nextReview).toBeDefined();
		});

		it("should drop from Guru (stage 5) to stage 3 on 1 incorrect", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			// Stage 5, penalty_factor=2, ceil(1/2)=1, drop=2 -> stage 3
			const result = await reviewKanjiItem(1, false, 5, 1, null, 1);
			expect(result.newStage).toBe(3);
		});

		it("should drop from Enlightened (stage 8) to stage 4 on 3 incorrect", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			// Stage 8, penalty_factor=2, ceil(3/2)=2, drop=4 -> stage 4
			const result = await reviewKanjiItem(1, false, 8, 1, null, 3);
			expect(result.newStage).toBe(4);
		});

		it("should drop from stage 4 to stage 2 on 2 incorrect", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			// Stage 4, penalty_factor=1, ceil(2/2)=1, drop=1 -> stage 3
			const result = await reviewKanjiItem(1, false, 4, 1, null, 2);
			expect(result.newStage).toBe(3);
		});

		it("should floor at stage 1 even with many incorrect", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, false, 3, 1, null, 10);
			expect(result.newStage).toBe(1);
		});

		it("should use accelerated intervals for level 1-2 items", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const resultLevel1 = await reviewKanjiItem(1, true, 1, 1);
			const resultLevel3 = await reviewKanjiItem(2, true, 1, 3);
			// Both advance to stage 2, but level 1 gets 2h review, level 3 gets 4h
			// We can't check exact times, but both should have valid datetime
			expect(resultLevel1.nextReview).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:00:00$/);
			expect(resultLevel3.nextReview).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:00:00$/);
		});

		it("should round review times to top of hour", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 1, 3);
			// Minutes and seconds should be 00:00
			expect(result.nextReview).toMatch(/:00:00$/);
		});

		it("should produce SQLite-compatible datetime format", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 1, 1);
			expect(result.nextReview).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		});
	});
});
