import { describe, expect, it } from "vitest";
import { toSqliteDateTime } from "./common";

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
