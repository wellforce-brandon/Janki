import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock window.speechSynthesis
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn().mockReturnValue([]);

Object.defineProperty(window, "speechSynthesis", {
	value: {
		speak: mockSpeak,
		cancel: mockCancel,
		getVoices: mockGetVoices,
	},
	writable: true,
});

// Mock SpeechSynthesisUtterance (not available in jsdom)
class MockUtterance {
	lang = "";
	rate = 1;
	pitch = 1;
	voice: unknown = null;
	text: string;
	onend: ((e: Event) => void) | null = null;
	onerror: ((e: Event) => void) | null = null;
	constructor(text: string) {
		this.text = text;
	}
}
(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;

describe("TTS speech", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should export getTts and speakJapanese", async () => {
		const { getTts, speakJapanese } = await import("./speech");
		expect(getTts).toBeDefined();
		expect(speakJapanese).toBeDefined();
	});

	it("should detect speech synthesis availability", async () => {
		const { getTts } = await import("./speech");
		const tts = getTts();
		expect(tts.isAvailable()).toBe(true);
	});

	it("should call speechSynthesis.cancel on stop", async () => {
		const { getTts } = await import("./speech");
		const tts = getTts();
		tts.stop();
		expect(mockCancel).toHaveBeenCalled();
	});

	it("should call speechSynthesis.speak with Japanese language", async () => {
		const { getTts } = await import("./speech");
		const tts = getTts();

		mockSpeak.mockImplementation((utterance: SpeechSynthesisUtterance) => {
			utterance.onend?.(new Event("end") as SpeechSynthesisEvent);
		});

		await tts.speak("テスト");
		expect(mockSpeak).toHaveBeenCalled();
		const utterance = mockSpeak.mock.calls[0][0] as SpeechSynthesisUtterance;
		expect(utterance.lang).toBe("ja-JP");
	});

	it("should set rate and pitch", async () => {
		const { getTts } = await import("./speech");
		const tts = getTts();
		tts.setRate(0.8);
		tts.setPitch(1.2);
		// No error thrown
		expect(true).toBe(true);
	});
});
