<script lang="ts">
import Header from "$lib/components/layout/Header.svelte";
import Sidebar from "$lib/components/layout/Sidebar.svelte";
import ToastContainer from "$lib/components/layout/ToastContainer.svelte";
import { currentView, navigate } from "$lib/stores/navigation.svelte";
import { dismissLatest } from "$lib/stores/toast.svelte";

import Dashboard from "./views/Dashboard.svelte";
import Decks from "./views/Decks.svelte";
import Grammar from "./views/Grammar.svelte";
import KanjiDashboard from "./views/KanjiDashboard.svelte";
import KanjiLessons from "./views/KanjiLessons.svelte";
import KanjiMap from "./views/KanjiMap.svelte";
import KanjiReview from "./views/KanjiReview.svelte";
import Reading from "./views/Reading.svelte";
import Review from "./views/Review.svelte";
import Search from "./views/Search.svelte";
import Settings from "./views/Settings.svelte";
import Stats from "./views/Stats.svelte";

// Focus first heading when view changes
let prevView = $state(currentView());
$effect(() => {
	const view = currentView();
	if (view !== prevView) {
		prevView = view;
		requestAnimationFrame(() => {
			const heading = document.querySelector("main h2");
			if (heading instanceof HTMLElement) heading.focus();
		});
	}
});

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		dismissLatest();
		return;
	}
	if (!e.ctrlKey) return;
	const shortcuts: Record<string, Parameters<typeof navigate>[0]> = {
		"1": "dashboard",
		"2": "decks",
		"3": "deck-review",
		"4": "kanji-dashboard",
		"5": "grammar",
		"6": "reading",
		"7": "stats",
	};
	const view = shortcuts[e.key];
	if (view) {
		e.preventDefault();
		navigate(view);
	}
	if (e.key === "f") {
		e.preventDefault();
		navigate("search");
	}
	if (e.key === "i") {
		e.preventDefault();
		navigate("decks");
	}
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-screen">
	<Sidebar />
	<div class="flex flex-1 flex-col overflow-hidden">
		<Header />
		<main class="flex-1 overflow-y-auto p-6">
			{#if currentView() === "dashboard"}
				<Dashboard />
			{:else if currentView() === "deck-review"}
				<Review />
			{:else if currentView() === "kanji-dashboard"}
				<KanjiDashboard />
			{:else if currentView() === "kanji-map" || currentView() === "kanji-detail"}
				<KanjiMap />
			{:else if currentView() === "kanji-lessons"}
				<KanjiLessons />
			{:else if currentView() === "kanji-review"}
				<KanjiReview />
			{:else if currentView() === "decks" || currentView() === "deck-browse"}
				<Decks />
			{:else if currentView() === "grammar"}
				<Grammar />
			{:else if currentView() === "reading"}
				<Reading />
			{:else if currentView() === "stats"}
				<Stats />
			{:else if currentView() === "search"}
				<Search />
			{:else if currentView() === "settings"}
				<Settings />
			{/if}
		</main>
	</div>
</div>

<ToastContainer />
