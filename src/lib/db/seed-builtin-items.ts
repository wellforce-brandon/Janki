import { getDb, safeQuery, type QueryResult } from "./database";

interface GrammarPoint {
	id: string;
	pattern: string;
	meaning: string;
	formation: string;
	explanation: string;
	examples: { ja: string; en: string; reading: string }[];
	related_grammar: string[];
	related_kanji: string[];
	tags: string[];
}

interface GrammarFile {
	level: string;
	points: GrammarPoint[];
}

interface Sentence {
	ja: string;
	en: string;
	reading: string;
}

const sampleSentences: Record<string, Sentence[]> = {
	N5: [
		{ ja: "私は学生です。", en: "I am a student.", reading: "わたしはがくせいです。" },
		{ ja: "これは本です。", en: "This is a book.", reading: "これはほんです。" },
		{
			ja: "毎日日本語を勉強します。",
			en: "I study Japanese every day.",
			reading: "まいにちにほんごをべんきょうします。",
		},
		{
			ja: "明日友達と映画を見ます。",
			en: "I will watch a movie with a friend tomorrow.",
			reading: "あしたともだちとえいがをみます。",
		},
		{ ja: "駅はどこですか？", en: "Where is the station?", reading: "えきはどこですか？" },
		{
			ja: "朝ごはんを食べましたか？",
			en: "Did you eat breakfast?",
			reading: "あさごはんをたべましたか？",
		},
		{
			ja: "日本の食べ物は美味しいです。",
			en: "Japanese food is delicious.",
			reading: "にほんのたべものはおいしいです。",
		},
		{
			ja: "先生は優しい人です。",
			en: "The teacher is a kind person.",
			reading: "せんせいはやさしいひとです。",
		},
		{
			ja: "図書館で本を読みます。",
			en: "I read books at the library.",
			reading: "としょかんでほんをよみます。",
		},
		{
			ja: "来週東京に行きます。",
			en: "I am going to Tokyo next week.",
			reading: "らいしゅうとうきょうにいきます。",
		},
	],
	N4: [
		{
			ja: "日本語が話せるようになりたいです。",
			en: "I want to become able to speak Japanese.",
			reading: "にほんごがはなせるようになりたいです。",
		},
		{
			ja: "雨が降りそうですね。",
			en: "It looks like it's going to rain.",
			reading: "あめがふりそうですね。",
		},
		{
			ja: "漢字を覚えるのは大変です。",
			en: "Memorizing kanji is hard.",
			reading: "かんじをおぼえるのはたいへんです。",
		},
		{
			ja: "電車に乗る前に切符を買います。",
			en: "I buy a ticket before getting on the train.",
			reading: "でんしゃにのるまえにきっぷをかいます。",
		},
		{
			ja: "彼女は料理が上手です。",
			en: "She is good at cooking.",
			reading: "かのじょはりょうりがじょうずです。",
		},
		{
			ja: "窓を開けてもいいですか？",
			en: "May I open the window?",
			reading: "まどをあけてもいいですか？",
		},
		{
			ja: "薬を飲まなければなりません。",
			en: "I must take medicine.",
			reading: "くすりをのまなければなりません。",
		},
		{
			ja: "この映画は見たことがあります。",
			en: "I have seen this movie before.",
			reading: "このえいがはみたことがあります。",
		},
	],
};

export async function seedBuiltinItems(): Promise<QueryResult<{ grammar: number; sentences: number }>> {
	return safeQuery(async () => {
		const db = await getDb();

		// Check if already seeded
		const existing = await db.select<{ count: number }[]>(
			"SELECT COUNT(*) as count FROM builtin_items",
		);
		if (existing[0]?.count > 0) {
			return { grammar: 0, sentences: 0 };
		}

		let grammarCount = 0;
		let sentenceCount = 0;

		// Seed grammar points from JSON files
		try {
			const response = await fetch("/data/grammar/n5.json");
			if (response.ok) {
				const data: GrammarFile = await response.json();
				for (const point of data.points) {
					await db.execute(
						`INSERT OR IGNORE INTO builtin_items (content_type, item_key, data, jlpt_level)
						 VALUES ('grammar', ?, ?, ?)`,
						[
							point.id,
							JSON.stringify({
								pattern: point.pattern,
								meaning: point.meaning,
								formation: point.formation,
								explanation: point.explanation,
								examples: point.examples,
								related_grammar: point.related_grammar,
								related_kanji: point.related_kanji,
								tags: point.tags,
							}),
							data.level,
						],
					);
					grammarCount++;
				}
			}
		} catch (e) {
			console.warn("Failed to load grammar data for seeding:", e);
		}

		// Seed reading sentences
		for (const [level, sentences] of Object.entries(sampleSentences)) {
			for (let i = 0; i < sentences.length; i++) {
				const sentence = sentences[i];
				await db.execute(
					`INSERT OR IGNORE INTO builtin_items (content_type, item_key, data, jlpt_level)
					 VALUES ('sentence', ?, ?, ?)`,
					[
						`reading-${level.toLowerCase()}-${String(i).padStart(3, "0")}`,
						JSON.stringify({
							ja: sentence.ja,
							en: sentence.en,
							reading: sentence.reading,
						}),
						level,
					],
				);
				sentenceCount++;
			}
		}

		return { grammar: grammarCount, sentences: sentenceCount };
	});
}
