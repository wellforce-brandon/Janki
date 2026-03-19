import { describe, expect, it } from "vitest";
import { sanitizeCardHtml } from "./sanitize";

describe("sanitizeCardHtml", () => {
	it("should strip script tags", () => {
		const result = sanitizeCardHtml('<div>hello</div><script>alert("xss")</script>');
		expect(result).not.toContain("<script>");
		expect(result).toContain("hello");
	});

	it("should preserve safe HTML", () => {
		const html = '<div class="card"><b>Front</b><br><ruby>漢字<rt>かんじ</rt></ruby></div>';
		const result = sanitizeCardHtml(html);
		expect(result).toContain("<b>Front</b>");
		expect(result).toContain("<ruby>");
		expect(result).toContain("<rt>");
	});

	it("should strip event handlers", () => {
		const result = sanitizeCardHtml('<img src="test.jpg" onerror="alert(1)">');
		expect(result).not.toContain("onerror");
		expect(result).toContain("src");
	});

	it("should strip data attributes", () => {
		const result = sanitizeCardHtml('<div data-evil="payload">safe</div>');
		expect(result).not.toContain("data-evil");
		expect(result).toContain("safe");
	});

	it("should handle empty string", () => {
		expect(sanitizeCardHtml("")).toBe("");
	});
});
