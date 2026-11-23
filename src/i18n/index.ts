import type { Text } from "../domain/types";
import { en } from "./en";
import { pt, type Dict } from "./pt";

export type Lang = keyof Text;
export const LANGS: readonly Lang[] = ["pt", "en"];

const DICTS: Record<Lang, Dict> = { pt, en };
const LOCALES: Record<Lang, string> = { pt: "pt-BR", en: "en-US" };

let current: Lang = "pt";

export function isLang(v: unknown): v is Lang {
	return LANGS.includes(v as Lang);
}

/** Idioma do navegador: português se começar com "pt", senão inglês */
export function detectLang(): Lang {
	const langs = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
	return langs.some((l) => l?.toLowerCase().startsWith("pt")) ? "pt" : "en";
}

/** Troca o idioma usado por t()/tx() e atualiza <html lang>, título e descrição */
export function applyLang(lang: Lang): void {
	current = lang;
	const dict = DICTS[lang];
	document.documentElement.lang = LOCALES[lang];
	document.title = dict.meta.title;
	document.querySelector('meta[name="description"]')?.setAttribute("content", dict.meta.description);
}

export function lang(): Lang {
	return current;
}

/** Locale do Intl (números, ordenação) */
export function locale(): string {
	return LOCALES[current];
}

/** Textos da interface no idioma atual */
export function t(): Dict {
	return DICTS[current];
}

/** Texto bilíngue dos dados do jogo no idioma atual */
export function tx(text: Text): string {
	return text[current];
}
