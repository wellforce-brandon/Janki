import { describe, expect, it, vi } from "vitest";
import { getStageColor, STAGE_CATEGORIES, STAGE_NAMES } from "./wanikani-srs";

// Mock the database module since reviewKanjiItem calls it
vi.mock("../db/queries/kanji", () => ({
	updateKanjiSrsState: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
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
			const result = await reviewKanjiItem(1, true, 1);
			expect(result.newStage).toBe(2);
			expect(result.nextReview).toBeDefined();
		});

		it("should drop stage on incorrect answer", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, false, 3);
			expect(result.newStage).toBeLessThan(3);
		});

		it("should burn on correct from enlightened", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 8);
			expect(result.newStage).toBe(9);
			expect(result.nextReview).toBeNull();
		});

		it("should not exceed stage 9", async () => {
			const { reviewKanjiItem } = await import("./wanikani-srs");
			const result = await reviewKanjiItem(1, true, 8);
			expect(result.newStage).toBeLessThanOrEqual(9);
		});
	});
});
