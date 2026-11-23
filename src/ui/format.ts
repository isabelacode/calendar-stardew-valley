import { SEASONS, toGameDate, weekdayIndex } from "../domain/calendar";
import type { CropData, Location, Range } from "../domain/types";
import { lang, locale, t } from "../i18n";

const BASE = import.meta.env.BASE_URL;

export const img = {
	crop: (crop: CropData) => `${BASE}images/crops/${crop.id}.png`,
	seed: (crop: CropData) => `${BASE}images/seeds/${crop.id}.png`,
	fertilizer: (id: string) => `${BASE}images/fertilizer/${id}.png`,
	season: (index: number) => `${BASE}images/seasons/${SEASONS[index]}.png`,
	portrait: (name: string) => `${BASE}images/people/${name}.png`,
	festival: () => `${BASE}images/flag.gif`,
	location: (loc: Location) => `${BASE}images/${{ farm: "scarecrow", greenhouse: "greenhouse", island: "island" }[loc]}.png`,
	ui: (name: string) => `${BASE}images/ui/${name}.png`,
	logo: () => `${BASE}images/logo.png`,
};

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(): Intl.NumberFormat {
	const loc = locale();
	let format = numberFormats.get(loc);
	if (!format) numberFormats.set(loc, (format = new Intl.NumberFormat(loc)));
	return format;
}

export function num(n: number): string {
	return numberFormat().format(Math.round(n));
}

/** 1234 → "1.234g" (pt) / "1,234g" (en); com sinal → "+1.234g" / "−1.234g" */
export function gold(n: number, signed = false): string {
	const text = `${numberFormat().format(Math.abs(Math.round(n)))}g`;
	if (n < 0) return `−${text}`;
	return signed && n > 0 ? `+${text}` : text;
}

export function goldClass(n: number): string {
	return n < 0 ? "gold neg" : n === 0 ? "gold zero" : "gold";
}

export function isRange(r: Range): boolean {
	return Math.round(r.min) !== Math.round(r.max);
}

export function wikiUrl(crop: CropData): string {
	const host = lang() === "pt" ? "pt.stardewvalleywiki.com" : "stardewvalleywiki.com";
	return `https://${host}/${encodeURIComponent(crop.name[lang()].replace(/ /g, "_"))}`;
}

export function percent(p: number): string {
	return `${Math.round(p * 100)}%`;
}

export function seasonName(index: number): string {
	return t().seasons[SEASONS[index]!];
}

export function locationName(loc: Location): string {
	return t().locations[loc];
}

/** "3 de Primavera" / "Spring 3", com dia da semana e ano opcionais */
export function formatDate(abs: number, opts: { year?: boolean; weekday?: boolean } = {}): string {
	const d = toGameDate(abs);
	let text = t().date.day(d.day, seasonName(d.season));
	if (opts.weekday) text = `${t().weekdaysLong[weekdayIndex(abs)]}, ${text}`;
	if (opts.year) text += `, ${t().date.year(d.year + 1)}`;
	return text;
}
