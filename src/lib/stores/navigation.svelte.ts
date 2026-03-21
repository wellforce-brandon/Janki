export type View =
	| "dashboard"
	| "deck-review"
	| "deck-stats"
	| "kanji-detail"
	| "kanji-dashboard"
	| "kanji-radicals"
	| "kanji-kanji"
	| "kanji-vocabulary"
	| "kanji-lessons"
	| "kanji-lesson-picker"
	| "kanji-review"
	| "kanji-extra-study"
	| "kanji-levels"
	| "kanji-level"
	| "lang-overview"
	| "lang-kana"
	| "lang-vocabulary"
	| "lang-grammar"
	| "lang-sentences"
	| "lang-conjugation"
	| "lang-review"
	| "lang-lessons"
	| "lang-lesson-picker"
	| "lang-decks"
	| "lang-browse"
	| "deck-browse"
	| "search"
	| "stats"
	| "settings";

/** Legacy view aliases -- redirect to new equivalents */
const LEGACY_REDIRECTS: Record<string, View> = {
	decks: "lang-overview",
	grammar: "lang-grammar",
	reading: "lang-sentences",
	"lang-decks": "lang-overview",
	"deck-browse": "lang-overview",
	"deck-review": "lang-overview",
};

/** Maps each sidebar section to its root view for navigateBack() */
const SECTION_ROOTS: Record<string, View> = {
	"lang-overview": "lang-overview",
	"lang-kana": "lang-overview",
	"lang-vocabulary": "lang-overview",
	"lang-grammar": "lang-overview",
	"lang-sentences": "lang-overview",
	"lang-conjugation": "lang-overview",
	"lang-review": "lang-overview",
	"lang-lessons": "lang-overview",
	"lang-lesson-picker": "lang-overview",
	"lang-decks": "lang-overview",
	"lang-browse": "lang-overview",
	"deck-browse": "lang-decks",
	"deck-review": "lang-overview",
	"deck-stats": "lang-decks",
	"kanji-dashboard": "kanji-dashboard",
	"kanji-radicals": "kanji-dashboard",
	"kanji-kanji": "kanji-dashboard",
	"kanji-vocabulary": "kanji-dashboard",
	"kanji-detail": "kanji-dashboard",
	"kanji-lessons": "kanji-dashboard",
	"kanji-lesson-picker": "kanji-dashboard",
	"kanji-review": "kanji-dashboard",
	"kanji-extra-study": "kanji-dashboard",
	"kanji-levels": "kanji-dashboard",
	"kanji-level": "kanji-levels",
	search: "search",
	stats: "stats",
	settings: "settings",
	dashboard: "dashboard",
};

interface NavigationState {
	current: View;
	params: Record<string, string>;
}

let state = $state<NavigationState>({
	current: "dashboard",
	params: {},
});

export function navigate(view: View | string, params: Record<string, string> = {}) {
	const resolved = LEGACY_REDIRECTS[view] ?? view;
	state = { current: resolved as View, params };
}

/** Navigate back to the section root for the current view */
export function navigateBack() {
	const root = SECTION_ROOTS[state.current] ?? "dashboard";
	if (root !== state.current) {
		navigate(root);
	}
}

export function currentView(): View {
	return state.current;
}

export function viewParams(): Record<string, string> {
	return state.params;
}
