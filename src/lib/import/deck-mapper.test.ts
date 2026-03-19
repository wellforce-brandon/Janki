import { describe, expect, it } from "vitest";
import { renderCardContent } from "./deck-mapper";

describe("renderCardContent", () => {
	it("should replace field placeholders with values", () => {
		const fields = { Front: "Hello", Back: "World" };
		const template = "<div>{{Front}}</div>";
		expect(renderCardContent(fields, template)).toBe("<div>Hello</div>");
	});

	it("should handle multiple fields", () => {
		const fields = { Question: "What?", Answer: "This" };
		const template = "{{Question}} - {{Answer}}";
		expect(renderCardContent(fields, template)).toBe("What? - This");
	});

	it("should strip FrontSide reference", () => {
		const fields = { Front: "Q" };
		const template = "{{FrontSide}}<hr>{{Back}}";
		const result = renderCardContent(fields, template);
		expect(result).not.toContain("FrontSide");
	});

	it("should strip unresolved mustache tags", () => {
		const fields = { Front: "Hello" };
		const template = "{{Front}} {{type:Back}} {{hint:Extra}}";
		const result = renderCardContent(fields, template);
		expect(result).toBe("Hello  ");
	});

	it("should handle Anki field separator correctly", () => {
		const fields = { Front: "日本語", Back: "Japanese" };
		const template = "<span>{{Front}}</span>";
		expect(renderCardContent(fields, template)).toBe("<span>日本語</span>");
	});

	it("should handle empty fields", () => {
		const fields = {};
		const template = "{{Front}}";
		expect(renderCardContent(fields, template)).toBe("");
	});
});
