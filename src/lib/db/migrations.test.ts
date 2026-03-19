import { describe, expect, it } from "vitest";
import { migrations } from "./migrations";

describe("migrations", () => {
	it("should have sequential version numbers", () => {
		for (let i = 0; i < migrations.length; i++) {
			expect(migrations[i].version).toBe(i + 1);
		}
	});

	it("should have non-empty up SQL", () => {
		for (const m of migrations) {
			expect(m.up.trim().length).toBeGreaterThan(0);
		}
	});

	it("should have non-empty down SQL", () => {
		for (const m of migrations) {
			expect(m.down.trim().length).toBeGreaterThan(0);
		}
	});

	it("should have a description for each migration", () => {
		for (const m of migrations) {
			expect(m.description.trim().length).toBeGreaterThan(0);
		}
	});
});
