import { DAYS_PER_SEASON, SEASONS } from "./calendar";
import { NO_FERTILIZER } from "./catalog";
import { daysToGrow } from "./growth";
import { plantingEvents, type Economy } from "./schedule";
import type { CropData, Location, Planting } from "./types";

export interface CropStats {
	/** Dias até a primeira colheita (com os bônus do jogador) */
	grow: number;
	/** Colheitas numa janela de estações, plantando no 1º dia */
	harvests: number;
	/** Lucro médio por dia por planta (null se a semente não é vendida) */
	profitPerDay: number | null;
	/** Lucro médio por dia, ignorando o preço da semente */
	revenuePerDay: number;
}

/**
 * Simula 1 semente plantada no primeiro dia em que a cultura cresce,
 * replantando sempre, até o fim das estações dela (culturas só de ambiente
 * fechado são medidas na Estufa durante 28 dias).
 */
export function cropStats(crop: CropData, eco: Economy): CropStats {
	const indoor = crop.indoorOnly || crop.seasons.length === 0;
	const location: Location = indoor ? "greenhouse" : "farm";
	const firstSeason = indoor ? 0 : SEASONS.indexOf(crop.seasons[0]!);
	const start = firstSeason * DAYS_PER_SEASON;
	const window = indoor ? DAYS_PER_SEASON : crop.seasons.length * DAYS_PER_SEASON;
	const end = start + window - 1;

	const planting: Planting = {
		id: "stats",
		cropId: crop.id,
		location,
		day: start,
		amount: 1,
		fertilizerId: NO_FERTILIZER.id,
		replant: true,
		removedAfter: indoor ? end : null,
	};

	let cost = 0;
	let revenue = 0;
	let harvests = 0;
	let lastHarvest = start;
	for (const ev of plantingEvents(planting, eco, end)) {
		if (ev.kind === "cost") {
			cost += ev.amount;
		} else {
			revenue += ev.revenue.max;
			harvests++;
			lastHarvest = ev.day;
		}
	}

	const daysUsed = Math.max(1, lastHarvest - start);
	return {
		grow: daysToGrow(crop, NO_FERTILIZER, eco),
		harvests,
		profitPerDay: crop.seedPrice === null ? null : round1((revenue - cost) / daysUsed),
		revenuePerDay: round1(revenue / daysUsed),
	};
}

function round1(n: number): number {
	return Math.round(n * 10) / 10;
}
