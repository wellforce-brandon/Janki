type View =
	| "dashboard"
	| "review"
	| "kanji"
	| "kanji-detail"
	| "decks"
	| "deck-browse"
	| "search"
	| "stats"
	| "settings";

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

export function currentView(): View {
	return state.current;
}

export function viewParams(): Record<string, string> {
	return state.params;
}
