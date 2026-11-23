import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS, seasonOf, toGameDate } from "./calendar";
import { getCrop, getFertilizer } from "./catalog";
import { daysToGrow } from "./growth";
import { QUALITIES, expectedItemsPerPlant, qualityOdds, sellPrice } from "./quality";
import type { CropData, Location, Planting, PlayerSettings, Range } from "./types";

/** Estufa e Ilha Gengibre: sem estações, as plantas vivem até serem arrancadas */
export function ignoresSeasons(location: Location): boolean {
	return location !== "farm";
}

export function canPlant(crop: CropData, location: Location, day: number): boolean {
	if (ignoresSeasons(location)) return true;
	return !crop.indoorOnly && crop.seasons.includes(seasonOf(day));
}

/**
 * Último dia em que a planta está viva.
 * Na fazenda ela morre no fim da última estação seguida em que pode crescer
 * (ex.: milho plantado no verão vive até o fim do outono).
 */
export function lastAliveDay(crop: CropData, planting: Pick<Planting, "location" | "day" | "removedAfter">): number {
	const removed = planting.removedAfter ?? Infinity;
	if (ignoresSeasons(planting.location)) return removed;

	const { year, season } = toGameDate(planting.day);
	let last = season;
	while (last < SEASONS.length - 1 && crop.seasons.includes(SEASONS[last + 1]!)) last++;
	const seasonEnd = year * DAYS_PER_YEAR + (last + 1) * DAYS_PER_SEASON - 1;
	return Math.min(seasonEnd, removed);
}

export interface HarvestEvent {
	kind: "harvest";
	planting: Planting;
	crop: CropData;
	day: number;
	/** Número da colheita desta plantação, a partir de 0 */
	index: number;
	/** true para rebrota ou replantio (sem custo de semente) */
	repeat: boolean;
	items: Range;
	revenue: Range;
}

export interface CostEvent {
	kind: "cost";
	planting: Planting;
	crop: CropData;
	day: number;
	/** "plant" = plantio original; "replant" = replantio automático */
	reason: "plant" | "replant";
	amount: number;
}

export type ScheduleEvent = HarvestEvent | CostEvent;

export type Economy = Pick<PlayerSettings, "farmingLevel" | "tiller" | "agriculturist" | "irrigatedPaddy">;

/** Valor de uma colheita: mínimo garantido e média esperada */
export function harvestValue(crop: CropData, amount: number, fertilizerQuality: number, eco: Economy): { items: Range; revenue: Range } {
	const expected = expectedItemsPerPlant(crop);
	const odds = qualityOdds(eco.farmingLevel, fertilizerQuality);
	const basePrice = sellPrice(crop, "normal", eco);

	// Só o primeiro item rola qualidade; os extras são sempre normais
	const firstItem = QUALITIES.reduce((sum, q) => sum + odds[q] * sellPrice(crop, q, eco), 0);
	const minItems = crop.yield.min * amount;
	const minRevenue = minItems * basePrice;
	const expRevenue = Math.floor(amount * (firstItem + basePrice * (expected - 1)));

	return {
		items: { min: minItems, max: Math.round(expected * amount) },
		revenue: { min: minRevenue, max: Math.max(minRevenue, expRevenue) },
	};
}

export function seedCost(crop: CropData, amount: number): number {
	return (crop.seedPrice ?? 0) * amount;
}

/**
 * Todos os eventos (custos e colheitas) de uma plantação até `untilDay`.
 * Plantas sem fim (Estufa/Ilha) são geradas só até o dia pedido.
 */
export function* plantingEvents(planting: Planting, eco: Economy, untilDay: number): Generator<ScheduleEvent> {
	const crop = getCrop(planting.cropId);
	if (!crop || planting.day > untilDay) return;

	const fertilizer = getFertilizer(planting.fertilizerId);
	const plantCost = seedCost(crop, planting.amount) + (fertilizer.price ?? 0) * planting.amount;
	yield { kind: "cost", planting, crop, day: planting.day, reason: "plant", amount: plantCost };

	const grow = daysToGrow(crop, fertilizer, eco);
	const alive = lastAliveDay(crop, planting);
	const lastDay = Math.min(alive, untilDay);
	const value = harvestValue(crop, planting.amount, fertilizer.quality, eco);
	const replants = planting.replant && !crop.regrow;

	let day = planting.day + grow;
	for (let index = 0; day <= lastDay; index++) {
		yield { kind: "harvest", planting, crop, day, index, repeat: index > 0, ...value };

		if (crop.regrow) {
			day += crop.regrow;
		} else if (replants && day + grow <= alive) {
			// Replanta só se a próxima colheita ainda acontecer
			yield { kind: "cost", planting, crop, day, reason: "replant", amount: seedCost(crop, planting.amount) };
			day += grow;
		} else {
			break;
		}
	}
}

/** A planta continua produzindo depois da primeira colheita? */
export function producesRepeatedly(planting: Planting): boolean {
	const crop = getCrop(planting.cropId);
	return !!crop && (!!crop.regrow || (planting.replant && !crop.regrow));
}
