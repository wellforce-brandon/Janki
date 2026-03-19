export type View =
	| "dashboard"
	| "deck-review"
	| "deck-stats"
	| "kanji-map"
	| "kanji-detail"
	| "kanji-dashboard"
	| "kanji-lessons"
	| "kanji-review"
	| "decks"
	| "deck-browse"
	| "search"
	| "stats"
	| "grammar"
	| "reading"
	| "settings";

/** Maps each sidebar section to its root view for navigateBack() */
const SECTION_ROOTS: Record<string, View> = {
	decks: "decks",
	"deck-browse": "decks",
	"deck-review": "decks",
	"deck-stats": "decks",
	"kanji-dashboard": "kanji-dashboard",
	"kanji-map": "kanji-dashboard",
	"kanji-detail": "kanji-dashboard",
	"kanji-lessons": "kanji-dashboard",
	"kanji-review": "kanji-dashboard",
	grammar: "grammar",
	reading: "reading",
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

export function navigate(view: View, params: Record<string, string> = {}) {
	state = { current: view, params };
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
