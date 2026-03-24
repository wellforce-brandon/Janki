<script lang="ts">
	import { ChevronLeft, ChevronRight } from "@lucide/svelte";
	import {
		getAllLanguageLevelProgress,
		getLanguageLevelItems,
		getLanguageLevelProgressByType,
		getLanguageUserLevel,
		type LanguageLevelItem,
		type LanguageLevelProgressByType,
		type LanguageLevelProgress,
	} from "$lib/db/queries/language";
	import { STAGE_NAMES } from "$lib/srs/wanikani-srs";
	import { getStageDots } from "$lib/utils/kanji";
	import { navigate } from "$lib/stores/navigation.svelte";

	interface Props {
		userLevel: number;
	}

	let { userLevel }: Props = $props();

	type ViewMode = "summary" | "type-detail" | "level-picker";

	// eslint-disable-next-line svelte/valid-compile -- intentional: capture initial value for local browsing
	let selectedLevel = $state(userLevel);
	let progressByType = $state<LanguageLevelProgressByType[]>([]);
	let allItems = $state<LanguageLevelItem[]>([]);
	let loading = $state(false);
	let fetchId = 0;

	let viewMode = $state<ViewMode>("summary");
	let expandedType = $state("vocabulary");

	let levelPickerData = $state<LanguageLevelProgress[]>([]);
	let levelPickerUserLevel = $state(1);
	let levelPickerLoading = $state(false);

	const TYPE_CONFIG = [
		{ key: "kana", label: "Kana", icon: "bg-teal-500 dark:bg-teal-600", border: "border-teal-200 dark:border-teal-800" },
		{ key: "grammar", label: "Grammar", icon: "bg-amber-500 dark:bg-amber-600", border: "border-amber-200 dark:border-amber-800" },
		{ key: "vocabulary", label: "Vocabulary", icon: "bg-purple-500 dark:bg-purple-600", border: "border-purple-200 dark:border-purple-800" },
		{ key: "conjugation", label: "Conjugation", icon: "bg-rose-500 dark:bg-rose-600", border: "border-rose-200 dark:border-rose-800" },
		{ key: "sentence", label: "Sentences", icon: "bg-blue-500 dark:bg-blue-600", border: "border-blue-200 dark:border-blue-800" },
	] as const;

	function getTypeProgress(type: string) {
		return progressByType.find((p) => p.content_type === type) ?? { total: 0, guru_plus: 0, unlocked: 0 };
	}

	let typeCards = $derived(
		TYPE_CONFIG.map((cfg) => {
			const data = getTypeProgress(cfg.key);
			return { ...cfg, guru: data.guru_plus, total: data.total };
		}).filter((c) => c.total > 0),
	);

	let isLevelLocked = $derived(progressByType.every((p) => p.unlocked === 0));

	let vocabNeeded = $derived(() => {
		const vocab = getTypeProgress("vocabulary");
		return Math.max(0, Math.ceil(vocab.total * 0.9) - vocab.guru_plus);
	});

	let expandedItems = $derived(allItems.filter((i) => i.content_type === expandedType));
	let expandedGuruCount = $derived(expandedItems.filter((i) => i.srs_stage >= 5).length);

	function getBlockColor(stage: number): string {
		if (stage === 0) return "bg-muted";
		if (stage <= 4) return "bg-pink-400 dark:bg-pink-500";
		if (stage <= 6) return "bg-green-500 dark:bg-green-400";
		if (stage === 7) return "bg-blue-400 dark:bg-blue-300";
		if (stage === 8) return "bg-yellow-400 dark:bg-yellow-300";
		return "bg-zinc-600 dark:bg-zinc-500";
	}

	function getTypeColor(type: string): string {
		const colors: Record<string, string> = {
			kana: "bg-teal-500",
			vocabulary: "bg-purple-500",
			grammar: "bg-amber-500",
			sentence: "bg-blue-500",
			conjugation: "bg-rose-500",
		};
		return colors[type] ?? "bg-gray-500";
	}

	function getTileClasses(item: LanguageLevelItem): string {
		if (item.srs_stage === 0) return "border-2 border-dashed border-muted-foreground/30 bg-transparent text-muted-foreground/50";
		if (item.srs_stage === 9) return "bg-zinc-700 dark:bg-zinc-600 text-zinc-300 border border-transparent";
		if (!item.lesson_completed_at) return "bg-pink-500/30 dark:bg-pink-400/30 text-pink-600 dark:text-pink-400 border border-pink-500/50";
		if (item.srs_stage <= 4) return "bg-pink-500 dark:bg-pink-600 text-white border border-transparent";
		if (item.srs_stage <= 6) return "bg-purple-500 dark:bg-purple-600 text-white border border-transparent";
		if (item.srs_stage === 7) return "bg-blue-500 dark:bg-blue-600 text-white border border-transparent";
		if (item.srs_stage === 8) return "bg-sky-500 dark:bg-sky-600 text-white border border-transparent";
		return "bg-muted text-muted-foreground border border-transparent";
	}

	function handleTypeClick(key: string) {
		expandedType = key;
		viewMode = "type-detail";
	}

	async function openLevelPicker() {
		viewMode = "level-picker";
		if (levelPickerData.length > 0) return;
		levelPickerLoading = true;
		const [progressR, levelR] = await Promise.all([getAllLanguageLevelProgress(), getLanguageUserLevel()]);
		if (progressR.ok) levelPickerData = progressR.data;
		if (levelR.ok) levelPickerUserLevel = levelR.data;
		levelPickerLoading = false;
	}

	function pickLevel(level: number) {
		selectedLevel = level;
		viewMode = "summary";
	}

	function getPickerLevelClasses(level: number): string {
		const progress = levelPickerData.find((p) => p.level === level);
		if (level === levelPickerUserLevel) return "bg-primary text-primary-foreground font-bold";
		if (progress && progress.percentage >= 90) return "bg-green-500 dark:bg-green-600 text-white font-semibold";
		if (progress && progress.unlocked > 0) return "bg-accent text-accent-foreground font-medium";
		return "bg-muted text-muted-foreground";
	}

	function getPickerProgress(level: number): number {
		const p = levelPickerData.find((lp) => lp.level === level);
		return p?.percentage ?? 0;
	}

	async function loadLevel(level: number) {
		const id = ++fetchId;
		loading = true;
		const [progressR, itemsR] = await Promise.all([
			getLanguageLevelProgressByType(level),
			getLanguageLevelItems(level),
		]);
		if (id !== fetchId) return;
		if (progressR.ok) progressByType = progressR.data;
		if (itemsR.ok) allItems = itemsR.data;
		loading = false;
	}

	$effect(() => { loadLevel(selectedLevel); });
</script>

<div class="rounded-lg border bg-card p-5">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<h3 class="font-medium">Level Progress</h3>
		<div class="flex items-center gap-1">
			{#if selectedLevel > 1}
				<button type="button" class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" onclick={() => { selectedLevel--; viewMode = "summary"; }} aria-label="Previous level">
					<ChevronLeft class="h-4 w-4" />
				</button>
			{/if}
			<button type="button" class="rounded px-2 py-0.5 text-sm font-medium hover:bg-accent transition-colors" onclick={openLevelPicker} aria-label="View all levels">
				Level {selectedLevel}
			</button>
			{#if selectedLevel < 60}
				<button type="button" class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" onclick={() => { selectedLevel++; viewMode = "summary"; }} aria-label="Next level">
					<ChevronRight class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if loading && progressByType.length === 0}
		<div class="py-6 text-center text-sm text-muted-foreground">Loading...</div>

	{:else if viewMode === "level-picker"}
		{#if levelPickerLoading}
			<div class="py-6 text-center text-sm text-muted-foreground">Loading levels...</div>
		{:else}
			<div class="max-h-72 overflow-y-auto">
				<div class="grid grid-cols-9 gap-1.5">
					{#each { length: 60 } as _, i}
						{@const lvl = i + 1}
						{@const pct = getPickerProgress(lvl)}
						<button
							type="button"
							class="group relative flex flex-col items-center justify-center rounded-md p-2 transition-all hover:brightness-110 {getPickerLevelClasses(lvl)} {lvl === selectedLevel ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}"
							onclick={() => pickLevel(lvl)}
							aria-label="Level {lvl}{pct > 0 ? `, ${pct}% complete` : ''}"
						>
							<span class="text-xs">{String(lvl).padStart(2, "0")}</span>
							{#if pct > 0}
								<div class="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-black/20">
									<div class="h-full rounded-full bg-white/70" style="width: {pct}%"></div>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/if}

	{:else if viewMode === "summary"}
		<p class="mb-3 text-sm text-muted-foreground">
			Number of items <span class="font-semibold text-foreground">Guru</span>'d in this level.
		</p>
		<div class="grid gap-3" style="grid-template-columns: repeat({Math.min(typeCards.length, 5)}, 1fr)">
			{#each typeCards as card}
				<button type="button" class="rounded-lg border {card.border} p-3 text-center transition-colors hover:bg-muted" onclick={() => handleTypeClick(card.key)}>
					<div class="mx-auto mb-1.5 flex items-center justify-center gap-1.5">
						<span class="inline-block h-4 w-4 rounded {card.icon}"></span>
						<span class="text-xs font-medium">{card.label}</span>
					</div>
					<div class="text-lg font-bold">{card.guru}/{card.total}</div>
					<div class="mt-1 text-xs text-muted-foreground">See All &rsaquo;</div>
				</button>
			{/each}
		</div>
		<!-- Level-up status -->
		<div class="mt-4">
			{#if isLevelLocked}
				<div class="rounded-md bg-accent/50 p-3">
					<p class="text-sm text-muted-foreground">You haven't unlocked this level yet. Do your Language Lessons and Reviews to level up!</p>
				</div>
			{:else if vocabNeeded() > 0}
				<p class="mb-2 text-sm text-muted-foreground">
					Guru <span class="font-semibold text-foreground">{vocabNeeded()}</span> more vocabulary to level up.
				</p>
				<div class="flex flex-wrap gap-1">
					{#each allItems.filter((i) => i.content_type === "vocabulary") as item}
						<div class="h-3.5 w-3.5 rounded-sm {getBlockColor(item.srs_stage)}" title={item.primary_text}></div>
					{/each}
				</div>
			{:else}
				{@const totalVocab = getTypeProgress("vocabulary").total}
				{#if totalVocab > 0}
					<p class="text-sm font-medium text-green-500 dark:text-green-400">Level complete!</p>
				{/if}
			{/if}
		</div>

	{:else if viewMode === "type-detail"}
		<div class="flex items-center justify-between mb-3">
			<button type="button" class="text-sm text-muted-foreground hover:text-foreground transition-colors" onclick={() => viewMode = "summary"}>
				&larr; Back
			</button>
			<span class="text-sm font-medium text-muted-foreground">
				{expandedGuruCount}/{expandedItems.length} items <span class="font-semibold text-foreground">Guru</span>'d
			</span>
		</div>
		<div class="max-h-72 overflow-y-auto">
			<div class="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
				{#each expandedItems as item}
					{@const dots = getStageDots(item.srs_stage)}
					<button type="button" class="flex flex-col items-center rounded-lg p-2 transition-all hover:brightness-110 {getTileClasses(item)}" onclick={() => navigate("lang-item-detail", { id: String(item.id), contentType: item.content_type })} aria-label="{item.primary_text} - {item.meaning ?? ''}">
						<span class="text-base font-bold leading-tight">{item.primary_text}</span>
						{#if item.reading}
							<span class="mt-0.5 truncate text-[10px] leading-tight opacity-80 max-w-full">{item.reading}</span>
						{/if}
						<span class="mt-0.5 max-w-full truncate text-[10px] leading-tight opacity-70">
							{item.meaning ? (item.meaning.length > 20 ? item.meaning.slice(0, 18) + "..." : item.meaning) : ""}
						</span>
						{#if item.srs_stage > 0 && item.srs_stage < 9}
							<div class="mt-1 flex gap-0.5">
								{#each { length: dots.total } as _, i}
									<div class="h-0.5 w-2 rounded-full {i < dots.filled ? 'bg-green-400' : 'bg-current opacity-30'}"></div>
								{/each}
							</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
