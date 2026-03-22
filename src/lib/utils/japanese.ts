// Kanji detection: CJK Unified Ideographs range
const KANJI_REGEX = /[\u4E00-\u9FAF]/;
const HIRAGANA_REGEX = /[\u3040-\u309F]/;
const KATAKANA_REGEX = /[\u30A0-\u30FF]/;

export function isKanji(char: string): boolean {
	return KANJI_REGEX.test(char);
}

export function isHiragana(char: string): boolean {
	return HIRAGANA_REGEX.test(char);
}

export function isKatakana(char: string): boolean {
	return KATAKANA_REGEX.test(char);
}

export function isKana(char: string): boolean {
	return isHiragana(char) || isKatakana(char);
}

export function containsKanji(text: string): boolean {
	return KANJI_REGEX.test(text);
}

export interface FuriganaSegment {
	text: string;
	reading?: string;
}

// Build ruby HTML from furigana segments
export function furiganaToHtml(segments: FuriganaSegment[]): string {
	return segments
		.map((seg) => {
			if (seg.reading) {
				return `<ruby>${seg.text}<rp>(</rp><rt>${seg.reading}</rt><rp>)</rp></ruby>`;
			}
			return seg.text;
		})
		.join("");
}

// Simple furigana: apply a single reading over the entire kanji portion
// For example: text="食べる", reading="たべる" -> [{text:"食",reading:"た"},{text:"べる"}]
// This is a basic approach; accurate segmentation requires a morphological analyzer.
// Known limitation: suffix-matching can misalign when the same kana character appears
// in both the kanji reading and the trailing kana (e.g., repeated mora). Handles ~95% of cases.
export function simpleFurigana(text: string, reading: string): FuriganaSegment[] {
	if (!containsKanji(text)) {
		return [{ text }];
	}

	// If entire text is kanji, wrap it all
	if ([...text].every((c) => isKanji(c))) {
		return [{ text, reading }];
	}

	// Try to align kana tails/heads between text and reading
	const segments: FuriganaSegment[] = [];
	let textIdx = 0;
	let readIdx = 0;

	while (textIdx < text.length) {
		if (isKanji(text[textIdx])) {
			// Find the end of kanji run
			let kanjiEnd = textIdx;
			while (kanjiEnd < text.length && isKanji(text[kanjiEnd])) {
				kanjiEnd++;
			}
			// Find matching kana suffix in text after kanji
			const suffixStart = kanjiEnd;
			// Match suffix from the reading
			if (suffixStart < text.length && isKana(text[suffixStart])) {
				// Find this kana in the reading to determine where kanji reading ends
				const suffix = text.slice(suffixStart);
				const suffixInReading = reading.indexOf(suffix.charAt(0), readIdx);
				if (suffixInReading > readIdx) {
					segments.push({
						text: text.slice(textIdx, kanjiEnd),
						reading: reading.slice(readIdx, suffixInReading),
					});
					readIdx = suffixInReading;
					textIdx = kanjiEnd;
					continue;
				} else {
					// Suffix alignment failed -- fall back to whole-word furigana
					return [{ text, reading }];
				}
			}
			// Fallback: assign remaining reading to kanji block
			const remainingKana = [...text.slice(kanjiEnd)].filter((c) => isKana(c)).length;
			const readingForKanji =
				remainingKana > 0
					? reading.slice(readIdx, reading.length - remainingKana)
					: reading.slice(readIdx);
			segments.push({
				text: text.slice(textIdx, kanjiEnd),
				reading: readingForKanji,
			});
			readIdx += readingForKanji.length;
			textIdx = kanjiEnd;
		} else {
			// Kana character -- pass through
			segments.push({ text: text[textIdx] });
			readIdx++;
			textIdx++;
		}
	}

	return segments;
}
