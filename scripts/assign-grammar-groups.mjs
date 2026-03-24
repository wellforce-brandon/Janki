/**
 * Grammar lesson_group Assignment Script
 *
 * Assigns lesson_group to all grammar items in grammar.json based on:
 * 1. context_notes section names (Tae Kim items with notes)
 * 2. Pattern-based categorization (JLPT deck grammar patterns)
 * 3. Explanation text analysis (Tae Kim example sentences)
 * 4. Question topic extraction (exercise items)
 *
 * Usage: node scripts/assign-grammar-groups.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";

const GRAMMAR_PATH = "public/data/language/grammar.json";
const REPORT_DIR = "scripts/reports";

// ── Grammar Group Definitions ──────────────────────────────────────────────
// Ordered by specificity (most specific patterns first)

const PATTERN_RULES = [
  // Sentence-ending particles & markers
  {
    group: "Sentence-ending Particles",
    patterns: [
      /^[〜~]?[よねわ]$/,
      /^[〜~]?なあ/,
      /^[〜~]?かな$/,
      /^[〜~]?っけ$/,
      /^[〜~]?だい$/,
      /^[〜~]?かい/,
      /^[〜~]?もの$/,
      /^[〜~]?ものか$/,
      /^って$/,
      /^ってば$/,
    ],
  },

  // Copula & state of being
  {
    group: "Copula & State of Being",
    patterns: [
      /^〜?だ$/,
      /^〜?です$/,
      /^〜?である$/,
      /^〜?であろう/,
      /^〜?でしょう/,
      /^〜?だろう$/,
      /^〜?でなくて/,
      /じゃない/,
      /だった/,
    ],
    keywords: ["copula", "state-of-being", "state of being"],
  },

  // Te-form patterns
  {
    group: "Te-form Patterns",
    patterns: [
      /て形/,
      /^〜?て$/,
      /^〜?てこそ/,
      /^〜?ては$/,
      /^〜?てはいられない/,
      /^〜?てまで/,
      /てから/,
      /てしょうがない/,
      /てたまらない/,
      /てならない/,
      /てやがる/,
      /て以来/,
      /て初めて/,
      /てもいい/,
      /^〜?てこの/,
      /^〜?てからというもの/,
    ],
  },

  // Compound verbs (verb + verb)
  {
    group: "Compound Verbs",
    patterns: [
      /^[〜~]?始める/,
      /^[〜~]?続ける/,
      /^[〜~]?出す$/,
      /^[〜~]?直す/,
      /^[〜~]?切る$/,
      /^[〜~]?込む$/,
      /^[〜~]?上げる$/,
      /^[〜~]?こなす/,
      /^[〜~]?ぬく$/,
      /^stem\s*\+/i,
      /合う$/,
      /掛[かけ]/,
      /見せる$/,
      /^-方$/,
      /やり方/,
      /にくい$/,
      /やすい$/,
    ],
  },

  // Desire & volition
  {
    group: "Desire & Volition",
    patterns: [
      /^〜?たい$/,
      /欲しい/,
      /つもり/,
      /意向形/,
      /^〜?よう$/,
      /ようとする/,
      /ようがない/,
      /ようもない/,
      /ようにも/,
      /ようではないか/,
      /ような気がする/,
      /予定/,
    ],
    keywords: ["want to", "intend", "plan to"],
  },

  // Conditional forms
  {
    group: "Conditional Forms",
    patterns: [
      /^〜?たら$/,
      /^〜?なら$/,
      /条件形/,
      /^〜?ば$/,
      /さえ〜ば/,
      /としたら/,
      /とすれば/,
      /とすると/,
      /〜としても/,
      /ようが.*ようと/,
      /これ以上〜ば/,
    ],
    keywords: ["conditional", "if "],
  },

  // Honorifics & politeness
  {
    group: "Honorific & Polite Speech",
    patterns: [
      /致します/,
      /頂[きく]/,
      /下さい/,
      /なさい/,
      /ちょうだい/,
      /お茶を濁す/,
      /伝えていただけませんか/,
    ],
    keywords: ["polite", "honorif", "humble", "please"],
  },

  // Obligation & prohibition
  {
    group: "Obligation & Prohibition",
    patterns: [
      /なければならない/,
      /なければなりません/,
      /せねばならない/,
      /なくちゃ/,
      /べき/,
      /べからず/,
      /べからざる/,
      /べく$/,
      /まじき/,
      /てはいけない/,
      /なくてもすむ/,
      /わけには.*いかない/,
    ],
    keywords: ["must", "have to", "should", "obligation", "prohibit"],
  },

  // Appearance & hearsay
  {
    group: "Appearance & Hearsay",
    patterns: [
      /^〜?そう$/,
      /そうもない/,
      /らしい$/,
      /みたい$/,
      /ようだ/,
      /のような/,
      /ごとく/,
      /ごとき/,
      /ごとし/,
      /さながら/,
      /っぽい$/,
      /めく$/,
      /げ$/,
      /いかにも/,
    ],
    keywords: ["seems", "looks like", "apparently", "hearsay"],
  },

  // Reason & cause
  {
    group: "Reason & Cause",
    patterns: [
      /^から$/,
      /^〜?ので$/,
      /^〜?のだ$/,
      /^〜?んです$/,
      /からこそ/,
      /だからこそ/,
      /だからといって/,
      /からといって/,
      /からには/,
      /せいで/,
      /せいにする/,
      /おかげで/,
      /ことから$/,
      /ものだから/,
      /ものですから/,
      /なぜなら/,
      /故に/,
      /ばこそ/,
      /以上$/,
      /^〜?なので$/,
    ],
    keywords: ["because", "reason", "cause"],
  },

  // Comparison & degree
  {
    group: "Comparison & Degree",
    patterns: [
      /^〜?より$/,
      /^〜?ほど/,
      /ほどだ/,
      /くらい$/,
      /ぐらい/,
      /すぎる/,
      /^〜?程$/,
      /比べ/,
      /比べものにならない/,
      /に等しい/,
      /並みに/,
      /丸で/,
      /まるで/,
      /余り$/,
      /あまり/,
      /たかだか/,
      /せいぜい/,
      /少し$/,
      /少しも/,
      /くらいなら/,
      /いくら/,
      /幾等/,
    ],
    keywords: ["compared to", "extent", "degree", "more than", "as much as"],
  },

  // Negation patterns
  {
    group: "Negation Patterns",
    patterns: [
      /^〜?ず$/,
      /ずに$/,
      /まい$/,
      /まいか/,
      /ない$/,
      /ないで$/,
      /ないことには/,
      /ないことはない/,
      /ないまでも/,
      /ないように/,
      /ないばかりか/,
      /っこない/,
      /ろくに〜ない/,
      /到底/,
      /必ずしも/,
    ],
    keywords: ["not ", "without", "negative", "never"],
  },

  // Particles (basic)
  {
    group: "Basic Particles",
    patterns: [
      /^〜?[はがをにでへ]$/,
      /^〜?の$/,
      /^〜?と$/,
      /^〜?も$/,
      /^〜?か$/,
      /^〜?な$/,
      /^〜?し$/,
      /^〜?で・に・前/,
    ],
    keywords: [
      "particle",
      "direct object",
      "subject marker",
      "topic marker",
    ],
  },

  // Particles (advanced/focus)
  {
    group: "Focus & Emphasis Particles",
    patterns: [
      /^〜?こそ$/,
      /^〜?さえ$/,
      /すら$/,
      /^〜?だに$/,
      /^〜?しか$/,
      /しかない$/,
      /こそ$/,
      /ばかり$/,
      /ばかりか$/,
      /ばかりに$/,
      /だけ$/,
      /だけの$/,
      /だけあって/,
      /だけに$/,
      /だけのことはある/,
      /のみ$/,
      /のみならず/,
      /きり$/,
      /くせに$/,
    ],
  },

  // Listing & enumeration
  {
    group: "Listing & Enumeration",
    patterns: [
      /たり.*form/i,
      /とか$/,
      /やら[〜~]やら/,
      /なり[〜~]なり/,
      /といい[〜~]といい/,
      /であれ[〜~]であれ/,
      /つ[〜~]つ/,
      /たりとも$/,
      /つつ$/,
    ],
    keywords: ["listing", "enumerate"],
  },

  // Conjunctions & contrast
  {
    group: "Conjunctions & Contrast",
    patterns: [
      /けれども/,
      /^〜?が$/,
      /^〜?のに$/,
      /^〜?なのに$/,
      /^〜?ものの$/,
      /ながら$/,
      /ながらも$/,
      /ながらに$/,
      /かわりに/,
      /反面/,
      /一方で/,
      /一方$/,
      /はもとより/,
      /はもちろん/,
      /それに$/,
      /それで$/,
      /そうすると$/,
      /かえって/,
      /かかわらず/,
      /にもかかわらず/,
      /とはいえ/,
    ],
    keywords: ["but ", "however", "although", "contrast", "nevertheless"],
  },

  // Extent & coverage
  {
    group: "Extent & Coverage Expressions",
    patterns: [
      /だらけ/,
      /まみれ/,
      /尽くめ/,
      /放題/,
      /ずくめ/,
      /がち$/,
      /がり$/,
      /がる$/,
      /気味$/,
      /っぱなし/,
      /っぽい/,
    ],
    keywords: ["covered in", "full of", "tendency"],
  },

  // Noun modification & relative clauses
  {
    group: "Noun Modification & Clauses",
    patterns: [
      /について/,
      /に関して/,
      /に対して/,
      /において/,
      /における/,
      /にわたって/,
      /にわたる/,
      /を通して/,
      /通じて/,
      /をめぐって/,
      /に沿って/,
      /に基づいて/,
      /をもとに/,
      /に即して/,
      /に伴って/,
      /に際して/,
      /に当たって/,
      /に先立って/,
      /によって$/,
      /によると$/,
      /によれば$/,
      /に応じて/,
      /に応えて/,
      /に従って/,
      /につき$/,
      /につけ$/,
      /につれて$/,
      /^つれて.*につれ$/,
      /にかけて/,
      /向[きけ]/,
      /^のもとで$/,
      /^を中心に$/,
      /^に於いて$/,
      /^に関わる$/,
      /^のなさ$/,
    ],
  },

  // Time & aspect
  {
    group: "Time & Aspect",
    patterns: [
      /ところ[だ(]?$/,
      /ところで$/,
      /ところに/,
      /ところを$/,
      /最中/,
      /うちに$/,
      /^[〜~]?時$/,
      /途端/,
      /か[〜~]ないかのうちに/,
      /が早いか/,
      /や否や/,
      /次第$/,
      /次第に$/,
      /一息/,
      /あっと言う間/,
      /隙に$/,
      /矢先に$/,
      /たとたん$/,
      /つつある$/,
      /一方だ$/,
      /^[〜~]?際$/,
      /^[〜~]?次第で$/,
      /^[〜~]?たっけ$/,
    ],
    keywords: ["as soon as", "while", "moment", "during"],
  },

  // Certainty & judgment
  {
    group: "Certainty & Judgment",
    patterns: [
      /に違いない/,
      /に相違ない/,
      /に決まっている/,
      /にきまっている/,
      /はず$/,
      /筈$/,
      /に過ぎない/,
      /にほかならない/,
      /わけだ$/,
      /わけがない/,
      /わけではない/,
      /訳$/,
      /訳ではない/,
      /かもしれない/,
      /かも$/,
      /限らない/,
      /限りません/,
      /とも限らない/,
      /限り$/,
      /限りだ$/,
      /限って/,
      /限らず/,
      /限り$/,
    ],
    keywords: ["certainly", "must be", "definitely", "no doubt"],
  },

  // Giving & receiving
  {
    group: "Giving & Receiving",
    patterns: [/くれる/, /もらう/, /あげる/, /貰う/, /頂[きく]/],
    keywords: ["give", "receive"],
  },

  // Formal & written style
  {
    group: "Formal & Written Style",
    patterns: [
      /にあたらない/,
      /にたえない/,
      /にたえる/,
      /に足る/,
      /に難くない/,
      /に至って/,
      /に至る/,
      /あるまじき/,
      /の至り/,
      /の極み/,
      /極まる/,
      /極まりない/,
      /を禁じ得/,
      /せんがため/,
      /ざるをえない/,
      /やまない/,
      /やむをえない/,
      /ことなしに/,
      /なくして/,
      /をもって/,
      /に相当する/,
      /をおいて/,
      /をぬきにして/,
      /をよそに/,
      /を限りに/,
      /もの[でを]$/,
      /ひとり〜/,
    ],
  },

  // Adverbs & manner
  {
    group: "Adverbs & Manner",
    patterns: [
      /ように$/,
      /ように〜/,
      /ようにする/,
      /ようになる/,
      /ように言う/,
      /ふと$/,
      /うっかり$/,
      /ぼんやり$/,
      /なんとなく$/,
      /とっさに$/,
      /通り$/,
      /まま$/,
      /ぶり$/,
    ],
  },

  // Causative & passive
  {
    group: "Causative & Passive Forms",
    patterns: [/させる/, /られる/, /される/],
    keywords: ["causative", "passive"],
  },

  // Scope & exception
  {
    group: "Scope & Exception",
    patterns: [
      /をはじめ/,
      /はさておき/,
      /はともかく/,
      /は愚か/,
      /は疎か/,
      /は言うまでもなく/,
      /ならいざ知らず/,
      /ならともかく/,
      /どころか/,
      /どころではない/,
      /まだしも/,
      /問わず/,
      /を問わず/,
      /に限り$/,
    ],
    keywords: ["let alone", "not to mention", "regardless"],
  },

  // Trigger & basis
  {
    group: "Trigger & Basis",
    patterns: [
      /きっかけ/,
      /を契機に/,
      /あっての/,
      /とあれば/,
      /とあって/,
      /にあって/,
      /にしたら/,
      /にして$/,
      /にしては/,
      /にしても/,
      /にしろ/,
      /として$/,
      /としては/,
      /とする$/,
      /にとって/,
      /にとっての/,
      /から見ると/,
      /からすると/,
      /からいうと/,
      /からして$/,
      /という/,
      /と言う/,
      /と言え/,
      /と言った/,
      /といえ/,
      /といった/,
      /とのこと/,
      /ということ/,
      /というもの/,
      /と共に/,
      /と同時に/,
      /と同様/,
      /と相まって/,
      /と思いきや/,
    ],
  },

  // Questions & wonder
  {
    group: "Questions & Uncertainty",
    patterns: [
      /かどうか/,
      /かしら/,
      /もしかして/,
      /果たして/,
      /どう[しせぞ]/,
      /どうも$/,
      /どうやら/,
      /どちらかといえば/,
      /どんな$/,
      /何$/,
      /こんな$/,
      /いくら$/,
      /まさかの/,
    ],
    keywords: ["whether", "wonder", "question"],
  },

  // Result & consequence
  {
    group: "Result & Consequence",
    patterns: [
      /それまでだ/,
      /始末だ/,
      /挙げ句/,
      /末に$/,
      /ものがある/,
      /かねない/,
      /かなわない/,
      /恐れがある/,
      /ことがある/,
      /ことだ$/,
      /ことで$/,
      /こととて/,
      /ことにする/,
      /ことになる/,
      /ことになっている/,
      /ことはない/,
      /上は$/,
      /上で$/,
      /上に$/,
      /上$/,
      /^なる$/,
      /^になる$/,
      /^にする$/,
      /^なりに$/,
    ],
  },

  // Demonstratives & reference
  {
    group: "Demonstratives & Reference",
    patterns: [
      /これ.*それ.*あれ/,
      /^Q〜でも$/,
      /^〜?など$/,
      /なんか/,
      /なんて/,
      /の?ことだから/,
    ],
  },

  // Effort & attempt
  {
    group: "Effort & Attempt",
    patterns: [
      /かけ[だるの]/,
      /かけた$/,
      /かけると/,
      /おく$/,
      /ずにはいられない/,
      /てはいられない/,
      /ものなら/,
      /ようとする/,
      /おうとすると/,
      /ほかない/,
      /よくも〜ものだ/,
      /よもや/,
      /せっかく/,
      /ついでに/,
      /できるだけ/,
      /わざとらしい/,
      /はかどる/,
      /はっちゃける/,
      /兼ね[てる]/,
      /もとい/,
      /まして/,
      /むしろ/,
      /もさることながら/,
      /ひいては/,
      /そばから/,
      /それっきり/,
    ],
  },

  // Misc set phrases
  {
    group: "Set Phrases & Expressions",
    patterns: [
      /とばかりに/,
      /と言わんばかり/,
      /ともなると/,
      /もかまわず/,
      /ものともせず/,
      /ひとつとっても/,
      /から〜まで/,
      /でなくてなんだろう/,
      /見た目はともかく/,
      /まで[にも]?ない/,
      /さもないと/,
      /さすが/,
      /ただ〜のみならず/,
      /たとえ/,
      /にしたところで/,
      /としたところで/,
      /にかけても$/,
      /であれ$/,
      /あればこそ$/,
      /いかなる/,
      /いかんによらず/,
      /ありうる/,
      /ありえる/,
      /有り得る/,
      /にひきかえ/,
      /にもまして/,
      /中に.*上に.*下に/,
      /今から思えば/,
      /今ごろになって/,
      /今さら/,
      /今では/,
      /代わりに/,
      /加えて/,
      /抜き$/,
      /〜ことか$/,
      /割りに/,
      /に越したことは/,
      /を込めて/,
      /を聞いた/,
      /事無く/,
      /儚い/,
      /兎も角/,
      /其の上/,
      /其れが/,
      /に依存/,
      /旨$/,
      /時間がたつ/,
      /気がする$/,
      /気が付いた/,
      /気になる$/,
      /為$/,
      /に反して/,
      /邪魔する/,
      /未だ/,
      /方が$/,
      /に相当する/,
      /不調法/,
      /無調法/,
      /やっぱり/,
      /たび/,
      /たまらない$/,
      /たものだ$/,
      /ものだ$/,
      /かたがた/,
      /かたわら/,
      /かと思うと/,
      /か何か/,
      /がする$/,
      /がたい$/,
      /がてら$/,
      /きらいがある/,
      /堪えない$/,
      /よりもさらに/,
      /ことに.*は/,
      /た形.*積もり/,
      /た形.*ところ/,
      /^とにかく$/,
      /^ときたら$/,
      /^辛うじて$/,
      /^みせる$/,
      /出す、出して、出した/,
      /^まで$/,
      /^までに$/,
      /^も[〜~]ば$/,
    ],
  },
];

// ── Tae Kim Section Mapping ────────────────────────────────────────────────
// Maps context_notes section names to normalized group names

function extractTaeKimGroup(contextNotes) {
  if (!contextNotes) return null;

  // Format: "004 Basic Grammar - Expressing State-of-Being: topic detail"
  const match = contextNotes.match(
    /\d+\s+(?:Basic Grammar|Essential Grammar|Special Expressions|Advanced Topics)\s*-\s*([^:]+)/,
  );
  if (match) {
    return "Tae Kim: " + match[1].trim();
  }

  // Try simpler format
  const simpleMatch = contextNotes.match(/\d+\s+(.+?):/);
  if (simpleMatch) {
    return "Tae Kim: " + simpleMatch[1].trim();
  }

  return null;
}

// ── Exercise Topic Extraction ──────────────────────────────────────────────

function extractExerciseTopic(primaryText) {
  if (!primaryText) return null;

  const text = primaryText.toLowerCase();

  if (text.includes("na-adjective")) return "Tae Kim: Adjectives";
  if (text.includes("i-adjective")) return "Tae Kim: Adjectives";
  if (text.includes("adjective")) return "Tae Kim: Adjectives";
  if (text.includes("state of being") || text.includes("state-of-being"))
    return "Tae Kim: Expressing State-of-Being";
  if (text.includes("particle")) return "Tae Kim: Introduction to Particles";
  if (text.includes("verb") && text.includes("past"))
    return "Tae Kim: Past Tense";
  if (text.includes("verb") && text.includes("negative"))
    return "Tae Kim: Negative Verbs";
  if (text.includes("ru-verb") || text.includes("u-verb"))
    return "Tae Kim: Verb Basics";
  if (text.includes("verb")) return "Tae Kim: Verb Basics";
  if (text.includes("noun")) return "Tae Kim: Introduction to Particles";
  if (text.includes("explanatory"))
    return "Tae Kim: Noun-related Particles";
  if (text.includes("casual") || text.includes("polite"))
    return "Tae Kim: Using Adverbs and Gobi";
  if (text.includes("conjugat") || text.includes("past tense"))
    return "Tae Kim: Past Tense";
  if (text.includes("together with") || text.includes("from something") || text.includes("agreement") || text.includes("informing"))
    return "Tae Kim: Using Adverbs and Gobi";
  if (text.includes("simplest") || text.includes("shortest") || text.includes("what is"))
    return "Tae Kim: Verb Basics";

  return null;
}

// ── Sentence Grammar Extraction ────────────────────────────────────────────
// For Tae Kim Athos items (example sentences), extract grammar concept from
// the explanation text

function extractSentenceGrammarGroup(item) {
  const explanation = (item.explanation || "").toLowerCase();
  const text = item.primary_text || "";

  // Check for highlighted grammar patterns in explanation
  // Order matters: more specific checks first
  if (explanation.includes("potential form") || explanation.includes("able to speak") || explanation.includes("able to do"))
    return "Potential & Ability";
  if (explanation.includes("conditional") || /\bたら\b/.test(explanation))
    return "Conditional Forms";
  if (explanation.includes("passive form") || explanation.includes("passive voice"))
    return "Causative & Passive Forms";
  if (explanation.includes("causative") || explanation.includes("make someone"))
    return "Causative & Passive Forms";
  if (
    explanation.includes("want to") ||
    explanation.includes("たい") ||
    explanation.includes("desire")
  )
    return "Desire & Volition";
  if (explanation.includes("ください") || explanation.includes("ちょうだい") || explanation.includes("casual request"))
    return "Honorific & Polite Speech";
  if (explanation.includes("polite form") || explanation.includes("humble") || explanation.includes("honorif") || explanation.includes("keigo"))
    return "Honorific & Polite Speech";
  if (
    /\bmust\b/.test(explanation) ||
    explanation.includes("have to") ||
    /\bshould\b/.test(explanation)
  )
    return "Obligation & Prohibition";
  if (explanation.includes("because") || /\breason\b/.test(explanation))
    return "Reason & Cause";
  if (explanation.includes("only ") || explanation.includes("しか"))
    return "Focus & Emphasis Particles";
  if (explanation.includes("might") || explanation.includes("かも"))
    return "Certainty & Judgment";
  if (explanation.includes("suggestion") || explanation.includes("how about"))
    return "Conditional Forms";
  if (
    /\bseems?\b/.test(explanation) ||
    explanation.includes("apparently") ||
    explanation.includes("look like")
  )
    return "Appearance & Hearsay";
  if (
    explanation.includes("te-form") ||
    explanation.includes("て form") ||
    explanation.includes("progressive")
  )
    return "Te-form Patterns";
  if (explanation.includes("比") || explanation.includes("compared"))
    return "Comparison & Degree";
  if (explanation.includes("giving") || explanation.includes("receiving"))
    return "Giving & Receiving";
  if (explanation.includes("particle") || explanation.includes("topic marker") || explanation.includes("subject marker"))
    return "Basic Particles";
  if (explanation.includes("conjugat") || explanation.includes("verb stem") || explanation.includes("polite form"))
    return "Verb Conjugation";
  if (explanation.includes("adjective"))
    return "Adjectives";
  if (explanation.includes("adverb"))
    return "Adverbs & Manner";
  if (explanation.includes("transitive") || explanation.includes("intransitive"))
    return "Causative & Passive Forms";
  if (explanation.includes("quotation") || explanation.includes("quoting") || explanation.includes("と言"))
    return "Quotation & Hearsay";
  if (explanation.includes("nominaliz") || explanation.includes("noun clause"))
    return "Noun Modification & Clauses";

  // Check primary_text for common grammar markers
  if (text.includes("ください") || text.includes("下さい"))
    return "Honorific & Polite Speech";
  if (text.includes("座りな") || text.includes("食べな"))
    return "Honorific & Polite Speech";
  if (/申[もう]します/.test(text) || text.includes("お願いします"))
    return "Honorific & Polite Speech";
  if (text.includes("たら") || text.includes("ればいい"))
    return "Conditional Forms";
  if (text.includes("から") || text.includes("ので")) return "Reason & Cause";
  if (text.includes("ている") || text.includes("ていた") || text.includes("てある"))
    return "Te-form Patterns";
  if (text.includes("じゃった") || text.includes("しちまった") || text.includes("ちゃった"))
    return "Te-form Patterns";
  if (text.includes("にくい") || text.includes("やすい"))
    return "Compound Verbs";
  if (text.includes("なった") || text.includes("にする") || text.includes("にします"))
    return "Result & Consequence";
  if (text.includes("たり"))
    return "Listing & Enumeration";
  if (text.includes("っけ"))
    return "Sentence-ending Particles";
  if (text.includes("のに"))
    return "Conjunctions & Contrast";

  return null;
}

// ── Pattern Matcher ────────────────────────────────────────────────────────

function matchPatternGroup(primaryText, meaning) {
  const text = (primaryText || "").trim();
  const meaningLower = (meaning || "").toLowerCase();

  for (const rule of PATTERN_RULES) {
    // Check primary_text patterns
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return rule.group;
      }
    }

    // Check meaning keywords
    if (rule.keywords) {
      for (const kw of rule.keywords) {
        if (meaningLower.includes(kw.toLowerCase())) {
          return rule.group;
        }
      }
    }
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("Loading grammar data...");
const grammar = JSON.parse(readFileSync(GRAMMAR_PATH, "utf-8"));
console.log(`Loaded ${grammar.length} grammar items`);

const report = {
  total: grammar.length,
  byMethod: {
    contextNotes: 0,
    exerciseTopic: 0,
    sentenceAnalysis: 0,
    patternMatch: 0,
    fallback: 0,
  },
  groupDistribution: {},
  unmatched: [],
};

let modified = 0;

for (const item of grammar) {
  let group = null;
  let method = "fallback";

  const decks = item.source_decks || [];
  const isJlptDeck = decks.includes(
    "Full_Japanese_Study_Deck_JLPT_N5N1_vocabkanji__more.apkg",
  );
  const isAthos = decks.includes("TAE_KIM_complete_guide_deck_Athos.apkg");
  const isExerciseDeck = decks.includes(
    "Tae_Kims_Grammar_Guide_Vocabulary_Grammar_and_Exercises.apkg",
  );
  const isTaeKimGuide = decks.includes(
    "Tae_Kims_Guide_to_Japanese_Grammar.apkg",
  );

  // Pass 1: Extract from context_notes
  if (item.context_notes) {
    group = extractTaeKimGroup(item.context_notes);
    if (group) method = "contextNotes";
  }

  // Pass 2: Exercise topic extraction
  if (!group && isExerciseDeck && !item.context_notes) {
    group = extractExerciseTopic(item.primary_text);
    if (group) method = "exerciseTopic";
  }

  // Pass 3: Tae Kim sentence grammar extraction
  if (!group && (isAthos || isTaeKimGuide)) {
    group = extractSentenceGrammarGroup(item);
    if (group) method = "sentenceAnalysis";
  }

  // Pass 4: Pattern-based matching (JLPT deck + fallback for others)
  if (!group) {
    group = matchPatternGroup(item.primary_text, item.meaning);
    if (group) method = "patternMatch";
  }

  // Pass 5: Fallback
  if (!group) {
    // Try explanation text for any remaining items
    if (item.explanation) {
      group = extractSentenceGrammarGroup(item);
      if (group) method = "sentenceAnalysis";
    }
  }

  if (!group) {
    group = "General Grammar";
    method = "fallback";
    report.unmatched.push({
      key: item.item_key,
      text: (item.primary_text || "").replace(/\n/g, " ").slice(0, 60),
      deck: (decks[0] || "").slice(0, 40),
    });
  }

  item.lesson_group = group;
  report.byMethod[method]++;
  report.groupDistribution[group] = (report.groupDistribution[group] || 0) + 1;
  modified++;
}

// Write updated grammar
console.log(`Writing ${modified} updates to grammar.json...`);
writeFileSync(GRAMMAR_PATH, JSON.stringify(grammar, null, 2), "utf-8");

// Write report
mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = "scripts/reports/grammar-groups.json";

const sortedGroups = Object.entries(report.groupDistribution)
  .sort((a, b) => b[1] - a[1])
  .reduce((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {});

writeFileSync(
  reportPath,
  JSON.stringify(
    {
      ...report,
      groupDistribution: sortedGroups,
      unmatched: report.unmatched.slice(0, 50),
      unmatchedTotal: report.unmatched.length,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log("\n=== Grammar Group Assignment Report ===");
console.log(`Total items:         ${report.total}`);
console.log(`By method:`);
console.log(`  context_notes:     ${report.byMethod.contextNotes}`);
console.log(`  exercise topic:    ${report.byMethod.exerciseTopic}`);
console.log(`  sentence analysis: ${report.byMethod.sentenceAnalysis}`);
console.log(`  pattern match:     ${report.byMethod.patternMatch}`);
console.log(`  fallback:          ${report.byMethod.fallback}`);
console.log(`\nGroup distribution:`);
Object.entries(sortedGroups).forEach(([k, v]) => {
  console.log(`  ${v.toString().padStart(4)} ${k}`);
});
console.log(`\nUnmatched items:     ${report.unmatched.length}`);
console.log(`Full report: ${reportPath}`);
