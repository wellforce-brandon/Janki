export type Theme = "dark" | "light" | "system";

let theme = $state<Theme>("dark");

export function getTheme(): Theme {
	return theme;
}

export function setTheme(value: Theme) {
	theme = value;
	if (
		value === "dark" ||
		(value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
	) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}
}
