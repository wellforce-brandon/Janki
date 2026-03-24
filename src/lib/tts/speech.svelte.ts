export interface TtsEngine {
	speak(text: string, lang?: string): Promise<void>;
	stop(): void;
	isAvailable(): boolean;
}

/** Reactive speaking state -- use isTtsSpeaking() in Svelte components */
let speaking = $state(false);

export function isTtsSpeaking(): boolean {
	return speaking;
}

class WebSpeechTts implements TtsEngine {
	private get synth() {
		return window.speechSynthesis;
	}
	private rate = 1.0;
	private pitch = 1.0;
	private cachedVoices: SpeechSynthesisVoice[] = [];
	private voicesReady: Promise<void>;

	constructor() {
		this.voicesReady = new Promise<void>((resolve) => {
			if (!this.isAvailable()) {
				resolve();
				return;
			}

			const voices = this.synth.getVoices();
			if (voices.length > 0) {
				this.cachedVoices = voices;
				resolve();
				return;
			}

			const onVoicesChanged = () => {
				this.cachedVoices = this.synth.getVoices();
				this.synth.removeEventListener("voiceschanged", onVoicesChanged);
				resolve();
			};
			this.synth.addEventListener("voiceschanged", onVoicesChanged);

			// Timeout fallback -- resolve after 3s even if event never fires
			setTimeout(() => {
				if (this.cachedVoices.length === 0) {
					this.cachedVoices = this.synth.getVoices();
				}
				this.synth.removeEventListener("voiceschanged", onVoicesChanged);
				resolve();
			}, 3000);
		});
	}

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
		const voices = this.cachedVoices;
		// Prefer Microsoft voices (Edge/Windows), then Google, then any ja voice
		const preferred = voices.find((v) => v.lang.startsWith("ja") && v.name.includes("Microsoft"));
		if (preferred) return preferred;

		const google = voices.find((v) => v.lang.startsWith("ja") && v.name.includes("Google"));
		if (google) return google;

		return voices.find((v) => v.lang.startsWith("ja")) ?? null;
	}

	async speak(text: string, lang = "ja-JP"): Promise<void> {
		if (!this.isAvailable()) {
			throw new Error("Speech synthesis not available");
		}

		this.stop();
		await this.voicesReady;

		return new Promise((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = lang;
			utterance.rate = this.rate;
			utterance.pitch = this.pitch;

			const voice = this.getJapaneseVoice();
			if (voice) utterance.voice = voice;

			utterance.onend = () => {
				speaking = false;
				resolve();
			};
			utterance.onerror = (e) => {
				speaking = false;
				reject(e);
			};

			speaking = true;
			this.synth.speak(utterance);
		});
	}

	stop(): void {
		if (this.isAvailable()) {
			this.synth.cancel();
		}
		speaking = false;
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

export function stopSpeaking(): void {
	const tts = getTts();
	tts.stop();
}
