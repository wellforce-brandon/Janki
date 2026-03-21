<script lang="ts">
import Badge from "$lib/components/ui/badge/badge.svelte";
import type { PronunciationAudio } from "$lib/utils/kanji";

interface Props {
	audios: PronunciationAudio[];
}

let { audios }: Props = $props();

let playingUrl = $state<string | null>(null);
let audioError = $state(false);

// Group by voice actor, prefer webm format
let voiceActors = $derived(() => {
	const map = new Map<number, PronunciationAudio>();
	for (const audio of audios) {
		const existing = map.get(audio.metadata.voice_actor_id);
		if (!existing || audio.content_type === "audio/webm") {
			map.set(audio.metadata.voice_actor_id, audio);
		}
	}
	return Array.from(map.values()).sort(
		(a, b) => a.metadata.voice_actor_id - b.metadata.voice_actor_id,
	);
});

function play(audio: PronunciationAudio) {
	audioError = false;
	playingUrl = audio.url;
	const el = new Audio(audio.url);
	el.onended = () => (playingUrl = null);
	el.onerror = () => {
		playingUrl = null;
		audioError = true;
	};
	el.play().catch(() => {
		playingUrl = null;
		audioError = true;
	});
}
</script>

{#if audios.length > 0}
	<div class="rounded-lg border bg-card p-4 space-y-3">
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-medium text-muted-foreground">Audio</h3>
			<Badge variant="outline" class="text-xs">Requires internet</Badge>
		</div>

		<div class="flex gap-3">
			{#each voiceActors() as audio}
				<button
					type="button"
					class="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
					onclick={() => play(audio)}
					disabled={playingUrl !== null}
					aria-label="Play {audio.metadata.voice_actor_name} pronunciation"
				>
					<span class="text-lg">{playingUrl === audio.url ? "&#9632;" : "&#9654;"}</span>
					<div class="text-left">
						<div class="font-medium">{audio.metadata.voice_actor_name}</div>
						<div class="text-xs text-muted-foreground">
							{audio.metadata.voice_description}, {audio.metadata.gender}
						</div>
					</div>
				</button>
			{/each}
		</div>

		{#if audioError}
			<p class="text-xs text-destructive">Audio unavailable. Check your internet connection.</p>
		{/if}
	</div>
{/if}
