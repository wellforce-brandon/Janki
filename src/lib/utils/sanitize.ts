import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
	"b",
	"i",
	"u",
	"br",
	"div",
	"span",
	"p",
	"img",
	"ruby",
	"rt",
	"rp",
	"table",
	"tr",
	"td",
	"th",
	"ul",
	"ol",
	"li",
	"sup",
	"sub",
	"hr",
];

const ALLOWED_ATTR = ["class", "style", "src", "alt", "width", "height"];

export function sanitizeCardHtml(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		ALLOW_DATA_ATTR: false,
	});
}

/**
 * Convert WaniKani custom tags to styled spans before DOMPurify sanitization.
 * DOMPurify 3.x strips non-standard HTML elements even when listed in ALLOWED_TAGS,
 * so we convert them to standard <span> elements with CSS classes.
 */
const WK_TAG_MAP: Record<string, string> = {
	radical: "wk-radical",
	kanji: "wk-kanji",
	vocabulary: "wk-vocabulary",
	reading: "wk-reading",
	ja: "wk-ja",
};

function convertWkTags(html: string): string {
	let result = html;
	for (const [tag, className] of Object.entries(WK_TAG_MAP)) {
		result = result
			.replace(new RegExp(`<${tag}>`, "gi"), `<span class="${className}">`)
			.replace(new RegExp(`</${tag}>`, "gi"), "</span>");
	}
	return result;
}

export function sanitizeMnemonicHtml(html: string): string {
	const converted = convertWkTags(html);
	return DOMPurify.sanitize(converted, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		ALLOW_DATA_ATTR: false,
	});
}
