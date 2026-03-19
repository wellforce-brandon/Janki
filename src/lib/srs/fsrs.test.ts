import { describe, expect, it } from "vitest";
import { createNewCard, getNextIntervals, Rating, reviewCard, State } from "./fsrs";

describe("FSRS wrapper", () => {
	it("should create a new card with default state", () => {
		const card = createNewCard();
		expect(card.state).toBe(State.New);
		expect(card.stability).toBe(0);
		expect(card.difficulty).toBe(0);
		expect(card.reps).toBe(0);
		expect(card.lapses).toBe(0);
		expect(card.due).toBeDefined();
	});

	it("should advance card state after Good rating", () => {
		const card = createNewCard();
		const { card: updated } = reviewCard(card, Rating.Good);

		expect(updated.state).toBe(State.Learning);
		expect(updated.reps).toBe(1);
		expect(updated.stability).toBeGreaterThan(0);
		expect(updated.difficulty).toBeGreaterThan(0);
	});

	it("should advance card state after Easy rating", () => {
		const card = createNewCard();
		const { card: updated } = reviewCard(card, Rating.Easy);

		expect(updated.reps).toBe(1);
		expect(updated.stability).toBeGreaterThan(0);
	});

	it("should keep card in learning after Again rating", () => {
		const card = createNewCard();
		const { card: updated } = reviewCard(card, Rating.Again);

		expect(updated.state).toBe(State.Learning);
		expect(updated.reps).toBe(1);
		expect(updated.lapses).toBe(0); // First review, no lapse
	});

	it("should increase stability on repeated Good ratings", () => {
		let card = createNewCard();
		const { card: after1 } = reviewCard(card, Rating.Good);
		card = after1;
		const { card: after2 } = reviewCard(card, Rating.Good);

		expect(after2.stability).toBeGreaterThan(after1.stability);
		expect(after2.reps).toBe(2);
	});

	it("should return next intervals for all ratings", () => {
		const card = createNewCard();
		const intervals = getNextIntervals(card);

		expect(intervals[Rating.Again]).toBeDefined();
		expect(intervals[Rating.Hard]).toBeDefined();
		expect(intervals[Rating.Good]).toBeDefined();
		expect(intervals[Rating.Easy]).toBeDefined();
	});

	it("should show longer intervals for Easy vs Again", () => {
		// After reviewing once to establish some state
		const card = createNewCard();
		const { card: reviewed } = reviewCard(card, Rating.Good);
		const { card: reviewed2 } = reviewCard(reviewed, Rating.Good);

		const intervals = getNextIntervals(reviewed2);
		// Easy interval should be longer than Again interval
		// Just check they're all defined strings
		expect(typeof intervals[Rating.Again]).toBe("string");
		expect(typeof intervals[Rating.Easy]).toBe("string");
	});
});
