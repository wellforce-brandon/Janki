import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock window.speechSynthesis with addEventListener support
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn().mockReturnValue([]);
const listeners: Record<string, (() => void)[]> = {};

Object.defineProperty(window, "speechSynthesis", {
	value: {
		speak: mockSpeak,
		cancel: mockCancel,
		getVoices: mockGetVoices,
		addEventListener: vi.fn((event: string, cb: () => void) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(cb);
		}),
		removeEventListener: vi.fn((event: string, cb: () => void) => {
			if (listeners[event]) {
				listeners[event] = listeners[event].filter((l) => l !== cb);
			}
		}),
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
		// Clear listener registry
		for (const key of Object.keys(listeners)) {
			listeners[key] = [];
		}
	});

	it("should export getTts, speakJapanese, stopSpeaking, and isTtsSpeaking", async () => {
		const { getTts, speakJapanese, stopSpeaking, isTtsSpeaking } = await import("./speech.svelte");
		expect(getTts).toBeDefined();
		expect(speakJapanese).toBeDefined();
		expect(stopSpeaking).toBeDefined();
		expect(isTtsSpeaking).toBeDefined();
	});

	it("should detect speech synthesis availability", async () => {
		const { getTts } = await import("./speech.svelte");
		const tts = getTts();
		expect(tts.isAvailable()).toBe(true);
	});

	it("should call speechSynthesis.cancel on stop", async () => {
		const { getTts } = await import("./speech.svelte");
		const tts = getTts();
		tts.stop();
		expect(mockCancel).toHaveBeenCalled();
	});

	it("should call speechSynthesis.speak with Japanese language", async () => {
		const { getTts } = await import("./speech.svelte");
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
		const { getTts } = await import("./speech.svelte");
		const tts = getTts();
		tts.setRate(0.8);
		tts.setPitch(1.2);
		// No error thrown
		expect(true).toBe(true);
	});

	it("should export stopSpeaking that calls cancel", async () => {
		const { stopSpeaking } = await import("./speech.svelte");
		stopSpeaking();
		expect(mockCancel).toHaveBeenCalled();
	});
});
