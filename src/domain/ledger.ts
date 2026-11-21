import { plantingEvents, type CostEvent, type Economy, type HarvestEvent } from "./schedule";
import type { Location, Planting, Range } from "./types";

export interface DayEntry {
	planted: CostEvent[];
	replanted: CostEvent[];
	harvests: HarvestEvent[];
	profit: Range;
}

export interface Totals {
	cost: number;
	revenue: Range;
	profit: Range;
	seedsPlanted: number;
	items: Range;
}

export interface Ledger {
	days: Map<number, DayEntry>;
	totals: Totals;
}

function emptyTotals(): Totals {
	return { cost: 0, revenue: { min: 0, max: 0 }, profit: { min: 0, max: 0 }, seedsPlanted: 0, items: { min: 0, max: 0 } };
}

function entryFor(days: Map<number, DayEntry>, day: number): DayEntry {
	let entry = days.get(day);
	if (!entry) {
		entry = { planted: [], replanted: [], harvests: [], profit: { min: 0, max: 0 } };
		days.set(day, entry);
	}
	return entry;
}

/**
 * Tudo o que acontece num local entre `from` e `to` (inclusive).
 * Considera plantações de qualquer data anterior, porque plantas da
 * Estufa/Ilha podem continuar produzindo por anos.
 */
export function buildLedger(plantings: readonly Planting[], location: Location, from: number, to: number, eco: Economy): Ledger {
	const days = new Map<number, DayEntry>();
	const totals = emptyTotals();

	for (const planting of plantings) {
		if (planting.location !== location || planting.day > to) continue;

		for (const ev of plantingEvents(planting, eco, to)) {
			if (ev.day < from) continue;
			const entry = entryFor(days, ev.day);

			if (ev.kind === "cost") {
				(ev.reason === "plant" ? entry.planted : entry.replanted).push(ev);
				entry.profit.min -= ev.amount;
				entry.profit.max -= ev.amount;
				totals.cost += ev.amount;
				totals.seedsPlanted += planting.amount;
			} else {
				entry.harvests.push(ev);
				entry.profit.min += ev.revenue.min;
				entry.profit.max += ev.revenue.max;
				totals.revenue.min += ev.revenue.min;
				totals.revenue.max += ev.revenue.max;
				totals.items.min += ev.items.min;
				totals.items.max += ev.items.max;
			}
		}
	}

	totals.profit.min = totals.revenue.min - totals.cost;
	totals.profit.max = totals.revenue.max - totals.cost;
	return { days, totals };
}

/** Totais de um trecho de um livro-caixa já calculado */
export function sumRange(ledger: Ledger, from: number, to: number): Totals {
	const totals = emptyTotals();
	for (const [day, entry] of ledger.days) {
		if (day < from || day > to) continue;
		for (const ev of [...entry.planted, ...entry.replanted]) {
			totals.cost += ev.amount;
			totals.seedsPlanted += ev.planting.amount;
		}
		for (const ev of entry.harvests) {
			totals.revenue.min += ev.revenue.min;
			totals.revenue.max += ev.revenue.max;
			totals.items.min += ev.items.min;
			totals.items.max += ev.items.max;
		}
	}
	totals.profit.min = totals.revenue.min - totals.cost;
	totals.profit.max = totals.revenue.max - totals.cost;
	return totals;
}
