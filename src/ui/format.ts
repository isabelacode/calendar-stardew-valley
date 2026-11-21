import { SEASONS } from "../domain/calendar";
import type { CropData, Location, Range } from "../domain/types";

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

const numberFormat = new Intl.NumberFormat("pt-BR");

export function num(n: number): string {
	return numberFormat.format(Math.round(n));
}

/** 1234 → "1.234g"; com sinal → "+1.234g" / "−1.234g" */
export function gold(n: number, signed = false): string {
	const text = `${numberFormat.format(Math.abs(Math.round(n)))}g`;
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
	return `https://pt.stardewvalleywiki.com/${encodeURIComponent(crop.name.replace(/ /g, "_"))}`;
}

export function percent(p: number): string {
	return `${Math.round(p * 100)}%`;
}
