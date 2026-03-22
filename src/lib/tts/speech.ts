export interface TtsEngine {
	speak(text: string, lang?: string): Promise<void>;
	stop(): void;
	isAvailable(): boolean;
}

class WebSpeechTts implements TtsEngine {
	private get synth() { return window.speechSynthesis; }
	private rate = 1.0;
	private pitch = 1.0;

	setRate(rate: number) {
		this.rate = Math.max(0.1, Math.min(2.0, rate));
	}

	setPitch(pitch: number) {
		this.pitch = Math.max(0.1, Math.min(2.0, pitch));
	}

	isAvailable(): boolean {
		return "speechSynthesis" in window;
	}

	private getJapaneseVoice(): SpeechSynthesisVoice | null {
		const voices = this.synth.getVoices();
		// Prefer Microsoft voices (Edge/Windows), then Google, then any ja voice
		const preferred = voices.find((v) => v.lang.startsWith("ja") && v.name.includes("Microsoft"));
		if (preferred) return preferred;

		const google = voices.find((v) => v.lang.startsWith("ja") && v.name.includes("Google"));
		if (google) return google;

		return voices.find((v) => v.lang.startsWith("ja")) ?? null;
	}

	speak(text: string, lang = "ja-JP"): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.isAvailable()) {
				reject(new Error("Speech synthesis not available"));
				return;
			}

			this.stop();

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = lang;
			utterance.rate = this.rate;
			utterance.pitch = this.pitch;

			const voice = this.getJapaneseVoice();
			if (voice) utterance.voice = voice;

			utterance.onend = () => resolve();
			utterance.onerror = (e) => reject(e);

			this.synth.speak(utterance);
		});
	}

	stop(): void {
		if (this.isAvailable()) {
			this.synth.cancel();
		}
	}
}

// Singleton instance
let ttsInstance: WebSpeechTts | null = null;

export function getTts(): WebSpeechTts {
	if (!ttsInstance) {
		ttsInstance = new WebSpeechTts();
	}
	return ttsInstance;
}

export function speakJapanese(text: string): void {
	const tts = getTts();
	if (tts.isAvailable()) {
		tts.speak(text).catch(() => {
			// Silently fail -- TTS is optional
		});
	}
}
