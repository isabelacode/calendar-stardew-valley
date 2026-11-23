import type { SeasonId } from "./types";

export const DAYS_PER_SEASON = 28;
export const SEASONS: readonly SeasonId[] = ["spring", "summer", "fall", "winter"];
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

export interface GameDate {
	/** Ano a partir de 0 */
	year: number;
	/** Índice da estação, 0–3 */
	season: number;
	/** Dia do mês, 1–28 */
	day: number;
}

/** Dia absoluto (0 = Primavera 1, Ano 1) → data do jogo */
export function toGameDate(abs: number): GameDate {
	const year = Math.floor(abs / DAYS_PER_YEAR);
	const inYear = abs - year * DAYS_PER_YEAR;
	const season = Math.floor(inYear / DAYS_PER_SEASON);
	return { year, season, day: inYear - season * DAYS_PER_SEASON + 1 };
}

export function toAbsDay(year: number, season: number, day: number): number {
	return year * DAYS_PER_YEAR + season * DAYS_PER_SEASON + (day - 1);
}

export function seasonOf(abs: number): SeasonId {
	return SEASONS[toGameDate(abs).season]!;
}

export function seasonRange(year: number, season: number): [first: number, last: number] {
	const first = toAbsDay(year, season, 1);
	return [first, first + DAYS_PER_SEASON - 1];
}

export function yearRange(year: number): [first: number, last: number] {
	const first = year * DAYS_PER_YEAR;
	return [first, first + DAYS_PER_YEAR - 1];
}

export function weekdayIndex(abs: number): number {
	return abs % 7;
}
