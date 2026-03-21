import type { CardWithContent } from "../db/queries/cards";
import {
	getDueBuiltinItems,
	getDueCardsByContentType,
	getNewBuiltinItems,
	getNewCardsByContentType,
	type BuiltinItem,
	type DueCardWithType,
} from "../db/queries/language";
import type { ContentType } from "../import/content-classifier";

/**
 * Unified review item that can represent either a deck card or a builtin item.
 * ReviewSession uses this shape to render cards from both sources.
 */
export interface UnifiedReviewItem {
	/** Unique key: "card-{id}" or "builtin-{id}" */
	key: string;
	source: "card" | "builtin";
	sourceId: number;
	contentType: string;

	// FSRS state
	stability: number;
	difficulty: number;
	due: string;
	last_review: string | null;
	reps: number;
	lapses: number;
	state: number;
	scheduled_days: number;
	elapsed_days: number;

	// Display content
	fields: Record<string, string>;
	frontHtml: string;
	backHtml: string;
	css: string | null;
}

export interface UnifiedReviewQueue {
	items: UnifiedReviewItem[];
	dueCount: number;
	newCount: number;
}

/**
 * Build a unified review queue from both card and builtin sources,
 * optionally filtered by content type.
 */
export async function getLanguageReviewQueue(
	contentTypeFilter?: ContentType,
	newCardLimit = 20,
	reviewLimit = 200,
): Promise<UnifiedReviewQueue> {
	// Fetch due items from both sources in parallel
	const [dueCardsResult, dueBuiltinsResult] = await Promise.all([
		getDueCardsByContentType(contentTypeFilter, reviewLimit),
		getDueBuiltinItems(contentTypeFilter, reviewLimit),
	]);

	const dueCards = dueCardsResult.ok ? dueCardsResult.data : [];
	const dueBuiltins = dueBuiltinsResult.ok ? dueBuiltinsResult.data : [];

	const dueItems = [
		...dueCards.map(cardToUnified),
		...dueBuiltins.map(builtinToUnified),
	].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
		.slice(0, reviewLimit);

	// Fill remaining slots with new items
	const remainingSlots = Math.max(0, reviewLimit - dueItems.length);
	const newLimit = Math.min(newCardLimit, remainingSlots);

	const [newCardsResult, newBuiltinsResult] = await Promise.all([
		getNewCardsByContentType(contentTypeFilter, newLimit),
		getNewBuiltinItems(contentTypeFilter, newLimit),
	]);

	const newCards = newCardsResult.ok ? newCardsResult.data : [];
	const newBuiltins = newBuiltinsResult.ok ? newBuiltinsResult.data : [];

	const newItems = [
		...newCards.map(cardToUnified),
		...newBuiltins.map(builtinToUnified),
	].slice(0, newLimit);

	return {
		items: [...dueItems, ...newItems],
		dueCount: dueItems.length,
		newCount: newItems.length,
	};
}

function cardToUnified(card: DueCardWithType): UnifiedReviewItem {
	let fields: Record<string, string> = {};
	try {
		fields = JSON.parse(card.fields);
	} catch { /* empty */ }

	let frontHtml = "";
	let backHtml = "";
	try {
		const templates = JSON.parse(card.card_templates) as { front: string; back: string }[];
		const tmpl = templates[card.template_index] ?? templates[0];
		if (tmpl) {
			frontHtml = tmpl.front;
			backHtml = tmpl.back;
		}
	} catch { /* empty */ }

	return {
		key: `card-${card.id}`,
		source: "card",
		sourceId: card.id,
		contentType: card.content_type,
		stability: card.stability,
		difficulty: card.difficulty,
		due: card.due,
		last_review: card.last_review,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state,
		scheduled_days: card.scheduled_days,
		elapsed_days: card.elapsed_days,
		fields,
		frontHtml,
		backHtml,
		css: card.css,
	};
}

function builtinToUnified(item: BuiltinItem): UnifiedReviewItem {
	let data: Record<string, string> = {};
	try {
		data = JSON.parse(item.data);
	} catch { /* empty */ }

	const { front, back } = buildBuiltinTemplates(item.content_type, data);

	return {
		key: `builtin-${item.id}`,
		source: "builtin",
		sourceId: item.id,
		contentType: item.content_type,
		stability: item.stability,
		difficulty: item.difficulty,
		due: item.due,
		last_review: item.last_review,
		reps: item.reps,
		lapses: item.lapses,
		state: item.state,
		scheduled_days: item.scheduled_days,
		elapsed_days: item.elapsed_days,
		fields: data,
		frontHtml: front,
		backHtml: back,
		css: null,
	};
}

/** Build default front/back HTML for builtin items per content type */
function buildBuiltinTemplates(
	contentType: string,
	data: Record<string, string>,
): { front: string; back: string } {
	switch (contentType) {
		case "grammar": {
			const pattern = data.pattern ?? "";
			const formation = data.formation ?? "";
			const meaning = data.meaning ?? "";
			const explanation = data.explanation ?? "";
			const examples = data.examples ?? "";

			let examplesHtml = "";
			try {
				const exArr = JSON.parse(examples);
				if (Array.isArray(exArr)) {
					examplesHtml = exArr
						.map((ex: { ja?: string; en?: string; reading?: string }) =>
							`<div class="mt-2"><p class="text-lg">${ex.ja ?? ""}</p>${ex.reading ? `<p class="text-sm text-muted-foreground">${ex.reading}</p>` : ""}${ex.en ? `<p class="text-sm">${ex.en}</p>` : ""}</div>`,
						)
						.join("");
				}
			} catch { /* not JSON, render as-is */ }

			return {
				front: `<div class="text-2xl font-bold">${pattern}</div>${formation ? `<div class="mt-2 text-sm">${formation}</div>` : ""}`,
				back: `<div class="text-lg font-medium">${meaning}</div>${explanation ? `<div class="mt-2 text-sm">${explanation}</div>` : ""}${examplesHtml}`,
			};
		}

		case "sentence": {
			const japanese = data.japanese ?? data.sentence ?? data.ja ?? "";
			const reading = data.reading ?? "";
			const translation = data.translation ?? data.english ?? data.en ?? "";

			return {
				front: `<div class="text-2xl">${japanese}</div>`,
				back: `${reading ? `<div class="text-lg">${reading}</div>` : ""}<div class="mt-2">${translation}</div>`,
			};
		}

		default: {
			// Generic: show first field as front, rest as back
			const entries = Object.entries(data);
			const front = entries[0] ? `<div class="text-2xl">${entries[0][1]}</div>` : "";
			const back = entries
				.slice(1)
				.map(([k, v]) => `<div><span class="text-sm font-medium">${k}:</span> ${v}</div>`)
				.join("");
			return { front, back };
		}
	}
}
