/**
 * Wraps matching substrings in <mark> tags for search result highlighting.
 * Returns the original text if query is empty. Escapes HTML in text first.
 */
export function highlightMatch(text: string, query: string): string {
	if (!query.trim()) return escapeHtml(text);

	const escaped = escapeHtml(text);
	const queryEscaped = escapeHtml(query.trim());
	const regex = new RegExp(`(${regexEscape(queryEscaped)})`, "gi");
	return escaped.replace(regex, "<mark>$1</mark>");
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function regexEscape(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
