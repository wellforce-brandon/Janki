<script lang="ts">
import Header from "$lib/components/layout/Header.svelte";
import Sidebar from "$lib/components/layout/Sidebar.svelte";
import ToastContainer from "$lib/components/layout/ToastContainer.svelte";
import { currentView, navigate, viewParams } from "$lib/stores/navigation.svelte";
import { dismissLatest } from "$lib/stores/toast.svelte";

import Dashboard from "./views/Dashboard.svelte";
import KanjiDashboard from "./views/KanjiDashboard.svelte";
import KanjiExtraStudy from "./views/KanjiExtraStudy.svelte";
import KanjiKanji from "./views/KanjiKanji.svelte";
import KanjiLessonPicker from "./views/KanjiLessonPicker.svelte";
import KanjiLessons from "./views/KanjiLessons.svelte";
import KanjiLevel from "./views/KanjiLevel.svelte";
import KanjiLevels from "./views/KanjiLevels.svelte";
import KanjiDetail from "./views/KanjiDetail.svelte";
import KanjiRadicals from "./views/KanjiRadicals.svelte";
import KanjiReview from "./views/KanjiReview.svelte";
import KanjiVocabulary from "./views/KanjiVocabulary.svelte";
import LanguageConjugation from "./views/LanguageConjugation.svelte";
import LanguageGrammar from "./views/LanguageGrammar.svelte";
import LanguageKana from "./views/LanguageKana.svelte";
import LanguageOverview from "./views/LanguageOverview.svelte";
import LanguageLessonPicker from "./views/LanguageLessonPicker.svelte";
import LanguageLessons from "./views/LanguageLessons.svelte";
import LanguageReview from "./views/LanguageReview.svelte";
import LanguageSentences from "./views/LanguageSentences.svelte";
import LanguageVocabulary from "./views/LanguageVocabulary.svelte";
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
		"2": "lang-overview",
		"3": "lang-review",
		"4": "kanji-dashboard",
		"5": "lang-grammar",
		"6": "lang-sentences",
		"7": "lang-vocabulary",
		"8": "stats",
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
			{:else if currentView() === "lang-overview"}
				<LanguageOverview />
			{:else if currentView() === "lang-vocabulary"}
				<LanguageVocabulary />
			{:else if currentView() === "lang-grammar"}
				<LanguageGrammar />
			{:else if currentView() === "lang-sentences"}
				<LanguageSentences />
			{:else if currentView() === "lang-kana"}
				<LanguageKana />
			{:else if currentView() === "lang-conjugation"}
				<LanguageConjugation />
			{:else if currentView() === "lang-review"}
				<LanguageReview />
			{:else if currentView() === "lang-lessons"}
				<LanguageLessons />
			{:else if currentView() === "lang-lesson-picker"}
				<LanguageLessonPicker />
			{:else if currentView() === "lang-decks" || currentView() === "deck-browse"}
				<LanguageOverview />
			{:else if currentView() === "kanji-dashboard"}
				<KanjiDashboard />
			{:else if currentView() === "kanji-detail"}
				<KanjiDetail itemId={Number(viewParams().id)} />
			{:else if currentView() === "kanji-radicals"}
				<KanjiRadicals />
			{:else if currentView() === "kanji-kanji"}
				<KanjiKanji />
			{:else if currentView() === "kanji-vocabulary"}
				<KanjiVocabulary />
			{:else if currentView() === "kanji-lessons"}
				<KanjiLessons />
			{:else if currentView() === "kanji-lesson-picker"}
				<KanjiLessonPicker />
			{:else if currentView() === "kanji-review"}
				<KanjiReview />
			{:else if currentView() === "kanji-extra-study"}
				<KanjiExtraStudy />
			{:else if currentView() === "kanji-levels"}
				<KanjiLevels />
			{:else if currentView() === "kanji-level"}
				<KanjiLevel />
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
