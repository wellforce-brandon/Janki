import { getKanaScriptLabel } from "$lib/data/kana-groups";
import type { LanguageItem } from "$lib/db/queries/language";

/** Get display label for a content type. For kana items, shows Hiragana/Katakana. */
export function getTypeLabel(type: string, item?: LanguageItem): string {
	if (type === "kana" && item) {
		return getKanaScriptLabel(item.primary_text);
	}
	const labels: Record<string, string> = {
		kana: "Kana",
		vocabulary: "Vocabulary",
		grammar: "Grammar",
		sentence: "Sentence",
		conjugation: "Conjugation",
	};
	return labels[type] ?? type;
}

/** Get the Tailwind background color class for a content type. */
export function getTypeColor(type: string): string {
	const colors: Record<string, string> = {
		kana: "bg-teal-500",
		vocabulary: "bg-purple-500",
		grammar: "bg-amber-500",
		sentence: "bg-blue-500",
		conjugation: "bg-rose-500",
	};
	return colors[type] ?? "bg-gray-500";
}
