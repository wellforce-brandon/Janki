// Romaji-to-hiragana converter for review input fields.
// Converts standard romaji syllables in real-time as the user types.

const ROMAJI_MAP: Record<string, string> = {
	a: "あ",
	i: "い",
	u: "う",
	e: "え",
	o: "お",
	ka: "か",
	ki: "き",
	ku: "く",
	ke: "け",
	ko: "こ",
	sa: "さ",
	si: "し",
	shi: "し",
	su: "す",
	se: "せ",
	so: "そ",
	ta: "た",
	ti: "ち",
	chi: "ち",
	tu: "つ",
	tsu: "つ",
	te: "て",
	to: "と",
	na: "な",
	ni: "に",
	nu: "ぬ",
	ne: "ね",
	no: "の",
	ha: "は",
	hi: "ひ",
	hu: "ふ",
	fu: "ふ",
	he: "へ",
	ho: "ほ",
	ma: "ま",
	mi: "み",
	mu: "む",
	me: "め",
	mo: "も",
	ya: "や",
	yu: "ゆ",
	yo: "よ",
	ra: "ら",
	ri: "り",
	ru: "る",
	re: "れ",
	ro: "ろ",
	wa: "わ",
	wi: "ゐ",
	we: "ゑ",
	wo: "を",
	// nn handled specially in converter logic
	ga: "が",
	gi: "ぎ",
	gu: "ぐ",
	ge: "げ",
	go: "ご",
	za: "ざ",
	zi: "じ",
	ji: "じ",
	zu: "ず",
	ze: "ぜ",
	zo: "ぞ",
	da: "だ",
	di: "ぢ",
	du: "づ",
	de: "で",
	do: "ど",
	ba: "ば",
	bi: "び",
	bu: "ぶ",
	be: "べ",
	bo: "ぼ",
	pa: "ぱ",
	pi: "ぴ",
	pu: "ぷ",
	pe: "ぺ",
	po: "ぽ",
	kya: "きゃ",
	kyi: "きぃ",
	kyu: "きゅ",
	kye: "きぇ",
	kyo: "きょ",
	sha: "しゃ",
	shu: "しゅ",
	she: "しぇ",
	sho: "しょ",
	sya: "しゃ",
	syu: "しゅ",
	syo: "しょ",
	cha: "ちゃ",
	chu: "ちゅ",
	che: "ちぇ",
	cho: "ちょ",
	tya: "ちゃ",
	tyu: "ちゅ",
	tyo: "ちょ",
	nya: "にゃ",
	nyi: "にぃ",
	nyu: "にゅ",
	nye: "にぇ",
	nyo: "にょ",
	hya: "ひゃ",
	hyi: "ひぃ",
	hyu: "ひゅ",
	hye: "ひぇ",
	hyo: "ひょ",
	mya: "みゃ",
	myi: "みぃ",
	myu: "みゅ",
	mye: "みぇ",
	myo: "みょ",
	rya: "りゃ",
	ryi: "りぃ",
	ryu: "りゅ",
	rye: "りぇ",
	ryo: "りょ",
	gya: "ぎゃ",
	gyi: "ぎぃ",
	gyu: "ぎゅ",
	gye: "ぎぇ",
	gyo: "ぎょ",
	ja: "じゃ",
	ju: "じゅ",
	je: "じぇ",
	jo: "じょ",
	jya: "じゃ",
	jyu: "じゅ",
	jyo: "じょ",
	bya: "びゃ",
	byi: "びぃ",
	byu: "びゅ",
	bye: "びぇ",
	byo: "びょ",
	pya: "ぴゃ",
	pyi: "ぴぃ",
	pyu: "ぴゅ",
	pye: "ぴぇ",
	pyo: "ぴょ",
	// Small kana
	xa: "ぁ",
	xi: "ぃ",
	xu: "ぅ",
	xe: "ぇ",
	xo: "ぉ",
	xya: "ゃ",
	xyu: "ゅ",
	xyo: "ょ",
	xtu: "っ",
	xtsu: "っ",
	// Special
	"-": "ー",
};

// Pre-built set of all valid prefixes of ROMAJI_MAP keys for O(1) lookup
const VALID_PREFIXES = new Set<string>();
for (const key of Object.keys(ROMAJI_MAP)) {
	for (let i = 1; i <= key.length; i++) {
		VALID_PREFIXES.add(key.slice(0, i));
	}
}

// Check if a romaji prefix could still become a valid syllable
function isValidPrefix(prefix: string): boolean {
	if (prefix.length === 0) return false;
	if (VALID_PREFIXES.has(prefix)) return true;
	// Double consonant prefix (e.g., "kk" -> っ + "k")
	if (prefix.length >= 2 && prefix[0] === prefix[1] && prefix[0] !== "n" && prefix[0] !== "a") {
		return true;
	}
	return false;
}

/**
 * Convert a romaji string to hiragana.
 * Used for real-time input conversion in review fields.
 */
export function romajiToHiragana(input: string): string {
	let result = "";
	let buffer = "";
	const lower = input.toLowerCase();

	for (let i = 0; i < lower.length; i++) {
		const ch = lower[i];
		buffer += ch;

		// Handle "n" before consonant or end -> ん
		if (buffer === "n" && i + 1 < lower.length) {
			const next = lower[i + 1];
			if (
				next !== "y" &&
				next !== "a" &&
				next !== "i" &&
				next !== "u" &&
				next !== "e" &&
				next !== "o" &&
				next !== "n"
			) {
				result += "ん";
				buffer = "";
				continue;
			}
		}

		// Double consonant handling
		if (
			buffer.length === 2 &&
			buffer[0] === buffer[1] &&
			/[a-z]/.test(buffer[0]) &&
			!"aiueo".includes(buffer[0])
		) {
			if (buffer[0] === "n") {
				// "nn" -> ん, keep second n in buffer for potential na/ni/etc.
				result += "ん";
				buffer = "n";
				// Don't continue -- let the n-before-consonant rule check on next iteration
				continue;
			}
			result += "っ";
			buffer = buffer[1];
			// Don't continue -- fall through to check if single char maps
		}

		// Check for exact match
		if (ROMAJI_MAP[buffer]) {
			result += ROMAJI_MAP[buffer];
			buffer = "";
			continue;
		}

		// If current buffer is a valid prefix, keep accumulating
		if (isValidPrefix(buffer)) {
			continue;
		}

		// Buffer doesn't match anything -- output as-is and restart
		if (buffer.length > 1) {
			// Try to output what we had minus the last char, then retry with last char
			const prev = buffer.slice(0, -1);
			if (ROMAJI_MAP[prev]) {
				result += ROMAJI_MAP[prev];
			} else {
				result += prev;
			}
			buffer = ch;
			// Check if the single char maps
			if (ROMAJI_MAP[buffer]) {
				result += ROMAJI_MAP[buffer];
				buffer = "";
			} else if (!isValidPrefix(buffer)) {
				result += buffer;
				buffer = "";
			}
		} else if (!isValidPrefix(buffer)) {
			result += buffer;
			buffer = "";
		}
	}

	// Handle trailing "n" -> ん
	if (buffer === "n") {
		result += "ん";
		buffer = "";
	}

	// Flush remaining buffer
	if (buffer.length > 0) {
		if (ROMAJI_MAP[buffer]) {
			result += ROMAJI_MAP[buffer];
		} else {
			result += buffer;
		}
	}

	return result;
}
