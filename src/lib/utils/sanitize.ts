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
