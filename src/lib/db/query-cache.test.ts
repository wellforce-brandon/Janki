import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCached, invalidateCache, setCache } from "./query-cache";

describe("Query Cache", () => {
	beforeEach(() => {
		invalidateCache(); // clear all
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getCached / setCache", () => {
		it("should return undefined for missing key", () => {
			expect(getCached("nonexistent")).toBeUndefined();
		});

		it("should store and retrieve a value", () => {
			setCache("test", { count: 42 });
			expect(getCached("test")).toEqual({ count: 42 });
		});

		it("should store different types", () => {
			setCache("string", "hello");
			setCache("number", 123);
			setCache("array", [1, 2, 3]);
			expect(getCached("string")).toBe("hello");
			expect(getCached("number")).toBe(123);
			expect(getCached("array")).toEqual([1, 2, 3]);
		});

		it("should return undefined after TTL expires", () => {
			vi.useFakeTimers();
			setCache("expiring", "data", 1000);
			expect(getCached("expiring")).toBe("data");

			vi.advanceTimersByTime(1001);
			expect(getCached("expiring")).toBeUndefined();
			vi.useRealTimers();
		});

		it("should return value before TTL expires", () => {
			vi.useFakeTimers();
			setCache("fresh", "data", 5000);

			vi.advanceTimersByTime(4999);
			expect(getCached("fresh")).toBe("data");
			vi.useRealTimers();
		});

		it("should use default TTL of 60s when not specified", () => {
			vi.useFakeTimers();
			setCache("default-ttl", "data");

			vi.advanceTimersByTime(59_999);
			expect(getCached("default-ttl")).toBe("data");

			vi.advanceTimersByTime(2);
			expect(getCached("default-ttl")).toBeUndefined();
			vi.useRealTimers();
		});

		it("should overwrite existing value", () => {
			setCache("key", "old");
			setCache("key", "new");
			expect(getCached("key")).toBe("new");
		});
	});

	describe("invalidateCache", () => {
		it("should clear all entries when no prefix given", () => {
			setCache("a", 1);
			setCache("b", 2);
			setCache("c", 3);
			invalidateCache();
			expect(getCached("a")).toBeUndefined();
			expect(getCached("b")).toBeUndefined();
			expect(getCached("c")).toBeUndefined();
		});

		it("should clear only the exact key specified", () => {
			setCache("contentTypeCounts", 10);
			setCache("srsSummary", 5);
			invalidateCache("contentTypeCounts");
			expect(getCached("contentTypeCounts")).toBeUndefined();
			expect(getCached("srsSummary")).toBe(5);
		});

		it("should handle key that is not in cache", () => {
			setCache("contentTypeCounts", "value");
			invalidateCache("srsSummary");
			expect(getCached("contentTypeCounts")).toBe("value");
		});
	});
});
